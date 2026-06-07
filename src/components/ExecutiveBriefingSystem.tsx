import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, Briefcase, ShoppingBag, Users, ArrowLeft,
  BarChart3, Volume2, Play, Square, Loader2,
  TrendingUp, TrendingDown, Wallet, Clock,
  HardHat, CheckCircle, AlertTriangle, Building2,
  RefreshCw, ChevronLeft, Sparkles, ShieldCheck,
  Coins, Activity, FileText
} from 'lucide-react';
import {
  collection, query, onSnapshot, where, orderBy, limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeProjectSpending, analyzeCompanyPortfolioCredit } from '../lib/gemini';
import { toast } from 'sonner';


/* ─── Types ─── */
interface BriefingItem {
  id: string;
  type: 'action' | 'insight' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon: React.ElementType;
  category: string;
  tab: string;
  count?: number;
}

interface RealStats {
  income: number;
  expenses: number;
  net: number;
  pendingPurchases: number;
  activeProjects: number;
  totalWorkers: number;
  totalEmployees: number;
  todayAttendance: number;
}

/* ─── Helpers ─── */
function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-US');
}
function fmtTime(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ─── KPI Card ─── */
function KpiCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${color === 'text-emerald-600' ? 'bg-emerald-100' : color === 'text-red-500' ? 'bg-red-100' : color === 'text-indigo-600' ? 'bg-indigo-100' : 'bg-amber-100'}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1 font-semibold">{sub}</p>}
    </div>
  );
}

