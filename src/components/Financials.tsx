import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter, Download, Loader2, ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, Minus, Building2, CreditCard, X } from 'lucide-react';
import { 
  LineChart,
  Line,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from 'recharts';
import { toast } from 'sonner';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { sendNotification } from '../lib/notifications';
import { exportToCSV } from '../lib/export';
import { exportToPDF } from '../lib/pdfExport';
import { softDelete } from '../lib/softDelete';
import SmartExport from './ui/SmartExport';
import PrintableReport from './PrintableReport';
import ExportDateRangeDialog from './ExportDateRangeDialog';
import { Transaction, Project, BankAccount } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Financials() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [searchTerm, setSearchTerm] = useState('');
  const [generalTransactions, setGeneralTransactions] = useState<Transaction[]>([]);
  const [workerTransactions, setWorkerTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  // Navigation State for Detail Views
  const [currentView, setCurrentView] = useState<'dashboard' | 'revenue' | 'expenses' | 'profit' | 'account'>('dashboard');
  const [viewedAccountId, setViewedAccountId] = useState<string | null>(null);

  useEffect(() => {
    // Check if we need to open the dialog from URL parameters or similar mechanism? 
    // For now, implement programmatic trigger if requested.
    // In this applet, since we don't have URL-parsing here directly, 
    // we'll advise the user to implement a trigger if they want to call it from another component.
    // But for now, just satisfying the request to PREPARE variables.
  }, []);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    description: '',
    category: 'other',
    projectId: '',
    paymentMethod: 'cash' as 'cash' | 'transfer',
    bankAccountId: ''
  });

  useEffect(() => {
    const qGen = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubGen = onSnapshot(qGen, (snapshot) => {
      setGeneralTransactions(snapshot.docs.map(doc => ({
        id: doc.id,
        source: 'general',
        ...doc.data()
      } as unknown as Transaction)));
    }, (error) => console.error("Financials General Listen Error:", error));

    const qWorker = query(collection(db, 'workerTransactions'), orderBy('date', 'desc'));
    const unsubWorker = onSnapshot(qWorker, (snapshot) => {
      setWorkerTransactions(snapshot.docs.map(doc => ({
        id: doc.id,
        source: 'worker',
        ...doc.data()
      })));
    }, (error) => console.error("Financials Worker Listen Error:", error));

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => console.error("Financials Projects Listen Error:", error));

    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
    }, (error) => console.error("Financials Banks Listen Error:", error));

    setLoading(false);
    return () => {
      unsubGen();
      unsubWorker();
      unsubProjects();
      unsubBanks();
    };
  }, []);

  const transactions = useMemo(() => {
    const combined = [
      ...generalTransactions.map(t => ({
        ...t,
        unifiedType: t.type === 'income' ? 'income' : 'expense',
        dateOriginal: t.date?.toDate?.() || new Date(t.date),
        dateDisplay: t.date?.toDate?.()?.toLocaleString('ar-SA') || new Date(t.date).toLocaleString('ar-SA')
      })),
      ...workerTransactions.filter(t => t.type === 'payment').map(t => ({
        ...t,
        unifiedType: 'expense',
        amount: Math.abs(t.amount || 0),
        dateOriginal: new Date(t.date),
        dateDisplay: new Date(t.date).toLocaleString('ar-SA')
      }))
    ];

    return combined.sort((a,b) => b.dateOriginal - a.dateOriginal);
  }, [generalTransactions, workerTransactions]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.unifiedType === 'income').reduce((acc, t) => acc + (t.amount || 0), 0);
    const expense = transactions.filter(t => t.unifiedType === 'expense').reduce((acc, t) => acc + (t.amount || 0), 0);
    return {
      income,
      expense,
      net: income - expense
    };
  }, [transactions]);

  const accountBalances = useMemo(() => {
    return bankAccounts.map(acc => {
      const accTransactions = transactions.filter(t => t.bankAccountId === acc.id);
      const income = accTransactions.filter(t => t.unifiedType === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      const expense = accTransactions.filter(t => t.unifiedType === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
      return {
        ...acc,
        balance: acc.initialBalance + income - expense
      };
    });
  }, [bankAccounts, transactions]);

  const chartData = useMemo(() => {
    const months: any = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleString('ar-SA', { month: 'short' });
      months[key] = { name, income: 0, expense: 0, profit: 0, sortKey: key };
    }

    transactions.forEach(t => {
      const date = t.dateOriginal;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (months[key]) {
        if (t.unifiedType === 'income') months[key].income += t.amount;
        else months[key].expense += t.amount;
        months[key].profit = months[key].income - months[key].expense;
      }
    });

    return Object.values(months).sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description?.includes(searchTerm) || 
        t.id?.includes(searchTerm) ||
        projects.find(p => p.id === t.projectId)?.title?.includes(searchTerm);
      
      const matchesAccount = selectedAccountId ? t.bankAccountId === selectedAccountId : true;
      
      return matchesSearch && matchesAccount;
    });
  }, [searchTerm, transactions, projects, selectedAccountId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!formData.amount || !formData.description) {
      toast.error('يرجى ملء كافة الحقول المطلوبة');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: serverTimestamp(),
        createdBy: profile.uid,
        status: 'approved'
      };

      if (!data.projectId) delete data.projectId;

      await addDoc(collection(db, 'transactions'), data);
      
      await logActivity(
        formData.type === 'income' ? 'إيراد جديد' : 'مصروف جديد',
        `تم تسجيل ${formData.type === 'income' ? 'إيراد' : 'مصروف'} بمبلغ ${formData.amount} ر.س: ${formData.description}`,
        'success',
        'financial',
        profile.uid
      );

      // Send Global Notification
      await sendNotification({
        title: formData.type === 'income' ? 'إيراد مالي جديد' : 'مصروف جديد',
        message: `تم تسجيل عملية بقيمة ${formData.amount} ر.س: ${formData.description}`,
        type: formData.type === 'income' ? 'success' : 'info',
        category: 'financial',
        targetRole: 'manager',
        tab: 'financials',
        priority: formData.type === 'income' ? 'high' : 'medium'
      });

      toast.success('تمت إضافة العملية بنجاح');
      setIsDialogOpen(false);
      setFormData({ 
        type: 'expense', 
        amount: '', 
        description: '', 
        category: 'other', 
        projectId: '',
        paymentMethod: 'cash',
        bankAccountId: ''
      });
    } catch (error) {
      console.error(error);
      toast.error('فشل في إضافة العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const exportData = filteredTransactions.map(tx => ({
      'المعرف': tx.id,
      'الوصف': tx.description,
      'النوع': tx.type === 'income' ? 'إيراد' : tx.type === 'expense' ? 'مصروف' : 'مشتريات',
      'المبلغ': tx.amount,
      'التاريخ': tx.date,
      'الحالة': tx.status === 'approved' ? 'معتمد' : 'معلق'
    }));

    exportToCSV('التقرير_المالي', exportData);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const handleStartPDFExport = () => {
    if (transactions.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }
    setIsDateRangeDialogOpen(true);
  };

  const handleConfirmDateRange = (start: string, end: string) => {
    setDateRange({ start, end });
    setIsExportingPDF(true);
    toast.loading('جاري تجهيز التقرير المخصص...');
    
    setTimeout(async () => {
      try {
        await exportToPDF('financial-report-pdf', `التقرير_المالي_${start}_إلى_${end}`);
        toast.dismiss();
        toast.success('تم تحميل التقرير بنجاح');
      } catch (error) {
        toast.dismiss();
        toast.error('فشل في تصدير التقرير');
      } finally {
        setIsExportingPDF(false);
      }
    }, 800);
  };

  const reportTransactions = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    
    return transactions.filter(tx => {
      const txDate = tx.dateOriginal instanceof Date ? tx.dateOriginal : new Date(tx.dateOriginal);
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      return txDate >= start && txDate <= end;
    }).sort((a, b) => {
      const dateA = a.dateOriginal instanceof Date ? a.dateOriginal.getTime() : new Date(a.dateOriginal).getTime();
      const dateB = b.dateOriginal instanceof Date ? b.dateOriginal.getTime() : new Date(b.dateOriginal).getTime();
      return dateB - dateA;
    });
  }, [transactions, dateRange]);

  const handleDelete = async () => {
    if (!profile || !selectedTransaction) return;

    setIsSubmitting(true);
    try {
      const collectionName = selectedTransaction.source === 'worker' ? 'workerTransactions' : 'transactions';
      const success = await softDelete(
        collectionName,
        selectedTransaction.id,
        selectedTransaction,
        profile.uid,
        `عملية مالية: ${selectedTransaction.description}`
      );
      
      if (success) {
        await logActivity(
          'أرشفة عملية مالية',
          `تم نقل العملية: ${selectedTransaction.description} بمبلغ ${selectedTransaction.amount} ر.س إلى سلة المهملات`,
          'warning',
          'financial',
          profile.uid
        );
        setIsDeleteConfirmOpen(false);
      }
    } catch (error) {
      toast.error('فشل في حذف العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    currentView !== 'dashboard' ? (
      <div className="space-y-6">
        {currentView === 'revenue' && (
          <div className="max-w-6xl mx-auto space-y-8 pb-32">
            <DetailHeader title="تفاصيل الإيرادات" icon={ArrowUpRight} onBack={() => setCurrentView('dashboard')} />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="md:col-span-1 rounded-3xl bg-emerald-600 text-white border-none shadow-xl shadow-emerald-900/20 p-8 flex flex-col justify-center">
                <p className="text-xs font-black opacity-60 uppercase tracking-widest mb-1">إجمالي الإيرادات</p>
                <h3 className="text-4xl font-black">{stats.income.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
              </Card>
              
              <Card className="md:col-span-3 rounded-3xl border-none shadow-sm bg-white p-6">
                <h4 className="font-bold mb-4 text-slate-800">تحليل مصادر الدخل</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(transactions.filter(t => t.unifiedType === 'income').reduce((acc: any, t) => {
                      acc[t.category || 'other'] = (acc[t.category || 'other'] || 0) + t.amount;
                      return acc;
                    }, {})).map(([name, value]) => ({ name, value }))}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
                <h4 className="font-bold">سجل الإيرادات التفصيلي</h4>
              </div>
              <Table className="text-right" dir="rtl">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">البيان/المصدر</TableHead>
                    <TableHead className="text-right">المشروع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.unifiedType === 'income').map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-[11px]">{tx.dateDisplay}</TableCell>
                      <TableCell className="font-bold text-slate-800">{tx.description}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">{projects.find(p => p.id === tx.projectId)?.title || '-'}</TableCell>
                      <TableCell className="font-black text-emerald-600">{tx.amount.toLocaleString()} ر.س</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {currentView === 'expenses' && (
          <div className="max-w-6xl mx-auto space-y-8 pb-32">
            <DetailHeader title="تفاصيل المصروفات" icon={ArrowDownLeft} onBack={() => setCurrentView('dashboard')} />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="md:col-span-1 rounded-3xl bg-red-500 text-white border-none shadow-xl shadow-red-900/20 p-8 flex flex-col justify-center">
                <p className="text-xs font-black opacity-60 uppercase tracking-widest mb-1">إجمالي المصروفات</p>
                <h3 className="text-4xl font-black">{stats.expense.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
              </Card>
              
              <Card className="md:col-span-3 rounded-3xl border-none shadow-sm bg-white p-6">
                <h4 className="font-bold mb-4 text-slate-800">توزيع المصروفات حسب الفئة</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(transactions.filter(t => t.unifiedType === 'expense').reduce((acc: any, t) => {
                      const cat = t.category === 'other' ? 'أخرى' : (t.category || 'أخرى');
                      acc[cat] = (acc[cat] || 0) + t.amount;
                      return acc;
                    }, {})).map(([name, value]) => ({ name, value }))}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Bar dataKey="value" fill="#f43f5e" radius={[8, 8, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-slate-50/50">
                <h4 className="font-bold">كشف المصروفات والمشتريات</h4>
              </div>
              <Table className="text-right" dir="rtl">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">البيان</TableHead>
                    <TableHead className="text-right">الفئة</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.unifiedType === 'expense').map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium text-[11px]">{tx.dateDisplay}</TableCell>
                      <TableCell className="font-bold text-slate-800">{tx.description}</TableCell>
                      <TableCell className="text-[10px] font-black uppercase text-slate-400">{tx.category || 'مصروف عام'}</TableCell>
                      <TableCell className="font-black text-red-500">{tx.amount.toLocaleString()} ر.س</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {currentView === 'profit' && (
          <div className="max-w-6xl mx-auto space-y-8 pb-32">
            <DetailHeader title="تحليل صافي الربح" icon={Wallet} onBack={() => setCurrentView('dashboard')} />
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <Card className="md:col-span-4 rounded-3xl bg-slate-900 text-white border-none shadow-xl p-8 overflow-hidden relative group">
                <TrendingUp className="absolute -bottom-8 -right-8 w-48 h-48 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                <p className="text-xs font-black opacity-60 uppercase tracking-widest mb-1 relative z-10">إجمالي الأرباح الصافية</p>
                <h3 className="text-5xl font-black relative z-10">{stats.net.toLocaleString()} <span className="text-xs font-normal">ر.س</span></h3>
                <div className="mt-6 flex items-center gap-2 relative z-10 bg-white/10 w-fit px-3 py-1.5 rounded-full border border-white/10 border-dashed">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400">معدل نمو إيجابي مستهدف</span>
                </div>
              </Card>

              <Card className="md:col-span-8 rounded-3xl border-none shadow-sm bg-white p-6">
                <h4 className="font-bold mb-6 text-slate-800">تطور الربح الصافي شهرياً</h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-3xl border-none shadow-sm p-6 bg-white">
                <h4 className="font-bold mb-4 text-emerald-600 border-b pb-2">أعلى المشاريع ربحاً</h4>
                <div className="space-y-3">
                  {projects.slice(0, 5).map(p => {
                    const income = transactions.filter(t => t.projectId === p.id && t.unifiedType === 'income').reduce((s,tx) => s+tx.amount, 0);
                    const expense = transactions.filter(t => t.projectId === p.id && t.unifiedType === 'expense').reduce((s,tx) => s+tx.amount, 0);
                    return (
                      <div key={p.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="text-right">
                          <p className="font-bold text-sm text-slate-700">{p.title}</p>
                          <p className="text-[10px] text-slate-400">إجمالي العمليات: {transactions.filter(t => t.projectId === p.id).length}</p>
                        </div>
                        <p className="font-black text-emerald-600">{(income - expense).toLocaleString()} <span className="text-[8px]">ر.س</span></p>
                      </div>
                    );
                  })}
                </div>
              </Card>
              <Card className="rounded-3xl border-none shadow-sm p-6 bg-white">
                <h4 className="font-bold mb-4 text-slate-800 border-b pb-2 text-right">ملخص النفقات الرأسمالية</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                    <span className="text-sm font-bold text-slate-500">أجور العمالة</span>
                    <span className="font-black text-red-500">{transactions.filter(t => t.category === 'عمالة' || t.source === 'worker').reduce((s,t) => s+t.amount, 0).toLocaleString()} ر.س</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                    <span className="text-sm font-bold text-slate-500">مشتريات المواد</span>
                    <span className="font-black text-red-500">{transactions.filter(t => t.category === 'مواد').reduce((s,t) => s+t.amount, 0).toLocaleString()} ر.س</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {currentView === 'account' && viewedAccountId && (
          <div className="max-w-6xl mx-auto space-y-8 pb-32">
            <DetailHeader 
              title={`كشف حساب: ${accountBalances.find(a => a.id === viewedAccountId)?.name}`} 
              icon={accountBalances.find(a => a.id === viewedAccountId)?.type === 'bank' ? CreditCard : Wallet} 
              onBack={() => setCurrentView('dashboard')} 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-3xl bg-white border shadow-sm p-8 flex flex-col items-center justify-center text-center">
                <div className={`p-4 rounded-3xl mb-4 ${accountBalances.find(a => a.id === viewedAccountId)?.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {accountBalances.find(a => a.id === viewedAccountId)?.type === 'bank' ? <CreditCard className="w-10 h-10" /> : <Wallet className="w-10 h-10" />}
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">الرصيد المتاح حالياً</p>
                <h3 className="text-4xl font-black text-primary">{(accountBalances.find(a => a.id === viewedAccountId)?.balance || 0).toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3>
                <Badge className="mt-4 bg-slate-100 text-slate-600 border-none px-4 py-1.5 rounded-full font-bold">
                  {accountBalances.find(a => a.id === viewedAccountId)?.type === 'bank' ? 'حساب بنكي' : 'خزينة نقدية'}
                </Badge>
              </Card>

              <Card className="md:col-span-2 rounded-3xl border-none shadow-sm bg-white p-6">
                <h4 className="font-bold mb-6 text-slate-800 text-right">حركة التدفق النقدي في هذا الحساب</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.map(d => {
                      const accTransactions = transactions.filter(t => t.bankAccountId === viewedAccountId);
                      const income = accTransactions.filter(t => t.unifiedType === 'income' && t.dateOriginal.getMonth() === new Date(d.sortKey).getMonth()).reduce((s,t) => s+t.amount, 0);
                      const expense = accTransactions.filter(t => t.unifiedType === 'expense' && t.dateOriginal.getMonth() === new Date(d.sortKey).getMonth()).reduce((s,t) => s+t.amount, 0);
                      return { name: d.name, income, expense };
                    })}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: '12px' }} />
                      <Bar dataKey="income" fill="#10b981" radius={[4,4,0,0]} barSize={20} />
                      <Bar dataKey="expense" fill="#f43f5e" radius={[4,4,0,0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-slate-50/50">
                <h4 className="font-bold text-right">كشف الحركات المسجلة</h4>
              </div>
              <Table className="text-right" dir="rtl">
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">العملية</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.bankAccountId === viewedAccountId).map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-[10px] text-slate-400 font-bold text-right">{tx.dateDisplay}</TableCell>
                      <TableCell className="font-bold text-slate-800 text-right">{tx.description}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`font-bold border-none ${tx.unifiedType === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {tx.unifiedType === 'income' ? 'وارد' : 'صادر'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-black text-right ${tx.unifiedType === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.unifiedType === 'income' ? '+' : '-'} {tx.amount.toLocaleString()} ر.س
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.filter(t => t.bankAccountId === viewedAccountId).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400">لا توجد حركات مسجلة لهذا الحساب</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-primary tracking-tight">المالية والمصروفات</h1>
          <p className="text-[10px] md:text-[13px] text-muted-foreground">إدارة العمليات المالية والمشتريات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button 
                className="rounded-lg bg-primary hover:bg-black gap-2 font-bold px-3 md:px-6 h-9 md:h-10 text-xs md:text-sm shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>إضافة عملية</span>
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-primary">إضافة عملية مالية</DialogTitle>
                <DialogDescription className="text-muted-foreground">أدخل تفاصيل العملية المالية الجديدة (إيراد أو مصروف) أدناه.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="space-y-2 text-right text-gray-700">
                  <Label htmlFor="type" className="font-bold">نوع العملية</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(v) => setFormData({...formData, type: v})}
                  >
                    <SelectTrigger className="w-full text-right h-11 rounded-lg">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">إيرادات (دخل)</SelectItem>
                      <SelectItem value="expense">مصروفات</SelectItem>
                      <SelectItem value="purchase">مشتريات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 text-right text-gray-700">
                  <Label htmlFor="project" className="font-bold font-sans">ربط بمشروع (اختياري)</Label>
                  <Select 
                    value={formData.projectId} 
                    onValueChange={(v) => setFormData({...formData, projectId: v})}
                  >
                    <SelectTrigger className="w-full text-right h-11 rounded-lg">
                      <SelectValue placeholder="اختر مشروع معين" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مشروع</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-right text-gray-700">
                  <Label htmlFor="category" className="font-bold">التصنيف</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v) => setFormData({...formData, category: v})}
                  >
                    <SelectTrigger className="w-full text-right h-11 rounded-lg">
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="مواد">مواد ومشتريات</SelectItem>
                      <SelectItem value="عمالة">أجور وعمالة</SelectItem>
                      <SelectItem value="مواصلات">مواصلات وبنزين</SelectItem>
                      <SelectItem value="أكل">إعاشة وأكل</SelectItem>
                      <SelectItem value="مصروفات جانبية">مصروفات جانبية</SelectItem>
                      <SelectItem value="إيجار">إيجارات</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 text-right text-gray-700">
                  <Label htmlFor="amount" className="font-bold">المبلغ (ر.س)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00" 
                    className="h-11 rounded-lg text-right"
                  />
                </div>
                <div className="space-y-2 text-right text-gray-700">
                  <Label htmlFor="description" className="font-bold">الوصف / المورد</Label>
                  <Input 
                    id="description" 
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="مثال: فاتورة أحبار، إيجار المكتب..." 
                    className="h-11 rounded-lg text-right"
                  />
                </div>
                <div className="space-y-2 text-right text-gray-700">
                  <Label className="font-bold">طريقة الدفع</Label>
                  <Select 
                    value={formData.paymentMethod} 
                    onValueChange={(v) => setFormData({...formData, paymentMethod: v as any})}
                  >
                    <SelectTrigger className="w-full text-right h-11 rounded-lg">
                      <SelectValue placeholder="اختر الطريقة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">كاش (الخزينة)</SelectItem>
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.paymentMethod === 'transfer' && (
                  <div className="space-y-2 text-right text-gray-700 animate-in slide-in-from-top-1">
                    <Label className="font-bold">الحساب البنكي</Label>
                    <Select 
                      value={formData.bankAccountId} 
                      onValueChange={(v: string) => setFormData({...formData, bankAccountId: v})}
                    >
                      <SelectTrigger className="w-full text-right h-11 rounded-lg">
                        <SelectValue placeholder="اختر الحساب المستلم/المرسل" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.filter(b => b.type === 'bank').map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {formData.paymentMethod === 'cash' && (
                  <div className="space-y-2 text-right text-gray-700 animate-in slide-in-from-top-1">
                    <Label className="font-bold">الخزينة المستهدفة</Label>
                    <Select 
                      value={formData.bankAccountId} 
                      onValueChange={(v: string) => setFormData({...formData, bankAccountId: v})}
                    >
                      <SelectTrigger className="w-full text-right h-11 rounded-lg">
                        <SelectValue placeholder="اختر الخزينة" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.filter(b => b.type === 'cash').map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <DialogFooter className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-primary hover:bg-black font-bold text-lg"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ العملية'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          <SmartExport 
            title="التقرير المالي العام"
            data={generalTransactions}
            columns={[
              { header: 'الوصف', key: 'description' },
              { header: 'المبلغ', key: 'amount' },
              { header: 'التصنيف', key: 'category' },
              { header: 'التاريخ', key: 'date' },
              { header: 'النوع', key: 'type' },
              { header: 'وسيلة الدفع', key: 'paymentMethod' }
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <StatCard title="الإيرادات" value={stats.income} icon={ArrowUpRight} color="text-emerald-600" onClick={() => setCurrentView('revenue')} />
        <StatCard title="المصروفات" value={stats.expense} icon={ArrowDownLeft} color="text-red-500" onClick={() => setCurrentView('expenses')} />
        {isManager && <StatCard title="صافي الربح" value={stats.net} icon={Wallet} color={stats.net >= 0 ? "text-emerald-600" : "text-red-600"} className="col-span-2 md:col-span-1" onClick={() => setCurrentView('profit')} />}
      </div>

      {isManager && (
        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            توزيع السيولة (الحسابات والخزينة)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {accountBalances.map(acc => (
              <Card 
                key={acc.id} 
                onClick={() => {
                  setViewedAccountId(acc.id);
                  setCurrentView('account');
                }}
                className={`rounded-2xl border-2 transition-all cursor-pointer overflow-hidden group hover:shadow-md ${
                  viewedAccountId === acc.id ? 'border-primary ring-2 ring-primary/10 bg-primary/5' : 'border-transparent shadow-sm bg-white'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl transition-colors ${
                      acc.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {acc.type === 'bank' ? <CreditCard className="w-3.5 h-3.5" /> : <Wallet className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-black text-slate-500 truncate">{acc.name}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary truncate">
                      {acc.balance.toLocaleString()} 
                      <span className="text-[10px] font-normal mr-1 text-slate-400">ر.س</span>
                    </p>
                    <p className="text-[8px] font-medium text-slate-400 mt-0.5">
                      {acc.type === 'bank' ? 'حساب بنكي' : 'خزينة كاش'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {accountBalances.length === 0 && (
              <div className="col-span-full p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-bold text-slate-400">لا توجد حسابات مسجلة. قم بإضافتها من الإعدادات لمراقبة السيولة.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-xl border-border bg-white shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  تحليل الدخل والمصروفات (آخر ٦ أشهر)
                </h3>
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium">مقارنة بين إجمالي السيولة الواردة والصادرة</p>
              </div>
            </div>
            <div className="h-[250px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Cairo' }}
                  />
                  <Legend iconType="circle" />
                  <Bar name="إيرادات" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar name="مصروفات" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-xl border-border bg-white shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-600" />
                  صافي الربح الشهري
                </h3>
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium">تطور الأرباح الصافية خلال الفترة الماضية</p>
              </div>
            </div>
            <div className="h-[250px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Cairo' }}
                  />
                  <Legend iconType="circle" />
                  <Line 
                    type="monotone" 
                    name="صافي الربح" 
                    dataKey="profit" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {isExportingPDF && (
        <PrintableReport 
          id="financial-report-pdf"
          title="التقرير المالي التفصيلي"
          subtitle={`سجل العمليات المالية - فترة من ${dateRange.start} إلى ${dateRange.end}`}
          headers={['ID', 'البيان', 'الفئة', 'النوع', 'المبلغ (ر.س)', 'التاريخ']}
          data={reportTransactions.map(tx => [
            tx.id.substring(0, 8).toUpperCase(),
            tx.description,
            tx.source === 'worker' ? 'أجور عمال' : (tx.category === 'other' ? 'أخرى' : tx.category),
            tx.unifiedType === 'income' ? 'إيراد' : 'مصروف',
            tx.amount.toLocaleString(),
            tx.dateDisplay
          ])}
          summary={[
            { label: 'عدد العمليات', value: reportTransactions.length.toString() },
            { 
              label: 'إجمالي المبلغ المعتمد', 
              value: reportTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString() + ' ر.س' 
            },
            { label: 'حالة التقرير', value: 'معتمد وموثق' }
          ]}
        />
      )}

      <ExportDateRangeDialog 
        isOpen={isDateRangeDialogOpen}
        onOpenChange={setIsDateRangeDialogOpen}
        onConfirm={handleConfirmDateRange}
        title="تصدير التقرير المالي"
      />

      <Card className="rounded-xl border-border bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
              <div className="relative w-full md:w-96">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث برقم الفاتورة أو المورد..." 
                  className="pr-10 rounded-lg border-slate-200 h-10 text-sm focus-visible:ring-accent" 
                />
              </div>
              {selectedAccountId && (
                <Badge 
                  variant="secondary" 
                  className="bg-primary/10 text-primary hover:bg-primary/20 gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                  onClick={() => setSelectedAccountId(null)}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  حساب: {bankAccounts.find(b => b.id === selectedAccountId)?.name}
                  <X className="w-3.5 h-3.5" />
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => toast.info('تصفية النتائج قيد التطوير...')}
                variant="ghost" 
                size="sm" 
                className="rounded-lg gap-2 text-muted-foreground hover:bg-slate-50"
              >
                <Filter className="w-4 h-4" />
                تصفية النتائج
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">رقم العملية</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">المورد / الوصف</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">المبلغ</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">التاريخ</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الحالة</TableHead>
                  <TableHead className="text-center py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                       <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-primary">#{tx.id.slice(0, 6)}</TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-primary">{tx.description}</span>
                          <span className={`text-[9px] font-bold px-1 py-0 rounded-sm uppercase w-fit mt-1 ${
                            tx.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {tx.type === 'purchase' ? 'مشتريات' : tx.type === 'income' ? 'إيرادات' : 'مصروف'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className={`text-[13px] font-bold flex items-center gap-0.5 ${tx.unifiedType === 'income' ? 'text-emerald-600' : 'text-primary'}`}>
                          {tx.amount.toLocaleString()} <span className="text-[10px] font-normal">ر.س</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[12px] text-muted-foreground font-medium">{tx.dateDisplay}</TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className={`rounded px-2.5 py-0.5 text-[10px] font-bold border-none shadow-none ${
                          tx.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {tx.status === 'approved' ? 'تم الاعتماد' : 'قيد الانتظار'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        {isManager && (
                          <Button 
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setIsDeleteConfirmOpen(true);
                            }}
                            variant="ghost" 
                            size="icon" 
                            className="text-red-400 hover:bg-red-50 rounded-lg h-8 w-8"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm font-medium">
                      لا يوجد عمليات مالية مطابقة للبحث
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-slate-100">
             {loading ? (
                <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
             ) : filteredTransactions.length > 0 ? (
               filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-3 flex items-center justify-between active:bg-slate-50 transition-all">
                     <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-black text-primary truncate max-w-[150px]">{tx.description}</span>
                           <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 border-slate-100 text-muted-foreground font-bold">{tx.id.slice(0, 4)}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] text-muted-foreground font-bold">{tx.dateDisplay?.split(',')?.[0] || '...'}</span>
                           <span className={`text-[7px] font-bold px-1 py-0 rounded-sm uppercase ${
                            tx.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {tx.type === 'purchase' ? 'مشتريات' : tx.type === 'income' ? 'إيرادات' : 'مصروف'}
                          </span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 shrink-0">
                        <div className="text-left">
                           <p className={`text-[12px] font-black ${tx.unifiedType === 'income' ? 'text-emerald-600' : 'text-primary'}`}>
                              {tx.amount.toLocaleString()} <span className="text-[8px] font-normal">ر.س</span>
                           </p>
                        </div>
                        <Button 
                          onClick={() => {
                            setSelectedTransaction(tx);
                            setIsDeleteConfirmOpen(true);
                          }}
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-red-300 active:text-red-600"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </Button>
                     </div>
                  </div>
               ))
             ) : (
                <div className="p-12 text-center text-xs text-muted-foreground">لا يوجد عمليات</div>
             )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">تأكيد حذف العملية</DialogTitle>
            <DialogDescription className="text-gray-600 py-3">
              هل أنت متأكد تماماً من حذف عملية: <span className="font-bold text-primary">{selectedTransaction?.description}</span>؟ سيتم إزالة هذه العملية نهائياً من سجلات المالية.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row-reverse gap-3 pt-4">
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 font-bold h-11 rounded-lg"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، حذف العملية'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 font-bold h-11 rounded-lg"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-24 left-6 z-40">
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="w-14 h-14 rounded-full bg-primary hover:bg-black shadow-xl flex items-center justify-center p-0"
        >
          <Plus className="w-7 h-7 text-white" />
        </Button>
      </div>
    </div>
  )
);
}

function StatCard({ title, value, icon: Icon, color, className, onClick }: any) {
  return (
    <Card 
      onClick={onClick}
      className={`rounded-2xl border-border bg-white shadow-sm p-3 md:p-5 overflow-hidden transition-all hover:shadow-md cursor-pointer group active:scale-95 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 text-right">
          <p className="text-[10px] md:text-[12px] font-bold text-muted-foreground mb-1 uppercase tracking-wider truncate">{title}</p>
          <h3 className={`text-lg md:text-2xl font-black truncate ${color}`}>
            {value.toLocaleString()} <span className="text-[10px] md:text-sm font-normal text-muted-foreground mr-1">ر.س</span>
          </h3>
        </div>
        <div className={`p-1.5 md:p-2 rounded-lg bg-slate-50 transition-colors group-hover:bg-primary group-hover:text-white ${color} shrink-0`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
    </Card>
  );
}

function DetailHeader({ title, onBack, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between mb-4 md:mb-8 animate-in slide-in-from-top-4 duration-500 bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm" dir="rtl">
      <div className="flex items-center gap-2 md:gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onBack}
          className="rounded-lg md:rounded-xl border-slate-200 hover:bg-slate-100 h-8 w-8 md:h-10 md:w-10 shrink-0"
        >
          <X className="w-4 h-4 md:w-5 md:h-5" />
        </Button>
        <div className="text-right">
          <h2 className="text-base md:text-2xl font-black text-primary flex items-center gap-1 md:gap-2">
            {Icon && <Icon className="w-4 h-4 md:w-6 md:h-6 text-primary/20 shrink-0" />}
            {title}
          </h2>
          <p className="text-[8px] md:text-[11px] text-muted-foreground font-bold italic">تفاصيل كاملة وتحليل مخصص</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => window.print()} variant="outline" className="rounded-xl h-9 md:h-10 px-3 md:px-5 font-bold gap-2 text-[10px] md:text-sm">
          <Download className="w-3 md:w-4 h-3 md:h-4 text-emerald-500" />
          طباعة التقرير
        </Button>
      </div>
    </div>
  );
}

