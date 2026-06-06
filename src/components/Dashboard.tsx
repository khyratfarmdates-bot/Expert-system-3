import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Users, Wallet, Bell, ShoppingBag, ShoppingCart,
  AlertTriangle, CheckCircle, FileText, Clock, Zap,
  Briefcase, Scan, HardHat, Loader2, X, TrendingUp,
  TrendingDown, Building2, ChevronLeft, ArrowLeft,
  Package, BarChart2, Banknote, UserCheck, Star, Receipt
} from 'lucide-react';
import {
  collection, query, limit, onSnapshot, orderBy, where, getDocs, doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { AnimatePresence, motion } from 'motion/react';
import {
  AreaChart, Area, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import SmartAttendance from './SmartAttendance';
import { analyzeProjectSpending } from '../lib/gemini';

/* ─── Types ─── */
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
  id: string; text: string; type: 'amber' | 'red' | 'rose'; icon: React.ElementType; tab: string;
}
interface BriefingItem {
  id: string; text: string; done: boolean; icon: React.ElementType;
}

/* ─── Helpers ─── */
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-US');
}
function fmtDate(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء النور';
  return 'مساء الخير';
}
function todayAr() {
  return new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ─── StatCard ─── */
function StatCard({ label, value, sub, icon: Icon, iconColor, iconBg, onClick, alert }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconColor: string; iconBg: string;
  onClick?: () => void; alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-right bg-white rounded-xl border p-4 flex flex-col gap-2.5
        hover:shadow-md transition-all active:scale-[0.97]
        ${alert ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <ChevronLeft className="w-3.5 h-3.5 text-slate-300 mt-0.5" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black leading-none ${alert ? 'text-amber-700' : 'text-slate-900'}`}>
          {typeof value === 'number' ? fmtNum(value) : value}
        </p>
        {sub && <p className="text-[10px] text-slate-400 font-semibold mt-1">{sub}</p>}
      </div>
    </button>
  );
}

/* ─── ActionBtn ─── */
function ActionBtn({ icon: Icon, label, onClick, color }: {
  icon: React.ElementType; label: string; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-3.5 py-3 rounded-xl font-bold
        text-[11px] whitespace-nowrap transition-all active:scale-95 min-w-[68px] ${color}`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

/* ─── Section Header ─── */
function Section({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">{label}</p>
      {sub && <p className="text-[9px] text-slate-400 font-semibold">{sub}</p>}
    </div>
  );
}

/* ═══════════ MAIN ═══════════ */
export default function Dashboard({ goToTab }: { goToTab: (tabId: string) => void }) {
  const { user, profile } = useAuth();
  const isManager    = profile?.role === 'manager';
  const isSupervisor = profile?.role === 'supervisor';
  const isElevated   = isManager || isSupervisor;

  const [aiInsight, setAiInsight]   = useState<string | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [stats, setStats]           = useState<DashboardStats>({
    income: 0, expenses: 0, purchases: 0, employeesCount: 0,
    pendingInvoices: 0, workerExpense: 0, activeWorkers: 0, activeProjects: 0
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [workers, setWorkers]           = useState<any[]>([]);
  const [alerts, setAlerts]             = useState<AlertItem[]>([]);
  const [briefing, setBriefing]         = useState<BriefingItem[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [chartData] = useState([
    { d: 'السبت', v: 400 }, { d: 'الأحد', v: 300 }, { d: 'الاثنين', v: 500 },
    { d: 'الثلاثاء', v: 278 }, { d: 'الأربعاء', v: 189 },
    { d: 'الخميس', v: 390 }, { d: 'الجمعة', v: 349 },
  ]);

  /* ── AI ── */
  useEffect(() => {
    if (!isManager) return;
    (async () => {
      setAiLoading(true);
      try {
        const pSnap = await getDocs(query(collection(db, 'projects'), limit(1)));
        const tSnap = await getDocs(query(collection(db, 'transactions'), limit(10)));
        if (!pSnap.empty) {
          setAiInsight(await analyzeProjectSpending(
            pSnap.docs[0].data(), tSnap.docs.map(d => d.data())
          ));
        } else {
          setAiInsight('لا توجد مشاريع مسجلة حتى الآن. أضف أول مشروع من قسم المشاريع.');
        }
      } catch (e) { console.error('AI:', e); }
      finally { setAiLoading(false); }
    })();
  }, [isManager]);

  /* ── Announcement ── */
  useEffect(() => {
    const u = onSnapshot(doc(db, 'system', 'settings'), s => {
      if (s.exists()) setAnnouncement(s.data().generalAnnouncement || '');
    });
    return u;
  }, []);

  /* ── Projects ── */
  useEffect(() => {
    const u = onSnapshot(collection(db, 'projects'), s => {
      setStats(p => ({
        ...p,
        activeProjects: s.docs.filter(d => ['in-progress', 'active'].includes(d.data().status)).length
      }));
    }, e => console.error('Projects:', e));
    return u;
  }, []);

  /* ── Alerts & Briefing ── */
  useEffect(() => {
    if (!isElevated || !profile) return;
    (async () => {
      const al: AlertItem[] = [];
      const br: BriefingItem[] = [];
      if (stats.pendingInvoices > 0) {
        al.push({ id: 'pur', text: `${stats.pendingInvoices} طلبات شراء تنتظر موافقتك`, type: 'amber', icon: ShoppingBag, tab: 'purchases' });
        br.push({ id: 'b1', text: 'اعتماد طلبات الشراء المعلقة', done: false, icon: FileText });
      }
      if (stats.expenses > stats.income * 0.8 && stats.income > 0) {
        al.push({ id: 'exp', text: 'المصروفات تجاوزت 80% من الدخل', type: 'red', icon: AlertTriangle, tab: 'financials' });
      }
      try {
        const ps = await getDocs(query(collection(db, 'projects'), limit(10)));
        const ap = ps.docs.filter(d => d.data().status === 'in-progress');
        if (ap.length > 0)
          br.push({ id: 'b2', text: `متابعة ${ap.length} مشاريع نشطة`, done: false, icon: Briefcase });
        const today = new Date().toISOString().split('T')[0];
        const att = await getDocs(query(collection(db, 'attendance'), where('dateString', '==', today)));
        if (att.size < stats.employeesCount * 0.5 && stats.employeesCount > 0) {
          al.push({ id: 'att', text: 'نسبة الحضور منخفضة اليوم', type: 'rose', icon: Users, tab: 'attendance_manager' });
          br.push({ id: 'b3', text: 'مراجعة سجل الحضور والانصراف', done: false, icon: Clock });
        }
        if (stats.income > 5000)
          br.push({ id: 'b4', text: 'تحليل الأداء الربحي للشهر', done: true, icon: CheckCircle });
      } catch (e) { console.error('Insights:', e); }
      setAlerts(al);
      setBriefing(br.slice(0, 5));
    })();
  }, [isElevated, profile, stats.pendingInvoices, stats.income, stats.expenses, stats.employeesCount]);

  /* ── Transactions & Stats ── */
  useEffect(() => {
    if (!profile) return;
    const subs: (() => void)[] = [];

    const qT = isElevated
      ? query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(6))
      : query(collection(db, 'transactions'), where('createdBy', '==', user?.uid), orderBy('date', 'desc'), limit(6));

    subs.push(onSnapshot(qT, s => {
      setTransactions(s.docs.map(d => {
        const data = d.data();
        let dateOriginal: Date = new Date();
        if (data.date) {
          dateOriginal = typeof data.date.toDate === 'function'
            ? data.date.toDate() : new Date(data.date);
        }
        return { id: d.id, ...data, dateOriginal };
      }));
    }, e => console.error('Trans:', e)));

    if (isElevated) {
      subs.push(onSnapshot(collection(db, 'workerTransactions'), s => {
        const total = s.docs.reduce((acc, d) =>
          d.data().type === 'payment' ? acc + (d.data().amount || 0) : acc, 0);
        setStats(p => ({ ...p, workerExpense: total }));
      }, e => console.error('WorkerTrans:', e)));

      const ago90 = new Date();
      ago90.setDate(ago90.getDate() - 90);
      subs.push(onSnapshot(
        query(collection(db, 'transactions'), where('date', '>=', ago90.toISOString())),
        s => {
          let inc = 0, exp = 0, pur = 0, pend = 0;
          s.docs.forEach(d => {
            const data = d.data();
            if (data.type === 'income')    inc  += data.amount || 0;
            if (data.type === 'expense')   exp  += data.amount || 0;
            if (data.type === 'purchase')  pur  += data.amount || 0;
            if (data.status === 'pending') pend++;
          });
          setStats(p => ({ ...p, income: inc, expenses: exp, purchases: pur, pendingInvoices: pend }));
        }, e => console.error('Stats:', e)));

      subs.push(onSnapshot(query(collection(db, 'users'), limit(100)), s =>
        setStats(p => ({ ...p, employeesCount: s.size }))));

      subs.push(onSnapshot(query(collection(db, 'workers'), limit(100)), s => {
        setWorkers(s.docs.map(d => ({ id: d.id, ...d.data() })));
        setStats(p => ({ ...p, activeWorkers: s.size }));
      }));
    }

    return () => subs.forEach(u => u());
  }, [profile, isElevated, user?.uid]);

  /* ── Derived ── */
  const totalExpenses = stats.expenses + stats.workerExpense;
  const netBalance    = stats.income - totalExpenses;
  const profitPct     = stats.income > 0 ? Math.round((netBalance / stats.income) * 100) : 0;

  /* ═══════ RENDER ═══════ */
  return (
    <div className="min-h-screen bg-slate-50 pb-28" dir="rtl">
      <div className="w-full px-3 sm:px-5 py-5 space-y-5">

        {/* ══ HEADER ══ */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">{greeting()}</p>
            <h1 className="text-xl font-black text-slate-900">{profile?.name || 'المدير'}</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">{todayAr()}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {announcement && (
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1.5 bg-amber-50 border border-amber-200
                    text-amber-800 rounded-xl px-3 py-2 text-[10px] font-bold max-w-[130px] truncate hover:bg-amber-100 transition">
                    <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{announcement}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-black">
                      <Bell className="w-4 h-4 text-amber-500" /> إعلان الإدارة
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-slate-700 leading-relaxed bg-amber-50 rounded-xl p-4 border border-amber-100">
                    {announcement}
                  </p>
                </DialogContent>
              </Dialog>
            )}
            <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-lg">V2.1</span>
          </div>
        </div>

        {/* ══ EMPLOYEE VIEW ══ */}
        {!isElevated && <SmartAttendance />}

        {/* ══ ALERTS ══ */}
        {isManager && alerts.length > 0 && (
          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {alerts.slice(0, 3).map(alert => (
                <motion.div
                  key={alert.id} layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    alert.type === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                    alert.type === 'red'   ? 'bg-red-50 border-red-200 text-red-900' :
                                             'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg text-white shrink-0 ${
                    alert.type === 'amber' ? 'bg-amber-500' :
                    alert.type === 'red'   ? 'bg-red-500' : 'bg-rose-500'
                  }`}><alert.icon className="w-3.5 h-3.5" /></div>
                  <p className="flex-1 text-xs font-bold cursor-pointer truncate"
                    onClick={() => goToTab(alert.tab)}>{alert.text}</p>
                  <button
                    onClick={() => setAlerts(p => p.filter(a => a.id !== alert.id))}
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/10 transition">
                    <X className="w-3.5 h-3.5 opacity-50" />
                  </button>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ══ QUICK ACTIONS ══ */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">الوصول السريع</p>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <ActionBtn icon={HardHat}       label="العمالة"     color="bg-emerald-500 text-white"   onClick={() => goToTab('workers_management')} />
            <ActionBtn icon={Scan}          label="مسح فاتورة"  color="bg-slate-900 text-white"     onClick={() => goToTab('camera')} />
            <ActionBtn icon={Clock}         label="الحضور"      color="bg-blue-500 text-white"      onClick={() => goToTab('attendance_manager')} />
            <ActionBtn icon={ShoppingCart}  label="المشتريات"   color="bg-amber-500 text-white"     onClick={() => goToTab('purchases')} />
            <ActionBtn icon={Briefcase}     label="المشاريع"    color="bg-indigo-500 text-white"    onClick={() => goToTab('projects')} />
            <ActionBtn icon={Wallet}        label="الماليات"    color="bg-teal-600 text-white"      onClick={() => goToTab('financials')} />
            {isManager && <>
              <ActionBtn icon={TrendingUp}  label="المبيعات"    color="bg-pink-500 text-white"      onClick={() => goToTab('sales')} />
              <ActionBtn icon={Users}       label="الفريق"      color="bg-purple-500 text-white"    onClick={() => goToTab('employees')} />
              <ActionBtn icon={Package}     label="المخزون"     color="bg-orange-500 text-white"    onClick={() => goToTab('inventory')} />
              <ActionBtn icon={Banknote}    label="البنوك"      color="bg-cyan-600 text-white"      onClick={() => goToTab('banking')} />
            </>}
          </div>
        </div>

        {/* ══ KPI: FINANCIAL ══ */}
        {isElevated && (
          <>
            <div>
              <Section label="المالية" sub="آخر 90 يوم" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="الدخل الإجمالي" value={stats.income} sub="إجمالي الإيرادات"
                  icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50"
                  onClick={() => goToTab('financials')}
                />
                <StatCard
                  label="المصروفات" value={totalExpenses} sub="شامل رواتب العمال"
                  icon={TrendingDown} iconColor="text-red-500" iconBg="bg-red-50"
                  onClick={() => goToTab('financials')}
                />
                <StatCard
                  label="صافي الربح" value={netBalance}
                  sub={netBalance >= 0 ? `هامش ${profitPct}%` : '⚠ تجاوز الدخل'}
                  icon={Wallet}
                  iconColor={netBalance >= 0 ? 'text-indigo-600' : 'text-red-600'}
                  iconBg={netBalance >= 0 ? 'bg-indigo-50' : 'bg-red-50'}
                  onClick={() => goToTab('financials')}
                />
                <StatCard
                  label="طلبات معلقة" value={stats.pendingInvoices} sub="تنتظر الموافقة"
                  icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50"
                  alert={stats.pendingInvoices > 0}
                  onClick={() => goToTab('purchases')}
                />
              </div>
            </div>

            {/* ══ KPI: OPERATIONS ══ */}
            <div>
              <Section label="التشغيل والموارد" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="عمال اليومية" value={stats.activeWorkers} sub="مسجلون في النظام"
                  icon={HardHat} iconColor="text-emerald-600" iconBg="bg-emerald-50"
                  onClick={() => goToTab('workers_management')}
                />
                <StatCard
                  label="المشاريع النشطة" value={stats.activeProjects} sub="قيد التنفيذ"
                  icon={Building2} iconColor="text-blue-600" iconBg="bg-blue-50"
                  onClick={() => goToTab('projects')}
                />
                <StatCard
                  label="الفريق" value={stats.employeesCount} sub="موظف مسجل"
                  icon={Users} iconColor="text-slate-600" iconBg="bg-slate-100"
                  onClick={() => goToTab('employees')}
                />
                <StatCard
                  label="إجمالي المشتريات" value={stats.purchases} sub="آخر 90 يوم"
                  icon={ShoppingBag} iconColor="text-orange-600" iconBg="bg-orange-50"
                  onClick={() => goToTab('purchases')}
                />
              </div>
            </div>
          </>
        )}

        {/* ══ MAIN CONTENT GRID ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ─── LEFT COL: Transactions + Workers ─── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Transactions */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-900">آخر الحركات المالية</p>
                  <p className="text-[10px] text-slate-400">العمليات المسجلة حديثاً</p>
                </div>
                <button
                  onClick={() => goToTab('financials')}
                  className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:opacity-70 transition">
                  عرض الكل <ArrowLeft className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {transactions.length > 0 ? transactions.map((tx: any, i: number) => (
                  <button key={tx.id || i} onClick={() => goToTab('financials')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-right">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === 'income' ? 'bg-emerald-50' :
                      tx.type === 'purchase' ? 'bg-orange-50' : 'bg-red-50'
                    }`}>
                      {tx.type === 'income'
                        ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                        : tx.type === 'purchase'
                        ? <ShoppingBag className="w-4 h-4 text-orange-500" />
                        : <TrendingDown className="w-4 h-4 text-red-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{tx.description || 'عملية مالية'}</p>
                      <p className="text-[10px] text-slate-400">{fmtDate(tx.dateOriginal)}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className={`text-sm font-black ${
                        tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {tx.type === 'income' ? '+' : '−'}{fmtNum(tx.amount || 0)}
                      </p>
                      <p className="text-[9px] text-slate-400 font-semibold">ر.س</p>
                    </div>
                  </button>
                )) : (
                  <div className="py-10 text-center text-slate-300">
                    <Wallet className="w-8 h-8 mx-auto opacity-25 mb-2" />
                    <p className="text-xs font-bold">لا توجد حركات مالية</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workers Preview */}
            {isElevated && workers.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-black text-slate-900">عمال اليومية</p>
                    <p className="text-[10px] text-slate-400">آخر المسجلين</p>
                  </div>
                  <button
                    onClick={() => goToTab('workers_management')}
                    className="flex items-center gap-1 text-[10px] font-black text-emerald-600 hover:opacity-70 transition">
                    إدارة الكل <ArrowLeft className="w-3 h-3" />
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {workers.slice(0, 5).map(w => (
                    <button key={w.id} onClick={() => goToTab('workers_management')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-right">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-sm shrink-0">
                        {(w.name?.[0] || '؟')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{w.name}</p>
                        <p className="text-[10px] text-slate-400">{w.role || 'عامل يومي'}</p>
                      </div>
                      <span className="text-xs font-black text-emerald-600 shrink-0">{w.dailyRate} ر.س/يوم</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT COL: AI + Chart + Briefing ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* AI Card — Manager only */}
            {isManager && (
              <div className="bg-slate-900 rounded-xl p-4 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-black">الذكاء الميداني</p>
                    <p className="text-[9px] text-white/40 uppercase tracking-widest">AI Field Analysis</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-lg p-3 mb-3 min-h-[72px]">
                  {aiLoading ? (
                    <div className="flex items-center gap-2 text-white/40">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-xs">جاري تحليل بيانات المشاريع...</span>
                    </div>
                  ) : (
                    <p className="text-xs text-white/80 leading-relaxed line-clamp-4">
                      {aiInsight || 'لا توجد بيانات كافية للتحليل الآن.'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => goToTab('briefing')}
                  className="w-full py-2.5 rounded-lg bg-white text-slate-900 text-xs font-black hover:bg-slate-100 transition">
                  فتح الموجز التنفيذي ←
                </button>
              </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-black text-slate-900">مؤشر الإنتاجية الأسبوعي</p>
              <p className="text-[10px] text-slate-400 mb-3">التوزيع التشغيلي</p>
              <div className="h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#0d9488" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="d" axisLine={false} tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 700 }} dy={5} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10, border: 'none',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        fontFamily: 'Cairo', fontSize: 11
                      }}
                      cursor={{ stroke: '#0d9488', strokeWidth: 1.5 }}
                    />
                    <Area type="monotone" dataKey="v" stroke="#0d9488"
                      strokeWidth={2} fill="url(#ga)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Briefing */}
            {isElevated && briefing.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <p className="text-sm font-black text-slate-900">موجز اليوم</p>
                </div>
                <div className="space-y-2">
                  {briefing.map(b => (
                    <div key={b.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold ${
                      b.done
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-slate-50 text-slate-700 border border-slate-100'
                    }`}>
                      <b.icon className={`w-3.5 h-3.5 shrink-0 ${b.done ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className="flex-1 truncate">{b.text}</span>
                      {b.done && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links — Manager shortcuts to key sections */}
            {isManager && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">روابط إدارية</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'الأستاذ العام',   icon: Receipt,    tab: 'general_ledger', color: 'text-slate-700' },
                    { label: 'الاعتمادات',      icon: CheckCircle, tab: 'approvals',     color: 'text-emerald-700' },
                    { label: 'تقييم الأداء',    icon: Star,        tab: 'evaluation',    color: 'text-amber-700' },
                    { label: 'التحليلات',       icon: BarChart2,   tab: 'analytics',     color: 'text-indigo-700' },
                    { label: 'الأرشيف',         icon: Package,     tab: 'archive',       color: 'text-slate-600' },
                    { label: 'إعدادات النظام',  icon: UserCheck,   tab: 'settings',      color: 'text-teal-700' },
                  ].map(link => (
                    <button key={link.tab} onClick={() => goToTab(link.tab)}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100
                        hover:bg-slate-100 hover:border-slate-200 transition text-right">
                      <link.icon className={`w-3.5 h-3.5 shrink-0 ${link.color}`} />
                      <span className="text-[11px] font-bold text-slate-700 truncate">{link.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
