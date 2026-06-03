import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Quotation, Transaction, UserProfile } from '../types';
import { toast } from 'sonner';
import { Check, X, Users, FileText, Landmark, UserPlus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDoc, serverTimestamp } from 'firebase/firestore';

export default function SalesRepsManagement() {
  const [reps, setReps] = useState<UserProfile[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState('quotations');

  // Add Sales Rep State
  const [isAddRepOpen, setIsAddRepOpen] = useState(false);
  const [newRep, setNewRep] = useState({
    name: '',
    email: '',
    phone: '',
    compensationType: 'salary' as 'salary' | 'commission_only',
    baseSalary: '',
    commissionRate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // 1. Fetch Sales Reps
    const unsubReps = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'sales_rep')),
      (snap) => setReps(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile)))
    );

    // 2. Fetch pending quotations
    const unsubQuotes = onSnapshot(
      query(collection(db, 'quotations'), where('status', '==', 'pending')),
      (snap) => setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quotation)))
    );

    // 3. Fetch pending transactions from sales reps (loans, invoices)
    // Here we just fetch all pending expenses that belong to sales reps
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('status', '==', 'pending')),
      (snap) => {
        // filter client-side to only those created by sales_reps
        // Note: For large datasets, it's better to add a field 'creatorRole' to transactions
        const allPending = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        // We will just show all pending for now, assuming manager can approve them here
        // or filter if we have reps data available.
        setTransactions(allPending);
      }
    );

    return () => {
      unsubReps();
      unsubQuotes();
      unsubTx();
    };
  }, []);

  const handleUpdateQuotation = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'quotations', id), { status });
      toast.success(`تم ${status === 'approved' ? 'اعتماد' : 'رفض'} عرض السعر`);
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث حالة العرض');
    }
  };

  const handleUpdateTransaction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'transactions', id), { status });
      toast.success(`تم ${status === 'approved' ? 'اعتماد' : 'رفض'} الحركة المالية`);
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث الحركة المالي');
    }
  };

  const handleAddSalesRep = async () => {
    if (!newRep.name || !newRep.email) {
      toast.error('الرجاء إدخال الاسم والبريد الإلكتروني');
      return;
    }
    if (newRep.compensationType === 'salary' && !newRep.baseSalary) {
      toast.error('الرجاء إدخال الراتب الأساسي');
      return;
    }
    if (newRep.compensationType === 'commission_only' && !newRep.commissionRate) {
      toast.error('الرجاء إدخال نسبة العمولة');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: newRep.name,
        email: newRep.email.toLowerCase(),
        phone: newRep.phone,
        role: 'sales_rep',
        compensationType: newRep.compensationType,
        baseSalary: newRep.compensationType === 'salary' ? Number(newRep.baseSalary) : 0,
        commissionRate: newRep.compensationType === 'commission_only' ? Number(newRep.commissionRate) : 0,
        joinedAt: new Date().toISOString(),
      });
      
      toast.success('تمت إضافة المندوب بنجاح. سيتمكن من تسجيل الدخول ببريده الإلكتروني.');
      setIsAddRepOpen(false);
      setNewRep({ name: '', email: '', phone: '', compensationType: 'salary', baseSalary: '', commissionRate: '' });
    } catch (error: any) {
      console.error(error);
      toast.error('حدث خطأ أثناء إضافة المندوب: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">إدارة مناديب المبيعات</h1>
          <p className="text-slate-500 mt-1">راجع طلبات المناديب واعتمدها.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-primary text-white border-none shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Users className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold opacity-80">عدد المناديب</p>
              <h3 className="text-3xl font-black">{reps.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-600 text-white border-none shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><FileText className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold opacity-80">عروض معلقة</p>
              <h3 className="text-3xl font-black">{quotations.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500 text-white border-none shadow-lg">
          <CardContent className="p-6 flex items-center gap-4">
             <div className="bg-white/20 p-3 rounded-2xl"><Landmark className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold opacity-80">طلبات مالية معلقة</p>
              <h3 className="text-3xl font-black">{transactions.filter(t => reps.find(r => r.uid === t.createdBy)).length}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className="w-full max-w-3xl bg-white shadow-sm border border-slate-100 p-1.5 rounded-2xl flex flex-row-reverse justify-between">
            <TabsTrigger value="reps" className="flex-1 rounded-xl font-bold py-3 text-sm">قائمة المناديب</TabsTrigger>
            <TabsTrigger value="finance" className="flex-1 rounded-xl font-bold py-3 text-sm">الطلبات المالية</TabsTrigger>
            <TabsTrigger value="quotations" className="flex-1 rounded-xl font-bold py-3 text-sm">عروض الأسعار المعلقة</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="quotations" className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>عروض الأسعار التي بانتظار الاعتماد</CardTitle>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <p className="text-center text-slate-500 py-8">لا توجد عروض أسعار معلقة حالياً.</p>
              ) : (
                <div className="space-y-3">
                  {quotations.map(q => {
                    const rep = reps.find(r => r.uid === q.salesRepId);
                    return (
                      <div key={q.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">بواسطة: {rep?.name || 'مندوب غير معروف'}</span>
                          </div>
                          <h4 className="font-bold text-slate-800">العميل: {q.clientName}</h4>
                          <p className="text-sm text-slate-500 max-w-md">{q.items}</p>
                        </div>
                        <div className="flex flex-col md:items-end gap-2 shrink-0">
                          <p className="font-black text-primary text-lg">{q.totalAmount.toLocaleString()} ر.س</p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="bg-green-500 hover:bg-green-600 rounded-lg" onClick={() => handleUpdateQuotation(q.id, 'approved')}>
                              <Check className="w-4 h-4 mr-1" /> اعتماد
                            </Button>
                            <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => handleUpdateQuotation(q.id, 'rejected')}>
                              <X className="w-4 h-4 mr-1" /> رفض
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle>الطلبات المالية المعلقة (من المناديب)</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.filter(t => reps.find(r => r.uid === t.createdBy)).length === 0 ? (
                <p className="text-center text-slate-500 py-8">لا توجد طلبات مالية معلقة.</p>
              ) : (
                <div className="space-y-3">
                  {transactions
                    .filter(t => reps.find(r => r.uid === t.createdBy))
                    .map(tx => {
                    const rep = reps.find(r => r.uid === tx.createdBy);
                    return (
                      <div key={tx.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">المندوب: {rep?.name || 'غير معروف'}</span>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">{tx.category}</span>
                          </div>
                          <p className="text-sm text-slate-700 font-medium">{tx.description}</p>
                          {tx.attachmentURL && tx.attachmentURL !== 'https://via.placeholder.com/150' && (
                             <a href={tx.attachmentURL} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">عرض المرفق</a>
                          )}
                        </div>
                        <div className="flex flex-col md:items-end gap-2 shrink-0">
                          <p className="font-black text-red-600 text-lg">{tx.amount.toLocaleString()} ر.س</p>
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="bg-green-500 hover:bg-green-600 rounded-lg" onClick={() => handleUpdateTransaction(tx.id, 'approved')}>
                              <Check className="w-4 h-4 mr-1" /> اعتماد
                            </Button>
                            <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => handleUpdateTransaction(tx.id, 'rejected')}>
                              <X className="w-4 h-4 mr-1" /> رفض
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reps" className="space-y-6">
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <CardTitle className="text-xl font-black text-primary">قائمة المناديب</CardTitle>
              <Dialog open={isAddRepOpen} onOpenChange={setIsAddRepOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 gap-2">
                    <UserPlus className="w-4 h-4" />
                    إضافة مندوب جديد
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="text-primary font-black text-xl">إضافة مندوب مبيعات</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>الاسم الكامل</Label>
                      <Input value={newRep.name} onChange={e => setNewRep({...newRep, name: e.target.value})} placeholder="اسم المندوب" />
                    </div>
                    <div className="space-y-2">
                      <Label>البريد الإلكتروني (لتسجيل الدخول)</Label>
                      <Input type="email" value={newRep.email} onChange={e => setNewRep({...newRep, email: e.target.value})} placeholder="rep@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>رقم الجوال</Label>
                      <Input type="tel" value={newRep.phone} onChange={e => setNewRep({...newRep, phone: e.target.value})} placeholder="05XXXXXXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع التعويض المالي</Label>
                      <Select value={newRep.compensationType} onValueChange={(val: any) => setNewRep({...newRep, compensationType: val})}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع التعويض" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="salary">راتب ثابت + عمولات</SelectItem>
                          <SelectItem value="commission_only">عمولة فقط (بدون راتب)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newRep.compensationType === 'salary' ? (
                      <div className="space-y-2">
                        <Label>الراتب الأساسي (ر.س)</Label>
                        <Input type="number" value={newRep.baseSalary} onChange={e => setNewRep({...newRep, baseSalary: e.target.value})} placeholder="مثال: 4000" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>نسبة العمولة الثابتة (%)</Label>
                        <Input type="number" value={newRep.commissionRate} onChange={e => setNewRep({...newRep, commissionRate: e.target.value})} placeholder="مثال: 15" />
                      </div>
                    )}
                  </div>
                  <Button className="w-full font-black text-md bg-primary hover:bg-primary/90" onClick={handleAddSalesRep} disabled={isSubmitting}>
                    {isSubmitting ? "جاري الإضافة..." : "حفظ المندوب"}
                  </Button>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {reps.map(rep => (
                  <div key={rep.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 relative group">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl shadow-inner">
                      {rep.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{rep.name}</h4>
                      <p className="text-xs text-slate-500 mb-3">{rep.email}</p>
                      <div className="inline-flex items-center justify-center gap-2">
                        {rep.compensationType === 'commission_only' ? (
                          <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full font-bold">عمولة فقط: {rep.commissionRate || 0}%</span>
                        ) : (
                          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold">راتب: {rep.baseSalary || 0} ر.س</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {reps.length === 0 && <p className="text-sm text-slate-500 col-span-full text-center py-8">لا يوجد مناديب مسجلين.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
