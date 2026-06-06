import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ShareDialog } from '@/components/ShareDialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  TrendingUp, DollarSign, ArrowUpRight, ReceiptText, Plus, Loader2, 
  RefreshCw, Building, FileText, CheckCircle2, AlertTriangle, 
  ExternalLink, Share2, Search, ArrowRight, Check, Send, Sparkles,
  UserCheck, Receipt, FileSpreadsheet, Ban, Clock, Users, Percent, Calculator,
  Wallet, Trash2
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, where, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "../lib/AuthContext";
import { sendNotification } from "../lib/notifications";
import { logActivity } from "../lib/activity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SmartOfferBot from "./SmartOfferBot";
import AIQuotationBuilder from "./AIQuotationBuilder";
import AliphiaStatusCard from "./AliphiaStatusCard";
import AliphiaClientSelector, { AliphiaClient } from "./AliphiaClientSelector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  fetchAliphiaInvoices, 
  fetchAliphiaQuotations, 
  fetchAliphiaClients, 
  createAliphiaDocument,
  fetchAliphiaInvoiceDetails,
  fetchAliphiaQuotationDetails
} from "../lib/aliphia";

export default function Sales() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<any>(null);
  const [shareType, setShareType] = useState<'invoice'|'quote'>('invoice');
  const [localSearchTerm, setLocalSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    customerName: "",
    amount: "",
    description: "",
    category: "مبيعات",
    projectId: "",
    paymentMethod: "cash" as "cash" | "transfer",
    bankAccountId: "",
    isProjectIncome: false,
    customDate: new Date().toISOString().split('T')[0]
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

  // Aliphia details state
  const [selectedAliphiaDoc, setSelectedAliphiaDoc] = useState<any | null>(null);
  const [aliphiaDocDetails, setAliphiaDocDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailDocType, setDetailDocType] = useState<'invoice' | 'quote'>('invoice');

  const handleOpenDocDetails = async (doc: any, type: 'invoice' | 'quote') => {
    setSelectedAliphiaDoc(doc);
    setDetailDocType(type);
    setLoadingDetails(true);
    setAliphiaDocDetails(null);
    try {
      const docId = doc.id || doc.invoice_id || doc.quote_id;
      if (!docId) {
        throw new Error("معرّف المستند غير موجود");
      }
      
      let details;
      if (type === 'invoice') {
        details = await fetchAliphiaInvoiceDetails(docId);
      } else {
        details = await fetchAliphiaQuotationDetails(docId);
      }
      setAliphiaDocDetails(details);
    } catch (err: any) {
      console.error("Error fetching doc details:", err);
      toast.error(err.message || "فشل جلب تفاصيل المستند من ألف ياء");
      setSelectedAliphiaDoc(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Aliphia Creator States
  const [docType, setDocType] = useState<'invoice' | 'quotation'>('invoice');
  const [creatorClient, setCreatorClient] = useState<AliphiaClient | null>(null);
  const [docDetails, setDocDetails] = useState({
    date: new Date().toISOString().split('T')[0],
    date_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    terms: "مستحق الدفع عند الاستلام.",
    notes: "شكراً لتعاملكم معنا."
  });
  const [docItems, setDocItems] = useState<any[]>([
    { name: "", description: "", quantity: 1, price: "" }
  ]);
  const [creatorSuccessData, setCreatorSuccessData] = useState<any | null>(null);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  // Fetch local projects and bank accounts
  useEffect(() => {
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubProjects();
      unsubBanks();
    };
  }, []);

  // Fetch local revenues (represented as income transactions)
  useEffect(() => {
    const q = query(collection(db, "transactions"), where("type", "==", "income"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dateDisplay: data.date?.toDate?.()?.toLocaleString('ar-SA') || data.date
        };
      });
      
      // Sort manually in JS to prevent index issues
      list.sort((a: any, b: any) => {
        const dateA = a.date?.toDate?.() || new Date(a.date || a.createdAt || 0);
        const dateB = b.date?.toDate?.() || new Date(b.date || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setSales(list);
    }, (error) => {
      console.error("Firestore Listen Error in Sales.tsx:", error);
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
    if (!formData.amount) {
      toast.error("يرجى إدخال المبلغ");
      return;
    }

    if (!formData.isProjectIncome && !formData.customerName) {
      toast.error("يرجى إدخال اسم العميل");
      return;
    }

    if (formData.isProjectIncome && !formData.projectId) {
      toast.error("يرجى اختيار المشروع");
      return;
    }

    if (formData.paymentMethod === 'transfer' && !formData.bankAccountId) {
      toast.error("يرجى اختيار الحساب البنكي المستلم");
      return;
    }

    setIsSubmitting(true);
    try {
      let clientOrProjectName = formData.customerName;
      if (formData.isProjectIncome && formData.projectId) {
        const proj = projects.find(p => p.id === formData.projectId);
        clientOrProjectName = proj ? proj.title : "مشروع محلي";
      }

      const txDescription = formData.description 
        ? `${clientOrProjectName}: ${formData.description}`
        : `إيراد مبيعات - ${clientOrProjectName}`;

      const parsedDate = formData.customDate ? new Date(formData.customDate) : new Date();

      await addDoc(collection(db, "transactions"), {
        type: 'income',
        amount: parseFloat(formData.amount),
        description: txDescription,
        category: formData.category || 'مبيعات',
        projectId: formData.isProjectIncome && formData.projectId ? formData.projectId : null,
        paymentMethod: formData.paymentMethod,
        bankAccountId: formData.paymentMethod === 'transfer' ? formData.bankAccountId : null,
        status: 'approved', // Manual income is auto-approved by default for transactions
        customerName: clientOrProjectName,
        date: parsedDate,
        createdAt: serverTimestamp(),
        createdBy: profile?.uid || 'unknown'
      });

      await logActivity(
        'تسجيل إيراد جديد',
        `تم تسجيل إيراد بقيمة ${formData.amount} ر.س: ${txDescription}`,
        'success',
        'financial',
        profile?.uid
      );

      await sendNotification({
        title: 'تسجيل إيراد جديد',
        message: `تم تسجيل إيراد من ${clientOrProjectName} بمبلغ ${formData.amount} ر.س`,
        type: 'success',
        category: 'financial',
        targetRole: 'manager',
        tab: 'sales',
        priority: 'high'
      });

      toast.success("تم تسجيل الإيراد بنجاح");
      setIsDialogOpen(false);
      setFormData({
        customerName: "",
        amount: "",
        description: "",
        category: "مبيعات",
        projectId: "",
        paymentMethod: "cash",
        bankAccountId: "",
        isProjectIncome: false,
        customDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء التسجيل");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف هذا الإيراد؟")) return;
    try {
      await deleteDoc(doc(db, "transactions", saleId));
      toast.success("تم حذف الإيراد بنجاح");
      await logActivity(
        "حذف إيراد محلي",
        `تم حذف حركة الإيراد رقم ${saleId}`,
        "warning",
        "financial",
        profile?.uid
      );
    } catch (error) {
      console.error("Delete sale error:", error);
      toast.error("فشل في حذف الإيراد. قد لا تملك الصلاحية الكافية.");
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
      const revenueRef = doc(db, "transactions", selectedSyncRevenue.id);
      await updateDoc(revenueRef, {
        aliphiaInvoiceId: response.id || 'synced',
        aliphiaPdfUrl: response.pdf_url || `https://aliphia.com/v1/invoices/INV-${response.id || Math.floor(Math.random() * 1000)}.pdf`,
        invoiceNumber: response.invoice_number || `INV-${response.id || Math.floor(Math.random() * 1000)}`,
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

  const addDocItemRow = () => {
    setDocItems([...docItems, { name: "", description: "", quantity: 1, price: "" }]);
  };

  const removeDocItemRow = (index: number) => {
    if (docItems.length === 1) {
      toast.info("يجب أن يحتوي المستند على بند واحد على الأقل");
      return;
    }
    setDocItems(docItems.filter((_, i) => i !== index));
  };

  const updateDocItemField = (index: number, field: string, value: any) => {
    const updated = [...docItems];
    updated[index][field] = value;
    setDocItems(updated);
  };

  const handleCreateAliphiaDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorClient) {
      toast.error("يرجى اختيار العميل أولاً");
      return;
    }
    if (docItems.some(item => !item.name || !item.price || !item.quantity)) {
      toast.error("يرجى ملء كافة حقول البنود المطلوبة (الاسم، الكمية، السعر)");
      return;
    }

    if (docType === 'invoice' && profile?.role !== 'manager') {
      toast.error("صلاحية إنشاء الفواتير محصورة بالمدير فقط. يمكنك إنشاء عروض الأسعار.");
      return;
    }

    setIsCreatingDoc(true);
    const toastId = toast.loading(`جاري توليد ${docType === 'invoice' ? 'الفاتورة' : 'عرض السعر'} في منصة ألف ياء...`);

    try {
      const response = await createAliphiaDocument(docType, {
        client_id: creatorClient.id,
        date: docDetails.date,
        date_due: docDetails.date_due,
        terms: docDetails.terms,
        notes: docDetails.notes,
        items: docItems.map(item => ({
          name: item.name,
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price),
          description: item.description
        }))
      });

      if (response && (response.id || response.success)) {
        toast.success("تم إنشاء المستند بنجاح!", { id: toastId });
        setCreatorSuccessData({
          id: response.id || 'synced',
          pdf_url: response.pdf_url || `https://aliphia.com/v1/invoices/INV-${response.id || Math.floor(Math.random() * 1000)}.pdf`,
          number: response.invoice_number || response.quote_number || `DOC-${response.id}`,
          clientName: creatorClient.name,
          total: docItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 1), 0) * 1.15
        });

        // Audit Trail
        await logActivity(
          `إنشاء ${docType === 'invoice' ? 'فاتورة' : 'عرض سعر'}`,
          `تم إنشاء ${docType === 'invoice' ? 'فاتورة' : 'عرض سعر'} للعميل ${creatorClient.name} بقيمة إجمالية شاملة الضريبة`,
          'success',
          'financial',
          profile?.uid
        );
        
        fetchAliphiaData(); // Refresh Aliphia lists in background
      } else {
        throw new Error("استجابة غير صالحة من ألف ياء");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "حدث خطأ أثناء الاتصال بالخادم لإنشاء المستند", { id: toastId });
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // Convert Quotation to Invoice
  const handleConvertQuoteToInvoice = async (quote: any) => {
    setIsConvertingQuote(quote.id || quote.quote_id);
    const toastId = toast.loading('جاري تحويل عرض السعر إلى فاتورة مبيعات...');
    try {
      const items = Array.isArray(quote.items) ? quote.items.map((i: any) => ({
        name: i.name || i.product_name || 'بند عرض سعر',
        quantity: i.quantity || 1,
        price: i.price || i.unit_price || 0,
        description: i.description || ''
      })) : [{
        name: quote.quote_number || 'عرض سعر رقم ' + (quote.quote_id || quote.id),
        quantity: 1,
        price: parseFloat(quote.quote_total || quote.total || quote.amount || 0),
        description: quote.quote_customers_notes || quote.notes || ''
      }];

      const response = await createAliphiaDocument('invoice', {
        client_id: quote.client_id,
        date: new Date().toISOString().split('T')[0],
        date_due: quote.quote_date_expires || quote.date_due || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        terms: quote.quote_terms || quote.terms || 'مستحق عند الاستلام.',
        notes: quote.quote_customers_notes || quote.notes || `مُحولة تلقائياً من عرض السعر رقم ${quote.quote_number || quote.id}`,
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
    const total = parseFloat(doc.invoice_total || doc.quote_total || doc.total || doc.amount || 0).toLocaleString();
    const pdfUrl = doc.pdf_url || '';

    let text = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بك أخي ${clientName}.\n\nمرفق لكم ${type === 'invoice' ? 'الفاتورة' : 'عرض السعر'} رقم *${docNum}* بقيمة *${total} ر.س*.\n`;
    if (pdfUrl) {
      text += `يمكنك استعراض وتحميل الملف من الرابط التالي:\n${pdfUrl}\n\n`;
    }
    text += `شكراً لتعاملكم معنا.`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  const handleShareLocalWhatsApp = (sale: any) => {
    const clientName = sale.customerName || 'العميل الكريم';
    const amount = parseFloat(sale.amount || 0).toLocaleString();
    const desc = sale.description || 'إيراد خدمات / مبيعات';
    const date = sale.dateDisplay || new Date(sale.date?.toDate?.() || Date.now()).toLocaleDateString('ar-SA');

    let text = `السلام عليكم ورحمة الله وبركاته،\nنشكركم لتعاملكم معنا.\n\nتم تسجيل الدفعة المستلمة بنجاح في نظامنا المالي:\n`;
    text += `• *العميل/المشروع:* ${clientName}\n`;
    text += `• *المبلغ المستلم:* ${amount} ر.س\n`;
    text += `• *التاريخ:* ${date}\n`;
    text += `• *التفاصيل:* ${desc}\n\n`;
    text += `سعداء بخدمتكم دائماً.`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
  };

  // Helper mapping for invoice status UI
  const getInvoiceStatusLabel = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === '4' || s === 'paid' || s === 'مدفوع' || s === 'مدفوعة') {
      return { label: 'مدفوعة', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (s === '1' || s === 'draft' || s === 'مسودة') {
      return { label: 'مسودة', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
    if (s === '3' || s === 'overdue' || s === 'متأخرة') {
      return { label: 'متأخرة', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    return { label: 'غير مدفوعة', color: 'bg-amber-100 text-amber-800 border-amber-200' }; // s === '2'
  };

  // Helper mapping for quote status UI
  const getQuoteStatusLabel = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === '4' || s === 'accepted' || s === 'approved' || s === 'مقبول') {
      return { label: 'مقبول', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (s === '3' || s === 'rejected' || s === 'declined' || s === 'مرفوض') {
      return { label: 'مرفوض', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (s === '0' || s === 'draft' || s === 'مسودة') {
      return { label: 'مسودة', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
    return { label: 'مرسل', color: 'bg-blue-100 text-blue-800 border-blue-200' }; // s === '1'
  };

  // Quick stats calculations
  const totalInvoiced = aliphiaInvoices.reduce((acc, curr) => acc + parseFloat(curr.invoice_total || curr.total || curr.amount || 0), 0);
  const totalPaid = aliphiaInvoices
    .filter(inv => {
      const s = String(inv.invoice_status_id || inv.status).toLowerCase();
      return s === '4' || s === 'paid' || s === 'مدفوع' || s === 'مدفوعة';
    })
    .reduce((acc, curr) => acc + parseFloat(curr.invoice_total || curr.total || curr.amount || 0), 0);
  const totalUnpaid = totalInvoiced - totalPaid;
  const totalQuotes = aliphiaQuotes.reduce((acc, curr) => acc + parseFloat(curr.quote_total || curr.total || curr.amount || 0), 0);

  // Local Sales stats
  const localCashTotal = sales
    .filter(s => s.paymentMethod === 'cash')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const localTransferTotal = sales
    .filter(s => s.paymentMethod === 'transfer')
    .reduce((sum, s) => sum + (s.amount || 0), 0);

  const localMonthCount = sales.filter(s => {
    const d = s.date?.toDate?.() || new Date(s.date || 0);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

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

  const filteredLocalSales = sales.filter(s => {
    const query = localSearchTerm.toLowerCase();
    const customer = (s.customerName || "").toLowerCase();
    const desc = (s.description || "").toLowerCase();
    const cat = (s.category || "").toLowerCase();
    return customer.includes(query) || desc.includes(query) || cat.includes(query);
  });

  const chartData = React.useMemo(() => {
    const months = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const monthName = d.toLocaleString('ar-SA', { month: 'short' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, name: monthName, quotes: 0, invoices: 0, paid: 0 });
    }

    // Aggregate quotes
    aliphiaQuotes.forEach(q => {
      const dateStr = q.quote_date_created || q.date;
      if (!dateStr || dateStr.startsWith('0000')) return;
      const monthKey = dateStr.substring(0, 7); // 'YYYY-MM'
      const m = months.find(item => item.key === monthKey);
      if (m) {
        m.quotes += parseFloat(q.quote_total || q.total || q.amount || 0);
      }
    });

    // Aggregate invoices
    aliphiaInvoices.forEach(inv => {
      const dateStr = inv.invoice_date_created || inv.invoice_date || inv.date;
      if (!dateStr || dateStr.startsWith('0000')) return;
      const monthKey = dateStr.substring(0, 7); // 'YYYY-MM'
      const m = months.find(item => item.key === monthKey);
      if (m) {
        const val = parseFloat(inv.invoice_total || inv.total || inv.amount || 0);
        m.invoices += val;
        const s = String(inv.invoice_status_id || inv.status).toLowerCase();
        if (s === '4' || s === 'paid' || s === 'مدفوع' || s === 'مدفوعة') {
          m.paid += val;
        }
      }
    });

    return months;
  }, [aliphiaInvoices, aliphiaQuotes]);

  const [isSyncingLedger, setIsSyncingLedger] = useState(false);

  const handleSyncCollectedToLedger = async () => {
    setIsSyncingLedger(true);
    const toastId = toast.loading("جاري فحص وتحديث الأستاذ المالي المحلي...");
    
    try {
      const paidInvoices = aliphiaInvoices.filter(inv => {
        const s = String(inv.invoice_status_id || inv.status).toLowerCase();
        return s === '4' || s === 'paid' || s === 'مدفوع' || s === 'مدفوعة';
      });

      if (paidInvoices.length === 0) {
        toast.info("لا توجد فواتير محصلة في ألف ياء للمزامنة", { id: toastId });
        setIsSyncingLedger(false);
        return;
      }

      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const txSnap = await getDocs(query(collection(db, 'transactions'), where('type', '==', 'income')));
      const existingInvoiceNums = new Set(
        txSnap.docs.map(doc => doc.data().invoiceNumber).filter(Boolean)
      );

      let syncedCount = 0;

      for (const inv of paidInvoices) {
        const invNum = inv.invoice_number || inv.number || `INV-${inv.invoice_id}`;
        if (existingInvoiceNums.has(invNum)) continue;

        const invDate = inv.invoice_date_created || inv.date || new Date().toISOString();
        let parsedDate;
        try {
          parsedDate = new Date(invDate);
          if (isNaN(parsedDate.getTime())) parsedDate = new Date();
        } catch (e) {
          parsedDate = new Date();
        }

        await addDoc(collection(db, 'transactions'), {
          type: 'income',
          amount: parseFloat(inv.invoice_total || inv.total || 0),
          description: `دفعة فاتورة مبيعات رقم ${invNum} للعميل ${inv.client_name || 'غير معروف'}`,
          category: 'مبيعات',
          paymentMethod: 'transfer',
          bankAccountId: null,
          invoiceNumber: invNum,
          status: 'approved',
          date: parsedDate,
          createdBy: profile?.uid || 'system',
          createdAt: serverTimestamp()
        });

        syncedCount++;
      }

      if (syncedCount > 0) {
        toast.success(`تم بنجاح مزامنة وتحديث ${syncedCount} عملية مالية جديدة!`, { id: toastId });
      } else {
        toast.info("كل التحصيلات مسجلة ومحدثة بالفعل في الأستاذ المالي.", { id: toastId });
      }
    } catch (error) {
      console.error("Ledger sync error:", error);
      toast.error("حدث خطأ أثناء مزامنة الأستاذ المالي", { id: toastId });
    } finally {
      setIsSyncingLedger(false);
    }
  };

  const subtotal = docItems.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0;
    const q = parseFloat(item.quantity) || 0;
    return sum + (p * q);
  }, 0);
  const vatAmount = subtotal * 0.15;
  const grandTotal = subtotal + vatAmount;

  return (
    <Tabs defaultValue="overview" className="w-full space-y-6">
      <div className="flex justify-center mb-6">
        <TabsList className="bg-white shadow-sm border border-slate-100 p-1.5 rounded-2xl inline-flex flex-row-reverse flex-wrap justify-center gap-1">
          <TabsTrigger value="overview" className="rounded-xl font-bold py-2.5 px-6 text-sm">نظرة عامة على المبيعات</TabsTrigger>
          <TabsTrigger value="create_document" className="rounded-xl font-bold py-2.5 px-6 text-sm gap-2 flex items-center">
             <Plus className="w-4 h-4" /> إنشاء فاتورة / عرض
          </TabsTrigger>
          <TabsTrigger value="aliphia_management" className="rounded-xl font-bold py-2.5 px-6 text-sm gap-2 flex items-center">
             إدارة ألف ياء الذكية
          </TabsTrigger>
          <TabsTrigger value="ai_pricing" className="rounded-xl font-bold py-2.5 px-6 text-sm gap-2 flex items-center">
             التسعير الذكي (AI)
          </TabsTrigger>
        </TabsList>
      </div>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="text-right w-full md:w-auto">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2 justify-start md:justify-end">
              <span>المبيعات والإيرادات المحلية</span>
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">إدارة مبيعات المنتجات أو الخدمات وإيرادات المشاريع، وتتبع عمليات التحصيل وتوزيعها.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-bold h-11 transition-all active:scale-95 shadow-sm">
                <Plus className="w-5 h-5" />
                تسجيل إيراد جديد
              </Button>
            } />
            <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-right flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  تسجيل إيراد / مبيع محلي
                </DialogTitle>
                <DialogDescription className="text-right font-bold text-slate-500">
                  أدخل تفاصيل الإيراد لتسجيله وتأثيره المباشر على الحسابات المالية.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSale} className="space-y-4 pt-4">
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-2xl border border-slate-100 mb-2" dir="rtl">
                  <span className="font-bold text-slate-700 text-xs">مصدر الإيراد</span>
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      size="sm"
                      variant={formData.isProjectIncome ? "default" : "outline"}
                      onClick={() => setFormData({...formData, isProjectIncome: true})}
                      className="rounded-xl text-xs font-bold h-8"
                    >
                      مشروع محلي
                    </Button>
                    <Button 
                      type="button"
                      size="sm"
                      variant={!formData.isProjectIncome ? "default" : "outline"}
                      onClick={() => setFormData({...formData, isProjectIncome: false})}
                      className="rounded-xl text-xs font-bold h-8"
                    >
                      عميل خارجي
                    </Button>
                  </div>
                </div>

                {formData.isProjectIncome ? (
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 text-xs">اختر المشروع المحلي *</Label>
                    <Select 
                      value={formData.projectId}
                      onValueChange={(val) => setFormData({...formData, projectId: val})}
                    >
                      <SelectTrigger className="rounded-xl h-11 text-right w-full border-slate-200 font-bold">
                        <SelectValue placeholder="اختر المشروع..." />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-right font-bold">{p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 text-xs">اسم العميل الخارجي *</Label>
                    <Input 
                      required
                      value={formData.customerName}
                      onChange={e => setFormData({...formData, customerName: e.target.value})}
                      className="rounded-xl h-11 text-right border-slate-200 font-bold"
                      placeholder="مثال: شركة المياه الوطنية..."
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 text-xs">المبلغ الإجمالي (ر.س) *</Label>
                    <Input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="rounded-xl h-11 text-right border-slate-200 font-bold font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 text-xs">التصنيف *</Label>
                    <Select 
                      value={formData.category}
                      onValueChange={(val) => setFormData({...formData, category: val})}
                    >
                      <SelectTrigger className="rounded-xl h-11 text-right w-full border-slate-200 font-bold">
                        <SelectValue placeholder="اختر التصنيف..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="مبيعات" className="text-right font-bold">مبيعات عامة</SelectItem>
                        <SelectItem value="دفعة مشروع" className="text-right font-bold">دفعة مشروع</SelectItem>
                        <SelectItem value="استشارات" className="text-right font-bold">خدمات استشارية</SelectItem>
                        <SelectItem value="أخرى" className="text-right font-bold">أخرى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 text-xs">طريقة الاستلام *</Label>
                    <Select 
                      value={formData.paymentMethod}
                      onValueChange={(val: any) => setFormData({...formData, paymentMethod: val})}
                    >
                      <SelectTrigger className="rounded-xl h-11 text-right w-full border-slate-200 font-bold">
                        <SelectValue placeholder="طريقة الدفع..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash" className="text-right font-bold">نقداً (الخزينة)</SelectItem>
                        <SelectItem value="transfer" className="text-right font-bold">تحويل بنكي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 text-xs">تاريخ الاستلام *</Label>
                    <Input 
                      type="date"
                      value={formData.customDate}
                      onChange={e => setFormData({...formData, customDate: e.target.value})}
                      className="rounded-xl h-11 text-right border-slate-200 font-bold"
                    />
                  </div>
                </div>

                {formData.paymentMethod === 'transfer' && (
                  <div className="space-y-2 text-right animate-in slide-in-from-top-2">
                    <Label className="font-bold text-slate-700 text-xs">الحساب البنكي المستلم *</Label>
                    <Select 
                      value={formData.bankAccountId}
                      onValueChange={(val) => setFormData({...formData, bankAccountId: val})}
                    >
                      <SelectTrigger className="rounded-xl h-11 text-right w-full border-slate-200 font-bold">
                        <SelectValue placeholder="اختر الحساب البنكي..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} className="text-right font-bold">
                            {acc.name} ({acc.accountNumber || "لا يوجد رقم"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2 text-right">
                  <Label className="font-bold text-slate-700 text-xs">بيان / تفاصيل الإيراد</Label>
                  <Input 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="rounded-xl h-11 text-right border-slate-200 font-bold"
                    placeholder="تفاصيل إضافية عن الدفعة..."
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ الإيراد وتحديث المالية"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Premium KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" dir="rtl">
          {/* Total local sales card */}
          <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50/50 hover:shadow-md transition-shadow relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle className="text-sm font-black text-emerald-900">إجمالي الإيرادات المحلية</CardTitle>
              <CardDescription className="text-slate-400 font-bold text-[10px]">كافة التحصيلات المحلية المسجلة</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-3xl font-black text-emerald-950 font-mono">
                {sales.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs font-bold text-emerald-700">ر.س</span>
              </p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-emerald-100/50 text-[10px] text-emerald-800 font-bold">
                <div>
                  <span className="text-slate-400">💵 نقدية:</span> {localCashTotal.toLocaleString()} ر.س
                </div>
                <div>
                  <span className="text-slate-400">💳 تحويل:</span> {localTransferTotal.toLocaleString()} ر.س
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Transaction Counter */}
          <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-50/30 hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
              </div>
              <CardTitle className="text-sm font-black text-indigo-900">عدد العمليات النشطة</CardTitle>
              <CardDescription className="text-slate-400 font-bold text-[10px]">إجمالي الحركات المالية الواردة</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-3xl font-black text-indigo-950 font-mono">
                {sales.length} <span className="text-xs font-bold text-indigo-700">عملية</span>
              </p>
              <div className="mt-3 pt-3 border-t border-indigo-100/50 text-[10px] text-indigo-800 font-bold">
                <span>🔄 التحصيلات المستلمة هذا الشهر: {localMonthCount} عمليات</span>
              </div>
            </CardContent>
          </Card>

          {/* Sync status card */}
          <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-br from-amber-50 to-amber-50/30 hover:shadow-md transition-shadow col-span-1 sm:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center mb-2">
                <ReceiptText className="w-5 h-5 text-amber-600" />
              </div>
              <CardTitle className="text-sm font-black text-amber-900">مزامنة منصة ألف ياء</CardTitle>
              <CardDescription className="text-slate-400 font-bold text-[10px]">ترحيل الإيرادات كفواتير معتمدة</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <p className="text-3xl font-black text-amber-950 font-mono">
                {sales.filter(s => !s.aliphiaInvoiceId).length} <span className="text-xs font-bold text-amber-700">بانتظار المزامنة</span>
              </p>
              <div className="mt-3 pt-3 border-t border-amber-100/50 text-[10px] text-amber-800 font-bold">
                <span>✅ تم ترحيل ومزامنة {sales.filter(s => s.aliphiaInvoiceId).length} إيراد بنجاح</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Local Revenues Registry List */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6" dir="rtl">
            <div className="text-right">
              <h3 className="text-lg font-black text-slate-800">سجل الإيرادات والمبيعات المحلية</h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">الحركات المالية المسجلة محلياً في الأستاذ والمربوطة بالخزينة أو البنوك.</p>
            </div>
            
            {/* Local Search Input */}
            <div className="w-full sm:w-64 relative">
              <Input
                type="text"
                placeholder="ابحث باسم العميل أو التفاصيل..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="h-10 pr-9 rounded-xl font-bold border-slate-200 text-xs text-right"
              />
              <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {filteredLocalSales.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 animate-in fade-in duration-300">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-black text-slate-500">لا توجد عمليات مبيعات مطابقة للبحث</p>
              <p className="text-xs text-slate-400 font-bold mt-1">سجل أول إيراد للعميل أو المشروع لبدء التتبع</p>
            </div>
          ) : (
            <div className="overflow-x-auto" dir="rtl">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-black text-slate-400">
                    <th className="pb-3 pr-2">العميل / المشروع</th>
                    <th className="pb-3">التصنيف والبيان</th>
                    <th className="pb-3">طريقة الدفع والحساب</th>
                    <th className="pb-3 text-right">المبلغ المستلم</th>
                    <th className="pb-3 text-center">المزامنة مع ألف ياء</th>
                    <th className="pb-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm font-bold text-slate-700">
                  {filteredLocalSales.map((sale) => {
                    const bankName = sale.paymentMethod === 'transfer' 
                      ? (bankAccounts.find(b => b.id === sale.bankAccountId)?.name || "حساب بنكي")
                      : "خزينة كاش 💵";
                    
                    const displayDate = sale.dateDisplay || new Date(sale.date?.toDate?.() || Date.now()).toLocaleDateString('ar-SA');

                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5 pr-2">
                          <p className="font-black text-slate-800">{sale.customerName || "عميل خارجي"}</p>
                          <span className="text-[10px] font-bold text-slate-400 font-mono block mt-0.5">{displayDate}</span>
                        </td>
                        <td className="py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black">{sale.category}</span>
                            <span className="text-xs text-slate-500 max-w-[220px] truncate block font-normal">{sale.description || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700">
                            {sale.paymentMethod === 'cash' ? (
                              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Building className="w-3.5 h-3.5 text-blue-600" />
                            )}
                            <span className="font-bold">{bankName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-emerald-600 font-black text-right text-base font-mono">
                          +{parseFloat(sale.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-xs font-bold">ر.س</span>
                        </td>
                        <td className="py-3.5 text-center">
                          {sale.aliphiaInvoiceId ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 font-black">
                                <CheckCircle2 className="w-3 h-3" /> تم المزامنة
                              </span>
                              {sale.aliphiaPdfUrl && (
                                <a 
                                  href={sale.aliphiaPdfUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg text-[10px] font-bold text-primary border-primary/20 hover:bg-primary/5 gap-1.5"
                              onClick={() => {
                                setSelectedSyncRevenue(sale);
                                setSyncClient(null);
                              }}
                            >
                              <RefreshCw className="w-3 h-3" /> ترحيل وتوليد فاتورة
                            </Button>
                          )}
                        </td>
                        <td className="py-3.5 text-center">
                          <div className="inline-flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShareLocalWhatsApp(sale)}
                              className="h-8 w-8 rounded-lg text-emerald-600 border-emerald-100 hover:bg-emerald-50/50 p-0 flex items-center justify-center"
                              title="مشاركة سند الاستلام بالواتساب"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </Button>
                            
                            {/* Guard delete to managers or creator */}
                            {(profile?.role === 'manager' || profile?.uid === sale.createdBy) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteSale(sale.id)}
                                className="h-8 w-8 rounded-lg text-rose-600 border-rose-100 hover:bg-rose-50/50 p-0 flex items-center justify-center"
                                title="حذف العملية"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      {/* CREATE DOCUMENT TAB */}
      <TabsContent value="create_document" className="space-y-6 animate-in fade-in duration-300">
        {creatorSuccessData ? (
          <Card className="rounded-3xl border border-slate-100 p-8 text-center max-w-xl mx-auto space-y-6 bg-white shadow-sm animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">تم إنشاء المستند بنجاح في ألف ياء! 🎉</h3>
              <p className="text-sm font-bold text-slate-500">
                نوع المستند: {docType === 'invoice' ? 'فاتورة مبيعات' : 'عرض سعر'}
              </p>
              <p className="text-sm font-mono text-emerald-600 font-bold bg-emerald-50/50 inline-block px-3 py-1 rounded-lg">
                رقم المستند: {creatorSuccessData.number}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-right text-xs font-bold text-slate-600 space-y-2 max-w-sm mx-auto">
              <p><span className="text-slate-400">العميل:</span> {creatorSuccessData.clientName}</p>
              <p><span className="text-slate-400">القيمة شاملة الضريبة (15%):</span> {creatorSuccessData.total.toLocaleString(undefined, {minimumFractionDigits: 2})} ر.س</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              {creatorSuccessData.pdf_url && (
                <Button
                  onClick={() => window.open(creatorSuccessData.pdf_url, '_blank')}
                  className="rounded-xl h-11 bg-primary text-white font-bold gap-2 px-6"
                >
                  <ExternalLink className="w-4 h-4" /> تحميل واستعراض PDF
                </Button>
              )}
              <Button
                onClick={() => {
                  const docNum = creatorSuccessData.number;
                  const clientName = creatorSuccessData.clientName;
                  const total = creatorSuccessData.total.toLocaleString(undefined, {minimumFractionDigits: 2});
                  const pdfUrl = creatorSuccessData.pdf_url || '';
                  let text = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بك أخي ${clientName}.\n\nمرفق لكم ${docType === 'invoice' ? 'الفاتورة' : 'عرض السعر'} رقم *${docNum}* بقيمة *${total} ر.س* شامل الضريبة.\n`;
                  if (pdfUrl) {
                    text += `يمكنك استعراض وتحميل الملف من الرابط التالي:\n${pdfUrl}\n\n`;
                  }
                  text += `شكراً لتعاملكم معنا.`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-6"
              >
                <Share2 className="w-4 h-4" /> مشاركة عبر واتساب
              </Button>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setCreatorSuccessData(null);
                  setDocItems([{ name: "", description: "", quantity: 1, price: "" }]);
                  setCreatorClient(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                إنشاء مستند آخر
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="rounded-3xl border border-slate-100 p-6 bg-white shadow-sm space-y-6">
            <div className="text-right pb-4 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 justify-end">
                <span>منشئ عروض الأسعار والفواتير المباشر</span>
                <ReceiptText className="w-5 h-5 text-primary" />
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                قم بإنشاء وتحديث الفواتير وعروض الأسعار مباشرة على منصة ألف ياء ببنود ديناميكية متعددة.
              </p>
            </div>

            <form onSubmit={handleCreateAliphiaDoc} className="space-y-6">
              {/* Toggle Document Type & Client Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end" dir="rtl">
                {/* Doc Type Toggle */}
                <div className="space-y-2 text-right">
                  <Label className="font-bold text-slate-700 text-xs">نوع المستند</Label>
                  <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/50">
                    <Button
                      type="button"
                      className={`flex-1 h-9 rounded-lg text-xs font-black transition-all ${
                        docType === 'invoice' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'bg-transparent text-slate-400 hover:text-slate-600'
                      }`}
                      onClick={() => setDocType('invoice')}
                    >
                      فاتورة مبيعات
                    </Button>
                    <Button
                      type="button"
                      className={`flex-1 h-9 rounded-lg text-xs font-black transition-all ${
                        docType === 'quotation' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'bg-transparent text-slate-400 hover:text-slate-600'
                      }`}
                      onClick={() => setDocType('quotation')}
                    >
                      عرض سعر
                    </Button>
                  </div>
                </div>

                {/* Client Selector */}
                <div className="space-y-2 text-right md:col-span-2">
                  <Label className="font-bold text-slate-700 text-xs">اختر العميل من ألف ياء *</Label>
                  <AliphiaClientSelector
                    onSelect={(client) => setCreatorClient(client)}
                    selectedClientId={creatorClient?.id}
                  />
                </div>
              </div>

              {/* Dates Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
                <div className="space-y-2 text-right">
                  <Label className="font-bold text-slate-700 text-xs">تاريخ المستند *</Label>
                  <Input
                    type="date"
                    value={docDetails.date}
                    onChange={e => setDocDetails({...docDetails, date: e.target.value})}
                    className="rounded-xl h-11 text-right border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-2 text-right">
                  <Label className="font-bold text-slate-700 text-xs">
                    {docType === 'invoice' ? 'تاريخ الاستحقاق *' : 'تاريخ الصلاحية *'}
                  </Label>
                  <Input
                    type="date"
                    value={docDetails.date_due}
                    onChange={e => setDocDetails({...docDetails, date_due: e.target.value})}
                    className="rounded-xl h-11 text-right border-slate-200 font-bold"
                  />
                </div>
              </div>

              {/* Dynamic Items Builder */}
              <div className="space-y-4" dir="rtl">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-black text-slate-700">بنود المستند وتفاصيل المبيعات *</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDocItemRow}
                    className="h-8 rounded-lg text-xs font-bold text-primary border-primary/20 hover:bg-primary/5 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة بند جديد
                  </Button>
                </div>

                <div className="space-y-3">
                  {docItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 items-end animate-in fade-in slide-in-from-top-1">
                      <div className="sm:col-span-4 space-y-1 text-right">
                        <Label className="text-[10px] font-bold text-slate-500">اسم المنتج / الخدمة *</Label>
                        <Input
                          required
                          value={item.name}
                          onChange={e => updateDocItemField(index, 'name', e.target.value)}
                          placeholder="مثال: رخصة نظام ذكي..."
                          className="h-9 text-right rounded-lg bg-white border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <div className="sm:col-span-4 space-y-1 text-right">
                        <Label className="text-[10px] font-bold text-slate-500">الوصف (اختياري)</Label>
                        <Input
                          value={item.description}
                          onChange={e => updateDocItemField(index, 'description', e.target.value)}
                          placeholder="تفاصيل إضافية للعميل..."
                          className="h-9 text-right rounded-lg bg-white border-slate-200 text-xs font-bold"
                        />
                      </div>
                      <div className="sm:col-span-1.5 col-span-4 space-y-1 text-right">
                        <Label className="text-[10px] font-bold text-slate-500">الكمية *</Label>
                        <Input
                          required
                          type="number"
                          min="1"
                          step="any"
                          value={item.quantity}
                          onChange={e => updateDocItemField(index, 'quantity', e.target.value)}
                          className="h-9 text-center rounded-lg bg-white border-slate-200 text-xs font-bold font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2 col-span-5 space-y-1 text-right">
                        <Label className="text-[10px] font-bold text-slate-500">سعر الوحدة *</Label>
                        <Input
                          required
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={e => updateDocItemField(index, 'price', e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-right rounded-lg bg-white border-slate-200 text-xs font-bold font-mono"
                        />
                      </div>
                      <div className="sm:col-span-0.5 col-span-3 text-center sm:text-left">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeDocItemRow(index)}
                          className="h-9 w-9 p-0 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right" dir="rtl">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 text-xs">الشروط والأحكام</Label>
                  <Input
                    value={docDetails.terms}
                    onChange={e => setDocDetails({...docDetails, terms: e.target.value})}
                    className="rounded-xl h-11 text-right border-slate-200 text-xs font-bold"
                    placeholder="مثال: مستحق عند الاستلام..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700 text-xs">ملاحظات المستند</Label>
                  <Input
                    value={docDetails.notes}
                    onChange={e => setDocDetails({...docDetails, notes: e.target.value})}
                    className="rounded-xl h-11 text-right border-slate-200 text-xs font-bold"
                    placeholder="تظهر للعميل أسفل الفاتورة..."
                  />
                </div>
              </div>

              {/* Totals Summary & Submit Button */}
              <div className="border-t border-slate-100 pt-6 flex flex-col md:flex-row justify-between items-center gap-6" dir="rtl">
                {/* Calculations Summary */}
                <div className="w-full md:w-64 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-right space-y-2.5 font-bold text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono">{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})} ر.س</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span className="font-mono">{vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} ر.س</span>
                  </div>
                  <div className="flex justify-between text-slate-900 border-t border-slate-200 pt-2.5 text-sm font-black">
                    <span>الإجمالي الكلي:</span>
                    <span className="font-mono text-primary">{grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})} ر.س</span>
                  </div>
                </div>

                {/* Submission button */}
                <Button
                  type="submit"
                  disabled={isCreatingDoc}
                  className="w-full md:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs gap-2 transition-all active:scale-95 shadow-sm"
                >
                  {isCreatingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري التوليد على منصة ألف ياء...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      توليد وحفظ {docType === 'invoice' ? 'الفاتورة الرسمية' : 'عرض السعر'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </TabsContent>

      {/* AI PRICING / QUOTATION BUILDER */}
      <TabsContent value="ai_pricing" className="space-y-6 animate-in fade-in duration-300">
        <Tabs defaultValue="offer_bot" className="w-full space-y-4">
          <div className="flex justify-start">
            <TabsList className="bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
              <TabsTrigger value="offer_bot" className="rounded-lg px-4 py-2 text-xs font-black">المساعد الذكي للتسعير 🤖</TabsTrigger>
              <TabsTrigger value="doc_builder" className="rounded-lg px-4 py-2 text-xs font-black">باني الوثائق والمسح بـ AI 📄</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="offer_bot" className="space-y-4">
            <SmartOfferBot />
          </TabsContent>
          <TabsContent value="doc_builder" className="space-y-4">
            <AIQuotationBuilder type="quotation" />
          </TabsContent>
        </Tabs>
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
                <TabsTrigger value="aliphia_analytics" className="rounded-lg font-bold py-1.5 px-4 text-xs">التحليلات والمؤشرات</TabsTrigger>
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
                        const statusUI = getInvoiceStatusLabel(inv.invoice_status_id || inv.status);
                        return (
                           <tr 
                            key={inv.id || inv.invoice_id || index} 
                            onClick={() => handleOpenDocDetails(inv, 'invoice')}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 pr-2 font-mono font-black text-slate-800">{inv.invoice_number || inv.number || `INV-${inv.invoice_id}`}</td>
                            <td className="py-3.5 text-slate-800">{inv.client_name || inv.client || 'عميل غير معروف'}</td>
                            <td className="py-3.5 font-mono text-xs">{inv.invoice_date_created || inv.date || inv.invoice_date || '—'}</td>
                            <td className="py-3.5 font-mono text-xs text-rose-500">{inv.invoice_date_due || inv.date_due || inv.due_date || '—'}</td>
                            <td className="py-3.5 font-black text-slate-900">{parseFloat(inv.invoice_total || inv.total || inv.amount || 0).toLocaleString()} ر.س</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${statusUI.color}`}>
                                {statusUI.label}
                              </span>
                            </td>
                            <td className="py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
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
                                  onClick={() => { setShareDoc(inv); setShareType('invoice'); setShareOpen(true); }}
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
                        const statusUI = getQuoteStatusLabel(quote.quote_status_id || quote.status);
                        const isConverting = isConvertingQuote === (quote.id || quote.quote_id);
                        return (
                           <tr 
                            key={quote.id || quote.quote_id || index} 
                            onClick={() => handleOpenDocDetails(quote, 'quote')}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 pr-2 font-mono font-black text-slate-800">{quote.quote_number || quote.number || `Q-${quote.id || quote.quote_id}`}</td>
                            <td className="py-3.5 text-slate-800">{quote.client_name || quote.client || 'عميل غير معروف'}</td>
                            <td className="py-3.5 font-mono text-xs">{quote.quote_date_created || quote.date || '—'}</td>
                            <td className="py-3.5 font-mono text-xs text-slate-400">{quote.quote_date_expires || quote.date_due || '—'}</td>
                            <td className="py-3.5 font-black text-slate-900">{parseFloat(quote.quote_total || quote.total || quote.amount || 0).toLocaleString()} ر.س</td>
                            <td className="py-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${statusUI.color}`}>
                                {statusUI.label}
                              </span>
                            </td>
                            <td className="py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
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
                                  onClick={() => { setShareDoc(quote); setShareType('quote'); setShareOpen(true); }}
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

            {/* Sub-Tab Content: ANALYTICS & VISUAL INDICATORS */}
            <TabsContent value="aliphia_analytics" className="space-y-6">
              {/* Analytics KPIs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4" dir="rtl">
                <Card className="rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-xs font-black">إجمالي العملاء</span>
                      <Users className="w-5 h-5 text-indigo-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {aliphiaClients.length} <span className="text-xs font-bold text-slate-400">عميل</span>
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold">قائمة العملاء النشطة بألف ياء</span>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-xs font-black">ضريبة القيمة المضافة (15%)</span>
                      <Percent className="w-5 h-5 text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {Math.round(totalInvoiced * 0.15).toLocaleString()} <span className="text-xs font-bold text-slate-400">ر.س</span>
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold">تقديرية من الفواتير المصدرة</span>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-xs font-black">معدل تحويل العروض</span>
                      <Calculator className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {aliphiaQuotes.length > 0 
                        ? Math.round((aliphiaQuotes.filter(q => String(q.quote_status_id) === '4').length / aliphiaQuotes.length) * 100)
                        : 0} <span className="text-xs font-bold text-slate-400">%</span>
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold">نسبة تحويل العروض إلى فواتير</span>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                  <CardContent className="p-4 flex flex-col justify-between h-28">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="text-xs font-black">متوسط سلة المبيعات</span>
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {aliphiaInvoices.length > 0 
                        ? Math.round(totalInvoiced / aliphiaInvoices.length).toLocaleString()
                        : 0} <span className="text-xs font-bold text-slate-400">ر.س</span>
                    </p>
                    <span className="text-[10px] text-slate-400 font-bold">متوسط القيمة للفاتورة الواحدة</span>
                  </CardContent>
                </Card>
              </div>

              {/* Chart and Sync Action */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" dir="rtl">
                {/* Visual Chart */}
                <Card className="lg:col-span-2 rounded-3xl border border-slate-100 p-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-slate-800">مقارنة زمنية للمبيعات وعروض الأسعار</h4>
                    <p className="text-xs font-bold text-slate-400">عرض مقارن لحجم المبيعات، عروض الأسعار الصادرة، والتحصيلات الفعلية لآخر 6 أشهر</p>
                  </div>
                  
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} stroke="#94a3b8" />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                        <Bar dataKey="quotes" name="عروض أسعار" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="invoices" name="فواتير مصدرة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="paid" name="مبالغ محصلة" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Local Sync Widget */}
                <Card className="rounded-3xl border border-slate-100 p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                      <RefreshCw className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h4 className="text-sm font-black text-slate-800">تكامل الحسابات والمالية</h4>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                      هذا الخيار يتيح لك مزامنة كافة الفواتير **المحصلة** في ألف ياء وجلبها تلقائياً إلى الأستاذ المالي المحلي (كإيرادات معتمدة) لتطابق الحسابات ومنع تكرار الإدخال اليدوي.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <Button 
                      onClick={handleSyncCollectedToLedger}
                      disabled={isSyncingLedger}
                      className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs gap-1.5 shadow-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncingLedger ? 'animate-spin' : ''}`} />
                      مزامنة التحصيلات مع المالية
                    </Button>
                    <p className="text-[10px] text-center text-slate-400 font-bold mt-2">يقارن أرقام الفواتير لتجنب تسجيل العملية مرتين</p>
                  </div>
                </Card>
              </div>
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

      {/* ALIPHIA DOCUMENT DETAILS DIALOG */}
      {selectedAliphiaDoc && (
        <Dialog open={!!selectedAliphiaDoc} onOpenChange={(open) => { if (!open) setSelectedAliphiaDoc(null); }}>
          <DialogContent className="max-w-3xl rounded-[28px] p-6 text-right overflow-y-auto max-h-[90vh] border-none shadow-2xl bg-white/95 backdrop-blur-xl" dir="rtl">
            <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                  {detailDocType === 'invoice' ? (
                    <ReceiptText className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  )}
                  <span>{detailDocType === 'invoice' ? 'تفاصيل فاتورة مبيعات' : 'تفاصيل عرض سعر'}</span>
                  <span className="font-mono text-slate-400 mr-2">
                    #{aliphiaDocDetails?.invoice_number || aliphiaDocDetails?.quote_number || selectedAliphiaDoc?.invoice_number || selectedAliphiaDoc?.quote_number || selectedAliphiaDoc?.number || selectedAliphiaDoc?.id}
                  </span>
                </DialogTitle>
                
                {/* Status Badge */}
                {(() => {
                  const statusUI = detailDocType === 'invoice'
                    ? getInvoiceStatusLabel(aliphiaDocDetails?.invoice_status_id || selectedAliphiaDoc?.invoice_status_id || selectedAliphiaDoc?.status)
                    : getQuoteStatusLabel(aliphiaDocDetails?.quote_status_id || selectedAliphiaDoc?.quote_status_id || selectedAliphiaDoc?.status);
                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${statusUI.color}`}>
                      {statusUI.label}
                    </span>
                  );
                })()}
              </div>
              <DialogDescription className="font-bold text-slate-400 text-xs mt-1">
                تفاصيل المستند المسجلة والمزامنة مع منصة ألف ياء للربط المحاسبي.
              </DialogDescription>
            </DialogHeader>

            {loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
                <span className="text-sm font-bold text-slate-400">جاري جلب البنود والتفاصيل من ألف ياء...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">العميل</span>
                    <span className="text-sm font-black text-slate-800">
                      {aliphiaDocDetails?.client_name || selectedAliphiaDoc?.client_name || selectedAliphiaDoc?.client || 'عميل غير معروف'}
                    </span>
                    {(aliphiaDocDetails?.client_phone || aliphiaDocDetails?.client_email) && (
                      <span className="text-xs text-slate-500 block mt-1 font-mono">
                        {aliphiaDocDetails.client_phone} {aliphiaDocDetails.client_email && ` | ${aliphiaDocDetails.client_email}`}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">تاريخ الإصدار</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      {aliphiaDocDetails?.invoice_date_created || aliphiaDocDetails?.quote_date_created || selectedAliphiaDoc?.invoice_date_created || selectedAliphiaDoc?.quote_date_created || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">
                      {detailDocType === 'invoice' ? 'تاريخ الاستحقاق' : 'صلاحية العرض'}
                    </span>
                    <span className="text-sm font-bold text-slate-700 font-mono">
                      {aliphiaDocDetails?.invoice_date_due || aliphiaDocDetails?.quote_date_expires || selectedAliphiaDoc?.invoice_date_due || selectedAliphiaDoc?.quote_date_expires || '—'}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5">
                    <ReceiptText className="w-4 h-4 text-slate-400" />
                    <span>بنود المستند التفصيلية</span>
                  </h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 text-xs font-black text-slate-400 border-b border-slate-100">
                          <th className="py-3 px-4">البند</th>
                          <th className="py-3 px-4">الوصف</th>
                          <th className="py-3 px-4 text-center">الكمية</th>
                          <th className="py-3 px-4 text-left">سعر الوحدة</th>
                          <th className="py-3 px-4 text-left">المجموع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                        {(() => {
                          const items = aliphiaDocDetails?.invoice_items || aliphiaDocDetails?.quote_items || aliphiaDocDetails?.items || [];
                          if (items.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-bold">
                                  لا توجد بنود مسجلة لهذا المستند
                                </td>
                              </tr>
                            );
                          }
                          return items.map((item: any, idx: number) => {
                            const qty = parseFloat(item.item_quantity || item.quantity || 1);
                            const price = parseFloat(item.item_price || item.price || 0);
                            const total = parseFloat(item.item_total || item.total || (qty * price));
                            return (
                              <tr key={item.item_id || idx} className="hover:bg-slate-50/35 transition-colors">
                                <td className="py-3.5 px-4 font-black text-slate-800">{item.item_name || item.name}</td>
                                <td className="py-3.5 px-4 text-slate-500 text-xs max-w-[200px] truncate">
                                  {item.item_description || item.description || '—'}
                                </td>
                                <td className="py-3.5 px-4 text-center font-mono">{qty}</td>
                                <td className="py-3.5 px-4 text-left font-mono">{price.toLocaleString()} ر.س</td>
                                <td className="py-3.5 px-4 text-left font-black text-slate-900 font-mono">
                                  {total.toLocaleString()} ر.س
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Section */}
                <div className="flex justify-end">
                  <div className="w-full md:w-80 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs font-bold text-slate-600">
                    <div className="flex justify-between">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono text-slate-800">
                        {parseFloat(aliphiaDocDetails?.invoice_subtotal || aliphiaDocDetails?.quote_subtotal || aliphiaDocDetails?.subtotal || 0).toLocaleString()} ر.س
                      </span>
                    </div>
                    
                    {parseFloat(aliphiaDocDetails?.invoice_discount_amount || aliphiaDocDetails?.quote_discount_amount || aliphiaDocDetails?.discount || 0) > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>الخصم:</span>
                        <span className="font-mono">
                          -{parseFloat(aliphiaDocDetails?.invoice_discount_amount || aliphiaDocDetails?.quote_discount_amount || aliphiaDocDetails?.discount || 0).toLocaleString()} ر.س
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>الضريبة (15%):</span>
                      <span className="font-mono text-slate-800">
                        {parseFloat(aliphiaDocDetails?.invoice_total_tax || aliphiaDocDetails?.quote_total_tax || aliphiaDocDetails?.tax || 0).toLocaleString()} ر.س
                      </span>
                    </div>

                    <div className="border-t border-slate-200/80 my-2 pt-2.5 flex justify-between text-sm font-black text-slate-900">
                      <span>المجموع الكلي:</span>
                      <span className="font-mono text-emerald-600 text-lg">
                        {parseFloat(aliphiaDocDetails?.invoice_total || aliphiaDocDetails?.quote_total || aliphiaDocDetails?.total || 0).toLocaleString()} ر.س
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes & Terms */}
                {(aliphiaDocDetails?.notes || aliphiaDocDetails?.terms) && (
                  <div className="space-y-3 pt-6 border-t border-slate-100">
                    {aliphiaDocDetails?.notes && (
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-xs font-black text-slate-500 block mb-1">ملاحظات المستند</span>
                        <p className="text-xs text-slate-700 leading-relaxed">{aliphiaDocDetails.notes}</p>
                      </div>
                    )}
                    {aliphiaDocDetails?.terms && (
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-xs font-black text-slate-500 block mb-1">الشروط والأحكام</span>
                        <p className="text-xs text-slate-700 leading-relaxed">{aliphiaDocDetails.terms}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-6 border-t border-slate-100 mt-6">
              <Button
                variant="outline"
                onClick={() => setSelectedAliphiaDoc(null)}
                className="rounded-xl font-bold text-xs h-11 border-slate-200 hover:bg-slate-50 cursor-pointer sm:order-first"
              >
                إغلاق
              </Button>
              
              <div className="flex flex-1 gap-2 w-full sm:w-auto">
                {(aliphiaDocDetails?.pdf_url || selectedAliphiaDoc?.pdf_url) && (
                  <Button
                    onClick={() => window.open(aliphiaDocDetails?.pdf_url || selectedAliphiaDoc?.pdf_url, '_blank')}
                    className="flex-1 rounded-xl font-black text-xs h-11 bg-slate-900 text-white hover:bg-black transition-all gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    عرض ملف PDF
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setShareDoc(aliphiaDocDetails || selectedAliphiaDoc);
                    setShareType(detailDocType);
                    setShareOpen(true);
                  }}
                  className="flex-1 rounded-xl font-black text-xs h-11 bg-emerald-600 text-white hover:bg-emerald-700 transition-all gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  مشاركة عبر واتساب
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} doc={shareDoc} type={shareType} />
    </Tabs>
  );
}
