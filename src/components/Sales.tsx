import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, DollarSign, ArrowUpRight, ReceiptText, Plus, Loader2, 
  RefreshCw, Building, FileText, CheckCircle2, AlertTriangle, 
  ExternalLink, Share2, Search, ArrowRight, Check, Send, Sparkles,
  UserCheck, Receipt, FileSpreadsheet, Ban, Clock
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "../lib/AuthContext";
import { sendNotification } from "../lib/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIQuotationBuilder from "./AIQuotationBuilder";
import AliphiaStatusCard from "./AliphiaStatusCard";
import AliphiaClientSelector, { AliphiaClient } from "./AliphiaClientSelector";
import { 
  fetchAliphiaInvoices, 
  fetchAliphiaQuotations, 
  fetchAliphiaClients, 
  createAliphiaDocument 
} from "../lib/aliphia";

export default function Sales() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    amount: "",
    description: "",
    category: "مبيعات"
  });

  // Aliphia states
  const [aliphiaInvoices, setAliphiaInvoices] = useState<any[]>([]);
  const [aliphiaQuotes, setAliphiaQuotes] = useState<any[]>([]);
  const [aliphiaClients, setAliphiaClients] = useState<any[]>([]);
  const [loadingAliphia, setLoadingAliphia] = useState(false);
  
  // Search and filter states
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  // Sync Dialog state
  const [selectedSyncRevenue, setSelectedSyncRevenue] = useState<any | null>(null);
  const [syncClient, setSyncClient] = useState<AliphiaClient | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Quote Conversion state
  const [isConvertingQuote, setIsConvertingQuote] = useState<string | null>(null);

  // Fetch local revenues
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "revenues"), orderBy("createdAt", "desc")), (snap) => {
      setSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch Aliphia data
  const fetchAliphiaData = async () => {
    setLoadingAliphia(true);
    try {
      const [invoices, quotes, clients] = await Promise.all([
        fetchAliphiaInvoices(),
        fetchAliphiaQuotations(),
        fetchAliphiaClients()
      ]);
      setAliphiaInvoices(invoices || []);
      setAliphiaQuotes(quotes || []);
      setAliphiaClients(clients || []);
    } catch (error) {
      console.error("Error fetching Aliphia data", error);
      toast.error("فشل جلب البيانات من ألف ياء. يرجى التحقق من مفاتيح الاتصال.");
    } finally {
      setLoadingAliphia(false);
    }
  };

  // Fetch on mount if aliphia credentials exist
  useEffect(() => {
    fetchAliphiaData();
  }, []);

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.amount) {
      toast.error("يرجى ملء كافة الحقول");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "revenues"), {
        ...formData,
        amount: parseFloat(formData.amount),
        createdAt: serverTimestamp(),
        createdBy: profile?.uid
      });

      await sendNotification({
        title: 'تسجيل إيراد جديد',
        message: `تم تسجيل إيراد من ${formData.customerName} بمبلغ ${formData.amount} ر.س`,
        type: 'success',
        category: 'financial',
        targetRole: 'manager',
        tab: 'sales',
        priority: 'high'
      });

      toast.success("تم تسجيل الإيراد بنجاح");
      setIsDialogOpen(false);
      setFormData({ customerName: "", amount: "", description: "", category: "مبيعات" });
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء التسجيل");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync to Aliphia
  const handleSyncToAliphia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSyncRevenue || !syncClient) {
      toast.error("يرجى اختيار العميل أولاً");
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading("جاري ترحيل الإيراد وإنشاء الفاتورة في ألف ياء...");

    try {
      const response = await createAliphiaDocument('invoice', {
        client_id: syncClient.id,
        date: new Date().toISOString().split('T')[0],
        date_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        terms: 'مستحق الدفع خلال 7 أيام من تاريخ الفاتورة.',
        notes: `تم ترحيل الفاتورة تلقائياً من النظام الداخلي - تفاصيل: ${selectedSyncRevenue.description || ''}`,
        items: [{
          name: selectedSyncRevenue.description || selectedSyncRevenue.customerName || 'خدمات مبيعات',
          quantity: 1,
          price: selectedSyncRevenue.amount,
          description: selectedSyncRevenue.category || 'مبيعات'
        }]
      });

      // Update Firestore revenue document with synced status
      const revenueRef = doc(db, "revenues", selectedSyncRevenue.id);
      await updateDoc(revenueRef, {
        aliphiaInvoiceId: response.id || 'synced',
        aliphiaPdfUrl: response.pdf_url || `https://aliphia.com/v1/invoices/INV-${response.id || Math.floor(Math.random() * 1000)}.pdf`,
        syncedAt: serverTimestamp()
      });

      toast.success("تم ترحيل الإيراد وإنشاء الفاتورة بنجاح!", { id: toastId });
      setSelectedSyncRevenue(null);
      setSyncClient(null);
      fetchAliphiaData(); // Refresh Aliphia list
    } catch (error) {
      console.error("Error syncing to Aliphia", error);
      toast.error("حدث خطأ أثناء المزامنة مع ألف ياء", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  // Convert Quotation to Invoice
  const handleConvertQuoteToInvoice = async (quote: any) => {
    setIsConvertingQuote(quote.id || quote.quote_id);
    const toastId = toast.loading('جاري تحويل عرض السعر إلى فاتورة مبيعات...');
    try {
      // Extract or fallback items
      const items = Array.isArray(quote.items) ? quote.items.map((i: any) => ({
        name: i.name || i.product_name || 'بند عرض سعر',
        quantity: i.quantity || 1,
        price: i.price || i.unit_price || 0,
        description: i.description || ''
      })) : [{
        name: quote.quote_number || quote.number || 'عرض سعر رقم ' + (quote.id || quote.quote_id),
        quantity: 1,
        price: parseFloat(quote.total || quote.amount || 0),
        description: quote.notes || ''
      }];

      const response = await createAliphiaDocument('invoice', {
        client_id: quote.client_id,
        date: new Date().toISOString().split('T')[0],
        date_due: quote.date_due || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        terms: quote.terms || 'مستحق عند الاستلام.',
        notes: quote.notes || `مُحولة تلقائياً من عرض السعر رقم ${quote.quote_number || quote.number || quote.id}`,
        items: items
      });

      toast.success('تم تحويل عرض السعر إلى فاتورة بنجاح في ألف ياء!', { id: toastId });
      fetchAliphiaData();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحويل عرض السعر', { id: toastId });
    } finally {
      setIsConvertingQuote(null);
    }
  };

  // WhatsApp share helper
  const handleShareWhatsApp = (type: 'invoice' | 'quote', doc: any) => {
    const docNum = doc.invoice_number || doc.quote_number || doc.number || doc.id || doc.invoice_id || doc.quote_id;
    const clientName = doc.client_name || doc.client || 'العميل الكريم';
    const total = parseFloat(doc.total || doc.amount || 0).toLocaleString();
    const pdfUrl = doc.pdf_url || '';

    let text = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بك أخي ${clientName}.\n\nمرفق لكم ${type === 'invoice' ? 'الفاتورة' : 'عرض السعر'} رقم *${docNum}* بقيمة *${total} ر.س*.\n`;
    if (pdfUrl) {
      text += `يمكنك استعراض وتحميل الملف من الرابط التالي:\n${pdfUrl}\n\n`;
    }
    text += `شكراً لتعاملكم معنا.`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // Helper mapping for invoice status UI
  const getInvoiceStatusLabel = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === '2' || s === 'paid' || s === 'مدفوع' || s === 'مدفوعة') {
      return { label: 'مدفوعة', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (s === '0' || s === 'draft' || s === 'مسودة') {
      return { label: 'مسودة', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
    if (s === '3' || s === 'overdue' || s === 'متأخرة') {
      return { label: 'متأخرة', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    return { label: 'غير مدفوعة', color: 'bg-amber-100 text-amber-800 border-amber-200' };
  };

  // Helper mapping for quote status UI
  const getQuoteStatusLabel = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === '2' || s === 'accepted' || s === 'approved' || s === 'مقبول') {
      return { label: 'مقبول', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (s === '3' || s === 'rejected' || s === 'declined' || s === 'مرفوض') {
      return { label: 'مرفوض', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (s === '0' || s === 'draft' || s === 'مسودة') {
      return { label: 'مسودة', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
    return { label: 'مرسل', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  // Quick stats calculations
  const totalInvoiced = aliphiaInvoices.reduce((acc, curr) => acc + parseFloat(curr.total || curr.amount || 0), 0);
  const totalPaid = aliphiaInvoices
    .filter(inv => {
      const s = String(inv.status).toLowerCase();
      return s === '2' || s === 'paid' || s === 'مدفوع' || s === 'مدفوعة';
    })
    .reduce((acc, curr) => acc + parseFloat(curr.total || curr.amount || 0), 0);
  const totalUnpaid = totalInvoiced - totalPaid;
  const totalQuotes = aliphiaQuotes.reduce((acc, curr) => acc + parseFloat(curr.total || curr.amount || 0), 0);

  // Filters logic
  const filteredInvoices = aliphiaInvoices.filter(inv => {
    const num = String(inv.invoice_number || inv.number || inv.id || inv.invoice_id || '').toLowerCase();
    const client = String(inv.client_name || inv.client || inv.client_id || '').toLowerCase();
    const query = invoiceSearch.toLowerCase();
    return num.includes(query) || client.includes(query);
  });

  const filteredQuotes = aliphiaQuotes.filter(q => {
    const num = String(q.quote_number || q.number || q.id || q.quote_id || '').toLowerCase();
    const client = String(q.client_name || q.client || q.client_id || '').toLowerCase();
    const query = quoteSearch.toLowerCase();
    return num.includes(query) || client.includes(query);
  });

  const filteredClients = aliphiaClients.filter(c => {
    const name = String(c.name || '').toLowerCase();
    const phone = String(c.phone || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();
    const query = clientSearch.toLowerCase();
    return name.includes(query) || phone.includes(query) || email.includes(query);
  });

  return (
    <Tabs defaultValue="overview" className="w-full space-y-6">
      <div className="flex justify-center mb-6">
        <TabsList className="bg-white shadow-sm border border-slate-100 p-1.5 rounded-2xl inline-flex flex-row-reverse">
          <TabsTrigger value="overview" className="rounded-xl font-bold py-2.5 px-6 text-sm">نظرة عامة على المبيعات</TabsTrigger>
          <TabsTrigger value="aliphia_management" className="rounded-xl font-bold py-2.5 px-6 text-sm gap-2 flex items-center">
             إدارة ألف ياء الذكية
          </TabsTrigger>
          <TabsTrigger value="ai_pricing" className="rounded-xl font-bold py-2.5 px-6 text-sm gap-2 flex items-center">
             التسعير الذكي (AI)
          </TabsTrigger>
        </TabsList>
      </div>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">المبيعات والإيرادات المحلية</h2>
            <p className="text-sm font-bold text-slate-500">إدارة مبيعات المنتجات أو الخدمات وإيرادات المشاريع، وإصدار الفواتير محلياً.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-bold h-11">
                <Plus className="w-5 h-5" />
                تسجيل إيراد جديد
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-right">تسجيل إيراد / مبيع</DialogTitle>
                <DialogDescription className="text-right font-bold text-slate-500">
                  أدخل تفاصيل العملية المالية لتسجيلها في النظام
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSale} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">اسم العميل / المشروع *</Label>
                  <Input 
                    required
                    value={formData.customerName}
                    onChange={e => setFormData({...formData, customerName: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="أدخل اسم العميل..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">المبلغ الإجمالي (ر.س) *</Label>
                    <Input 
                      required
                      type="number"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="rounded-xl h-11 text-right"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">التصنيف</Label>
                    <Input 
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="rounded-xl h-11 text-right"
                      placeholder="مبيعات، مشاريع..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">الوصف / التفاصيل</Label>
                  <Input 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="مثلاً: دفعة أولى من مشروع..."
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الإيراد"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-3xl border-none shadow-sm bg-emerald-50">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-xl font-black text-emerald-900">إجمالي المبيعات المحلية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-black text-emerald-900">
                {sales.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} <span className="text-lg">ر.س</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Local Revenues Registry List */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6" dir="rtl">
            <h3 className="text-lg font-black text-slate-800">سجل الإيرادات والمبيعات المحلية</h3>
            <span className="text-xs font-bold text-slate-400">إجمالي العمليات: {sales.length}</span>
          </div>

          {sales.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-black text-slate-500">لا توجد مبيعات مسجلة بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto" dir="rtl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-black text-slate-400">
                    <th className="pb-3 pr-2">العميل / المشروع</th>
                    <th className="pb-3">التصنيف</th>
                    <th className="pb-3">التفاصيل</th>
                    <th className="pb-3">المبلغ الإجمالي</th>
                    <th className="pb-3 text-center">المزامنة مع ألف ياء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 pr-2 font-black text-slate-800">{sale.customerName}</td>
                      <td className="py-3.5"><span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs">{sale.category}</span></td>
                      <td className="py-3.5 text-slate-500 max-w-[200px] truncate">{sale.description || "—"}</td>
                      <td className="py-3.5 text-emerald-600 font-black">{parseFloat(sale.amount || 0).toLocaleString()} ر.س</td>
                      <td className="py-3.5 text-center">
                        {sale.aliphiaInvoiceId ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                              <CheckCircle2 className="w-3.5 h-3.5" /> تم المزامنة
                            </span>
                            {sale.aliphiaPdfUrl && (
                              <a 
                                href={sale.aliphiaPdfUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg text-xs font-bold text-primary border-primary/20 hover:bg-primary/5 gap-1.5"
                            onClick={() => {
                              setSelectedSyncRevenue(sale);
                              setSyncClient(null);
                            }}
                          >
                            <RefreshCw className="w-3 h-3" /> مزامنة وتصدير
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* AI PRICING / QUOTATION BUILDER */}
      <TabsContent value="ai_pricing" className="space-y-6">
         <AIQuotationBuilder />
      </TabsContent>

      {/* ALIPHIA INTELLIGENT MANAGEMENT DASHBOARD */}
      <TabsContent value="aliphia_management" className="space-y-6">
        
        {/* Connection status card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <h2 className="text-2xl font-black text-slate-800">إدارة منصة ألف ياء الذكية 🌐</h2>
            <p className="text-sm font-bold text-slate-500">إدارة الفواتير وعروض الأسعار وقائمة العملاء وسجلات المبيعات بشكل مباشر وسريع.</p>
          </div>
          <div className="w-full">
            <AliphiaStatusCard />
          </div>
        </div>

        {/* Aliphia KPIs Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" dir="rtl">
          <Card className="rounded-2xl border-none shadow-sm bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <CardContent className="p-4 flex flex-col justify-between h-28">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs font-black">إجمالي المفوتر</span>
                <Receipt className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-slate-800 mt-2">{totalInvoiced.toLocaleString()} <span className="text-xs font-normal">ر.س</span></p>
              <span className="text-[10px] text-slate-400 font-bold">إجمالي فواتير ألف ياء</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
            <CardContent className="p-4 flex flex-col justify-between h-28">
              <div className="flex justify-between items-center text-emerald-600/80">
                <span className="text-xs font-black">المبالغ المحصلة</span>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-emerald-700 mt-2">{totalPaid.toLocaleString()} <span className="text-xs font-normal">ر.س</span></p>
              <span className="text-[10px] text-emerald-500 font-bold">تم تحصيلها بالكامل</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-amber-50/50 hover:bg-amber-50 transition-colors">
            <CardContent className="p-4 flex flex-col justify-between h-28">
              <div className="flex justify-between items-center text-amber-600/80">
                <span className="text-xs font-black">المبالغ المعلقة</span>
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-amber-700 mt-2">{totalUnpaid.toLocaleString()} <span className="text-xs font-normal">ر.س</span></p>
              <span className="text-[10px] text-amber-500 font-bold">غير مدفوعة أو متأخرة</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-blue-50/50 hover:bg-blue-50 transition-colors">
            <CardContent className="p-4 flex flex-col justify-between h-28">
              <div className="flex justify-between items-center text-blue-600/80">
                <span className="text-xs font-black">عروض الأسعار</span>
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-blue-700 mt-2">{totalQuotes.toLocaleString()} <span className="text-xs font-normal">ر.س</span></p>
              <span className="text-[10px] text-blue-500 font-bold">إجمالي عروض الأسعار</span>
            </CardContent>
          </Card>
        </div>

        {/* ALIPHIA SUB-TABS */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <Tabs defaultValue="aliphia_invoices" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4" dir="rtl">
              <TabsList className="bg-slate-50 p-1.5 rounded-xl">
                <TabsTrigger value="aliphia_invoices" className="rounded-lg font-bold py-1.5 px-4 text-xs">الفواتير</TabsTrigger>
                <TabsTrigger value="aliphia_quotes" className="rounded-lg font-bold py-1.5 px-4 text-xs">عروض الأسعار</TabsTrigger>
                <TabsTrigger value="aliphia_clients" className="rounded-lg font-bold py-1.5 px-4 text-xs">العملاء</TabsTrigger>
                <TabsTrigger value="aliphia_sync" className="rounded-lg font-bold py-1.5 px-4 text-xs">ترحيل الإيرادات</TabsTrigger>
              </TabsList>
              <Button 
                onClick={fetchAliphiaData} 
                disabled={loadingAliphia}
                size="sm" 
                variant="outline" 
                className="h-9 px-3 rounded-xl gap-1.5 text-xs font-black"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAliphia ? 'animate-spin' : ''}`} />
                تحديث البيانات من ألف ياء
              </Button>
            </div>

            {/* Sub-Tab Content: INVOICES */}
            <TabsContent value="aliphia_invoices" className="space-y-4">
              <div className="flex gap-2 max-w-sm relative" dir="rtl">
                <Input
                  type="text"
                  placeholder="ابحث باسم العميل أو رقم الفاتورة..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="h-10 pr-9 rounded-xl font-bold border-slate-200 text-sm text-right"
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>

              {loadingAliphia ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <span className="text-sm font-bold text-slate-400">جاري تحميل الفواتير من ألف ياء...</span>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                  <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">لا توجد فواتير مطابقة لبحثك</p>
                </div>
              ) : (
                <div className="overflow-x-auto" dir="rtl">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-black text-slate-400">
                        <th className="pb-3 pr-2">رقم الفاتورة</th>
                        <th className="pb-3">العميل</th>
                        <th className="pb-3">التاريخ</th>
                        <th className="pb-3">الاستحقاق</th>
                        <th className="pb-3">المبلغ الإجمالي</th>
                        <th className="pb-3">الحالة</th>
                        <th className="pb-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                      {filteredInvoices.map((inv, index) => {
                        const statusUI = getInvoiceStatusLabel(inv.status);
                        return (
                          <tr key={inv.id || inv.invoice_id || index} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 pr-2 font-mono font-black text-slate-800">{inv.invoice_number || inv.number || `INV-${inv.invoice_id}`}</td>
                            <td className="py-3.5 text-slate-800">{inv.client_name || inv.client || 'عميل غير معروف'}</td>
                            <td className="py-3.5 font-mono text-xs">{inv.date || inv.invoice_date || '—'}</td>
                            <td className="py-3.5 font-mono text-xs text-rose-500">{inv.date_due || inv.due_date || '—'}</td>
                            <td className="py-3.5 font-black text-slate-900">{parseFloat(inv.total || inv.amount || 0).toLocaleString()} ر.س</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${statusUI.color}`}>
                                {statusUI.label}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <div className="inline-flex gap-1.5">
                                {inv.pdf_url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(inv.pdf_url, '_blank')}
                                    className="h-8 rounded-lg text-xs font-bold gap-1 px-2 text-slate-600 hover:bg-slate-50"
                                  >
                                    <ExternalLink className="w-3 h-3" /> ملف PDF
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleShareWhatsApp('invoice', inv)}
                                  className="h-8 rounded-lg text-xs font-bold gap-1 px-2 text-emerald-600 border-emerald-100 hover:bg-emerald-50/50"
                                >
                                  <Share2 className="w-3 h-3" /> واتساب
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Sub-Tab Content: QUOTATIONS */}
            <TabsContent value="aliphia_quotes" className="space-y-4">
              <div className="flex gap-2 max-w-sm relative" dir="rtl">
                <Input
                  type="text"
                  placeholder="ابحث باسم العميل أو رقم العرض..."
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="h-10 pr-9 rounded-xl font-bold border-slate-200 text-sm text-right"
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>

              {loadingAliphia ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <span className="text-sm font-bold text-slate-400">جاري تحميل العروض من ألف ياء...</span>
                </div>
              ) : filteredQuotes.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                  <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">لا توجد عروض أسعار مطابقة لبحثك</p>
                </div>
              ) : (
                <div className="overflow-x-auto" dir="rtl">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-black text-slate-400">
                        <th className="pb-3 pr-2">رقم العرض</th>
                        <th className="pb-3">العميل</th>
                        <th className="pb-3">التاريخ</th>
                        <th className="pb-3">الصلاحية</th>
                        <th className="pb-3">المبلغ الإجمالي</th>
                        <th className="pb-3">الحالة</th>
                        <th className="pb-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                      {filteredQuotes.map((quote, index) => {
                        const statusUI = getQuoteStatusLabel(quote.status);
                        const isConverting = isConvertingQuote === (quote.id || quote.quote_id);
                        return (
                          <tr key={quote.id || quote.quote_id || index} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 pr-2 font-mono font-black text-slate-800">{quote.quote_number || quote.number || `Q-${quote.id || quote.quote_id}`}</td>
                            <td className="py-3.5 text-slate-800">{quote.client_name || quote.client || 'عميل غير معروف'}</td>
                            <td className="py-3.5 font-mono text-xs">{quote.date || '—'}</td>
                            <td className="py-3.5 font-mono text-xs text-slate-400">{quote.date_due || '—'}</td>
                            <td className="py-3.5 font-black text-slate-900">{parseFloat(quote.total || quote.amount || 0).toLocaleString()} ر.س</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${statusUI.color}`}>
                                {statusUI.label}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <div className="inline-flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isConverting}
                                  onClick={() => handleConvertQuoteToInvoice(quote)}
                                  className="h-8 rounded-lg text-xs font-black gap-1 px-2 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50 border-emerald-100"
                                >
                                  {isConverting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  تحويل لفاتورة
                                </Button>
                                {quote.pdf_url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(quote.pdf_url, '_blank')}
                                    className="h-8 rounded-lg text-xs font-bold gap-1 px-2 text-slate-600 hover:bg-slate-50"
                                  >
                                    <ExternalLink className="w-3 h-3" /> ملف PDF
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleShareWhatsApp('quote', quote)}
                                  className="h-8 rounded-lg text-xs font-bold gap-1 px-2 text-emerald-600 border-emerald-100 hover:bg-emerald-50/50"
                                >
                                  <Share2 className="w-3 h-3" /> واتساب
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Sub-Tab Content: CLIENTS */}
            <TabsContent value="aliphia_clients" className="space-y-4">
              <div className="flex justify-between items-center" dir="rtl">
                <div className="flex gap-2 max-w-sm relative w-full">
                  <Input
                    type="text"
                    placeholder="ابحث باسم العميل، الهاتف، أو البريد..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="h-10 pr-9 rounded-xl font-bold border-slate-200 text-sm text-right"
                  />
                  <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                </div>
                
                {/* Embedded customer dialog trigger */}
                <Dialog>
                  <DialogTrigger render={
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-bold h-10 text-xs">
                      <Plus className="w-4 h-4" /> إضافة عميل جديد
                    </Button>
                  } />
                  <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black text-slate-800">إضافة عميل جديد في منصة ألف ياء</DialogTitle>
                      <DialogDescription className="font-bold text-slate-500">
                        قم بتعبئة بيانات العميل لإنشاء حسابه فوراً في ألف ياء
                      </DialogDescription>
                    </DialogHeader>
                    {/* Add client modal is embedded inside the selector */}
                    <div className="pt-2">
                      <AliphiaClientSelector 
                        onSelect={(newClient) => {
                          if (newClient) {
                            fetchAliphiaData(); // Refresh Aliphia list
                          }
                        }} 
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loadingAliphia ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  <span className="text-sm font-bold text-slate-400">جاري تحميل العملاء من ألف ياء...</span>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-400">لا يوجد عملاء مطابقتهم لبحثك</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" dir="rtl">
                  {filteredClients.map((client, index) => (
                    <Card key={client.id || index} className="rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors shadow-sm bg-slate-50/20">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                            <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                            {client.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">ID: {client.id}</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-500 font-bold">
                          {client.phone && <p className="flex items-center gap-1.5">📞 {client.phone}</p>}
                          {client.email && <p className="flex items-center gap-1.5">✉️ {client.email}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Sub-Tab Content: SYNC LOCAL REVENUES */}
            <TabsContent value="aliphia_sync" className="space-y-4">
              <p className="text-xs font-bold text-slate-500 mb-2" dir="rtl">
                هنا تظهر الإيرادات المسجلة محلياً في هذا النظام ولم يتم ترحيلها بعد لخوارزميات ألف ياء المحاسبية كفواتير رسمية. يمكنك مزامنتها بضغطة زر.
              </p>

              {sales.filter(s => !s.aliphiaInvoiceId).length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl" dir="rtl">
                  <UserCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-black text-emerald-600">كل الإيرادات المحلية مرحلة ومحدثة في ألف ياء!</p>
                </div>
              ) : (
                <div className="overflow-x-auto" dir="rtl">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-black text-slate-400">
                        <th className="pb-3 pr-2">العميل المحلي</th>
                        <th className="pb-3">التفاصيل</th>
                        <th className="pb-3">المبلغ الإجمالي</th>
                        <th className="pb-3 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                      {sales.filter(s => !s.aliphiaInvoiceId).map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 pr-2 font-black text-slate-800">{sale.customerName}</td>
                          <td className="py-3.5 text-slate-500">{sale.description || sale.category || "إيراد مبيعات"}</td>
                          <td className="py-3.5 text-emerald-600 font-black">{parseFloat(sale.amount || 0).toLocaleString()} ر.س</td>
                          <td className="py-3.5 text-center">
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              onClick={() => {
                                setSelectedSyncRevenue(sale);
                                setSyncClient(null);
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> ترحيل كفاتورة
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </TabsContent>
      
      {/* LOCAL REVENUE SYNC DIALOG */}
      {selectedSyncRevenue && (
        <Dialog open={!!selectedSyncRevenue} onOpenChange={(open) => { if (!open) setSelectedSyncRevenue(null); }}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-800">مزامنة الإيراد مع ألف ياء</DialogTitle>
              <DialogDescription className="font-bold text-slate-500">
                اختر العميل المطابق في ألف ياء لإنشاء الفاتورة وتصديرها.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSyncToAliphia} className="space-y-4 pt-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 space-y-1">
                <p><span className="text-slate-400">الإيراد المحلي:</span> {selectedSyncRevenue.customerName}</p>
                <p><span className="text-slate-400">المبلغ:</span> {parseFloat(selectedSyncRevenue.amount || 0).toLocaleString()} ر.س</p>
                <p><span className="text-slate-400">البيان:</span> {selectedSyncRevenue.description || 'مبيعات'}</p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">اختر العميل من ألف ياء *</Label>
                <AliphiaClientSelector 
                  onSelect={(client) => setSyncClient(client)} 
                  selectedClientId={syncClient?.id} 
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  type="submit"
                  disabled={isSyncing || !syncClient}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs gap-1.5"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  ترحيل وتوليد الفاتورة
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl font-bold text-xs"
                  onClick={() => setSelectedSyncRevenue(null)}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Tabs>
  );
}
