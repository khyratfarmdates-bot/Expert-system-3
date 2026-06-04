import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronRight, 
  Wallet, 
  Receipt, 
  TrendingUp, 
  CheckCircle2, 
  Loader2, 
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Share2,
  Calendar,
  Eye,
  FileDown,
  XCircle,
  Clock,
  FileText
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Quotation, Transaction, BankAccount } from '../types';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SalesRepProfile({ salesRepId, onBack }: { salesRepId: string, onBack: () => void }) {
  const { profile } = useAuth(); // Manager auth profile
  const [rep, setRep] = useState<UserProfile | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [repTransactions, setRepTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('docs');
  const [selectedDoc, setSelectedDoc] = useState<Quotation | null>(null);

  // Payout dialog states
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'transfer' | 'cash'>('transfer');
  const [payoutDesc, setPayoutDesc] = useState('');

  useEffect(() => {
    const fetchRep = async () => {
      const docSnap = await getDoc(doc(db, 'users', salesRepId));
      if (docSnap.exists()) {
        setRep({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      }
      setLoading(false);
    };
    fetchRep();

    // Fetch quotations (unsorted query to avoid index errors, sorted in memory)
    const unsubQuotes = onSnapshot(
      query(collection(db, 'quotations'), where('salesRepId', '==', salesRepId)), 
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'quotation' } as Quotation));
        setQuotations(prev => {
          const rest = prev.filter(q => q.docType !== 'quotation');
          return [...items, ...rest].sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });
        });
      }
    );

    // Fetch invoices (unsorted query, sorted in memory)
    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('salesRepId', '==', salesRepId)), 
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'invoice' } as Quotation));
        setQuotations(prev => {
          const rest = prev.filter(q => q.docType !== 'invoice');
          return [...items, ...rest].sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });
        });
      }
    );

    // Fetch transactions/payouts for the representative
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('salesRepId', '==', salesRepId)),
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        items.sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });
        setRepTransactions(items);
      }
    );

    // Fetch bank accounts for payouts selection
    const unsubAccounts = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
    });

    return () => {
      unsubQuotes();
      unsubInvoices();
      unsubTx();
      unsubAccounts();
    };
  }, [salesRepId]);

  if (loading || !rep) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">جاري تحميل الملف الشخصي للمندوب...</p>
      </div>
    );
  }

  // Financial calculations
  const approvedDocs = quotations.filter(q => q.status === 'approved');
  const totalSales = approvedDocs.reduce((acc, q) => acc + (q.totalAmount || 0), 0);
  
  // له وعليه calculations
  const repShare = totalSales * 0.85; // 85% goes to rep
  const companyShare = totalSales * 0.15; // 15% goes to company

  const approvedPayouts = repTransactions.filter(t => t.type === 'expense' && t.status === 'approved');
  const totalPaid = approvedPayouts.reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const remainingBalance = repShare - totalPaid;

  const handleAddPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error('حدث خطأ في صلاحية الحساب الحالي');
      return;
    }
    if (!payoutAmount || Number(payoutAmount) <= 0) {
      toast.error('يرجى إدخال مبلغ دفع صحيح');
      return;
    }
    if (!payoutAccountId) {
      toast.error('يرجى تحديد صندوق أو حساب الخصم المالي');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        type: 'expense',
        category: 'دفعة مندوب',
        amount: Number(payoutAmount),
        description: payoutDesc || `دفعة مالية للمندوب: ${rep.name}`,
        date: Timestamp.now(),
        createdBy: profile.uid,
        salesRepId: salesRepId,
        bankAccountId: payoutAccountId,
        paymentMethod: payoutMethod,
        status: 'approved'
      });

      await logActivity(
        'تسجيل دفعة لمندوب',
        `تم تحويل دفعة مالية بقيمة ${payoutAmount} ر.س للمندوب ${rep.name}`,
        'info',
        'financial',
        profile.uid
      );

      toast.success('تم تسجيل الدفعة وخصمها من الحساب بنجاح');
      setIsPayoutOpen(false);
      setPayoutAmount('');
      setPayoutDesc('');
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء تسجيل الدفعة المالية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAccountName = (accountId?: string) => {
    if (!accountId) return '—';
    const acc = bankAccounts.find(b => b.id === accountId);
    return acc ? acc.name : '—';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'rejected': return 'مرفوض';
      default: return 'قيد المراجعة';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      
      {/* Profile Header */}
      <div className="relative group overflow-hidden rounded-3xl bg-white border shadow-sm p-4 md:p-8">
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
          <Button 
            onClick={onBack} 
            variant="ghost" 
            size="icon" 
            className="absolute -top-2 -right-2 md:top-0 md:right-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200"
          >
            <ChevronRight className="w-5 h-5 text-primary" />
          </Button>

          <Avatar className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-white shadow-xl ring-2 ring-slate-100">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rep.name}`} />
            <AvatarFallback className="bg-primary text-white text-3xl font-black">{rep.name?.[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2 justify-center md:justify-start">
              <h1 className="text-3xl font-black text-primary tracking-tight">{rep.name}</h1>
              <Badge className="bg-amber-100 text-amber-700 border-none px-3 py-1 text-xs font-bold shadow-sm w-fit mx-auto md:mx-0">
                شريك مبيعات (غير موظف)
              </Badge>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
              <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-full text-[12px] font-bold text-slate-600">
                <Wallet className="w-3.5 h-3.5" />
                حساب تشاركي (له وعليه - عمولة المؤسسة 15%)
              </div>
              {rep.phone && (
                <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-full text-[12px] font-bold text-slate-600">
                  هاتف: {rep.phone}
                </div>
              )}
              {rep.phone && (
                <Button
                  onClick={() => window.open(`https://wa.me/${rep.phone?.replace(/\+/g, '')}`, '_blank')}
                  variant="outline"
                  className="h-8 rounded-full border-green-200 text-green-700 hover:bg-green-50 font-bold gap-1 text-[11px] px-3 shadow-none"
                >
                  <Share2 className="w-3.5 h-3.5" /> تواصل واتساب
                </Button>
              )}
            </div>
          </div>

          {/* Action to Record Payout */}
          <div className="shrink-0">
            <Button 
              onClick={() => setIsPayoutOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white rounded-2xl font-black gap-2 h-11 px-5 shadow-sm text-xs"
            >
              <Plus className="w-4 h-4" /> تسجيل دفعة مالية للمندوب
            </Button>
          </div>
        </div>
      </div>

      {/* له وعليه Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 text-white border-none rounded-3xl">
          <CardContent className="p-5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold opacity-80 uppercase">إجمالي المبيعات المعتمدة</p>
              <h3 className="text-xl font-black mt-1">{totalSales.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-2xl"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-600 text-white border-none rounded-3xl">
          <CardContent className="p-5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold opacity-80 uppercase">مستحقات المندوب (85%)</p>
              <h3 className="text-xl font-black mt-1">{repShare.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-2xl"><ArrowUpRight className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500 text-white border-none rounded-3xl">
          <CardContent className="p-5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold opacity-80 uppercase">إجمالي المدفوع للمندوب</p>
              <h3 className="text-xl font-black mt-1">{totalPaid.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-2xl"><ArrowDownLeft className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>

        <Card className="bg-blue-600 text-white border-none rounded-3xl">
          <CardContent className="p-5 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold opacity-80 uppercase">الرصيد المتبقي له</p>
              <h3 className="text-xl font-black mt-1">{remainingBalance.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
            </div>
            <div className="bg-white/20 p-2.5 rounded-2xl"><Wallet className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs list */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-white shadow-sm border border-slate-100 p-1 rounded-2xl grid grid-cols-2 mb-6">
          <TabsTrigger value="docs" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white gap-2 flex items-center justify-center text-xs">
            <Receipt className="w-4 h-4" /> المستندات والوثائق المعتمدة ({approvedDocs.length})
          </TabsTrigger>
          <TabsTrigger value="payouts" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white gap-2 flex items-center justify-center text-xs">
            <Landmark className="w-4 h-4" /> كشف الحساب والدفعات ({approvedPayouts.length})
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="docs">
          <Card className="rounded-3xl shadow-sm border-border bg-white">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                عروض الأسعار والفواتير المعتمدة الصادرة باسم المندوب
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {approvedDocs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">لا توجد وثائق معتمدة مسجلة لهذا المندوب.</div>
              ) : (
                <div className="space-y-3">
                  {approvedDocs.map(q => (
                    <div key={q.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {q.docType === 'invoice' ? (
                          <Badge className="bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-50 text-[10px] font-bold">فاتورة</Badge>
                        ) : (
                          <Badge className="bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-50 text-[10px] font-bold">عرض سعر</Badge>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-slate-800 text-sm truncate">العميل: {q.clientName}</h4>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {q.docNumber ? `#${q.docNumber}` : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 max-w-sm truncate mt-0.5">{q.items}</p>
                        </div>
                      </div>
                      <div className="text-left shrink-0 ml-4 flex items-center gap-3">
                        <div>
                          <p className="font-black text-primary text-sm">{q.totalAmount.toLocaleString()} ر.س</p>
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">معتمد</span>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => setSelectedDoc(q)}
                            className="w-8 h-8 rounded-lg hover:text-primary hover:border-primary/30"
                            title="تفاصيل البنود"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {q.pdfUrl && (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => window.open(q.pdfUrl, '_blank')}
                              className="w-8 h-8 rounded-lg hover:text-teal-600 hover:border-teal-300"
                              title="تحميل PDF"
                            >
                              <FileDown className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card className="rounded-3xl shadow-sm border-border bg-white">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                سجل الدفعات والتحويلات المالية المسجلة للمندوب
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {approvedPayouts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold text-sm">لا توجد دفعات مالية مسجلة في كشف حساب المندوب.</div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                        <th className="p-3.5">البيان والتفاصيل</th>
                        <th className="p-3.5">طريقة التحويل</th>
                        <th className="p-3.5">حساب الدفع</th>
                        <th className="p-3.5 text-center">التاريخ</th>
                        <th className="p-3.5 text-left">المبلغ المدفوع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvedPayouts.map((tx) => (
                        <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="p-3.5">
                            <p className="font-black text-slate-800">{tx.category || 'دفعة لمندوب'}</p>
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5">{tx.description}</p>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {tx.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'نقداً'}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {getAccountName(tx.bankAccountId)}
                          </td>
                          <td className="p-3.5 text-center text-slate-500">
                            {tx.date?.seconds 
                              ? new Date(tx.date.seconds * 1000).toLocaleDateString('ar-SA')
                              : '—'
                            }
                          </td>
                          <td className="p-3.5 text-left font-black text-rose-600">
                            -{(tx.amount || 0).toLocaleString('ar-SA')} ر.س
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Payout Dialog */}
      <Dialog open={isPayoutOpen} onOpenChange={setIsPayoutOpen}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 text-right" dir="rtl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              تسجيل تحويل / دفعة مالية للمندوب
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddPayout} className="space-y-4" style={{ fontFamily: "'Cairo', sans-serif" }}>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">المبلغ المدفوع (ر.س)</label>
              <Input 
                type="number"
                placeholder="مثال: 2000"
                value={payoutAmount}
                onChange={e => setPayoutAmount(e.target.value)}
                className="rounded-xl h-11"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">الصندوق / الحساب البنكي المخصوم منه</label>
              <select 
                className="w-full border border-input bg-background px-3 h-11 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={payoutAccountId}
                onChange={e => setPayoutAccountId(e.target.value)}
                required
              >
                <option value="">-- اختر الحساب البنكي أو الصندوق --</option>
                {bankAccounts.filter(b => b.status === 'active').map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type === 'bank' ? 'حساب بنكي' : 'صندوق نقد'})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">طريقة الدفع</label>
              <select 
                className="w-full border border-input bg-background px-3 h-11 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={payoutMethod}
                onChange={e => setPayoutMethod(e.target.value as any)}
                required
              >
                <option value="transfer">تحويل بنكي / إلكتروني</option>
                <option value="cash">نقداً / كاش</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 block">ملاحظات / وصف الدفعة</label>
              <Input 
                placeholder="مثال: تحويل الدفعة المستحقة عن شهر مايو..."
                value={payoutDesc}
                onChange={e => setPayoutDesc(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl h-11 font-black text-xs"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري تسجيل الحركة...' : 'تسجيل الدفعة وخصمها'}
              </Button>
              <Button 
                type="button" 
                variant="ghost"
                className="rounded-xl h-11 px-4 text-slate-500 font-bold"
                onClick={() => setIsPayoutOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Document Details Modal */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-lg rounded-[2rem] p-6 text-right" dir="rtl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تفاصيل البنود والأسعار
            </DialogTitle>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4 font-bold text-xs" style={{ fontFamily: "'Cairo', sans-serif" }}>
              
              {/* Document Meta info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">العميل</span>
                  <span className="text-slate-800 font-black">{selectedDoc.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">رقم المستند في ألف ياء</span>
                  <span className="text-slate-800 font-black">{selectedDoc.docNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">المبلغ الإجمالي</span>
                  <span className="text-primary font-black text-sm">{selectedDoc.totalAmount?.toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">الحالة</span>
                  <span className="inline-flex items-center gap-1 mt-0.5">
                    {getStatusIcon(selectedDoc.status)}
                    <span className="text-[10px] text-slate-600">{getStatusText(selectedDoc.status)}</span>
                  </span>
                </div>
              </div>

              {/* Items details */}
              <div className="space-y-2">
                <span className="text-slate-800 font-black block">تفاصيل البنود</span>
                {selectedDoc.itemsDetail && selectedDoc.itemsDetail.length > 0 ? (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                          <th className="p-3">البند</th>
                          <th className="p-3 text-center">الكمية</th>
                          <th className="p-3 text-left">السعر</th>
                          <th className="p-3 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoc.itemsDetail.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3">
                              <p className="font-black text-slate-800">{item.name}</p>
                              {item.desc && <p className="text-[10px] text-slate-400 font-normal mt-0.5">{item.desc}</p>}
                            </td>
                            <td className="p-3 text-center text-slate-600">{item.qty}</td>
                            <td className="p-3 text-left text-slate-600">{(item.price || 0).toLocaleString('ar-SA')} ر.س</td>
                            <td className="p-3 text-left text-primary font-black">{((item.qty || 1) * (item.price || 0)).toLocaleString('ar-SA')} ر.s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-slate-600 text-xs font-normal mb-1">تم إنشاء هذا المستند بنص إجمالي:</p>
                    <p className="text-slate-800 font-bold">{selectedDoc.items}</p>
                  </div>
                )}
              </div>

              {/* Dialog Actions */}
              <div className="flex gap-2 pt-2">
                {selectedDoc.pdfUrl && (
                  <Button 
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-11 font-black gap-2"
                    onClick={() => window.open(selectedDoc.pdfUrl, '_blank')}
                  >
                    <FileDown className="w-4 h-4" /> تحميل نسخة PDF
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  className="rounded-xl h-11 px-4 text-slate-500 font-bold"
                  onClick={() => setSelectedDoc(null)}
                >
                  إغلاق
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
