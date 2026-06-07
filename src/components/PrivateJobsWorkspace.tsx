import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Wallet, 
  Calendar, 
  User, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Layers, 
  ChevronRight, 
  Search,
  Filter,
  Sparkles,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import { Quotation } from '../types';

interface PrivateJobsWorkspaceProps {
  onNavigate?: (tab: string) => void;
}

export default function PrivateJobsWorkspace({ onNavigate }: PrivateJobsWorkspaceProps = {}) {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';
  const isSalesRep = profile?.role === 'sales_rep';

  const [privateJobs, setPrivateJobs] = useState<any[]>([]);
  const [repsList, setRepsList] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepFilter, setSelectedRepFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  
  const [minIncomeFilter, setMinIncomeFilter] = useState(false);
  const [minExpenseFilter, setMinExpenseFilter] = useState(false);
  const [minProfitFilter, setMinProfitFilter] = useState(false);

  // Dialog States
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [selectedJobForTx, setSelectedJobForTx] = useState<any | null>(null);
  const [expandedMilestonesId, setExpandedMilestonesId] = useState<string | null>(null);
  const [activeDetailModal, setActiveDetailModal] = useState<'contracts' | 'incomes' | 'expenses' | 'commission' | 'profit' | null>(null);

  // Form States
  const [newJobData, setNewJobData] = useState({
    clientName: '',
    clientPhone: '',
    projectTitle: '',
    contractAmount: '',
    notes: '',
    projectType: 'company' as 'company' | 'external',
    linkedDocId: '',
    category: 'عظم',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  const [newJobTx, setNewJobTx] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    recipientOrSource: '',
  });

  useEffect(() => {
    if (!profile) return;

    let qJobs;
    if (isManager) {
      // Manager can see all private jobs
      qJobs = query(collection(db, 'rep_private_jobs'));
    } else {
      // Reps can only see their own
      qJobs = query(collection(db, 'rep_private_jobs'), where('salesRepId', '==', profile.uid));
    }

    const unsubJobs = onSnapshot(qJobs, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      items.sort((a, b) => {
        const dateA = a.createdAt?.seconds || a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.seconds || b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      });
      setPrivateJobs(items);
      setLoading(false);
    });

    // Fetch reps names for manager dropdown and display
    if (isManager) {
      const unsubReps = onSnapshot(query(collection(db, 'users'), where('role', '==', 'sales_rep')), (snap) => {
        setRepsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => {
        unsubJobs();
        unsubReps();
      };
    }

    // Fetch representative quotations/invoices for linking
    if (isSalesRep) {
      const unsubQuotes = onSnapshot(
        query(collection(db, 'quotations'), where('salesRepId', '==', profile.uid)),
        (snap) => {
          const quotes = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'quotation' } as Quotation));
          setQuotations(prev => {
            const rest = prev.filter(q => q.docType !== 'quotation');
            return [...quotes, ...rest];
          });
        }
      );
      const unsubInvoices = onSnapshot(
        query(collection(db, 'invoices'), where('salesRepId', '==', profile.uid)),
        (snap) => {
          const invoices = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'invoice' } as Quotation));
          setQuotations(prev => {
            const rest = prev.filter(q => q.docType !== 'invoice');
            return [...invoices, ...rest];
          });
        }
      );
      return () => {
        unsubJobs();
        unsubQuotes();
        unsubInvoices();
      };
    }

    return () => {
      unsubJobs();
    };
  }, [profile, isManager, isSalesRep]);

  const handleLinkDocChange = (docId: string) => {
    const docObj = quotations.find(q => q.id === docId);
    if (docObj) {
      setNewJobData(prev => ({
        ...prev,
        linkedDocId: docId,
        clientName: docObj.clientName || '',
        contractAmount: String(docObj.totalAmount || ''),
        projectTitle: prev.projectTitle || `${docObj.docType === 'invoice' ? 'فاتورة' : 'عرض سعر'} - ${docObj.clientName}`,
      }));
    } else {
      setNewJobData(prev => ({
        ...prev,
        linkedDocId: '',
      }));
    }
  };

  const handleAddPrivateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobData.clientName || !newJobData.projectTitle || !newJobData.contractAmount) {
      toast.error('يرجى تعبئة الحقول الأساسية: العميل، المشروع، وقيمة العقد');
      return;
    }
    try {
      let linkedDocNumber = '';
      if (newJobData.projectType === 'company' && newJobData.linkedDocId) {
        const docObj = quotations.find(q => q.id === newJobData.linkedDocId);
        if (docObj) {
          linkedDocNumber = docObj.docNumber || '';
        }
      }

      const defaultMilestones = [
        { id: 'm1', title: 'تجهيز الموقع وتنظيفه', completed: false },
        { id: 'm2', title: 'أعمال التأسيس والقواعد', completed: false },
        { id: 'm3', title: 'صب الهيكل الخرساني عظم', completed: false },
        { id: 'm4', title: 'تأسيس السباكة والكهرباء', completed: false },
        { id: 'm5', title: 'اللياسة والتشطيبات', completed: false },
        { id: 'm6', title: 'التسليم النهائي والمفتاح', completed: false }
      ];

      await addDoc(collection(db, 'rep_private_jobs'), {
        salesRepId: profile.uid,
        salesRepName: profile.name || 'مجهول',
        clientName: newJobData.clientName,
        clientPhone: newJobData.clientPhone || '',
        projectTitle: newJobData.projectTitle,
        contractAmount: Number(newJobData.contractAmount),
        status: 'active',
        notes: newJobData.notes || '',
        projectType: newJobData.projectType,
        linkedDocId: newJobData.linkedDocId || '',
        linkedDocNumber,
        category: newJobData.category,
        startDate: newJobData.startDate || '',
        endDate: newJobData.endDate || '',
        milestones: defaultMilestones,
        transactions: [],
        createdAt: serverTimestamp(),
      });

      toast.success('تمت إضافة مشروع المقاولات الخاص بنجاح ✅');
      setIsAddJobOpen(false);
      setNewJobData({
        clientName: '',
        clientPhone: '',
        projectTitle: '',
        contractAmount: '',
        notes: '',
        projectType: 'company',
        linkedDocId: '',
        category: 'عظم',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة المشروع الخاص');
    }
  };

  const handleAddJobTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTx.amount || !newJobTx.description) {
      toast.error('يرجى إدخال الوصف والمبلغ');
      return;
    }
    if (!selectedJobForTx) return;
    try {
      const txId = Math.random().toString(36).substring(2, 9);
      const newTransaction = {
        id: txId,
        type: newJobTx.type,
        amount: Number(newJobTx.amount),
        description: newJobTx.description,
        recipientOrSource: newJobTx.recipientOrSource || '',
        date: new Date().toISOString().split('T')[0],
      };
      
      const currentTxs = selectedJobForTx.transactions || [];
      const updatedTxs = [...currentTxs, newTransaction];
      
      await updateDoc(doc(db, 'rep_private_jobs', selectedJobForTx.id), {
        transactions: updatedTxs
      });
      
      toast.success('تم تسجيل المعاملة المالية للمشروع بنجاح ✅');
      setSelectedJobForTx({ ...selectedJobForTx, transactions: updatedTxs });
      setNewJobTx({ type: 'income', amount: '', description: '', recipientOrSource: '' });
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء إضافة المعاملة المالية');
    }
  };

  const handleToggleMilestone = async (job: any, milestoneId: string) => {
    try {
      const currentMilestones = job.milestones || [];
      const updatedMilestones = currentMilestones.map((m: any) => 
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      );
      
      await updateDoc(doc(db, 'rep_private_jobs', job.id), {
        milestones: updatedMilestones
      });
      toast.success('تم تحديث حالة المرحلة بنجاح ✅');
    } catch (err) {
      toast.error('حدث خطأ أثناء تحديث حالة المرحلة');
    }
  };

  const handleToggleJobStatus = async (jobId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'completed' : 'active';
      await updateDoc(doc(db, 'rep_private_jobs', jobId), {
        status: newStatus
      });
      toast.success(`تم تحديث حالة المشروع إلى: ${newStatus === 'completed' ? 'مكتمل' : 'نشط'}`);
    } catch (err) {
      toast.error('حدث خطأ أثناء تحديث حالة المشروع');
    }
  };

  const handleDeleteJobTransaction = async (job: any, txId: string) => {
    try {
      const currentTxs = job.transactions || [];
      const updatedTxs = currentTxs.filter((t: any) => t.id !== txId);
      
      await updateDoc(doc(db, 'rep_private_jobs', job.id), {
        transactions: updatedTxs
      });
      
      toast.success('تم حذف المعاملة المالية بنجاح 🗑️');
      if (selectedJobForTx && selectedJobForTx.id === job.id) {
        setSelectedJobForTx({ ...selectedJobForTx, transactions: updatedTxs });
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء حذف المعاملة المالية');
    }
  };

  const handleDeletePrivateJob = async (jobId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟')) return;
    try {
      await deleteDoc(doc(db, 'rep_private_jobs', jobId));
      toast.success('تم حذف المشروع بنجاح 🗑️');
    } catch (err) {
      toast.error('حدث خطأ أثناء حذف المشروع');
    }
  };

  const getRepName = (repId: string) => {
    const r = repsList.find(x => x.id === repId);
    return r ? r.name : 'مندوب';
  };

  // Filtered private jobs
  const filteredJobs = privateJobs.filter(job => {
    const matchesSearch = 
      job.projectTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.salesRepName && job.salesRepName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRep = selectedRepFilter === 'all' || job.salesRepId === selectedRepFilter;
    const matchesCategory = selectedCategoryFilter === 'all' || job.category === selectedCategoryFilter;
    const matchesType = selectedTypeFilter === 'all' || job.projectType === selectedTypeFilter;

    return matchesSearch && matchesRep && matchesCategory && matchesType;
  });

  // Financial calculations
  const totalContracts = filteredJobs.reduce((sum, j) => sum + (j.contractAmount || 0), 0);
  const totalIncomes = filteredJobs.reduce((sum, j) => {
    const txs = j.transactions || [];
    return sum + txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  }, 0);
  const totalExpenses = filteredJobs.reduce((sum, j) => {
    const txs = j.transactions || [];
    return sum + txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
  }, 0);
  const totalCommission = filteredJobs.reduce((sum, j) => {
    return sum + (j.projectType === 'company' ? (j.contractAmount || 0) * 0.15 : 0);
  }, 0);
  const netProfit = totalIncomes - totalExpenses - totalCommission;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
        <div className="animate-spin text-amber-600"><Briefcase className="w-10 h-10" /></div>
        <p className="text-slate-500 font-bold">جاري تحميل مساحة عمل المقاولات الخاصة...</p>
      </div>
    );
  }

  const getCategoryBadgeColor = (cat?: string) => {
    switch (cat) {
      case 'عظم': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'تشطيب': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'تأسيس': return 'bg-sky-50 text-sky-700 border-sky-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="p-4 md:p-6 w-full space-y-6" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-l from-slate-900 via-slate-800 to-amber-950 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl"><Briefcase className="w-6 h-6" /></span>
            <h1 className="text-xl md:text-2xl font-black">{isManager ? 'بوابة الرقابة وتدقيق أعمال المناديب المستقلة' : 'بوابتي للمقاولات وإدارة أعمالي الخاصة'}</h1>
          </div>
          <p className="text-slate-300 text-xs mt-1.5 max-w-xl">
            {isManager 
              ? 'مساحة إدارية لمراقبة مشروعات المقاولات الخارجية التي يديرها المناديب ومتابعة العمولات وتجنب تضارب المصالح.' 
              : 'نظام إدارة وCRM محاسبي مصغر لمتابعة عقودك المستقلة، مقبوضاتك، مصاريفك، ومقاولين الباطن بعيداً عن حسابات الشركة.'
            }
          </p>
        </div>
        {isSalesRep && (
          <Button 
            onClick={() => setIsAddJobOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black gap-2 h-11 px-5 text-xs shadow-lg shadow-amber-500/10 shrink-0 self-start sm:self-center"
          >
            <Plus className="w-4 h-4" /> إضافة مشروع مقاولات
          </Button>
        )}
      </div>

      {/* Top Navigation / Breadcrumb for Rep */}
      {isSalesRep && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.('rep_dashboard')}
            className="gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl px-3 h-9"
          >
            <ArrowRight className="w-4 h-4" /> العودة للوحة التحكم
          </Button>
          <span className="text-xs text-slate-400 font-bold">بوابة المندوب / المقاولات الخاصة</span>
        </div>
      )}

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Contracts Card */}
        <Card 
          onClick={() => setActiveDetailModal('contracts')}
          className="border-none shadow-md rounded-[1.5rem] bg-slate-900 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
        >
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400">إجمالي قيمة العقود</p>
              <h3 className="text-lg font-black">{totalContracts.toLocaleString('ar-SA')} <span className="text-[10px] font-normal">ر.س</span></h3>
              <p className="text-[9px] text-slate-400">{filteredJobs.length} مشروع (اضغط للتفاصيل)</p>
            </div>
            <div className="bg-white/10 p-2.5 rounded-2xl group-hover:scale-110 transition-transform"><TrendingUp className="w-5 h-5 text-slate-300" /></div>
          </CardContent>
        </Card>

        {/* Total Income Card */}
        <Card 
          onClick={() => setActiveDetailModal('incomes')}
          className="border-none shadow-md rounded-[1.5rem] bg-emerald-600 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
        >
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-emerald-100">إجمالي المقبوضات</p>
              <h3 className="text-lg font-black">{totalIncomes.toLocaleString('ar-SA')} <span className="text-[10px] font-normal">ر.س</span></h3>
              <p className="text-[9px] text-emerald-200">التحصيلات النقدية (اضغط للتفاصيل)</p>
            </div>
            <div className="bg-white/15 p-2.5 rounded-2xl group-hover:scale-110 transition-transform"><ArrowUpRight className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>

        {/* Total Expenses Card */}
        <Card 
          onClick={() => setActiveDetailModal('expenses')}
          className="border-none shadow-md rounded-[1.5rem] bg-rose-600 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
        >
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-rose-100">إجمالي المصروفات</p>
              <h3 className="text-lg font-black">{totalExpenses.toLocaleString('ar-SA')} <span className="text-[10px] font-normal">ر.س</span></h3>
              <p className="text-[9px] text-rose-200">التكاليف والمواد (اضغط للتفاصيل)</p>
            </div>
            <div className="bg-white/15 p-2.5 rounded-2xl group-hover:scale-110 transition-transform"><ArrowDownLeft className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>

        {/* Company Commission Card */}
        <Card 
          onClick={() => setActiveDetailModal('commission')}
          className="border-none shadow-md rounded-[1.5rem] bg-amber-500 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
        >
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-amber-100">عمولة المؤسسة (15%)</p>
              <h3 className="text-lg font-black">{totalCommission.toLocaleString('ar-SA')} <span className="text-[10px] font-normal">ر.س</span></h3>
              <p className="text-[9px] text-amber-100">مستحقة للمؤسسة (اضغط للتفاصيل)</p>
            </div>
            <div className="bg-white/15 p-2.5 rounded-2xl group-hover:scale-110 transition-transform"><Wallet className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>

        {/* Net Profit Card */}
        <Card 
          onClick={() => setActiveDetailModal('profit')}
          className="border-none shadow-md rounded-[1.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group sm:col-span-2 lg:col-span-1"
        >
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-blue-100">صافي الربح الفعلي</p>
              <h3 className="text-lg font-black">{netProfit.toLocaleString('ar-SA')} <span className="text-[10px] font-normal">ر.س</span></h3>
              <p className="text-[9px] text-blue-100">بعد التكاليف والعمولة (اضغط للتفاصيل)</p>
            </div>
            <div className="bg-white/15 p-2.5 rounded-2xl group-hover:scale-110 transition-transform"><Briefcase className="w-5 h-5 text-white" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="border-none shadow-sm rounded-3xl bg-white p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            <Input 
              placeholder={isManager ? "البحث باسم المشروع، العميل، أو المندوب..." : "البحث باسم المشروع أو العميل..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="rounded-xl h-11 pr-9 pl-4 bg-slate-50 border-slate-100 focus-visible:ring-amber-500"
            />
          </div>

          {/* Selector filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isManager && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-bold">المندوب:</span>
                <select
                  className="border border-slate-100 bg-slate-50 px-3 h-10 rounded-xl text-xs font-bold focus:outline-none"
                  value={selectedRepFilter}
                  onChange={e => setSelectedRepFilter(e.target.value)}
                >
                  <option value="all">كل المناديب</option>
                  {repsList.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">التخصص:</span>
              <select
                className="border border-slate-100 bg-slate-50 px-3 h-10 rounded-xl text-xs font-bold focus:outline-none"
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="all">كل التخصصات</option>
                <option value="عظم">أعمال عظم</option>
                <option value="تشطيب">أعمال تشطيب</option>
                <option value="تأسيس">أعمال تأسيس</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">النوع:</span>
              <select
                className="border border-slate-100 bg-slate-50 px-3 h-10 rounded-xl text-xs font-bold focus:outline-none"
                value={selectedTypeFilter}
                onChange={e => setSelectedTypeFilter(e.target.value)}
              >
                <option value="all">الكل</option>
                <option value="company">عبر المؤسسة (15%)</option>
                <option value="external">مستقل بالكامل (0%)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Main content grid */}
      {filteredJobs.length === 0 ? (
        <Card className="border-none shadow-sm rounded-[2rem] bg-white p-16 text-center">
          <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-25 text-slate-400" />
          <h3 className="font-black text-slate-800 text-base">لا توجد مشاريع مقاولات مطابقة حالياً</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">جرب تعديل فلاتر البحث والفرز، أو اضغط على إضافة مشروع جديد لبناء أول بطاقة مشروع مقاولات.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => {
            const txs = job.transactions || [];
            const jobIncome = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
            const jobExpense = txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
            const comm = job.projectType === 'company' ? (job.contractAmount || 0) * 0.15 : 0;
            const jobProfit = jobIncome - jobExpense - comm;
            
            const collectPercent = job.contractAmount > 0 ? Math.min(Math.round((jobIncome / job.contractAmount) * 100), 100) : 0;
            
            const milestonesList = job.milestones || [];
            const completedMilestonesCount = milestonesList.filter((m: any) => m.completed).length;
            const workPercent = milestonesList.length > 0 ? Math.round((completedMilestonesCount / milestonesList.length) * 100) : 0;

            return (
              <Card key={job.id} className="border border-slate-100 shadow-sm rounded-3xl bg-white hover:shadow-md transition-all p-5 flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${getCategoryBadgeColor(job.category)}`}>
                          {job.category || 'عظم'}
                        </span>
                        {job.projectType === 'company' ? (
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[9px] shadow-none">عبر المؤسسة 15%</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 font-bold text-[9px] shadow-none">خارجي 0%</Badge>
                        )}
                      </div>
                      <h4 className="font-black text-slate-800 text-sm mt-1.5">{job.projectTitle}</h4>
                      {isManager && (
                        <p className="text-[10px] text-amber-700 font-black mt-1">المندوب المسؤول: {job.salesRepName || getRepName(job.salesRepId)}</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-1">العميل: <span className="font-bold text-slate-700">{job.clientName}</span> {job.clientPhone && `(${job.clientPhone})`}</p>
                      {job.linkedDocNumber && (
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">مربوط بمستند: #{job.linkedDocNumber}</p>
                      )}
                    </div>
                    <button
                      onClick={() => isSalesRep && handleToggleJobStatus(job.id, job.status)}
                      disabled={isManager}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border shrink-0 ${
                        job.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                      } ${isManager ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {job.status === 'completed' ? 'مكتمل ✅' : 'نشط 🏗️'}
                    </button>
                  </div>

                  {/* Start and End Dates */}
                  {(job.startDate || job.endDate) && (
                    <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> البدء: {job.startDate || '—'}</span>
                      <span className="w-px h-3 bg-slate-200" />
                      <span>الانتهاء المتوقع: {job.endDate || '—'}</span>
                    </div>
                  )}

                  {/* Notes if exist */}
                  {job.notes && (
                    <p className="text-[10px] text-slate-400 font-normal bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50 mb-3 line-clamp-2">
                      {job.notes}
                    </p>
                  )}

                  {/* Financial Details Table */}
                  <div className="grid grid-cols-4 gap-1 bg-white p-3 rounded-2xl border border-slate-100 mb-4 text-center">
                    <div>
                      <span className="text-[8px] text-slate-400 block font-bold">قيمة العقد</span>
                      <span className="text-[10px] font-black text-slate-700">{job.contractAmount?.toLocaleString('ar-SA')}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block font-bold">عمولة المؤسسة</span>
                      <span className="text-[10px] font-black text-amber-600">{comm?.toLocaleString('ar-SA')}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block font-bold">المحصل</span>
                      <span className="text-[10px] font-black text-emerald-600">{jobIncome?.toLocaleString('ar-SA')}</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block font-bold">الربح الفعلي</span>
                      <span className={`text-[10px] font-black ${jobProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>{jobProfit?.toLocaleString('ar-SA')}</span>
                    </div>
                  </div>

                  {/* Two progress bars */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                        <span>نسبة التحصيل</span>
                        <span className="text-emerald-600">{collectPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${collectPercent}%` }}></div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] text-slate-400 font-bold">
                        <span>نسبة الإنجاز</span>
                        <span className="text-blue-600">{workPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${workPercent}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Milestones Checklist */}
                  <div className="border border-slate-100 rounded-2xl bg-slate-50/30 overflow-hidden mb-4">
                    <button
                      type="button"
                      onClick={() => setExpandedMilestonesId(expandedMilestonesId === job.id ? null : job.id)}
                      className="w-full px-3 py-2 text-right text-[10px] font-bold text-slate-600 flex justify-between items-center bg-slate-100/30 hover:bg-slate-100/60 transition-colors"
                    >
                      <span>مراحل وتدفق تنفيذ المشروع ({completedMilestonesCount} / {milestonesList.length})</span>
                      <span className="text-[9px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-600">
                        {expandedMilestonesId === job.id ? 'إغلاق 🔼' : 'عرض وتحديث 🔽'}
                      </span>
                    </button>
                    {expandedMilestonesId === job.id && (
                      <div className="p-3 space-y-2 border-t border-slate-100 bg-white max-h-[160px] overflow-y-auto">
                        {milestonesList.length === 0 ? (
                          <span className="text-[10px] text-slate-400 block text-center">لا توجد مراحل مسجلة</span>
                        ) : (
                          milestonesList.map((m: any) => (
                            <label key={m.id} className="flex items-center gap-2 text-[10px] font-bold text-slate-600 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors">
                              <input
                                type="checkbox"
                                checked={m.completed}
                                disabled={isManager}
                                onChange={() => handleToggleMilestone(job, m.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className={m.completed ? 'line-through text-slate-400 font-normal' : 'text-slate-700'}>
                                {m.title}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100/70">
                  <Button
                    onClick={() => setSelectedJobForTx(job)}
                    variant="outline"
                    className="flex-1 h-9.5 rounded-xl text-xs font-bold border-amber-200 text-amber-800 hover:bg-amber-50 gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" /> {isManager ? 'مراجعة الدفتر والتدقيق' : 'دفتر الحسابات'} ({txs.length})
                  </Button>
                  {isSalesRep && (
                    <Button
                      onClick={() => handleDeletePrivateJob(job.id)}
                      variant="outline"
                      size="icon"
                      className="h-9.5 w-9.5 rounded-xl border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200"
                      title="حذف المشروع"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Private Job Dialog */}
      <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem] p-6 text-right" dir="rtl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-amber-600" />
              إضافة مشروع مقاولات خاص جديد
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddPrivateJob} className="space-y-4" style={{ fontFamily: "'Cairo', sans-serif" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Right column / Group 1 */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">تصنيف المشروع *</label>
                  <select
                    className="w-full border border-input bg-background px-3 h-11 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={newJobData.projectType}
                    onChange={e => setNewJobData({ 
                      clientName: '',
                      clientPhone: '',
                      projectTitle: '',
                      contractAmount: '',
                      notes: '',
                      projectType: e.target.value as any, 
                      linkedDocId: '',
                      category: 'عظم',
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: '',
                    })}
                    required
                  >
                    <option value="company">مشروع عبر المؤسسة (يخضع لعمولة 15%)</option>
                    <option value="external">مشروع خارجي بالكامل (عمولة 0%)</option>
                  </select>
                </div>

                {newJobData.projectType === 'company' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">ربط بمستند رسمي صادر باسمك</label>
                    <select
                      className="w-full border border-input bg-background px-3 h-11 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={newJobData.linkedDocId}
                      onChange={e => handleLinkDocChange(e.target.value)}
                    >
                      <option value="">-- اختر مستنداً للربط التلقائي --</option>
                      {quotations.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.docType === 'invoice' ? 'فاتورة' : 'عرض سعر'} # {q.docNumber || 'بدون رقم'} - {q.clientName} ({(q.totalAmount || 0).toLocaleString('ar-SA')} ر.س)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">اسم المشروع / طبيعة العمل *</label>
                  <Input 
                    placeholder="مثال: مقاولة فيلا الياسمين - أعمال عظم"
                    value={newJobData.projectTitle}
                    onChange={e => setNewJobData({ ...newJobData, projectTitle: e.target.value })}
                    className="rounded-xl h-11"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">تاريخ البدء *</label>
                    <Input 
                      type="date"
                      value={newJobData.startDate}
                      onChange={e => setNewJobData({ ...newJobData, startDate: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">الانتهاء المتوقع *</label>
                    <Input 
                      type="date"
                      value={newJobData.endDate}
                      onChange={e => setNewJobData({ ...newJobData, endDate: e.target.value })}
                      className="rounded-xl h-11 text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Left column / Group 2 */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">اسم العميل الخاص *</label>
                  <Input 
                    placeholder="مثال: أبو فهد"
                    value={newJobData.clientName}
                    onChange={e => setNewJobData({ ...newJobData, clientName: e.target.value })}
                    className="rounded-xl h-11"
                    required
                    disabled={newJobData.projectType === 'company' && !!newJobData.linkedDocId}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">رقم هاتف العميل (اختياري)</label>
                  <Input 
                    placeholder="مثال: 05xxxxxxx"
                    value={newJobData.clientPhone}
                    onChange={e => setNewJobData({ ...newJobData, clientPhone: e.target.value })}
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">تخصص المشروع *</label>
                  <select
                    className="w-full border border-input bg-background px-3 h-11 rounded-xl text-xs font-bold focus-visible:outline-none"
                    value={newJobData.category}
                    onChange={e => setNewJobData({ ...newJobData, category: e.target.value })}
                    required
                  >
                    <option value="عظم">أعمال عظم وهيكل خرساني</option>
                    <option value="تشطيب">أعمال تشطيب وديكور</option>
                    <option value="تأسيس">أعمال تأسيس كهرباء وسباكة</option>
                    <option value="أخرى">أخرى / تخصص متنوع</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">قيمة العقد الكلية (ر.س) *</label>
                  <Input 
                    type="number"
                    placeholder="مثال: 150000"
                    value={newJobData.contractAmount}
                    onChange={e => setNewJobData({ ...newJobData, contractAmount: e.target.value })}
                    className="rounded-xl h-11"
                    required
                    disabled={newJobData.projectType === 'company' && !!newJobData.linkedDocId}
                  />
                </div>
              </div>

              {/* Full width bottom */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-600 block">ملاحظات أو شروط الدفع</label>
                <textarea 
                  placeholder="تفاصيل إضافية حول المشروع، الدفعات، والمواعيد..."
                  value={newJobData.notes}
                  onChange={e => setNewJobData({ ...newJobData, notes: e.target.value })}
                  className="w-full min-h-[80px] border border-input bg-background p-3 rounded-xl text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 mt-4">
              <Button 
                type="submit"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-11 font-black text-xs"
              >
                إضافة المشروع
              </Button>
              <Button 
                type="button" 
                variant="ghost"
                className="rounded-xl h-11 px-4 text-slate-500 font-bold"
                onClick={() => setIsAddJobOpen(false)}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Private Job Ledger Dialog */}
      <Dialog open={!!selectedJobForTx} onOpenChange={(open) => !open && setSelectedJobForTx(null)}>
        <DialogContent className="max-w-xl rounded-[2rem] p-6 text-right" dir="rtl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              {isManager ? 'سجل التدفقات المالية والمقبوضات المفصح عنها للمندوب' : 'دفتر الحسابات والتدفقات المالية للمشروع'}
            </DialogTitle>
            <p className="text-[11px] text-slate-500 font-bold mt-1">المشروع: {selectedJobForTx?.projectTitle} | قيمة العقد الكلية: {selectedJobForTx?.contractAmount?.toLocaleString('ar-SA')} ر.س</p>
          </DialogHeader>

          {selectedJobForTx && (
            <div className="space-y-6" style={{ fontFamily: "'Cairo', sans-serif" }}>
              {/* Transactions list */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-800 block">سجل الحركات المالية المضافة</span>
                {(!selectedJobForTx.transactions || selectedJobForTx.transactions.length === 0) ? (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs">
                    لا توجد أي حركات مالية مسجلة بعد لهذا المشروع.
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                          <th className="p-2.5">البيان</th>
                          <th className="p-2.5 text-center">التاريخ</th>
                          <th className="p-2.5 text-left">المبلغ</th>
                          {isSalesRep && <th className="p-2.5 text-center">حذف</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJobForTx.transactions.map((tx: any) => (
                          <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-2.5">
                              <p className="font-bold text-slate-800">{tx.description}</p>
                              {tx.recipientOrSource && (
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">الطرف المستلم/الدافع: {tx.recipientOrSource}</p>
                              )}
                            </td>
                            <td className="p-2.5 text-center text-slate-500">{tx.date}</td>
                            <td className={`p-2.5 text-left font-black ${tx.type === 'income' ? 'text-green-600' : 'text-rose-600'}`}>
                              {tx.type === 'income' ? '+' : '-'}{(tx.amount || 0).toLocaleString('ar-SA')} ر.س
                            </td>
                            {isSalesRep && (
                              <td className="p-2.5 text-center">
                                <button
                                  onClick={() => handleDeleteJobTransaction(selectedJobForTx, tx.id)}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add transaction form (Only for Sales Rep) */}
              {isSalesRep && (
                <form onSubmit={handleAddJobTransaction} className="border-t pt-4 space-y-3">
                  <span className="text-xs font-black text-slate-800 block">إضافة حركة مالية جديدة</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block">نوع المعاملة</label>
                      <select
                        className="w-full border border-input bg-background px-3 h-10 rounded-xl text-xs font-bold focus-visible:outline-none"
                        value={newJobTx.type}
                        onChange={e => setNewJobTx({ ...newJobTx, type: e.target.value as any })}
                        required
                      >
                        <option value="income">إيراد / دفعة من العميل (+)</option>
                        <option value="expense">مصروف / تكاليف ومواد (-)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600 block">المبلغ (ر.س)</label>
                      <Input
                        type="number"
                        placeholder="مثال: 5000"
                        value={newJobTx.amount}
                        onChange={e => setNewJobTx({ ...newJobTx, amount: e.target.value })}
                        className="rounded-xl h-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 block">المورد / مقاول الباطن / الدافع (اختياري)</label>
                      <Input
                        placeholder="مثال: مصنع الخرسانة الجاهزة، السباك أبو خالد، العميل نفسه..."
                        value={newJobTx.recipientOrSource}
                        onChange={e => setNewJobTx({ ...newJobTx, recipientOrSource: e.target.value })}
                        className="rounded-xl h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 block">الوصف / البيان *</label>
                    <Input
                      placeholder="مثال: استلام الدفعة الأولى من العميل، أو شراء حديد تسليح..."
                      value={newJobTx.description}
                      onChange={e => setNewJobTx({ ...newJobTx, description: e.target.value })}
                      className="rounded-xl h-10"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 font-black text-xs gap-1"
                  >
                    <Plus className="w-4 h-4" /> إضافة الحركة المالية
                  </Button>
                </form>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl h-10 px-4 text-slate-500 font-bold"
                  onClick={() => setSelectedJobForTx(null)}
                >
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Modals */}
      <Dialog open={activeDetailModal !== null} onOpenChange={(open) => !open && setActiveDetailModal(null)}>
        <DialogContent className="max-w-4xl rounded-[2rem] p-6 text-right overflow-y-auto max-h-[85vh] bg-white border border-slate-200 shadow-2xl" dir="rtl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              {activeDetailModal === 'contracts' && (
                <>
                  <Briefcase className="w-5 h-5 text-slate-900" />
                  تفاصيل العقود ومشاريع المقاولات الخاصة
                </>
              )}
              {activeDetailModal === 'incomes' && (
                <>
                  <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                  كشف المقبوضات والتحصيلات المالية (مجمعة)
                </>
              )}
              {activeDetailModal === 'expenses' && (
                <>
                  <ArrowDownLeft className="w-5 h-5 text-rose-600" />
                  سجل المصروفات وتكاليف الموردين والعمالة (مجمعة)
                </>
              )}
              {activeDetailModal === 'commission' && (
                <>
                  <Wallet className="w-5 h-5 text-amber-500" />
                  بيان عمولات المؤسسة التشغيلية المستحقة (15%)
                </>
              )}
              {activeDetailModal === 'profit' && (
                <>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  ملخص الأرباح والجدوى المالية للمشاريع
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Modal Content */}
          <div className="space-y-4 font-sans text-xs">
            {activeDetailModal === 'contracts' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-2">
                  <span className="font-bold text-slate-500">إجمالي قيمة العقود الخاصة:</span>
                  <span className="font-black text-sm text-slate-800">{totalContracts.toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                        <th className="p-3">اسم المشروع / المندوب</th>
                        <th className="p-3">العميل</th>
                        <th className="p-3">التصنيف</th>
                        <th className="p-3">النوع</th>
                        <th className="p-3 text-left">قيمة العقد</th>
                        <th className="p-3 text-center">التاريخ</th>
                        <th className="p-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => (
                        <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3">
                            <p className="font-black text-slate-800">{job.projectTitle}</p>
                            {isManager && <p className="text-[9px] text-amber-700 font-bold mt-0.5">المسؤول: {job.salesRepName || getRepName(job.salesRepId)}</p>}
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-700">{job.clientName}</p>
                            <p className="text-[9px] text-slate-400 font-normal">{job.clientPhone || 'بدون هاتف'}</p>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black ${getCategoryBadgeColor(job.category)}`}>
                              {job.category || 'عظم'}
                            </span>
                          </td>
                          <td className="p-3">
                            {job.projectType === 'company' ? (
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[8px] shadow-none">شركة (15%)</Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 font-bold text-[8px] shadow-none">مستقل</Badge>
                            )}
                          </td>
                          <td className="p-3 text-left font-black text-slate-700">
                            {(job.contractAmount || 0).toLocaleString('ar-SA')} ر.س
                          </td>
                          <td className="p-3 text-center text-slate-500 text-[10px]">
                            {job.startDate || '—'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {job.status === 'completed' ? 'مكتمل' : 'نشط'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeDetailModal === 'incomes' && (() => {
              const allIncomes = filteredJobs.flatMap(job => 
                (job.transactions || [])
                  .filter((t: any) => t.type === 'income')
                  .map((t: any) => ({ 
                    ...t, 
                    jobTitle: job.projectTitle, 
                    clientName: job.clientName, 
                    salesRepName: job.salesRepName || getRepName(job.salesRepId) 
                  }))
              );
              allIncomes.sort((a, b) => b.date.localeCompare(a.date));

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 mb-2">
                    <span className="font-bold text-emerald-800">إجمالي المقبوضات المحصلة:</span>
                    <span className="font-black text-sm text-emerald-700">{totalIncomes.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  {allIncomes.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p className="font-bold">لا توجد مقبوضات مسجلة بعد</p>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                            <th className="p-3">المشروع / المندوب</th>
                            <th className="p-3">الدافع (العميل / المصدر)</th>
                            <th className="p-3">البيان والوصف</th>
                            <th className="p-3 text-center">التاريخ</th>
                            <th className="p-3 text-left">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allIncomes.map((tx, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3">
                                <p className="font-black text-slate-800">{tx.jobTitle}</p>
                                {isManager && <p className="text-[9px] text-amber-700 font-bold mt-0.5">المندوب: {tx.salesRepName}</p>}
                              </td>
                              <td className="p-3 font-bold text-slate-700">{tx.recipientOrSource || tx.clientName}</td>
                              <td className="p-3 text-slate-500">{tx.description}</td>
                              <td className="p-3 text-center text-slate-400 text-[10px]">{tx.date}</td>
                              <td className="p-3 text-left font-black text-emerald-600">+{tx.amount.toLocaleString('ar-SA')} ر.س</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {activeDetailModal === 'expenses' && (() => {
              const allExpenses = filteredJobs.flatMap(job => 
                (job.transactions || [])
                  .filter((t: any) => t.type === 'expense')
                  .map((t: any) => ({ 
                    ...t, 
                    jobTitle: job.projectTitle, 
                    clientName: job.clientName, 
                    salesRepName: job.salesRepName || getRepName(job.salesRepId) 
                  }))
              );
              allExpenses.sort((a, b) => b.date.localeCompare(a.date));

              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100 mb-2">
                    <span className="font-bold text-rose-800">إجمالي المصروفات والتكاليف:</span>
                    <span className="font-black text-sm text-rose-600">{totalExpenses.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  {allExpenses.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p className="font-bold">لا توجد مصروفات مسجلة بعد</p>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                            <th className="p-3">المشروع / المندوب</th>
                            <th className="p-3">المستفيد / مقاول الباطن / المورد</th>
                            <th className="p-3">البيان والوصف</th>
                            <th className="p-3 text-center">التاريخ</th>
                            <th className="p-3 text-left">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allExpenses.map((tx, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3">
                                <p className="font-black text-slate-800">{tx.jobTitle}</p>
                                {isManager && <p className="text-[9px] text-amber-700 font-bold mt-0.5">المندوب: {tx.salesRepName}</p>}
                              </td>
                              <td className="p-3 font-bold text-slate-700">{tx.recipientOrSource || 'غير محدد'}</td>
                              <td className="p-3 text-slate-500">{tx.description}</td>
                              <td className="p-3 text-center text-slate-400 text-[10px]">{tx.date}</td>
                              <td className="p-3 text-left font-black text-rose-500">-{tx.amount.toLocaleString('ar-SA')} ر.س</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {activeDetailModal === 'commission' && (() => {
              const companyJobs = filteredJobs.filter(j => j.projectType === 'company');
              return (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-amber-50 p-3.5 rounded-2xl border border-amber-200 mb-2">
                    <span className="font-bold text-amber-800">إجمالي عمولة المؤسسة المتراكمة (15%):</span>
                    <span className="font-black text-sm text-amber-600">{totalCommission.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">تُحتسب هذه العمولة على المبيعات والمشاريع المسهلة للمندوبين عبر رخصة وسجلات المؤسسة الرسمية بمعدل 15% من قيمة العقد الإجمالية.</p>
                  {companyJobs.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <p className="font-bold">لا توجد مشاريع خاضعة للعمولة حالياً</p>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                            <th className="p-3">المشروع / المندوب</th>
                            <th className="p-3">العميل</th>
                            <th className="p-3 text-left">قيمة العقد</th>
                            <th className="p-3 text-left">عمولة المؤسسة (15%)</th>
                            <th className="p-3 text-center">نسبة التحصيل</th>
                            <th className="p-3 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companyJobs.map((job) => {
                            const comm = (job.contractAmount || 0) * 0.15;
                            const txs = job.transactions || [];
                            const jobIncome = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                            const collectPercent = job.contractAmount > 0 ? Math.min(Math.round((jobIncome / job.contractAmount) * 100), 100) : 0;
                            return (
                              <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="p-3">
                                  <p className="font-black text-slate-800">{job.projectTitle}</p>
                                  {isManager && <p className="text-[9px] text-amber-700 font-bold mt-0.5">المندوب: {job.salesRepName || getRepName(job.salesRepId)}</p>}
                                </td>
                                <td className="p-3 font-bold text-slate-700">{job.clientName}</td>
                                <td className="p-3 text-left font-bold text-slate-600">{(job.contractAmount || 0).toLocaleString('ar-SA')} ر.س</td>
                                <td className="p-3 text-left font-black text-amber-600">{comm.toLocaleString('ar-SA')} ر.س</td>
                                <td className="p-3 text-center font-bold text-emerald-600">{collectPercent}%</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {job.status === 'completed' ? 'مكتمل' : 'نشط'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {activeDetailModal === 'profit' && (() => {
              return (
                <div className="space-y-4">
                  {/* Performance overview cards inside modal */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl text-center">
                      <span className="text-[9px] font-bold text-emerald-800 block">إجمالي الإيرادات (المحصلة)</span>
                      <span className="text-xs font-black text-emerald-700 mt-1 block">{totalIncomes.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-2xl text-center">
                      <span className="text-[9px] font-bold text-rose-800 block">إجمالي المصاريف المباشرة</span>
                      <span className="text-xs font-black text-rose-600 mt-1 block">{totalExpenses.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-2xl text-center">
                      <span className="text-[9px] font-bold text-amber-800 block">العمولة المستقطعة للمؤسسة</span>
                      <span className="text-xs font-black text-amber-600 mt-1 block">{totalCommission.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-blue-600 text-white p-4 rounded-2xl">
                    <span className="font-bold text-[10px]">صافي الربح الفعلي المجمع للمشروعات:</span>
                    <span className="font-black text-sm">{netProfit.toLocaleString('ar-SA')} ر.س</span>
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                          <th className="p-3">المشروع / المسؤول</th>
                          <th className="p-3 text-left">المحصل (إيرادات)</th>
                          <th className="p-3 text-left">المنصرف (تكاليف)</th>
                          <th className="p-3 text-left">العمولة (15%)</th>
                          <th className="p-3 text-left">صافي أرباح المشروع</th>
                          <th className="p-3 text-center">معدل الربحية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredJobs.map((job) => {
                          const txs = job.transactions || [];
                          const jobIncome = txs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                          const jobExpense = txs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                          const comm = job.projectType === 'company' ? (job.contractAmount || 0) * 0.15 : 0;
                          const profit = jobIncome - jobExpense - comm;
                          const profitRate = jobIncome > 0 ? Math.round((profit / jobIncome) * 100) : 0;

                          return (
                            <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="p-3">
                                <p className="font-black text-slate-800">{job.projectTitle}</p>
                                {isManager && <p className="text-[9px] text-amber-700 font-bold mt-0.5">المندوب: {job.salesRepName || getRepName(job.salesRepId)}</p>}
                              </td>
                              <td className="p-3 text-left text-emerald-600 font-bold">{jobIncome.toLocaleString('ar-SA')} ر.س</td>
                              <td className="p-3 text-left text-rose-500 font-bold">{jobExpense.toLocaleString('ar-SA')} ر.س</td>
                              <td className="p-3 text-left text-amber-600 font-bold">{comm.toLocaleString('ar-SA')} ر.س</td>
                              <td className={`p-3 text-left font-black ${profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                {profit.toLocaleString('ar-SA')} ر.س
                              </td>
                              <td className="p-3 text-center font-bold">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                                  profit >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {profitRate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end pt-4 border-t mt-4">
            <Button
              type="button"
              className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 h-10 px-5 text-xs font-bold"
              onClick={() => setActiveDetailModal(null)}
            >
              إغلاق النافذة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
