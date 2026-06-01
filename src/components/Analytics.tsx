import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  BarChart3, 
  ArrowUpRight,
  ChevronRight,
  Layers,
  Users,
  CheckCircle2,
  Briefcase,
  Activity,
  Zap
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Transaction, Project, UserProfile, Attendance } from '../types';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export default function Analytics({ onBack }: { onBack?: () => void }) {
  const [period, setPeriod] = useState<Period>('monthly');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  useEffect(() => {
    const unsubTx = onSnapshot(query(collection(db, 'transactions'), orderBy('date', 'desc')), (snap) => {
      setTransactions(snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        dateObj: d.data().date?.toDate?.() || new Date(d.data().date) 
      } as any)));
    }, (err) => console.error("Analytics Transactions Listen Error:", err));

    const unsubProj = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Analytics Projects Listen Error:", err));

    const unsubEmp = onSnapshot(collection(db, 'users'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Analytics Employees Listen Error:", err));

    const unsubAtt = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Analytics Attendance Listen Error:", err));

    return () => {
      unsubTx();
      unsubProj();
      unsubEmp();
      unsubAtt();
    };
  }, []);

  const filteredData = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    if (period === 'daily') startDate.setHours(0, 0, 0, 0);
    else if (period === 'weekly') startDate.setDate(now.getDate() - 7);
    else if (period === 'monthly') startDate.setMonth(now.getMonth() - 1);
    else if (period === 'yearly') startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date(0);

    const txs = transactions.filter(t => t.dateObj >= startDate);
    const atts = attendance.filter(a => (a.date?.toDate?.() || new Date(a.date)) >= startDate);

    // Stats
    const income = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
    const purchase = txs.filter(t => t.type === 'purchase').reduce((acc, t) => acc + (t.amount || 0), 0);
    
    // Project Stats
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const activeProjects = projects.filter(p => p.status === 'in-progress' || p.status === 'pending').length;
    
    // Employee Stats
    const attendanceCount = atts.length;
    const daysInPeriod = period === 'daily' ? 1 : period === 'weekly' ? 7 : period === 'monthly' ? 30 : period === 'yearly' ? 365 : 100;
    const attendanceRate = (employees.length > 0 && daysInPeriod > 0) ? (attendanceCount / (employees.length * daysInPeriod)) * 100 : 85;

    // Chart grouping
    const chartGroups: any = {};
    txs.forEach(t => {
      let key = '';
      if (period === 'daily') key = t.dateObj.getHours() + ':00';
      else if (period === 'weekly') key = t.dateObj.toLocaleDateString('ar-SA', { weekday: 'short' });
      else if (period === 'monthly' || period === 'all') key = t.dateObj.toLocaleDateString('ar-SA', { month: 'short' });
      else key = t.dateObj.getFullYear().toString();

      if (!chartGroups[key]) chartGroups[key] = { name: key, income: 0, expense: 0, profit: 0, timestamp: t.dateObj.getTime() };
      if (t.type === 'income') chartGroups[key].income += t.amount;
      else if (t.type === 'expense' || t.type === 'purchase') chartGroups[key].expense += t.amount;
      chartGroups[key].profit = chartGroups[key].income - chartGroups[key].expense;
    });

    const sortedCharts = Object.values(chartGroups).sort((a: any, b: any) => a.timestamp - b.timestamp);

    return {
      income,
      expense: expense + purchase,
      netProfit: income - (expense + purchase),
      margin: income > 0 ? ((income - (expense + purchase)) / income) * 100 : 0,
      activeProjects,
      completedProjects,
      attendanceRate: Math.min(attendanceRate, 100),
      chartData: sortedCharts
    };
  }, [period, transactions, projects, employees, attendance]);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button onClick={onBack} variant="ghost" size="icon" className="rounded-lg bg-white shadow-sm border border-slate-200 h-9 w-9">
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </Button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">ذكاء الأعمال والتحليلات (Business BI)</h1>
            <p className="text-slate-500 text-xs font-semibold flex items-center gap-2 mt-0.5">
               مركز التقارير وقراءة مؤشرات كفاءة الأداء المالي والتشغيلي للمشاريع ثانية بثانية
               <Badge className="bg-emerald-50 text-emerald-600 border-none px-2 py-0.5 h-4.5 text-[9px] font-bold animate-pulse">مباشر</Badge>
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start">
          <PeriodButton active={period === 'daily'} label="يومي" onClick={() => setPeriod('daily')} />
          <PeriodButton active={period === 'weekly'} label="أسبوعي" onClick={() => setPeriod('weekly')} />
          <PeriodButton active={period === 'monthly'} label="شهري" onClick={() => setPeriod('monthly')} />
          <PeriodButton active={period === 'yearly'} label="سنوي" onClick={() => setPeriod('yearly')} />
          <PeriodButton active={period === 'all'} label="شامل" onClick={() => setPeriod('all')} />
        </div>
      </div>

      {/* Main Grid: Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Row 1: KPI Cards */}
        <StatCard 
          title="صافي الأرباح" 
          value={filteredData.netProfit} 
          subtitle="الأداء المالي الإجمالي الصافي"
          icon={Wallet} 
          trend="+12%"
          color="blue" 
        />
        <StatCard 
          title="نسبة الإنجاز" 
          value={filteredData.completedProjects} 
          subtitle="مشاريع منتهية ومسلمة"
          icon={CheckCircle2} 
          isCount
          trend="+5"
          color="emerald" 
        />
        <StatCard 
          title="نسبة حضور وانضباط الفريق" 
          value={filteredData.attendanceRate.toFixed(1)} 
          subtitle="معدل الحضور والانضباط اليومي"
          icon={Activity} 
          isPercent
          trend="-2%"
          color="amber" 
        />
        <StatCard 
          title="معدل نمو المؤسسة" 
          value={filteredData.margin.toFixed(1)} 
          subtitle="هامش الربحية التشغيلي"
          icon={TrendingUp} 
          isPercent
          trend="+3%"
          color="indigo" 
        />

        {/* Row 2: Charts */}
        <Card className="lg:col-span-3 rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
               <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <BarChart3 className="w-4.5 h-4.5 text-slate-700" />
                    تحليل التدفقات والربحية والسيولة المتوقعة
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-slate-400 mt-0.5">مراقبة الأداء المالي المباشر وتتبع العوائد مقابل المصاريف</CardDescription>
               </div>
               <div className="flex gap-4">
                  <LegendItem label="إيرادات" color="bg-emerald-500" />
                  <LegendItem label="أرباح صافية" color="bg-blue-500" />
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData.chartData}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 600, fill: '#64748b'}} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontFamily: 'Cairo', padding: '10px 14px' }}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gIncome)" />
                  <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#gProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Secondary Insights */}
        <div className="flex flex-col gap-4">
           <Card className="rounded-xl border border-slate-900 bg-slate-950 text-white p-6 flex flex-col justify-between h-1/2">
              <div className="flex justify-between items-start">
                <Zap className="w-8 h-8 text-amber-400" />
                <Badge variant="secondary" className="bg-white/10 text-white hover:bg-white/10 border-none text-[8px]">ذكاء اصطناعي</Badge>
              </div>
              <div>
                 <h4 className="text-sm font-bold text-slate-100">كفاءة تشغيل الأصول</h4>
                 <p className="text-[10px] text-slate-400 font-medium">وفق المشاريع الفعالة الحالية ومعدلات حضور الكادر البشري</p>
              </div>
              <div className="mt-4">
                 <div className="text-3xl font-bold font-mono text-amber-400">92%</div>
                 <div className="w-full h-1.5 bg-white/10 rounded-full mt-2.5 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: '92%' }} />
                 </div>
              </div>
           </Card>

           <Card className="rounded-xl border border-slate-200/60 bg-white p-6 flex flex-col justify-between h-1/2 relative overflow-hidden">
              <div className="relative z-10 space-y-1">
                 <div className="w-8 h-8 bg-emerald-50 text-emerald-700 flex items-center justify-center rounded-lg mb-2">
                   <Briefcase className="w-4 h-4" />
                 </div>
                 <p className="text-[10px] font-bold text-slate-400">المشاريع النشطة حالياً</p>
                 <h4 className="text-base font-bold text-slate-800">{filteredData.activeProjects} مشاريع قيد التنفيذ</h4>
              </div>
              <div className="absolute right-2 -bottom-2 opacity-[0.03]">
                 <Layers className="w-24 h-24 text-slate-950" />
              </div>
           </Card>
        </div>

        {/* Row 3: Employees & Tasks */}
        <Card className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                 <Users className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">الأكثر كفاءة والتزاماً</h4>
           </div>
           <div className="space-y-3.5">
              {employees.slice(0, 4).map((emp, i) => (
                 <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                       <div className="w-7.5 h-7.5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-800 text-xs border border-slate-200 shadow-sm">
                          {emp.name?.[0]}
                       </div>
                       <div>
                          <p className="text-xs font-bold text-slate-800">{emp.name}</p>
                          <p className="text-[9px] text-slate-400 font-semibold">{emp.role === 'manager' ? 'مدير' : emp.role === 'supervisor' ? 'مشرف' : 'فني'}</p>
                       </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50/50 text-emerald-600 text-[8px] border-emerald-100 font-bold shadow-none px-1.5 py-0">مثالي</Badge>
                 </div>
              ))}
           </div>
        </Card>

        {/* Row 3: Distribution Chart */}
        <Card className="lg:col-span-2 rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800">
              <PieChartIcon className="w-4.5 h-4.5 text-slate-500" />
              توزيع وتخصيص التدفقات النقدية
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
               <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                           { name: 'إيراد', value: filteredData.income },
                           { name: 'صرف', value: filteredData.expense },
                           { name: 'صافي', value: filteredData.netProfit > 0 ? filteredData.netProfit : 0 }
                        ]}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value"
                      >
                        {COLORS.map((c, i) => <Cell key={i} fill={c} cornerRadius={4} />)}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 flex justify-between items-center">
                     <div>
                        <span className="text-[10px] font-semibold text-emerald-700">مجموع الإيرادات</span>
                        <div className="text-sm font-bold text-emerald-900 mt-0.5">{filteredData.income.toLocaleString()} ر.س</div>
                     </div>
                     <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 flex justify-between items-center">
                     <div>
                        <span className="text-[10px] font-semibold text-blue-700">شجرة الأرباح المحققة</span>
                        <div className="text-sm font-bold text-blue-900 mt-0.5">{filteredData.netProfit.toLocaleString()} ر.س</div>
                     </div>
                     <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="p-3 rounded-lg bg-red-50/50 border border-red-100 flex justify-between items-center">
                     <div>
                        <span className="text-[10px] font-semibold text-red-700">شجرة المصاريف والتشغيل</span>
                        <div className="text-sm font-bold text-red-900 mt-0.5">{filteredData.expense.toLocaleString()} ر.س</div>
                     </div>
                     <TrendingDown className="w-4 h-4 text-red-600" />
                  </div>
               </div>
            </div>
        </Card>

        {/* Row 3: Insights Panel */}
        <Card className="rounded-xl border border-slate-900 bg-slate-950 text-white p-6 shadow-sm flex flex-col justify-between">
           <div>
              <h4 className="text-sm font-bold flex items-center gap-2">
                  <ArrowUpRight className="w-4.5 h-4.5 text-emerald-400" />
                  توصيات ذكية مقترحة
              </h4>
              <div className="space-y-3.5 mt-5">
                 <InsightItem text="تحسين سياسة التحصيل بالمستخلصات لتكثيف النقدية بنسبة 5%" color="bg-emerald-400" />
                 <InsightItem text="جدولة مشتريات المواد الخام لخفض التكلفة التشغيلية الإضافية" color="bg-blue-400" />
                 <InsightItem text="أتمتة طلبات تصاريح المواقع لتسريع مراحل التسليم الفعلي" color="bg-amber-400" />
              </div>
           </div>
           <Button className="w-full mt-6 rounded-lg bg-slate-800 text-white border border-slate-700 hover:bg-slate-700 h-9 text-xs font-semibold cursor-pointer">
              تصدير كشف مؤشرات الأداء
           </Button>
        </Card>
      </div>
    </div>
  );
}

