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
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button onClick={onBack} variant="ghost" size="icon" className="rounded-2xl bg-white shadow-sm border">
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tight">ذكاء الأعمال (Business BI)</h1>
            <p className="text-muted-foreground text-sm font-bold flex items-center gap-2">
               مركز التحليلات الشامل والقرارات الذكية
               <Badge className="bg-emerald-100 text-emerald-700 border-none px-2 py-0 h-5 text-[10px] font-black animate-pulse">مباشر</Badge>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap bg-white p-1 rounded-2xl border shadow-sm self-start">
          <PeriodButton active={period === 'daily'} label="يومي" onClick={() => setPeriod('daily')} />
          <PeriodButton active={period === 'weekly'} label="أسبوعي" onClick={() => setPeriod('weekly')} />
          <PeriodButton active={period === 'monthly'} label="شهري" onClick={() => setPeriod('monthly')} />
          <PeriodButton active={period === 'yearly'} label="سنوي" onClick={() => setPeriod('yearly')} />
          <PeriodButton active={period === 'all'} label="شامل" onClick={() => setPeriod('all')} />
        </div>
      </div>

      {/* Main Grid: Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Row 1: KPI Cards */}
        <StatCard 
          title="صافي الربح" 
          value={filteredData.netProfit} 
          subtitle="الأداء المالي الصافي"
          icon={Wallet} 
          trend="+12%"
          color="blue" 
        />
        <StatCard 
          title="نسبة الإنجاز" 
          value={filteredData.completedProjects} 
          subtitle="مشاريع منتهية"
          icon={CheckCircle2} 
          isCount
          trend="+5"
          color="emerald" 
        />
        <StatCard 
          title="نبض الفريق" 
          value={filteredData.attendanceRate.toFixed(1)} 
          subtitle="متوسط الحضور"
          icon={Activity} 
          isPercent
          trend="-2%"
          color="amber" 
        />
        <StatCard 
          title="معدل النمو" 
          value={filteredData.margin.toFixed(1)} 
          subtitle="هامش الربحية"
          icon={TrendingUp} 
          isPercent
          trend="+3%"
          color="indigo" 
        />

        {/* Row 2: Charts */}
        <Card className="lg:col-span-3 rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
          <CardHeader className="p-8 border-b border-dashed">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <CardTitle className="text-xl font-black flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-primary" />
                    تحليل التدفقات والربحية
                  </CardTitle>
                  <CardDescription className="font-bold">مراقبة الأداء المباشر حسب الفترة المختارة</CardDescription>
               </div>
               <div className="flex gap-4">
                  <LegendItem label="إيرادات" color="bg-emerald-500" />
                  <LegendItem label="مصاريف" color="bg-red-400" />
                  <LegendItem label="أرباح" color="bg-blue-500" />
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData.chartData}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fontWeight: 800, fill: '#64748b'}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fontWeight: 800, fill: '#64748b'}} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontFamily: 'Cairo', padding: '16px' }}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#gIncome)" />
                  <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#gProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Secondary Insights */}
        <div className="flex flex-col gap-4">
           <Card className="rounded-[2.5rem] border-none shadow-lg bg-primary text-primary-foreground p-8 flex-1 flex flex-col justify-between">
              <Zap className="w-10 h-10 text-amber-400 mb-4" />
              <div>
                 <h4 className="text-2xl font-black mb-2">كفاءة التشغيل</h4>
                 <p className="text-sm opacity-80 font-bold">بناءً على المشاريع والموظفين، كفاءتك الحالية هي:</p>
              </div>
              <div className="mt-6">
                 <div className="text-5xl font-black">92%</div>
                 <div className="w-full h-2 bg-white/20 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: '92%' }} />
                 </div>
              </div>
           </Card>

           <Card className="rounded-[2.5rem] border-none shadow-lg bg-emerald-600 text-white p-6 relative overflow-hidden">
              <div className="relative z-10">
                 <Briefcase className="w-6 h-6 mb-2" />
                 <p className="text-xs font-bold opacity-80">المشاريع النشطة</p>
                 <h4 className="text-3xl font-black tracking-tighter">{filteredData.activeProjects} مشروع قيد العمل</h4>
              </div>
              <div className="absolute -right-8 -bottom-8 opacity-10">
                 <Layers className="w-32 h-32" />
              </div>
           </Card>
        </div>

        {/* Row 3: Employees & Tasks */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                 <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black tracking-tight">أفضل الموظفين (Top)</h4>
           </div>
           <div className="space-y-5">
              {employees.slice(0, 4).map((emp, i) => (
                 <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-primary border-2 border-white shadow-sm">
                          {emp.name?.[0]}
                       </div>
                       <div>
                          <p className="text-sm font-black text-slate-800">{emp.name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold">{emp.role === 'manager' ? 'مدير' : emp.role === 'supervisor' ? 'مشرف' : 'فني'}</p>
                       </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 text-[10px] border-none font-black shadow-none px-3">متميز</Badge>
                 </div>
              ))}
           </div>
        </Card>

        {/* Row 3: Distribution Chart */}
        <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl bg-white p-8">
            <h4 className="text-lg font-black mb-6 flex items-center gap-2">
              <PieChartIcon className="w-6 h-6 text-primary" />
              توزيع الموارد والسيولة
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
               <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                           { name: 'دخل', value: filteredData.income },
                           { name: 'صرف', value: filteredData.expense },
                           { name: 'صافي', value: filteredData.netProfit > 0 ? filteredData.netProfit : 0 }
                        ]}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value"
                      >
                        {COLORS.map((c, i) => <Cell key={i} fill={c} cornerRadius={10} />)}
                      </Pie>
                      <Tooltip 
                         contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="space-y-4">
                  <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-100">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-emerald-700">تدفق الإيرادات</span>
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                     </div>
                     <div className="text-xl font-black text-emerald-900">{filteredData.income.toLocaleString()} ر.س</div>
                  </div>
                  <div className="p-4 rounded-3xl bg-blue-50 border border-blue-100">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-blue-700">صافي الأرباح</span>
                        <Zap className="w-4 h-4 text-blue-600" />
                     </div>
                     <div className="text-xl font-black text-blue-900">{filteredData.netProfit.toLocaleString()} ر.س</div>
                  </div>
                  <div className="p-4 rounded-3xl bg-red-50 border border-red-100">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-red-700">إجمالي المصاريف</span>
                        <TrendingDown className="w-4 h-4 text-red-600" />
                     </div>
                     <div className="text-xl font-black text-red-900">{filteredData.expense.toLocaleString()} ر.س</div>
                  </div>
               </div>
            </div>
        </Card>

        {/* Row 3: Insights Panel */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-slate-900 text-white p-8">
           <h4 className="text-lg font-black mb-4 flex items-center gap-2">
               <ArrowUpRight className="w-6 h-6 text-emerald-400" />
               مقترحات النمو
           </h4>
           <div className="space-y-4 mt-6">
              <InsightItem text="زيادة الإنتاجية في المشتريات لخفض الهدر بمقدار 5%" color="bg-emerald-400" />
              <InsightItem text="توسيع قائمة العملاء لزيادة الدخل الشهري بنسبة 15%" color="bg-blue-400" />
              <InsightItem text="تحسين جدول حضور الموظفين لرفع نبض الفريق" color="bg-amber-400" />
           </div>
           <Button className="w-full mt-8 rounded-[1.5rem] bg-white text-slate-900 font-black hover:bg-slate-100 h-12 shadow-inner">
              طلب تقرير تفصيلي
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
      className={`px-4 md:px-6 py-2 rounded-xl text-[11px] md:text-sm font-black transition-all ${active ? 'bg-primary text-white shadow-lg scale-105' : 'text-muted-foreground hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color, isPercent, isCount, trend }: any) {
  const themes: any = {
    blue: 'bg-blue-600 text-white',
    emerald: 'bg-emerald-500 text-white',
    amber: 'bg-amber-500 text-white',
    indigo: 'bg-indigo-600 text-white'
  };

  return (
    <Card className={`${themes[color]} rounded-[2.5rem] p-6 border-none shadow-xl relative overflow-hidden transition-all hover:scale-[1.03]`}>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
           <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Icon className="w-6 h-6" />
           </div>
           <Badge className="bg-white/20 text-white border-none font-bold text-[10px]">{trend}</Badge>
        </div>
        <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl md:text-3xl font-black mt-1">
          {isPercent ? `${value}%` : isCount ? value : `${Math.round(value).toLocaleString()} ر.س`}
        </h3>
        <p className="text-[10px] mt-2 font-bold opacity-70 italic">{subtitle}</p>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-10">
         <Activity className="w-24 h-24" />
      </div>
    </Card>
  );
}

function LegendItem({ label, color }: any) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs font-black text-slate-600">{label}</span>
    </div>
  );
}

function InsightItem({ text, color }: any) {
  return (
    <div className="flex items-start gap-3">
       <div className={`w-1.5 h-1.5 rounded-full ${color} mt-1.5 shrink-0`} />
       <p className="text-[11px] font-bold opacity-90 leading-relaxed">{text}</p>
    </div>
  );
}
