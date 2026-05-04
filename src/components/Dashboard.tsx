import * as React from 'react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Wallet,
  Bell, 
  ShoppingBag,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  Zap,
  ChevronLeft,
  Briefcase,
  Scan,
  HardHat,
  Plus,
  Minus,
  Loader2,
  X
} from 'lucide-react';
import { collection, query, limit, onSnapshot, orderBy, where, getDocs, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

import SmartAttendance from './SmartAttendance';
import { analyzeProjectSpending } from '../lib/gemini';

interface DashboardStats {
  income: number;
  expenses: number;
  purchases: number;
  employeesCount: number;
  pendingInvoices: number;
  workerExpense: number;
  activeWorkers: number;
  activeProjects: number;
}

interface AlertItem {
  id: string;
  text: string;
  type: 'amber' | 'red' | 'rose' | 'slate';
  icon: any;
  tab: string;
}

interface BriefingItem {
  id: string;
  text: string;
  done: boolean;
  icon: any;
}

export default function Dashboard({ goToTab }: { goToTab: (tabId: string) => void }) {
  const { user, profile } = useAuth();
  const isManager = profile?.role === 'manager';
  const isSupervisor = profile?.role === 'supervisor';
  const isElevated = isManager || isSupervisor;


  const [aiInsight, setAiInsight] = useState<string | null>(null);

  useEffect(() => {
    if (!isManager) return;
    
    // Only Managers get the strategic AI insights
    const fetchAiInsights = async () => {
      setAiLoading(true);
      try {
        // Fetch last 5 projects and transactions to analyze
        const pSnap = await getDocs(query(collection(db, 'projects'), limit(1)));
        const tSnap = await getDocs(query(collection(db, 'transactions'), limit(10)));
        
        if (!pSnap.empty) {
          const project = pSnap.docs[0].data();
          const txs = tSnap.docs.map(d => d.data());
          const insight = await analyzeProjectSpending(project, txs);
          setAiInsight(insight);
        }
      } catch (e) {
        console.error("AI Insight Error:", e);
      } finally {
        setAiLoading(false);
      }
    };

    fetchAiInsights();
  }, [isManager]);

  const [stats, setStats] = useState<DashboardStats>({
    income: 0,
    expenses: 0,
    purchases: 0,
    employeesCount: 0,
    pendingInvoices: 0,
    workerExpense: 0,
    activeWorkers: 0,
    activeProjects: 0
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [chartData] = useState<any[]>([
    { name: 'السبت', value: 400 },
    { name: 'الأحد', value: 300 },
    { name: 'الأثنين', value: 200 },
    { name: 'الثلاثاء', value: 278 },
    { name: 'الأربعاء', value: 189 },
    { name: 'الخميس', value: 239 },
    { name: 'الجمعة', value: 349 },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [briefing, setBriefing] = useState<BriefingItem[]>([]);
  const [generalAnnouncement, setGeneralAnnouncement] = useState<string>('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
      if (snap.exists()) {
        setGeneralAnnouncement(snap.data().generalAnnouncement || '');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Get project counts
    const unsub = onSnapshot(collection(db, 'projects'), (snap) => {
       const docs = snap.docs.map(d => d.data());
       const activeProjects = docs.filter(d => d.status === 'in-progress' || d.status === 'active').length;
       setStats(prev => ({ ...prev, activeProjects }));
    }, (error) => console.error("Dashboard Project Stats Listen Error:", error));

    return () => unsub();
  }, []);

  // Attendance effect removed as it was unused in redefined Dashboard


  useEffect(() => {
    if (!profile) return;
    
    // Logic for Smart Alerts & Briefing
    const generateManagementInsights = async () => {
       const alertsList: AlertItem[] = [];
       const briefingList: BriefingItem[] = [];

       if (stats.pendingInvoices > 0) {
          alertsList.push({ id: 'pur', text: `لديك ${stats.pendingInvoices} طلبات شراء تنتظر الموافقة`, type: 'amber', icon: ShoppingBag, tab: 'purchases' });
          briefingList.push({ id: 'b1', text: 'مراجعة واعتماد طلبات الشراء المعلقة', done: false, icon: FileText });
       }

       if (stats.expenses > stats.income * 0.8 && stats.income > 0) {
          alertsList.push({ id: 'exp', text: 'تحذير: المصروفات وصلت لـ 80% من الدخل', type: 'red', icon: AlertTriangle, tab: 'financials' });
       }

       // Project check
       const projSnaps = await getDocs(query(collection(db, 'projects'), limit(10)));
       const activeProjs = projSnaps.docs.filter(p => p.data().status === 'in-progress');
       if (activeProjs.length > 0) {
          briefingList.push({ id: 'b2', text: `متابعة حالة التقدم في ${activeProjs.length} مشاريع نشطة`, done: false, icon: Briefcase });
       }

       // Attendance check
       const today = new Date().toISOString().split('T')[0];
       const attSnaps = await getDocs(query(collection(db, 'attendance'), where('dateString', '==', today)));
       if (attSnaps.size < stats.employeesCount * 0.5 && stats.employeesCount > 0) {
          alertsList.push({ id: 'att', text: 'تنبيه: نسبة حضور الفريق منخفضة اليوم', type: 'rose', icon: Users, tab: 'employees' });
          briefingList.push({ id: 'b3', text: 'التحقق من سجل الحضور والانصراف الصباحي', done: false, icon: Clock });
       }

       if (stats.income > 5000) {
          briefingList.push({ id: 'b4', text: 'تحليل الأداء الربحي للشهر الحالي', done: true, icon: CheckCircle });
       }

       setAlerts(alertsList);
       setBriefing(briefingList.slice(0, 4));
    };

    if (isElevated) {
       generateManagementInsights();
    }
  }, [profile, stats.employeesCount, stats.pendingInvoices, stats.income, stats.expenses]);

  useEffect(() => {
    if (!profile) return;

    const unsubscibers: (() => void)[] = [];

    // Listen to transitions for stats and recent list
    // If not elevated, only listen to OWN transactions
    const qTransBase = collection(db, 'transactions');
    const qWorkerBase = collection(db, 'workerTransactions');

    const qTrans = isElevated 
      ? query(qTransBase, orderBy('date', 'desc'), limit(10))
      : query(qTransBase, where('createdBy', '==', user?.uid), orderBy('date', 'desc'), limit(10));

    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        const dateRaw = data.date;
        let dateOriginal: any = new Date();
        let dateDisplay = 'اليوم';

        if (dateRaw) {
          if (typeof dateRaw.toDate === 'function') {
            dateOriginal = dateRaw.toDate();
            dateDisplay = dateOriginal.toLocaleString('ar-SA');
          } else {
            dateOriginal = new Date(dateRaw);
            dateDisplay = isNaN(dateOriginal.getTime()) ? 'اليوم' : dateOriginal.toLocaleString('ar-SA');
          }
        }

        return {
          id: doc.id,
          ...data,
          dateOriginal,
          date: dateDisplay
        };
      });

      setTransactions(docs.slice(0, 5));
    }, (error) => console.error("Dashboard Trans Listen Error:", error));
    unsubscibers.push(unsubscribeTrans);

    if (isElevated) {
      onSnapshot(qWorkerBase, (snapshot) => {
        let workerExpenseTotal = 0;
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'payment') {
            workerExpenseTotal += (data.amount || 0);
          }
        });
        setStats(prev => ({ ...prev, workerExpense: workerExpenseTotal }));
      }, (error) => console.error("Dashboard Worker Trans Listen Error:", error));

      // 🚀 SPEED OPTIMIZATION: Only listen to transactions from the last 90 days for dashboard stats
      // This prevents the app from slowing down as the database grows over years.
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const qRecent = query(collection(db, 'transactions'), where('date', '>=', ninetyDaysAgo.toISOString()));
      
      const unsubscribeAll = onSnapshot(qRecent, (snapshot) => {
        let activeIncomeTotal = 0;
        let expTotal = 0;
        let purTotal = 0;
        let pendingTotal = 0;
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'income') activeIncomeTotal += (data.amount || 0);
          if (data.type === 'expense') expTotal += (data.amount || 0);
          if (data.type === 'purchase') purTotal += (data.amount || 0);
          if (data.status === 'pending') pendingTotal++;
        });
        setStats(prev => ({ 
          ...prev, 
          income: activeIncomeTotal, 
          expenses: expTotal, 
          purchases: purTotal, 
          pendingInvoices: pendingTotal 
        }));
      }, (error) => {
        console.error("Dashboard Stats Listen Error:", error);
      });
      unsubscibers.push(unsubscribeAll);
    }

    // Listen to users
    // Regular employees can't list all users based on strict rules (though I eased them slightly)
    // We'll only list if elevated to be safe and logical
    if (isElevated) {
      const qUsers = query(collection(db, 'users'), limit(5));
      const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
        setStats(prev => ({ ...prev, employeesCount: snapshot.size }));
      }, (error) => console.error("Dashboard Users Listen Error:", error));
      unsubscibers.push(unsubscribeUsers);

      const qWorkers = query(collection(db, 'workers'), limit(5));
      const unsubscribeWorkers = onSnapshot(qWorkers, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isWorker: true
        }));
        setWorkers(docs);
        setStats(prev => ({ ...prev, activeWorkers: snapshot.size }));
      }, (error) => console.error("Dashboard Workers Listen Error:", error));
      unsubscibers.push(unsubscribeWorkers);
    }

    return () => {
      unsubscibers.forEach(unsub => unsub());
    };
  }, [profile, isElevated]);

  // Removed redundant goToTab local definition to use prop


  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 mb-24 py-4" dir="rtl">
      {/* Compact Header Section */}
      <div className="flex flex-col gap-0 mb-1 px-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            لوحة التحكم
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none font-black text-[8px] h-4">V2.1</Badge>
          </h1>
          {/* General Announcement Badge */}
          {generalAnnouncement && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="animate-in fade-in slide-in-from-left-4 duration-700 max-w-[150px] md:max-w-xs"
            >
              <Dialog>
                <DialogTrigger asChild>
                  <span className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 shadow-sm block truncate cursor-pointer hover:bg-primary/20 transition-colors">
                    {generalAnnouncement}
                  </span>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-2xl" dir="rtl">
                   <DialogHeader>
                     <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                       <Bell className="w-5 h-5 text-primary" />
                       رسالة إدارية
                     </DialogTitle>
                   </DialogHeader>
                   <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                     <p className="text-slate-700 font-bold leading-relaxed text-sm">
                       {generalAnnouncement}
                     </p>
                   </div>
                </DialogContent>
              </Dialog>
            </motion.div>
          )}
        </div>
        <p className="text-[10px] font-bold text-slate-400">
          مرحباً {profile?.name || 'المدير'} — نظام إدارة المشاريع والعمليات الميدانية المتكاملة
        </p>
      </div>

      {!isElevated && (
        <SmartAttendance />
      )}

      {/* Urgent Alerts - Top Floating Section with Close Button */}
      {isManager && alerts.length > 0 && (
        <div className="space-y-2 px-1">
          <AnimatePresence mode="popLayout">
            {alerts.slice(0, 3).map((alert) => (
              <motion.div 
                key={alert.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={`group relative flex items-center justify-between p-3 rounded-xl shadow-lg border-2 transition-all ${
                   alert.type === 'amber' ? 'bg-amber-50 border-amber-100 text-amber-900 shadow-amber-500/5' :
                   alert.type === 'red' ? 'bg-red-50 border-red-100 text-red-900 shadow-red-500/5' :
                   'bg-rose-50 border-rose-100 text-rose-900 shadow-rose-500/5'
                }`}
              >
                <div 
                  className="flex flex-1 items-center gap-3 overflow-hidden cursor-pointer"
                  onClick={() => goToTab(alert.tab)}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${
                     alert.type === 'amber' ? 'bg-amber-500 text-white' :
                     alert.type === 'red' ? 'bg-red-500 text-white' :
                     'bg-rose-500 text-white'
                  }`}>
                    <alert.icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">تنبيه عاجل</span>
                    <span className="text-xs font-black truncate block">{alert.text}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-black/5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlerts(prev => prev.filter(a => a.id !== alert.id));
                    }}
                  >
                    <X className="w-4 h-4 opacity-40 hover:opacity-100" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Unified Quick Actions Bar - App-like Feel */}
      <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md p-2 rounded-[2rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar mx-1">
        <div className="flex gap-2 min-w-max px-1">
          <ActionButton icon={Users} label="العمالة" color="bg-primary text-white shadow-md shadow-primary/20" onClick={() => goToTab('workers_management')} />
          <ActionButton icon={Scan} label="رفع ميداني" color="bg-slate-900 text-white shadow-md shadow-black/10" onClick={() => goToTab('camera')} />
          <div className="w-px h-6 bg-slate-200 mt-2 mx-1" />
          <ActionButton icon={Plus} label="مصروف" color="bg-white text-red-500 border-red-50" onClick={() => goToTab('expenses')} />
          <ActionButton icon={Clock} label="حضور" color="bg-white text-blue-500 border-blue-50" onClick={() => goToTab('attendance_manager')} />
          <ActionButton icon={ShoppingCart} label="شراء" color="bg-white text-amber-500 border-amber-50" onClick={() => goToTab('purchases')} />
          <ActionButton icon={Briefcase} label="مشروع" color="bg-white text-emerald-500 border-emerald-50" onClick={() => goToTab('projects')} />
        </div>
      </div>

      {/* Primary Analytics Grid - 8 Cards (4+4) */}
      <div className="grid grid-cols-4 md:grid-cols-4 gap-2 md:gap-4 h-auto">
        <StatCard 
          title="عمال" 
          value={stats.activeWorkers} 
          icon={HardHat} 
          color="text-emerald-600" 
          bg="bg-emerald-50"
          sub="نشطون"
          onClick={() => goToTab('workers_management')}
        />
        <StatCard 
          title="السيولة" 
          value={stats.income} 
          icon={Wallet} 
          color="text-primary" 
          bg="bg-primary/5"
          sub="متاح"
          onClick={() => goToTab('financials')}
        />
        <StatCard 
          title="المشاريع" 
          value={stats.activeProjects} 
          icon={Briefcase} 
          color="text-blue-600" 
          bg="bg-blue-50"
          sub="جارية"
          onClick={() => goToTab('projects')}
        />
        <StatCard 
          title="المصاريف" 
          value={stats.expenses + stats.workerExpense} 
          icon={Minus} 
          color="text-red-500" 
          bg="bg-red-50"
          sub="تراكمي"
          onClick={() => goToTab('financials')}
        />
        
        {/* Row 2 */}
        <StatCard 
          title="طلبات" 
          value={stats.pendingInvoices} 
          icon={Clock} 
          color="text-amber-600" 
          bg="bg-amber-50"
          sub="معلقة"
          onClick={() => goToTab('purchases')}
        />
        <StatCard 
          title="الفريق" 
          value={stats.employeesCount} 
          icon={Users} 
          color="text-slate-600" 
          bg="bg-slate-100"
          sub="موظف"
          onClick={() => goToTab('employees')}
        />
        <StatCard 
          title="المشتريات" 
          value={stats.purchases} 
          icon={ShoppingBag} 
          color="text-orange-600" 
          bg="bg-orange-50"
          sub="فاتورة"
          onClick={() => goToTab('purchases')}
        />
        <StatCard 
          title="الأداء" 
          value="92%" 
          icon={Zap} 
          color="text-indigo-600" 
          bg="bg-indigo-50"
          sub="كفاءة"
          onClick={() => goToTab('analytics')}
        />
      </div>

      {/* Management Quick Insight - Replaces huge cards */}
      {isManager && (aiInsight || briefing.length > 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl md:rounded-3xl p-3 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 shadow-sm">
          {aiInsight && (
            <div className="flex-1 flex gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-indigo-500  flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <span className="text-[9px] md:text-[10px] font-black uppercase text-indigo-500 block mb-0.5 md:mb-1">توصيات الذكاء الميداني</span>
                <p className="text-[10px] md:text-xs text-slate-700 font-bold leading-relaxed">{aiInsight}</p>
              </div>
            </div>
          )}
          {briefing.length > 0 && (
             <div className="w-px bg-slate-200 hidden md:block" />
          )}
          {briefing.length > 0 && (
            <div className="flex-1 flex gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-emerald-500  flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="w-full">
                <span className="text-[9px] md:text-[10px] font-black uppercase text-emerald-500 block mb-0.5 md:mb-1">موجز الإدارة</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                  {briefing.slice(0, 4).map(b => (
                     <div key={b.id} className="flex items-center gap-1.5 p-1.5 md:p-2 rounded-lg md:rounded-xl bg-white border border-slate-100 text-[9px] md:text-[10px] text-slate-600 font-bold shadow-sm">
                        <b.icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
                        <span className="truncate">{b.text}</span>
                     </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        {/* Main Operating Area */}
        <div className="lg:col-span-8 space-y-4 md:space-y-8">
          <Card className="rounded-2xl md:rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-4 md:p-8">
               <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm md:text-xl font-black text-slate-900">سجل عمال اليومية</CardTitle>
                    <CardDescription className="text-[10px] md:text-sm font-bold text-slate-400 mt-0.5">مراجعة اليوميات والأجور</CardDescription>
                  </div>
                  <Button 
                    onClick={() => goToTab('workers_management')}
                    variant="ghost" 
                    className="text-primary font-black text-[10px] md:text-xs hover:bg-primary/5 rounded-lg h-8 md:h-10 px-3 md:px-4"
                  >
                    عرض الكل
                  </Button>
               </div>
            </CardHeader>
            <CardContent className="p-3 md:p-8">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                  {workers.length > 0 ? workers.slice(0, 4).map((worker) => (
                    <div 
                      key={worker.id}
                      onClick={() => goToTab('workers_management')}
                      className="group flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-xl md:rounded-[1.5rem] bg-slate-50/50 border border-transparent hover:border-primary/20 hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer"
                    >
                      <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-white shadow-sm flex items-center justify-center text-sm md:text-lg font-black text-primary border border-slate-100 group-hover:scale-110 transition-transform">
                        {worker.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 text-[11px] md:text-sm truncate">{worker.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tight">{worker.role || 'عامل'}</span>
                          <span className="w-0.5 h-0.5 md:w-1 md:h-1 rounded-full bg-slate-300" />
                          <span className="text-[8px] md:text-[10px] font-black text-primary">{worker.dailyRate} ر.س</span>
                        </div>
                      </div>
                      <ChevronLeft className="w-3 h-3 md:w-4 md:h-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  )) : (
                    <div className="col-span-full py-6 md:py-10 text-center space-y-2 md:space-y-3">
                       <Users className="w-8 h-8 md:w-12 md:h-12 text-slate-200 mx-auto" />
                       <p className="text-[10px] md:text-sm font-bold text-slate-400 italic">لا يوجد عمال مسجلين</p>
                    </div>
                  )}
               </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl md:rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-4 md:p-8 flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-sm md:text-xl font-black text-slate-900">مؤشر الإنتاجية التشغيلية</CardTitle>
                  <CardDescription className="text-[10px] md:text-sm font-bold text-slate-400 mt-0.5">توزيع الإنتاجية المالية أسبوعياً</CardDescription>
               </div>
            </CardHeader>
            <CardContent className="p-3 md:p-8">
               <div className="h-[180px] md:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2c7a7d" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2c7a7d" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                        dy={8}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', fontFamily: 'Cairo', fontSize: '10px' }}
                        cursor={{ stroke: '#2c7a7d', strokeWidth: 2 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#2c7a7d" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Tactical Intelligence Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          {/* AI Advisor Card */}
          <Card className="rounded-2xl md:rounded-[2.5rem] border-none shadow-xl bg-slate-900 text-white p-4 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
            <div className="absolute -top-20 -left-20 w-32 h-32 md:w-64 md:h-64 bg-primary/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-6">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 ring-4 ring-white/5">
                  <Zap className="w-4 h-4 md:w-6 md:h-6 text-amber-400 fill-amber-400 animate-pulse" />
                </div>
                <div>
                   <h3 className="font-black text-xs md:text-lg">تحليل الذكاء الميداني</h3>
                   <span className="text-[8px] md:text-[10px] text-white/40 uppercase tracking-widest font-black">AI Powered</span>
                </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                <div className="p-3 md:p-5 rounded-xl md:rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/10" onClick={() => goToTab('briefing')}>
                  <p className="text-slate-400 font-bold text-[8px] md:text-[10px] uppercase tracking-wider mb-1 md:mb-2 text-primary">استنتاج اليوم</p>
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-white/50 py-1">
                       <Loader2 className="w-3 h-3 animate-spin" />
                       <span className="text-[10px] font-bold">جاري التحليل...</span>
                    </div>
                  ) : (
                    <p className="text-[10px] md:text-sm font-bold text-white leading-relaxed line-clamp-2 md:line-clamp-none">{aiInsight || 'جاري تحليل بيانات المشاريع...'}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                   <div className="bg-white/5 p-2 md:p-4 rounded-xl md:rounded-2xl border border-white/5" onClick={() => goToTab('analytics')}>
                      <p className="text-[7px] md:text-[9px] font-black text-white/40 uppercase">الأداء</p>
                      <p className="text-sm md:text-lg font-black text-emerald-400">92%</p>
                   </div>
                   <div className="bg-white/5 p-2 md:p-4 rounded-xl md:rounded-2xl border border-white/5">
                      <p className="text-[7px] md:text-[9px] font-black text-white/40 uppercase">التكلفة</p>
                      <p className="text-sm md:text-lg font-black text-white">متوازن</p>
                   </div>
                </div>
                
                <Button 
                   onClick={() => goToTab('briefing')}
                   className="w-full h-10 md:h-14 rounded-xl md:rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-black text-[10px] md:text-sm mt-1 shadow-xl shadow-black/20"
                >
                  فتح الموجز التنفيذي
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick Transaction Feed */}
          <Card className="rounded-2xl md:rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
             <CardHeader className="p-4 md:p-8 pb-2 md:pb-4 border-b border-slate-50">
                <CardTitle className="text-sm md:text-lg font-black text-slate-900">حركات مالية أخيرة</CardTitle>
             </CardHeader>
             <CardContent className="p-2 md:p-8 pt-2 md:pt-4 space-y-1.5 md:space-y-3">
                {transactions.length > 0 ? transactions.slice(0, 4).map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 md:p-4 rounded-xl md:rounded-[1.25rem] bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => goToTab('financials')}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {tx.type === 'income' ? <Plus className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] md:text-[11px] font-black text-slate-800 truncate block w-20 md:w-auto">{tx.description}</p>
                        <p className="text-[7px] md:text-[9px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('ar-SA')}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] md:text-[11px] font-black ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{(tx.amount || 0).toLocaleString()}
                    </span>
                  </div>
                )) : (
                  <div className="py-6 md:py-10 text-center text-slate-300">
                     <Wallet className="w-8 h-8 md:w-10 md:h-10 mx-auto opacity-20 mb-2" />
                     <p className="text-[10px] md:text-xs font-bold">لا يوجد عمليات</p>
                  </div>
                )}
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg, sub, onClick }: { title: string, value: string | number, icon: any, color: string, bg: string, sub?: string, onClick?: () => void }) {
  return (
    <Card 
      onClick={onClick}
      className={`${bg} rounded-xl md:rounded-[2.5rem] border-none p-2 md:p-6 cursor-pointer transition-all active:scale-95 shadow-sm hover:shadow-md h-full flex flex-col justify-between group`}
    >
      <div className="flex items-center justify-between mb-1 md:mb-3">
        <div className={`p-1.5 md:p-2.5 rounded-lg md:rounded-2xl bg-white shadow-sm transition-transform group-hover:scale-110 ${color}`}>
          <Icon className="w-3.5 h-3.5 md:w-5 h-5" />
        </div>
        <div className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-black/5 flex items-center justify-center translate-x-1 md:translate-x-2">
          <ChevronLeft className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-30" />
        </div>
      </div>
      <div>
        <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-tight md:tracking-[0.1em] mb-0">{title}</p>
        <h3 className={`text-xs md:text-xl font-black ${color} tracking-tighter md:tracking-tight truncate`}>
           {typeof value === 'number' ? value.toLocaleString() : value}
        </h3>
        {sub && <p className="hidden md:block text-[8px] font-bold text-slate-400 mt-0.5 opacity-80 truncate">{sub}</p>}
      </div>
    </Card>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        onClick?.();
        if ('vibrate' in navigator) navigator.vibrate(10);
      }}
      className={`${color} flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black tracking-tight border border-transparent transition-all whitespace-nowrap shadow-sm active:shadow-none`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </motion.button>
  );
}



