import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Quotation, Transaction } from '../types';
import AIQuotationBuilder from './AIQuotationBuilder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, FileText, Landmark, Camera, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default function SalesRepDashboard() {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState('quotations');
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

    return () => {
      unsubQuotes();
      unsubTx();
    };
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
    } catch (error) {
      toast.error('حدث خطأ أثناء طلب السلفة');
    } finally {
      setIsSubmitting(false);
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'rejected': return 'مرفوض';
      default: return 'قيد المراجعة';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">بوابة مندوب المبيعات</h1>
          <p className="text-slate-500 mt-1">مرحباً {profile?.name}، يمكنك إدارة مبيعاتك وطلباتك من هنا.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full max-w-3xl bg-white shadow-sm border border-slate-100 p-1 rounded-2xl grid grid-cols-3 mb-8">
          <TabsTrigger value="quotations" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-emerald-500 data-[state=active]:text-white gap-2 flex items-center justify-center">
             <FileText className="w-4 h-4" /> عروض الأسعار
          </TabsTrigger>
          <TabsTrigger value="invoices" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white gap-2 flex items-center justify-center">
             <Camera className="w-4 h-4" /> الفواتير
          </TabsTrigger>
          <TabsTrigger value="finance" className="rounded-xl font-bold py-2.5 gap-2 flex items-center justify-center">
             <Landmark className="w-4 h-4" /> المالية والسلف
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-6">
          <AIQuotationBuilder type="quotation" />

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>عروض الأسعار السابقة</CardTitle>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <p className="text-center text-slate-500 py-8">لا توجد عروض أسعار مسجلة.</p>
              ) : (
                <div className="space-y-3">
                  {quotations.map(q => (
                    <div key={q.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-800">{q.clientName}</h4>
                        <p className="text-sm text-slate-500 truncate max-w-md">{q.items}</p>
                      </div>
                      <div className="text-left">
                        <p className="font-black text-primary">{q.totalAmount.toLocaleString()} ر.س</p>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          {getStatusIcon(q.status)}
                          <span className="text-xs font-bold">{getStatusText(q.status)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" />
                طلب سلفة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestLoan} className="flex gap-4 items-start">
                <div className="flex-1 space-y-4">
                  <Input type="number" placeholder="المبلغ المطلوب" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} required />
                  <Input placeholder="سبب السلفة" value={loanReason} onChange={e => setLoanReason(e.target.value)} required />
                </div>
                <Button type="submit" className="rounded-xl h-[92px]" disabled={isSubmitting}>
                  إرسال الطلب
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>سجل الحركات المالية</CardTitle>
            </CardHeader>
            <CardContent>
               {transactions.length === 0 ? (
                <p className="text-center text-slate-500 py-8">لا توجد حركات مالية مسجلة.</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-800">{tx.category}</h4>
                        <p className="text-sm text-slate-500 truncate max-w-md">{tx.description}</p>
                      </div>
                      <div className="text-left">
                        <p className={`font-black ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} ر.س
                        </p>
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          {getStatusIcon(tx.status || 'approved')}
                          <span className="text-xs font-bold">{getStatusText(tx.status || 'approved')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
           <AIQuotationBuilder type="invoice" />
        </TabsContent>

      </Tabs>
    </div>
  );
}
