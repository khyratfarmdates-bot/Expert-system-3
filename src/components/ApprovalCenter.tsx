import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  FileText, 
  CreditCard, 
  Plane,
  AlertCircle,
  Loader2,
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { sendNotification } from '../lib/notifications';
import { toast } from 'sonner';

export default function ApprovalCenter() {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Pending Leave Requests
    const qLeaves = query(collection(db, 'leaveRequests'), where('status', '==', 'pending'));
    const unsubLeaves = onSnapshot(qLeaves, async (snapshot) => {
      const data = await Promise.all(snapshot.docs.map(async (d) => {
        const leaveData = d.data();
        const leave = { id: d.id, ...leaveData };
        const userSnap = await getDoc(doc(db, 'users', leaveData.userId));
        return { ...leave, userName: userSnap.exists() ? userSnap.data().name : 'موظف مجهول' };
      }));
      setLeaves(data);
    });

    // 2. Pending Financial Adjustments
    const qAdj = query(collection(db, 'financialAdjustments'), where('status', '==', 'pending'));
    const unsubAdj = onSnapshot(qAdj, async (snapshot) => {
      const data = await Promise.all(snapshot.docs.map(async (d) => {
        const adjData = d.data();
        const adj = { id: d.id, ...adjData };
        const userSnap = await getDoc(doc(db, 'users', adjData.userId));
        return { ...adj, userName: userSnap.exists() ? userSnap.data().name : 'موظف مجهول' };
      }));
      setAdjustments(data);
    });

    // 3. Pending Transactions (OCR/Invoices)
    const qTx = query(collection(db, 'transactions'), where('status', '==', 'pending'));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    setLoading(false);
    return () => {
      unsubLeaves();
      unsubAdj();
      unsubTx();
    };
  }, []);

  const handleApprove = async (collectionName: string, id: string, title: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), {
        status: 'approved',
        approvedBy: profile?.uid,
        approvedAt: serverTimestamp()
      });
      await logActivity('اعتماد طلب', `تمت الموافقة على: ${title}`, 'success', 'system', profile?.uid || 'system');
      
      await sendNotification({
        title: 'تم اعتماد طلب',
        message: `تمت الموافقة النهائية على: ${title}`,
        type: 'approval',
        category: 'system',
        targetRole: 'all',
        tab: 'approvals'
      });

      toast.success('تم الاعتماد بنجاح');
    } catch (e) {
      toast.error('فشل في عملية الاعتماد');
    }
  };

  const handleReject = async (collectionName: string, id: string, title: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), {
        status: 'rejected',
        rejectedBy: profile?.uid,
        rejectedAt: serverTimestamp()
      });
      await logActivity('رفض طلب', `تم رفض: ${title}`, 'warning', 'system', profile?.uid || 'system');
      
      await sendNotification({
        title: 'تم رفض طلب',
        message: `نأسف، تم رفض طلبك: ${title}. يرجى مراجعة الإدارة للمزيد من التفاصيل.`,
        type: 'error',
        category: 'system',
        targetRole: 'all', // We could target the specific user if we passed userId
        tab: 'approvals'
      });

      toast.warning('تم رفض الطلب');
    } catch (e) {
      toast.error('فشل في عملية الرفض');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">جاري تحميل مركز الاعتمادات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-primary tracking-tight">مركز الاعتمادات الإدارية</h1>
        <p className="text-[13px] text-muted-foreground">صلاحيات المدير للموافقة على الإجازات، الفواتير، والتعديلات المالية</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-6">
        <StatSummary title="إجازات" count={leaves.length} icon={Plane} color="text-blue-600" />
        <StatSummary title="فواتير" count={transactions.length} icon={FileText} color="text-amber-600" />
        <StatSummary title="مالية" count={adjustments.length} icon={CreditCard} color="text-emerald-600" />
      </div>

      <Tabs defaultValue="leaves" className="w-full">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="flex w-max sm:grid sm:w-full sm:max-w-md grid-cols-3 rounded-xl p-1 bg-slate-100/80 backdrop-blur-sm shadow-inner min-w-full sm:min-w-0">
            <TabsTrigger value="leaves" className="gap-2 font-black text-[11px] sm:text-xs">
              <Plane className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">الإجازات ({leaves.length})</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 font-black text-[11px] sm:text-xs">
              <FileText className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">الفواتير ({transactions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-2 font-black text-[11px] sm:text-xs">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">المالية ({adjustments.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leaves" className="mt-4 sm:mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
            {leaves.map((leave) => (
              <ApprovalCard 
                key={leave.id}
                title={leave.type === 'annual' ? 'إجازة سنوية' : 'إجازة مرضية'}
                user={leave.userName}
                details={`${leave.startDate} - ${leave.reason}`}
                onApprove={() => handleApprove('leaveRequests', leave.id, `إجازة ${leave.userName}`)}
                onReject={() => handleReject('leaveRequests', leave.id, `إجازة ${leave.userName}`)}
              />
            ))}
            {leaves.length === 0 && <EmptyState text="لا توجد طلبات إجازة معلقة حالياً" />}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 sm:mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
            {transactions.map((tx) => (
              <ApprovalCard 
                key={tx.id}
                title={tx.vendor || 'مورد جديد'}
                user="OCR كاميرا"
                details={`${tx.amount} ر.س - ${tx.description}`}
                onApprove={() => handleApprove('transactions', tx.id, `فاتورة ${tx.vendor}`)}
                onReject={() => handleReject('transactions', tx.id, `فاتورة ${tx.vendor}`)}
                showPreview
              />
            ))}
            {transactions.length === 0 && <EmptyState text="لا توجد فواتير بانتظار المراجعة" />}
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-4 sm:mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
            {adjustments.map((adj) => (
              <ApprovalCard 
                key={adj.id}
                title={adj.type === 'bonus' ? 'مكافأة مالية' : 'خصم / سلفة'}
                user={adj.userName}
                details={`${adj.amount} ر.س - ${adj.reason}`}
                onApprove={() => handleApprove('financialAdjustments', adj.id, `تعديل مالي ${adj.userName}`)}
                onReject={() => handleReject('financialAdjustments', adj.id, `تعديل مالي ${adj.userName}`)}
              />
            ))}
            {adjustments.length === 0 && <EmptyState text="لا توجد تعديلات مالية تتطلب الاعتماد" />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatSummary({ title, count, icon: Icon, color }: any) {
  return (
    <Card className="rounded-xl sm:rounded-2xl border-border bg-white shadow-sm overflow-hidden border-t-2 border-t-slate-100">
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-center justify-between gap-1">
          <div className={`p-1.5 sm:p-2 bg-slate-50 ${color} rounded-lg`}><Icon className="w-3.5 h-3.5 sm:w-5 h-5"/></div>
          {count > 0 && <Badge variant="destructive" className="animate-pulse px-1.5 py-0 min-w-[20px] justify-center text-[10px] sm:text-xs">{count}</Badge>}
        </div>
        <div className="mt-2 sm:mt-4">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground truncate">{title}</p>
          <h3 className={`text-lg sm:text-2xl font-black ${count > 0 ? 'text-primary' : 'text-slate-300'}`}>{count}</h3>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalCard({ title, user, details, onApprove, onReject, showPreview }: any) {
  return (
    <Card className="rounded-xl sm:rounded-2xl border-border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden border-r-2 sm:border-r-4 border-r-amber-400 flex flex-col h-full">
      <CardContent className="p-3 sm:p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2 sm:mb-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-primary font-black text-[10px] sm:text-base capitalize">
              {user?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-primary text-[11px] sm:text-sm truncate leading-tight">{title}</h4>
              <p className="text-[9px] sm:text-xs text-muted-foreground font-medium truncate">{user}</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-none px-1.5 py-0 sm:px-3 sm:py-1 text-[8px] sm:text-[10px] font-bold">معلق</Badge>
          </div>
        </div>
        
        <div className="flex-1">
          <p className="text-[9px] sm:text-xs text-slate-600 mb-3 sm:mb-6 bg-slate-50/50 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-dashed border-slate-200 line-clamp-2 sm:line-clamp-none italic sm:not-italic">
            {details}
          </p>
          
          {showPreview && (
            <div className="mb-3 sm:mb-6 p-4 sm:p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-300 group cursor-pointer hover:border-accent hover:text-accent transition-all">
              <ImageIcon className="w-5 h-5 sm:w-8 sm:h-8" />
              <span className="text-[8px] sm:text-[10px] font-bold text-center">عرض المرفق</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 mt-auto border-t border-slate-50">
          <Button 
            onClick={onApprove} 
            size="sm"
            className="flex-1 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold h-8 sm:h-11 gap-1 sm:gap-2 text-[10px] sm:text-sm px-0"
          >
            <CheckCircle2 className="w-3 h-3 sm:w-4 h-4" />
            اعتماد
          </Button>
          <Button 
            onClick={onReject} 
            size="sm"
            variant="outline" 
            className="flex-1 rounded-lg sm:rounded-xl border-red-100 text-red-600 hover:bg-red-50 font-bold h-8 sm:h-11 gap-1 sm:gap-2 text-[10px] sm:text-sm px-0"
          >
            <XCircle className="w-3 h-3 sm:w-4 h-4" />
            رفض
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
      <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
      <p className="text-sm font-bold text-muted-foreground">{text}</p>
    </div>
  );
}