function PeriodButton({ active, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-md text-[10px] md:text-xs font-bold transition-all cursor-pointer ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
    >
      {label}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, isPercent, isCount, trend }: any) {
  const themes: any = {
    blue: 'border-l-4 border-l-blue-500',
    emerald: 'border-l-4 border-l-emerald-500',
    amber: 'border-l-4 border-l-amber-500',
    indigo: 'border-l-4 border-l-indigo-500'
  };

  return (
    <Card className={`${themes[color]} rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm relative overflow-hidden transition-all hover:shadow-md`}>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
           <div className="p-2.5 bg-slate-50 text-slate-700 rounded-lg border border-slate-100">
              <Icon className="w-4 h-4" />
           </div>
           <Badge variant="secondary" className="bg-slate-50 text-slate-600 border border-slate-100 font-bold text-[9px] pointer-events-none">{trend}</Badge>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-mono mt-0.5 tracking-tight">
          {isPercent ? `${value}%` : isCount ? value : `${Math.round(value).toLocaleString()} ر.س`}
        </h3>
        <p className="text-[9px] mt-1 font-medium text-slate-400">{subtitle}</p>
      </div>
    </Card>
  );
}

function LegendItem({ label, color }: any) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
    </div>
  );
}

function InsightItem({ text, color }: any) {
  return (
    <div className="flex items-start gap-2.5">
       <div className={`w-1 h-1 rounded-full ${color} mt-2 shrink-0`} />
       <p className="text-[11px] font-medium text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}