/* ═══════ MAIN ═══════ */
export default function ExecutiveBriefingSystem({ goToTab }: { goToTab?: (tab: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceFocus, setVoiceFocus] = useState<'all' | 'financial' | 'operations'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [lastUpdated, setLastUpdated] = useState(fmtTime());
  const [stats, setStats] = useState<RealStats>({
    income: 0, expenses: 0, net: 0,
    pendingPurchases: 0, activeProjects: 0,
    totalWorkers: 0, totalEmployees: 0, todayAttendance: 0
  });
  const [briefingItems, setBriefingItems] = useState<BriefingItem[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Raw collections for AI analysis
  const [rawProjects, setRawProjects] = useState<any[]>([]);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [projectAnalysisMap, setProjectAnalysisMap] = useState<Record<string, { reading: boolean; text?: string; isError?: boolean }>>({});
  const [globalPortfolioAnalysis, setGlobalPortfolioAnalysis] = useState<{ reading: boolean; text?: string }>({ reading: false });


  /* ── Build briefing items from real stats ── */
  useEffect(() => {
    const items: BriefingItem[] = [];

    if (stats.pendingPurchases > 0) {
      items.push({
        id: 'pur-1', type: 'warning', priority: 'high',
        title: 'طلبات شراء تنتظر اعتمادك',
        description: `${stats.pendingPurchases} طلب شراء معلق. يجب مراجعتها لضمان استمرارية التوريد للمواقع.`,
        icon: ShoppingBag, category: 'المشتريات', tab: 'purchases', count: stats.pendingPurchases
      });
    }

    if (stats.activeProjects > 0) {
      items.push({
        id: 'proj-1', type: 'action', priority: 'medium',
        title: 'مشاريع نشطة تحتاج متابعة',
        description: `${stats.activeProjects} مشروع قيد التنفيذ حالياً. تأكد من مطابقة الجداول الزمنية والميزانيات.`,
        icon: Building2, category: 'المشاريع', tab: 'projects', count: stats.activeProjects
      });
    }

    if (stats.net < 0) {
      items.push({
        id: 'fin-warn', type: 'warning', priority: 'high',
        title: 'تحذير: المصروفات تتجاوز الدخل',
        description: `صافي الربح سالب بمقدار ${fmtNum(Math.abs(stats.net))} ر.س — يجب مراجعة بنود الصرف فوراً.`,
        icon: AlertTriangle, category: 'المالية', tab: 'financials'
      });
    } else if (stats.income > 0) {
      const margin = Math.round((stats.net / stats.income) * 100);
      items.push({
        id: 'fin-1', type: 'insight', priority: 'low',
        title: 'تحليل التدفق المالي',
        description: `الدخل: ${fmtNum(stats.income)} ر.س — المصروفات: ${fmtNum(stats.expenses)} ر.س — هامش الربح: ${margin}%`,
        icon: BarChart3, category: 'المالية', tab: 'financials'
      });
    }

    if (stats.totalWorkers > 0) {
      items.push({
        id: 'wkr-1', type: 'action', priority: 'low',
        title: 'متابعة رواتب عمال اليومية',
        description: `${stats.totalWorkers} عامل يومي مسجل في النظام. تأكد من تسوية مستحقاتهم بانتظام.`,
        icon: HardHat, category: 'العمالة', tab: 'workers_management', count: stats.totalWorkers
      });
    }

    if (stats.todayAttendance > 0 && stats.totalEmployees > 0) {
      const pct = Math.round((stats.todayAttendance / stats.totalEmployees) * 100);
      const isLow = pct < 70;
      items.push({
        id: 'att-1',
        type: isLow ? 'warning' : 'insight',
        priority: isLow ? 'high' : 'low',
        title: isLow ? 'نسبة حضور منخفضة اليوم' : 'سجل الحضور اليوم',
        description: `${stats.todayAttendance} من ${stats.totalEmployees} موظف حاضر (${pct}%)`,
        icon: Users, category: 'الحضور', tab: 'attendance_manager', count: stats.todayAttendance
      });
    }

    setBriefingItems(items);
    setLastUpdated(fmtTime());
    if (items.length > 0 || stats.income > 0) setLoading(false);
  }, [stats]);

  /* ── Firebase real-time subscriptions ── */
  useEffect(() => {
    const subs: (() => void)[] = [];
    const today = new Date().toISOString().split('T')[0];
    const ago90 = new Date();
    ago90.setDate(ago90.getDate() - 90);

    // Transactions → income / expenses / pending
    subs.push(onSnapshot(
      query(collection(db, 'transactions'), where('date', '>=', ago90.toISOString())),
      snap => {
        let inc = 0, exp = 0, pend = 0;
        const txsList: any[] = [];
        snap.forEach(d => {
          const data = d.data();
          txsList.push({ id: d.id, ...data });
          if (data.type === 'income') inc += data.amount || 0;
          if (data.type === 'expense' || data.type === 'purchase') exp += data.amount || 0;
          if (data.status === 'pending') pend++;
        });
        setRawTransactions(txsList);
        setStats(p => ({ ...p, income: inc, expenses: exp, net: inc - exp, pendingPurchases: pend }));
        setLoading(false);
      },
      err => { console.error('Briefing/Trans:', err); setLoading(false); }
    ));

    // Projects
    subs.push(onSnapshot(collection(db, 'projects'), snap => {
      const projsList: any[] = [];
      snap.forEach(d => {
        projsList.push({ id: d.id, ...d.data() });
      });
      setRawProjects(projsList);
      const active = projsList.filter(p => ['in-progress', 'active'].includes(p.status)).length;
      setStats(p => ({ ...p, activeProjects: active }));
    }));

    // Workers
    subs.push(onSnapshot(query(collection(db, 'workers'), limit(200)), snap => {
      setStats(p => ({ ...p, totalWorkers: snap.size }));
    }));

    // Employees
    subs.push(onSnapshot(query(collection(db, 'users'), limit(200)), snap => {
      setStats(p => ({ ...p, totalEmployees: snap.size }));
    }));

    // Today attendance
    subs.push(onSnapshot(
      query(collection(db, 'attendance'), where('dateString', '==', today)),
      snap => setStats(p => ({ ...p, todayAttendance: snap.size }))
    ));

    return () => subs.forEach(u => u());
  }, []);

  /* ── Voice ── */
  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const generateVoiceBrief = () => {
    window.speechSynthesis.cancel();

    const margin = stats.income > 0 ? Math.round((stats.net / stats.income) * 100) : 0;

    let text = `مرحباً يا مدير. إليك الموجز التنفيذي. `;

    if (voiceFocus === 'all' || voiceFocus === 'financial') {
      text += `المالية: الدخل ${fmtNum(stats.income)} ريال، المصروفات ${fmtNum(stats.expenses)} ريال، `;
      text += stats.net >= 0
        ? `صافي الربح ${fmtNum(stats.net)} ريال بهامش ${margin} بالمئة. `
        : `تحذير: الخسارة ${fmtNum(Math.abs(stats.net))} ريال. `;
    }

    if (voiceFocus === 'all' || voiceFocus === 'operations') {
      if (stats.pendingPurchases > 0)
        text += `يوجد ${stats.pendingPurchases} طلب شراء معلق يحتاج اعتمادك. `;
      if (stats.activeProjects > 0)
        text += `لديك ${stats.activeProjects} مشروع نشط قيد التنفيذ. `;
      if (stats.totalWorkers > 0)
        text += `يوجد ${stats.totalWorkers} عامل يومي مسجل. `;
    }

    text += briefingItems.filter(i => i.priority === 'high').length > 0
      ? `إجمالي التنبيهات العالية الأولوية: ${briefingItems.filter(i => i.priority === 'high').length} بند. ننصح بمعالجتها فوراً.`
      : `لا توجد تنبيهات حرجة حالياً. الوضع مستقر.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleProjectAIAnalysis = async (project: any) => {
    setProjectAnalysisMap(prev => ({ ...prev, [project.id]: { reading: true } }));
    try {
      const relatedTxs = rawTransactions.filter(t => t.projectId === project.id);
      const resText = await analyzeProjectSpending(project, relatedTxs);
      setProjectAnalysisMap(prev => ({
        ...prev,
        [project.id]: { reading: false, text: resText || 'تعذر الحصول على استجابة.' }
      }));
      toast.success('تم تحليل بيانات المشروع بنجاح');
    } catch (e: any) {
      console.error(e);
      setProjectAnalysisMap(prev => ({
        ...prev,
        [project.id]: { reading: false, text: 'حدث خطأ أثناء الاتصال بـ Gemini: ' + (e.message || e), isError: true }
      }));
      toast.error('فشل الاتصال بالذكاء الاصطناعي');
    }
  };

  const handleCompanyPortfolioAIAnalysis = async () => {
    setGlobalPortfolioAnalysis({ reading: true });
    try {
      const activeProjects = rawProjects.filter(p => !p.status || ['in-progress', 'active', 'on-hold'].includes(p.status));
      const projectsSummary = activeProjects.map(p => {
        const relatedTxs = rawTransactions.filter(t => t.projectId === p.id);
        const totalExp = relatedTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        return {
          id: p.id,
          title: p.title || p.name || 'مشروع بدون عنوان',
          budget: Number(p.budget) || 0,
          progress: Number(p.progress) || 0,
          totalExpenses: totalExp,
          remaining: (Number(p.budget) || 0) - totalExp
        };
      });

      const resultText = await analyzeCompanyPortfolioCredit(projectsSummary, rawTransactions);
      setGlobalPortfolioAnalysis({ reading: false, text: resultText });
      toast.success('اكتمل التقرير المالي الاستشاري');
    } catch (e: any) {
      console.error(e);
      setGlobalPortfolioAnalysis({ reading: false, text: 'عذراً، فشل تنفيذ التحليل الائتماني الشامل: ' + (e.message || e) });
      toast.error('تعذر إجراء تقييم المحفظة');
    }
  };

  /* ── Filter ── */
  const filtered = briefingItems.filter(item => {
    if (activeFilter === 'high') return item.priority === 'high';
    if (activeFilter === 'medium') return item.priority === 'medium';
    return true;
  });

  const highCount = briefingItems.filter(i => i.priority === 'high').length;

  /* ═══════ RENDER ═══════ */
  return (
    <div className="min-h-screen bg-slate-50 pb-28" dir="rtl">
      <div className="w-full px-3 sm:px-5 py-5 space-y-5">

        {/* ══ HEADER ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Title block */}
          <div className="lg:col-span-2 bg-slate-900 rounded-xl p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-base font-black text-white leading-tight">الموجز التنفيذي الذكي</h1>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">AI Executive Briefing</p>
              </div>
              <div className="mr-auto flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
                <RefreshCw className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/30 font-bold">{lastUpdated}</span>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              بيانات حية من Firebase — الأرقام محسوبة من المعاملات والمشاريع والحضور الفعلي في النظام.
            </p>

            {/* High priority badge */}
            {highCount > 0 && (
              <div className="mt-4 flex items-center gap-2 bg-red-500/15 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs font-bold text-red-300">{highCount} بنود عالية الأولوية تحتاج تدخلك الآن</span>
              </div>
            )}
          </div>

          {/* Voice control */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-slate-600" />
                <p className="text-sm font-black text-slate-800">التقرير الصوتي</p>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mb-3">
                يقرأ الأرقام الحقيقية من النظام بناءً على التركيز المحدد:
              </p>
              <div className="space-y-1.5 mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">التركيز</p>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { v: 'all', label: 'شامل' },
                    { v: 'financial', label: 'المالية' },
                    { v: 'operations', label: 'التشغيل' },
                  ] as const).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setVoiceFocus(opt.v)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                        voiceFocus === opt.v
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
            {isSpeaking ? (
              <button
                onClick={stopSpeaking}
                className="w-full h-10 rounded-xl bg-red-500 text-white text-xs font-black flex items-center justify-center gap-2 animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-white" /> إيقاف التشغيل
              </button>
            ) : (
              <button
                onClick={generateVoiceBrief}
                disabled={loading}
                className="w-full h-10 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-slate-800 transition disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> تشغيل الموجز الصوتي
              </button>
            )}
          </div>
        </div>

        {/* ══ KPI ROW ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="الدخل الإجمالي" value={`${fmtNum(stats.income)} ر.س`}
            sub="آخر 90 يوم" icon={TrendingUp} color="text-emerald-600" bg="bg-white border-slate-200" />
          <KpiCard label="المصروفات" value={`${fmtNum(stats.expenses)} ر.س`}
            sub="آخر 90 يوم" icon={TrendingDown} color="text-red-500" bg="bg-white border-slate-200" />
          <KpiCard
            label="صافي الربح" value={`${stats.net >= 0 ? '+' : ''}${fmtNum(stats.net)} ر.س`}
            sub={stats.income > 0 ? `هامش ${Math.round((stats.net / stats.income) * 100)}%` : '—'}
            icon={Wallet}
            color={stats.net >= 0 ? 'text-indigo-600' : 'text-red-600'}
            bg={stats.net >= 0 ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200'}
          />
          <KpiCard label="طلبات معلقة" value={stats.pendingPurchases.toLocaleString('en-US')}
            sub="تنتظر اعتمادك" icon={Clock}
            color={stats.pendingPurchases > 0 ? 'text-amber-600' : 'text-slate-500'}
            bg={stats.pendingPurchases > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}
          />
        </div>

        {/* ══ FILTER BAR ══ */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-white border border-slate-200 p-0.5 rounded-xl gap-0.5">
            {([
              { v: 'all', label: `الكل (${briefingItems.length})` },
              { v: 'high', label: `عاجل (${highCount})` },
              { v: 'medium', label: 'متوسط' },
            ] as const).map(f => (
              <button
                key={f.v}
                onClick={() => setActiveFilter(f.v)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeFilter === f.v
                    ? f.v === 'high' ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >{f.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            مباشر من Firebase
          </div>
        </div>

        {/* ══ BRIEFING GRID ══ */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-2 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-slate-100 rounded" />
                  <div className="h-2 bg-slate-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-black text-slate-500">لا توجد بنود في هذه الفئة</p>
            <p className="text-xs text-slate-400 mt-1">الوضع مستقر ✓</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <div className={`bg-white rounded-xl border h-full flex flex-col overflow-hidden ${
                    item.priority === 'high' ? 'border-red-200' :
                    item.priority === 'medium' ? 'border-amber-200' : 'border-slate-200'
                  }`}>
                    {/* Card header */}
                    <div className="p-4 flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          item.priority === 'high' ? 'bg-red-50' :
                          item.priority === 'medium' ? 'bg-amber-50' : 'bg-slate-50'
                        }`}>
                          <item.icon className={`w-4.5 h-4.5 ${
                            item.priority === 'high' ? 'text-red-600' :
                            item.priority === 'medium' ? 'text-amber-600' : 'text-slate-500'
                          }`} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.count !== undefined && (
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                              item.priority === 'high' ? 'bg-red-50 text-red-600' :
                              item.priority === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>{item.count}</span>
                          )}
                          <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                            {item.category}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-sm font-black text-slate-800 mb-1.5">{item.title}</h3>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">{item.description}</p>
                    </div>

                    {/* Card footer */}
                    <div className={`px-4 py-3 border-t flex items-center justify-between ${
                      item.priority === 'high' ? 'bg-red-50/50 border-red-100' :
                      item.priority === 'medium' ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                        item.priority === 'high' ? 'bg-red-100 text-red-700' :
                        item.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.priority === 'high' ? '● عاجل' : item.priority === 'medium' ? '◐ متوسط' : '○ منخفض'}
                      </span>
                      {goToTab && (
                        <button
                          onClick={() => goToTab(item.tab)}
                          className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:opacity-70 transition"
                        >
                          الذهاب للقسم <ChevronLeft className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ══ AI FINANCIAL ANALYSIS & DEFICIT EARLY WARNING SECTION (EBS-3) ══ */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-tight">الرقابة المالية الوقائية وتنبؤات العجز (Gemini AI)</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Project Financial standing & early deficit warnings</p>
              </div>
            </div>
            
            <button
              onClick={handleCompanyPortfolioAIAnalysis}
              disabled={globalPortfolioAnalysis.reading || rawProjects.length === 0}
              className="px-4 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-indigo-600/10 cursor-pointer active:scale-95 border-none"
            >
              {globalPortfolioAnalysis.reading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري فحص المحفظة الائتمانية بالكامل...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 animate-bounce" />
                  تحليل ائتماني وقائي شامل لشركة خبراء الرسم
                </>
              )}
            </button>
          </div>

          {/* Global executive report */}
          {globalPortfolioAnalysis.text && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-950 text-white rounded-xl p-5 space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 border-b border-indigo-900/40 pb-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-black text-white">التقرير الائتماني المالي الشامل للمدير التنفيذي</h4>
              </div>
              <div className="text-xs leading-relaxed font-semibold text-slate-200 whitespace-pre-line text-right">
                {globalPortfolioAnalysis.text}
              </div>
            </motion.div>
          )}

          {/* Active Projects List with specific inline Gemini Credit analysis */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">تقييم المشاريع بشكل فردي وتدقيق نفقات المواقع</h4>
            
            {rawProjects.filter(p => !p.status || ['in-progress', 'active'].includes(p.status)).length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold text-center py-4 bg-slate-50 rounded-xl">لا توجد مشاريع نشطة حالياً لإخضاعها للفحص الذكي.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {rawProjects
                  .filter(p => !p.status || ['in-progress', 'active'].includes(p.status))
                  .map(p => {
                    const relatedTxs = rawTransactions.filter(t => t.projectId === p.id);
                    const totalSpent = relatedTxs
                      .filter(t => t.type === 'expense')
                      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
                    const budget = Number(p.budget) || 0;
                    const balance = budget - totalSpent;
                    const pct = budget > 0 ? Math.min(100, Math.round((totalSpent / budget) * 100)) : 0;
                    const isOverBudget = totalSpent > budget && budget > 0;
                    const isApproachingCrisis = pct >= 75 && pct <= 100 && budget > 0;
                    const aiResult = projectAnalysisMap[p.id];

                    return (
                      <div 
                        key={p.id} 
                        className={`border rounded-xl p-4 transition-all bg-white relative ${
                          isOverBudget ? 'border-red-200 bg-red-50/5' :
                          isApproachingCrisis ? 'border-amber-200 bg-amber-50/5' : 'border-slate-100 hover:border-slate-200 shadow-sm'
                        }`}
                      >
                        {/* Project Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                              {(p.projectType === 'hoardings' && 'أسوار دعائية') || 
                               (p.projectType === 'signage_printing' && 'لوحات وطباعة') || 
                               (p.projectType === 'cladding_letters' && 'كلادينج وحروف بارزة') || 
                               (p.projectType === 'digital_screens' && 'شاشات ومجسمات') || 'دعاية وإنشاءات'}
                            </span>
                            <h5 className="font-black text-xs text-slate-800 mt-1">{p.title || p.name}</h5>
                            <p className="text-[10px] text-slate-400 font-bold">العميل: {p.clientName || 'غير مسجل'}</p>
                          </div>

                          <div className="text-left">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-lg font-sans">
                              إنجاز: {p.progress || 0}%
                            </span>
                          </div>
                        </div>

                        {/* Financial Parameters */}
                        <div className="grid grid-cols-3 gap-2 py-3 border border-slate-100 mb-3 bg-slate-50/50 rounded-lg p-2 border-l-0 border-r-0">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400">الميزانية</p>
                            <p className="text-xs font-black text-slate-700">{budget > 0 ? budget.toLocaleString() : '—'} ر.س</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400">صرف تشغيلي فعلي</p>
                            <p className={`text-xs font-black ${isOverBudget ? 'text-red-600' : 'text-slate-700'}`}>{totalSpent.toLocaleString()} ر.س</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400">السيولة المتبقية</p>
                            <p className={`text-xs font-black ${balance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{balance.toLocaleString()} ر.س</p>
                          </div>
                        </div>

                        {/* Cost Progress Bar */}
                        {budget > 0 && (
                          <div className="space-y-1 mb-4">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-400">استهلاك ميزانية المشروع:</span>
                              <span className={`${pct > 90 ? 'text-red-600 font-black' : pct > 70 ? 'text-amber-600' : 'text-indigo-600'}`}>{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isOverBudget ? 'bg-red-500' :
                                  isApproachingCrisis ? 'bg-amber-500' : 'bg-indigo-500'
                                }`} 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>
                        )}

                        {/* Actions and AI inline comments */}
                        <div className="space-y-3">
                          <button
                            onClick={() => handleProjectAIAnalysis(p)}
                            disabled={aiResult?.reading}
                            className="w-full h-9 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
                          >
                            {aiResult?.reading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                جاري تحليل الصرف بـ Gemini...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                كشف مالي وقائي (Gemini AI)
                              </>
                            )}
                          </button>

                          {aiResult?.text && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`p-3 rounded-lg text-[11px] leading-relaxed font-semibold border ${
                                aiResult.isError ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-705 border-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1 font-black text-slate-800">
                                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                التقييم الائتماني والوقائي لـ Gemini:
                              </div>
                              <p className="text-right whitespace-pre-line">{aiResult.text}</p>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* ══ SUMMARY BAR ══ */}
        <div className="bg-slate-900 rounded-xl p-5 text-white">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: 'عمال اليومية', value: stats.totalWorkers, icon: HardHat },
              { label: 'مشاريع نشطة', value: stats.activeProjects, icon: Building2 },
              { label: 'موظفون', value: stats.totalEmployees, icon: Users },
              { label: 'حضور اليوم', value: stats.todayAttendance, icon: CheckCircle },
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <s.icon className="w-4 h-4 text-white/30 mx-auto" />
                <p className="text-xl font-black text-white">{s.value.toLocaleString('en-US')}</p>
                <p className="text-[10px] text-white/40 font-bold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
