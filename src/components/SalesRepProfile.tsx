import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Wallet, Receipt, TrendingUp, CheckCircle2, Loader2, Landmark } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserProfile, Quotation } from '../types';

export default function SalesRepProfile({ salesRepId, onBack }: { salesRepId: string, onBack: () => void }) {
  const [rep, setRep] = useState<UserProfile | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRep = async () => {
      const docSnap = await getDoc(doc(db, 'users', salesRepId));
      if (docSnap.exists()) {
        setRep({ id: docSnap.id, ...docSnap.data() } as UserProfile);
      }
      setLoading(false);
    };
    fetchRep();

    const qQuotes = query(collection(db, 'quotations'), where('salesRepId', '==', salesRepId));
    const unsubQuotes = onSnapshot(qQuotes, snap => {
      setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Quotation)));
    });

    return () => unsubQuotes();
  }, [salesRepId]);

  if (loading || !rep) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">جاري تحميل الملف الشخصي للمندوب...</p>
      </div>
    );
  }

  const approvedQuotes = quotations.filter(q => q.status === 'approved');
  const totalSales = approvedQuotes.reduce((acc, q) => acc + (q.totalAmount || 0), 0);
  
  let calculatedCommission = 0;
  if (rep.compensationType === 'commission_only') {
    calculatedCommission = totalSales * ((rep.commissionRate || 0) / 100);
  } else {
    // If salary, they might still have commission. Using commissionRate if exists.
    calculatedCommission = totalSales * ((rep.commissionRate || 0) / 100);
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-20" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
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

          <Avatar className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl ring-2 ring-slate-100">
            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rep.name}`} />
            <AvatarFallback className="bg-primary text-white text-3xl font-black">{rep.name?.[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h1 className="text-3xl font-black text-primary tracking-tight">{rep.name}</h1>
              <Badge className="bg-amber-100 text-amber-700 border-none px-3 py-1 text-xs font-bold shadow-sm">
                مندوب مبيعات
              </Badge>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
              <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-full text-[13px] font-bold text-slate-600">
                <Wallet className="w-3.5 h-3.5" />
                {rep.compensationType === 'commission_only' ? 'نظام العمولات فقط' : 'راتب أساسي + عمولات'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-white border-none rounded-3xl">
          <CardContent className="p-6">
             <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-bold opacity-80 uppercase">إجمالي المبيعات المعتمدة</p>
                 <h3 className="text-3xl font-black mt-2">{totalSales.toLocaleString()} <span className="text-sm">ر.س</span></h3>
               </div>
               <div className="bg-white/20 p-3 rounded-2xl"><TrendingUp className="w-6 h-6" /></div>
             </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500 text-white border-none rounded-3xl">
          <CardContent className="p-6">
             <div className="flex justify-between items-start">
               <div>
                 <p className="text-xs font-bold opacity-80 uppercase">العمولات المستحقة ({rep.commissionRate || 0}%)</p>
                 <h3 className="text-3xl font-black mt-2">{calculatedCommission.toLocaleString()} <span className="text-sm">ر.س</span></h3>
               </div>
               <div className="bg-white/20 p-3 rounded-2xl"><Receipt className="w-6 h-6" /></div>
             </div>
          </CardContent>
        </Card>

        {rep.compensationType === 'salary' && (
          <Card className="bg-emerald-500 text-white border-none rounded-3xl">
            <CardContent className="p-6">
               <div className="flex justify-between items-start">
                 <div>
                   <p className="text-xs font-bold opacity-80 uppercase">الراتب الأساسي الثابت</p>
                   <h3 className="text-3xl font-black mt-2">{rep.baseSalary?.toLocaleString() || 0} <span className="text-sm">ر.س</span></h3>
                 </div>
                 <div className="bg-white/20 p-3 rounded-2xl"><Landmark className="w-6 h-6" /></div>
               </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-3xl shadow-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg font-black flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            عروض الأسعار المعتمدة ({approvedQuotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedQuotes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">لا توجد عروض أسعار معتمدة حتى الآن.</div>
          ) : (
            <div className="space-y-4">
              {approvedQuotes.map(q => (
                <div key={q.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <h4 className="font-bold text-slate-800">العميل: {q.clientName}</h4>
                    <p className="text-xs text-slate-500 max-w-sm truncate">{q.items}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-primary">{q.totalAmount.toLocaleString()} ر.س</p>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">معتمد</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
