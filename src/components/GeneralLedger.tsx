// src/components/GeneralLedger.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calculator, 
  Printer, 
  Search, 
  Calendar as CalendarIcon, 
  Briefcase, 
  RefreshCw,
  Loader2,
  FileText
} from 'lucide-react';
import SmartExport from './ui/SmartExport';
import PrintableReport from './PrintableReport';
import { exportToPDF } from '../lib/pdfExport';
import { toast } from 'sonner';

export default function GeneralLedger() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // all | credit (income) | debit (expense/purchase)
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [quickDate, setQuickDate] = useState('all'); // all | today | week | month | year
  
  const [isPrinting, setIsPrinting] = useState(false);

  // Load transactions and projects
  useEffect(() => {
    setLoading(true);
    
    // Listen to transactions
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), orderBy('date', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            dateObj: data.date?.toDate?.() || new Date(data.date || Date.now())
          };
        }));
        setLoading(false);
      },
      (err) => {
        console.error("General Ledger Transactions Listen Error:", err);
        toast.error("فشل في تحميل حركات الحسابات");
      }
    );

    // Listen to projects for filter list
    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snap) => {
        setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (err) => console.error("General Ledger Projects Listen Error:", err)
    );

    return () => {
      unsubTx();
      unsubProjects();
    };
  }, []);

  // Handle Quick Date selection
  useEffect(() => {
    const now = new Date();
    const start = new Date();
    
    if (quickDate === 'today') {
      start.setHours(0, 0, 0, 0);
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      });
    } else if (quickDate === 'week') {
      start.setDate(now.getDate() - 7);
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      });
    } else if (quickDate === 'month') {
      start.setMonth(now.getMonth() - 1);
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      });
    } else if (quickDate === 'year') {
      start.setFullYear(now.getFullYear() - 1);
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      });
    } else {
      setDateRange({ start: '', end: '' });
    }
  }, [quickDate]);

  // Main calculations memo
  const calculatedData = useMemo(() => {
    let list = [...transactions];

    // Filter by project
    if (projectFilter !== 'all') {
      list = list.filter(t => t.projectId === projectFilter);
    }

    // Filter by type
    if (typeFilter !== 'all') {
      list = list.filter(t => {
        const isCredit = t.type === 'income';
        return typeFilter === 'credit' ? isCredit : !isCredit;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        (t.description || '').toLowerCase().includes(q) || 
        (t.category || '').toLowerCase().includes(q)
      );
    }

    // Filter by custom date range
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      list = list.filter(t => t.dateObj >= start);
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      list = list.filter(t => t.dateObj <= end);
    }

    // Sort ascending to compute running balance chronologically
    const sortedAsc = [...list].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    let runningBalance = 0;
    
    const withRunningBalance = sortedAsc.map(t => {
      const isCredit = t.type === 'income';
      const amount = Number(t.amount || 0);
      if (isCredit) {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      return {
        ...t,
        credit: isCredit ? amount : 0,
        debit: !isCredit ? amount : 0,
        balance: runningBalance,
        dateStr: t.dateObj.toLocaleDateString('ar-SA')
      };
    });

    // Totals
    const totalCredit = withRunningBalance.reduce((acc, t) => acc + t.credit, 0);
    const totalDebit = withRunningBalance.reduce((acc, t) => acc + t.debit, 0);
    const netBalance = totalCredit - totalDebit;

    // Return descending for list rendering
    return {
      transactionsList: withRunningBalance.reverse(),
      totalCredit,
      totalDebit,
      netBalance
    };
  }, [transactions, searchQuery, projectFilter, typeFilter, dateRange]);

  const handlePrint = async () => {
    setIsPrinting(true);
    toast.loading('جاري تحضير ملف الطباعة (PDF)...');
    
    setTimeout(async () => {
      try {
        await exportToPDF('general-ledger-print', `دفتر_الأستاذ_العام_${new Date().toISOString().split('T')[0]}`);
        toast.dismiss();
        toast.success('تم تحميل كشف الأستاذ العام بنجاح 🖨️');
      } catch (err) {
        toast.dismiss();
        toast.error('فشل تصدير الكشف للطباعة');
      } finally {
        setIsPrinting(false);
      }
    }, 500);
  };

  const columnsForExport = [
    { header: "التاريخ", key: "dateStr" },
    { header: "البيان / الوصف", key: "description" },
    { header: "التصنيف", key: "category" },
    { header: "مدين (مدفوعات)", key: "debit" },
    { header: "دائن (مقبوضات)", key: "credit" },
    { header: "الرصيد", key: "balance" }
  ];

  return (
    <div className="space-y-6 pb-20 w-full px-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">دفتر الأستاذ العام (General Ledger)</h1>
          <p className="text-slate-500 text-xs font-semibold mt-0.5">
            دفتر القيود اليومية والحركات المحاسبية المدونة وتتبع كشف الحساب المالي للمنشأة
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handlePrint}
            disabled={isPrinting || calculatedData.transactionsList.length === 0}
            className="rounded-xl border-slate-200 hover:bg-slate-50 font-bold text-xs h-11 px-4 gap-2 bg-white shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            طباعة الكشف
          </Button>

          <SmartExport 
            data={calculatedData.transactionsList}
            title="دفتر الأستاذ العام - خبراء الرسم"
            columns={columnsForExport}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="rounded-2xl border-none shadow-sm bg-emerald-50/70 border-r-4 border-r-emerald-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-emerald-100/50 text-emerald-600 rounded-xl">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-[9px]">دائن (مقبوضات)</Badge>
            </div>
            <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest mt-4">إجمالي المقبوضات</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 font-mono mt-0.5">
              {calculatedData.totalCredit.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-rose-50/70 border-r-4 border-r-rose-500">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-rose-100/50 text-rose-600 rounded-xl">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <Badge className="bg-rose-100 text-rose-800 border-none font-bold text-[9px]">مدين (مدفوعات)</Badge>
            </div>
            <p className="text-[10px] font-bold text-rose-600/80 uppercase tracking-widest mt-4">إجمالي المدفوعات</p>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 font-mono mt-0.5">
              {calculatedData.totalDebit.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span>
            </h3>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-slate-900 border-r-4 border-r-primary text-white">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-white/10 text-primary rounded-xl">
                <Calculator className="w-5 h-5" />
              </div>
              <Badge className="bg-primary/20 text-primary border-none font-bold text-[9px]">صافي الرصيد الحالي</Badge>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">رصيد الحساب الموحد</p>
            <h3 className={`text-xl md:text-2xl font-black font-mono mt-0.5 ${calculatedData.netBalance >= 0 ? 'text-primary' : 'text-rose-400'}`}>
              {calculatedData.netBalance.toLocaleString('ar-SA')} <span className="text-xs font-normal text-slate-400">ر.س</span>
            </h3>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="rounded-[24px] border-none shadow-sm bg-white overflow-hidden p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Search Query */}
          <div className="space-y-1.5 text-right">
            <Label className="font-bold text-xs text-slate-600">بحث بالوصف أو التصنيف</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="ادخل كلمة البحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-11 rounded-xl text-xs font-bold border-slate-200/80"
              />
            </div>
          </div>

          {/* Project selector */}
          <div className="space-y-1.5 text-right">
            <Label className="font-bold text-xs text-slate-600">تصفية حسب المشروع</Label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل المشاريع</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name || p.title}</option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="space-y-1.5 text-right">
            <Label className="font-bold text-xs text-slate-600">نوع الحركة</Label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">كل المعاملات</option>
              <option value="credit">مقبوضات (دائن) 🟢</option>
              <option value="debit">مدفوعات (مدين) 🔴</option>
            </select>
          </div>

          {/* Quick Dates */}
          <div className="space-y-1.5 text-right">
            <Label className="font-bold text-xs text-slate-600">النطاق المالي السريع</Label>
            <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'today', label: 'اليوم' },
                { id: 'week', label: 'أسبوع' },
                { id: 'month', label: 'شهر' },
                { id: 'year', label: 'سنة' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQuickDate(opt.id)}
                  className={`py-1.5 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                    quickDate === opt.id 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom date range option */}
        {quickDate === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-dashed border-slate-100">
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs text-slate-500">من تاريخ</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="h-10 rounded-xl text-xs font-bold border-slate-200"
              />
            </div>
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs text-slate-500">إلى تاريخ</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="h-10 rounded-xl text-xs font-bold border-slate-200"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Main Table */}
      <Card className="rounded-[24px] border-none shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-bold text-slate-400">جاري تجميع السجل المالي لدفتر الأستاذ...</p>
            </div>
          ) : calculatedData.transactionsList.length > 0 ? (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-b-0 text-right">
                  <TableHead className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">التاريخ</TableHead>
                  <TableHead className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">البيان / الوصف</TableHead>
                  <TableHead className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">التصنيف</TableHead>
                  <TableHead className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">مدين (مدفوعات)</TableHead>
                  <TableHead className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">دائن (مقبوضات)</TableHead>
                  <TableHead className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-wider">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedData.transactionsList.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 text-right font-medium">
                    <TableCell className="px-6 py-4 text-xs text-slate-500 font-mono">{t.dateStr}</TableCell>
                    <TableCell className="px-6 py-4">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{t.description}</p>
                        {t.projectId && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-400 mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            <Briefcase className="w-2.5 h-2.5" />
                            {projects.find(p => p.id === t.projectId)?.name || 'مشروع'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-100 text-slate-600 rounded-lg px-2 shadow-none">{t.category || 'عام'}</Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-red-500 font-black font-mono">
                      {t.debit > 0 ? `-${t.debit.toLocaleString()} ر.س` : '—'}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs text-emerald-600 font-black font-mono">
                      {t.credit > 0 ? `+${t.credit.toLocaleString()} ر.س` : '—'}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-black text-slate-700 font-mono bg-slate-50/50">
                      {t.balance.toLocaleString()} ر.س
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-black text-slate-400">لا توجد حركات مالية مطابقة للتصفية المحددة</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Off-screen printing report component */}
      {isPrinting && (
        <PrintableReport 
          id="general-ledger-print"
          title="دفتر الأستاذ العام المالي"
          subtitle="سجل حركات الحسابات والتدفقات النقدية والبنكية للمؤسسة"
          headers={['التاريخ', 'البيان', 'التصنيف', 'مدين (مدفوعات)', 'دائن (مقبوضات)', 'الرصيد']}
          data={calculatedData.transactionsList.map(t => [
            t.dateStr,
            t.description + (t.projectId ? ` (${projects.find(p => p.id === t.projectId)?.name || 'مشروع'})` : ''),
            t.category || 'عام',
            t.debit > 0 ? `${t.debit.toLocaleString()} ر.س` : '—',
            t.credit > 0 ? `${t.credit.toLocaleString()} ر.س` : '—',
            `${t.balance.toLocaleString()} ر.س`
          ])}
          summary={[
            { label: 'إجمالي المقبوضات (دائن)', value: `${calculatedData.totalCredit.toLocaleString()} ر.س` },
            { label: 'إجمالي المدفوعات (مدين)', value: `${calculatedData.totalDebit.toLocaleString()} ر.س` },
            { label: 'صافي رصيد الحساب الموحد', value: `${calculatedData.netBalance.toLocaleString()} ر.س` }
          ]}
        />
      )}
    </div>
  );
}
