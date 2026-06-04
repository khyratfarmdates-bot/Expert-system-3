import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Quotation, Transaction } from '../types';
import SmartOfferBot from './SmartOfferBot';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FileText, Landmark, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react';

export default function SalesRepDashboard() {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState('bot');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanReason, setLoanReason] = useState('');

  useEffect(() => {
    if (!profile) return;

    const unsubQuotes = onSnapshot(
      query(collection(db, 'quotations'), where('salesRepId', '==', profile.uid), orderBy('createdAt', 'desc')),
      (snap) => setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quotation)))
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('createdBy', '==', profile.uid), orderBy('date', 'desc')),
      (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)))
    );

    return () => { unsubQuotes(); unsubTx(); };
  }, [profile]);

  const handleRequestLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        type: 'expense',
        category: 'سلفة مندوب',
        amount: Number(loanAmount),
        description: `سلفة للمندوب: ${profile.name} - السبب: ${loanReason}`,
        date: Timestamp.now(),
        createdBy: profile.uid,
        status: 'pending',
      });
      toast.success('تم إرسال طلب السلفة للإدارة');
      setLoanAmount('');
      setLoanReason('');
    } catch {
      toast.error('حدث خطأ أثناء طلب السلفة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'rejected': return 'مرفوض';
      default: return 'قيد المراجعة';
    }
  };

  const totalQuotesValue = quotations.reduce((s, q) => s + (q.totalAmount || 0), 0);
  const approvedCount = quotations.filter(q => q.status === 'approved').length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">بوابة مندوب المبيعات</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            مرحباً <span className="font-black text-primary">{profile?.name}</span>، يمكنك إنشاء العروض وإدارة عملياتك من هنا.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="text-center bg-white border border-slate-100 rounded-2xl px-4 py-2.5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي العروض</p>
            <p className="text-lg font-black text-primary">{totalQuotesValue.toLocaleString()} <span className="text-xs">ر.س</span></p>
          </div>
          <div className="text-center bg-white border border-slate-100 rounded-2xl px-4 py-2.5 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase">معتمد</p>
            <p className="text-lg font-black text-emerald-600">{approvedCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-white shadow-sm border border-slate-100 p-1 rounded-2xl grid grid-cols-3 mb-6">
          <TabsTrigger value="bot" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white gap-2 flex items-center justify-center text-xs">
            <Sparkles className="w-4 h-4" /> الموظف الذكي
          </TabsTrigger>
          <TabsTrigger value="quotations" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-teal-600 data-[state=active]:text-white gap-2 flex items-center justify-center text-xs">
            <FileText className="w-4 h-4" /> عروضي السابقة
          </TabsTrigger>
          <TabsTrigger value="finance" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-2 flex items-center justify-center text-xs">
            <Landmark className="w-4 h-4" /> المالية
          </TabsTrigger>
        </TabsList>

        {/* === AI Smart Bot Tab === */}
        <TabsContent value="bot" className="space-y-6">
          <SmartOfferBot />
        </TabsContent>

        {/* === Past Quotations Tab === */}
        <TabsContent value="quotations" className="space-y-4">
          <Card className="border-none shadow-md rounded-3xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                عروض الأسعار الصادرة عني
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-bold text-sm">لا توجد عروض مسجلة بعد</p>
                  <p className="text-xs mt-1">استخدم تبويب «الموظف الذكي» لإنشاء أول عرض أسعار</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotations.map(q => (
                    <div key={q.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-800 text-sm">{q.clientName}</h4>
                        <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{q.items}</p>
                      </div>
                      <div className="text-left shrink-0 mr-4">
                        <p className="font-black text-primary text-sm">{q.totalAmount?.toLocaleString()} ر.س</p>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          {getStatusIcon(q.status)}
                          <span className="text-[10px] font-bold text-slate-500">{getStatusText(q.status)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Finance Tab === */}
        <TabsContent value="finance" className="space-y-4">
          <Card className="border-none shadow-md rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-500" />
                طلب سلفة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestLoan} className="space-y-3">
                <Input
                  type="number"
                  placeholder="المبلغ المطلوب (ر.س)"
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  className="rounded-xl h-12"
                  required
                />
                <Input
                  placeholder="سبب السلفة..."
                  value={loanReason}
                  onChange={e => setLoanReason(e.target.value)}
                  className="rounded-xl h-12"
                  required
                />
                <Button type="submit" className="w-full h-12 rounded-xl font-black" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الإرسال...' : 'إرسال طلب السلفة للإدارة'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base font-black text-slate-800">سجل الحركات المالية</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm font-bold">لا توجد حركات مالية مسجلة.</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{tx.category}</h4>
                        <p className="text-xs text-slate-400 truncate max-w-xs">{tx.description}</p>
                      </div>
                      <div className="text-left shrink-0 mr-4">
                        <p className={`font-black text-sm ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{tx.amount?.toLocaleString()} ر.س
                        </p>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          {getStatusIcon(tx.status || 'approved')}
                          <span className="text-[10px] font-bold text-slate-500">{getStatusText(tx.status || 'approved')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
