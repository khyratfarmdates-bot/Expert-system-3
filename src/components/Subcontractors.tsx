import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  DollarSign, 
  Search, 
  Clock,
  Briefcase,
  Loader2,
  Wallet,
  CheckCircle2,
  Filter,
  Plus,
  ArrowRight,
  Edit2,
  Phone,
  Calendar,
  MessageSquare,
  Check
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { softDelete } from '../lib/softDelete';
import { toast } from 'sonner';
import { Project, Subcontractor, BankAccount } from '../types';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendNotification } from '../lib/notifications';

export default function Subcontractors() {
  const { profile } = useAuth();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  
  // Add Subcontractor Modal States
  const [isAddSubDialogOpen, setIsAddSubDialogOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    name: '',
    serviceType: '',
    contractAmount: '',
    paidAmount: '0',
    contact: '',
    projectId: ''
  });

  // Payment Modal States
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subcontractor | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [subToDelete, setSubToDelete] = useState<Subcontractor | null>(null);

  // Detail Subcontractor States
  const [viewingSubId, setViewingSubId] = useState<string | null>(null);
  const [subTransactions, setSubTransactions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');

  // Edit Subcontractor Modal States
  const [isEditSubDialogOpen, setIsEditSubDialogOpen] = useState(false);
  const [editSubForm, setEditSubForm] = useState({
    name: '',
    serviceType: '',
    contractAmount: '',
    contact: '',
    projectId: ''
  });

  const confirmDeleteSub = async () => {
    if (!profile || !subToDelete) return;
    setIsSubmitting(true);
    try {
      const success = await softDelete(
        'subcontractors', 
        subToDelete.id, 
        subToDelete, 
        profile.uid, 
        `مقاول باطن: ${subToDelete.name}`
      );
      if (success) {
        toast.success("تم نقل بيانات المقاول إلى سلة المهملات");
        setIsDeleteConfirmOpen(false);
        setSubToDelete(null);
      }
    } catch (e) {
      toast.error("فشل في حذف المقاول");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // 1. Fetch Subcontractors
    const unsubSub = onSnapshot(
      query(collection(db, 'subcontractors'), orderBy('name', 'asc')),
      (snapshot) => {
        setSubcontractors(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Subcontractor)));
        setLoading(false);
      }
    );

    // 2. Fetch Projects (for names)
    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    });

    // 3. Fetch Bank Accounts
    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snap) => {
      setBankAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount)));
    });

    return () => {
      unsubSub();
      unsubProjects();
      unsubBanks();
    };
  }, []);

  // Fetch transactions and notes for the selected subcontractor
  useEffect(() => {
    if (!viewingSubId) {
      setSubTransactions([]);
      setNotes([]);
      return;
    }

    // Fetch subcontractor transactions
    const qTx = query(
      collection(db, 'transactions'),
      where('referenceId', '==', viewingSubId)
    );
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort locally by date desc
      txs.sort((a: any, b: any) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const db = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return db.getTime() - da.getTime();
      });
      setSubTransactions(txs);
    });

    // Fetch subcontractor notes
    const qNotes = query(
      collection(db, 'subcontractorNotes'),
      where('subcontractorId', '==', viewingSubId)
    );
    const unsubNotes = onSnapshot(qNotes, (snapshot) => {
      const nts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort locally by date desc
      nts.sort((a: any, b: any) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const db = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return db.getTime() - da.getTime();
      });
      setNotes(nts);
    });

    return () => {
      unsubTx();
      unsubNotes();
    };
  }, [viewingSubId]);

  const filteredSubs = useMemo(() => {
    return subcontractors.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sub.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = filterProject === 'all' || sub.projectId === filterProject;
      return matchesSearch && matchesProject;
    });
  }, [subcontractors, searchTerm, filterProject]);

  const stats = useMemo(() => {
    const totalContract = subcontractors.reduce((sum, s) => sum + (s.contractAmount || 0), 0);
    const totalPaid = subcontractors.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const totalRemaining = totalContract - totalPaid;
    return { totalContract, totalPaid, totalRemaining };
  }, [subcontractors]);

  const currentSub = useMemo(() => {
    if (!viewingSubId) return null;
    return subcontractors.find(s => s.id === viewingSubId) || null;
  }, [subcontractors, viewingSubId]);

  const openEditDialog = (sub: Subcontractor) => {
    setEditSubForm({
      name: sub.name,
      serviceType: sub.serviceType,
      contractAmount: String(sub.contractAmount),
      contact: sub.contact || '',
      projectId: sub.projectId
    });
    setIsEditSubDialogOpen(true);
  };

  const handleUpdateSubcontractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !viewingSubId) return;

    setIsSubmitting(true);
    try {
      const amount = parseFloat(editSubForm.contractAmount);
      if (isNaN(amount) || amount < 0) {
        toast.error('يرجى إدخال مبلغ صحيح');
        return;
      }

      await updateDoc(doc(db, 'subcontractors', viewingSubId), {
        name: editSubForm.name,
        serviceType: editSubForm.serviceType,
        contractAmount: amount,
        contact: editSubForm.contact,
        projectId: editSubForm.projectId
      });

      await sendNotification({
        title: 'تحديث بيانات مقاول',
        message: `تم تحديث بيانات المقاول ${editSubForm.name} بنجاح`,
        type: 'info',
        category: 'financial',
        targetRole: 'manager',
        priority: 'medium'
      });

      toast.success('تم تحديث بيانات المقاول بنجاح');
      setIsEditSubDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('فشل تحديث بيانات المقاول');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !viewingSubId || !noteText.trim()) return;

    try {
      await addDoc(collection(db, 'subcontractorNotes'), {
        subcontractorId: viewingSubId,
        content: noteText.trim(),
        date: serverTimestamp(),
        createdBy: profile.uid,
        createdByEmail: profile.email || '',
        createdByRole: profile.role || '',
        userName: profile.name || profile.email?.split('@')[0] || 'مستخدم'
      });
      setNoteText('');
      toast.success('تمت إضافة الملاحظة بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('فشل حفظ الملاحظة');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedSub) return;
    
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const remaining = selectedSub.contractAmount - selectedSub.paidAmount;
    if (amountNum > remaining) {
      toast.warning(`المبلغ المدخل (${amountNum}) أكبر من المتبقي (${remaining})`);
    }

    setIsSubmitting(true);
    try {
      // 1. Update Subcontractor
      await updateDoc(doc(db, 'subcontractors', selectedSub.id), {
        paidAmount: (selectedSub.paidAmount || 0) + amountNum,
        status: (selectedSub.paidAmount || 0) + amountNum >= selectedSub.contractAmount ? 'completed' : 'active'
      });

      // 2. Add Transaction
      const project = projects.find(p => p.id === selectedSub.projectId);
      await addDoc(collection(db, 'transactions'), {
        type: 'expense',
        category: 'subcontractor',
        amount: amountNum,
        projectId: selectedSub.projectId,
        description: `دفعة للمقاول: ${selectedSub.name} - خدمة: ${selectedSub.serviceType} (${project?.title || ''})`,
        date: serverTimestamp(),
        createdBy: profile.uid,
        status: 'approved',
        referenceId: selectedSub.id,
        paymentMethod,
        bankAccountId
      });

      // 3. Send Notification
      await sendNotification({
        title: 'صرف دفعة مقاول باطن',
        message: `تم صرف مبلغ ${amountNum.toLocaleString()} ر.س للمقاول ${selectedSub.name} لمشروع ${project?.title || ''}`,
        type: 'info',
        category: 'financial',
        targetRole: 'manager',
        priority: 'medium'
      });

      toast.success('تم تسجيل الدفعة بنجاح');
      setIsPaymentDialogOpen(false);
      setPaymentAmount('');
      setBankAccountId('');
    } catch (e) {
      console.error(e);
      toast.error('فشل تسجيل الدفعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubcontractor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !subForm.projectId) {
      toast.error('يرجى اختيار المشروع');
      return;
    }

    setIsSubmitting(true);
    try {
      const amount = parseFloat(subForm.contractAmount);
      const paid = parseFloat(subForm.paidAmount);

      const subRef = await addDoc(collection(db, 'subcontractors'), {
        ...subForm,
        contractAmount: amount,
        paidAmount: paid,
        status: profile.role === 'manager' ? 'active' : 'pending-approval',
        createdBy: profile.uid,
        createdAt: serverTimestamp()
      });

      if (paid > 0) {
        await addDoc(collection(db, 'transactions'), {
          type: 'expense',
          category: 'subcontractor',
          amount: paid,
          projectId: subForm.projectId,
          description: `دفعة أولى للمقاول: ${subForm.name}`,
          date: serverTimestamp(),
          createdBy: profile.uid,
          status: 'approved',
          referenceId: subRef.id
        });
      }

      await sendNotification({
        title: 'مقاول باطن جديد',
        message: `تم تسجيل المقاول ${subForm.name} لمشروع ${projects.find(p => p.id === subForm.projectId)?.title}`,
        type: 'info',
        category: 'financial',
        targetRole: 'manager',
        priority: 'medium'
      });

      toast.success('تم تسجيل المقاول بنجاح');
      setIsAddSubDialogOpen(false);
      setSubForm({ name: '', serviceType: '', contractAmount: '', paidAmount: '0', contact: '', projectId: '' });
    } catch (e) {
      console.error(e);
      toast.error('فشل تسجيل المقاول');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.title || 'مشروع غير معروف';
  };

  if (currentSub) {
    const contractAmount = currentSub.contractAmount || 0;
    const paidAmount = currentSub.paidAmount || 0;
    const remaining = contractAmount - paidAmount;
    const progress = contractAmount === 0 ? 0 : (paidAmount / contractAmount) * 100;
    const projectName = getProjectName(currentSub.projectId);

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20 select-none text-right" dir="rtl">
        {/* Detail view header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
             <Button 
               variant="ghost" 
               onClick={() => setViewingSubId(null)} 
               className="rounded-xl gap-2 font-black text-slate-500 hover:text-slate-800 self-start cursor-pointer p-1 px-3 mb-2"
             >
               <ArrowRight className="w-4 h-4 ml-1" />
               <span>العودة لقائمة المقاولين</span>
             </Button>
             
             <div className="flex items-center gap-3 justify-start">
               <h1 className="text-3xl font-black text-slate-800 tracking-tight">{currentSub.name}</h1>
               <Badge className={`border-none px-2.5 py-0.5 text-xs font-black ${
                 currentSub.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
               }`}>
                  {currentSub.status === 'completed' ? 'تمت التسوية' : 'نشط'}
               </Badge>
             </div>
             <p className="text-muted-foreground text-sm font-bold">بوابة إدارة تفاصيل العقد والمدفوعات والملاحظات</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
             <Button 
              onClick={() => openEditDialog(currentSub)}
              className="rounded-xl gap-1.5 font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-10 shadow-sm text-xs cursor-pointer"
             >
                <Edit2 className="w-4 h-4 text-slate-500" />
                تعديل البيانات
             </Button>
             
             <Button 
              onClick={() => {
                setSelectedSub(currentSub);
                setIsPaymentDialogOpen(true);
              }}
              disabled={remaining <= 0}
              className="rounded-xl gap-1.5 font-black bg-emerald-600 hover:bg-emerald-700 text-white h-10 shadow-lg text-xs cursor-pointer"
             >
                <DollarSign className="w-4 h-4" />
                تسجيل دفعة جديدة
             </Button>

             <Button 
              variant="outline"
              onClick={() => {
                setSubToDelete(currentSub);
                setIsDeleteConfirmOpen(true);
              }}
              className="rounded-xl gap-1.5 font-bold border-red-100 bg-red-50 text-red-600 hover:bg-red-100 h-10 text-xs cursor-pointer"
             >
                <Trash2 className="w-4 h-4" />
                أرشفة المقاول
             </Button>
          </div>
        </div>

        {/* Detailed Financial Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden relative">
            <CardContent className="p-5">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">قيمة العقد الكلية</p>
                  <h3 className="text-lg font-bold text-primary mt-0.5">
                     {contractAmount.toLocaleString()} <span className="text-xs font-normal opacity-40">ر.س</span>
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden relative">
            <CardContent className="p-5">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 tracking-wider">مجموع المبالغ المصروفة</p>
                  <h3 className="text-lg font-bold text-emerald-600 mt-0.5">
                     {paidAmount.toLocaleString()} <span className="text-xs font-normal opacity-40">ر.س</span>
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden relative">
            <CardContent className="p-5">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 tracking-wider">المتبقي للتسوية</p>
                  <h3 className="text-lg font-bold text-amber-600 mt-0.5">
                     {remaining.toLocaleString()} <span className="text-xs font-normal opacity-40">ر.س</span>
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden relative flex flex-col justify-center">
            <CardContent className="p-5 flex flex-col justify-center">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1.5 uppercase font-sans">
                 <span>نسبة السداد المالي</span>
                 <span className="text-emerald-600">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                 />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Body: Specs-Transactions & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Contracts Spec & Transactions Timeline */}
          <div className="lg:col-span-8 space-y-6">
             {/* General Contract Metadata Card */}
             <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden text-right">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-black text-slate-800">بيانات وتفاصيل العقد</h3>
                </div>
                <CardContent className="p-5">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm font-bold">
                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-right">
                        <Wallet className="w-5 h-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold mb-0.5">الخدمة / البند</p>
                          <p className="text-slate-800">{currentSub.serviceType}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-right">
                        <Briefcase className="w-5 h-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold mb-0.5">المشروع المرتبط</p>
                          <p className="text-slate-800 truncate">{projectName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-right">
                        <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold mb-0.5">جهة الاتصال للتواصل</p>
                          <p className="text-slate-850 hover:text-primary transition-all">
                            {currentSub.contact ? (
                              <a href={`tel:${currentSub.contact}`} className="underline decoration-dotted">{currentSub.contact}</a>
                            ) : 'غير مسجلة'}
                          </p>
                        </div>
                      </div>
                   </div>
                </CardContent>
             </Card>

             {/* Past Payments List */}
             <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden text-right">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-800">تاريخ المعاملات والدفعات المقيدة</h3>
                    <p className="text-slate-400 text-[10px] font-semibold mt-0.5">كافة الدفعات والتحويلات المالية المسجلة للمقاول</p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[10px] py-1 px-2.5">
                     {subTransactions.length} معاملات
                  </Badge>
                </div>
                <CardContent className="p-5">
                   {subTransactions.length > 0 ? (
                      <div className="space-y-4">
                        {subTransactions.map((tx) => {
                          const bankName = bankAccounts.find(a => a.id === tx.bankAccountId)?.name || 'الرصيد النقدي / الحساب';
                          const txDate = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date || 0);

                          return (
                            <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/60 hover:bg-slate-50 border border-slate-100 transition-all text-xs font-bold text-right hover:border-slate-200 group" dir="rtl">
                               <div className="flex items-center gap-3.5">
                                 <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 font-black shrink-0">
                                   ر.س
                                 </div>
                                 <div className="text-right">
                                    <h4 className="text-slate-900 text-sm font-black">{tx.amount?.toLocaleString()} ر.س</h4>
                                    <p className="text-slate-400 mt-0.5 text-[10px] font-semibold">
                                       طريقة الدفع: {tx.paymentMethod === 'transfer' ? `تحويل بنكي (${bankName})` : 'صرف نقدي / كاش'}
                                    </p>
                                 </div>
                               </div>

                               <div className="text-left space-y-1">
                                  <div className="flex items-center gap-1.5 justify-end text-slate-400 font-semibold text-[10px]">
                                     <Calendar className="w-3.5 h-3.5 ml-1" />
                                     <span>{txDate ? txDate.toLocaleString('ar-SA', { dateStyle: 'medium' }) : ''}</span>
                                  </div>
                                  <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                     معتمدة
                                  </span>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                   ) : (
                      <div className="py-12 text-center text-slate-300 flex flex-col items-center justify-center gap-3">
                         <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                           <DollarSign className="w-6 h-6 text-slate-350 opacity-40" />
                         </div>
                         <div>
                            <p className="text-xs font-bold text-slate-500">لا يوجد دفعات مسجلة بعد</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-semibold">يمكنك البدء بالنقر على "تسجيل دفعة جديدة" في الأعلى</p>
                         </div>
                      </div>
                   )}
                </CardContent>
             </Card>
          </div>

          {/* Interactive Notes Board */}
          <div className="lg:col-span-4 space-y-6 text-right" dir="rtl">
             <Card className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden text-right flex flex-col">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-sm font-black text-slate-800">ملاحظات ومتابعة الإنجاز</h3>
                  <p className="text-slate-400 text-[10px] font-semibold mt-0.5">تقييد الملاحظات، جودة العمل، وتحديثات الموقع</p>
                </div>
                <CardContent className="p-5 space-y-4">
                   {/* Create Note Input Form */}
                   <form onSubmit={handleAddNote} className="space-y-2">
                     <Label className="font-bold text-slate-700 text-xs">إضافة ملاحظة جديدة</Label>
                     <div className="relative">
                       <Input 
                         placeholder="اكتب ملاحظة تخص نطاق العقد أو الإنجاز..." 
                         value={noteText}
                         onChange={(e) => setNoteText(e.target.value)}
                         className="h-11 pl-12 pr-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                         required
                       />
                       <Button 
                         type="submit" 
                         size="icon"
                         className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                       >
                         <Check className="w-4 h-4" />
                       </Button>
                     </div>
                   </form>

                   {/* Notes Timeline Stream */}
                   <div className="space-y-3.5 max-h-[350px] overflow-y-auto pt-2 scrollbar-thin">
                      {notes.length > 0 ? (
                         notes.map((n) => {
                            const noteDate = n.date?.toDate ? n.date.toDate() : new Date(n.date || 0);

                            return (
                               <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-right space-y-2 relative animate-in fade-in slide-in-from-bottom-2 duration-300">
                                  <p className="text-[11px] font-semibold text-slate-700 leading-relaxed break-words pr-4 border-r-2 border-primary/30 text-right">
                                     {n.content}
                                  </p>
                                  <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 mt-1">
                                     <span className="bg-slate-150 py-0.5 px-2 rounded-full text-slate-500 font-extrabold shadow-3xs">{n.userName}</span>
                                     <span className="flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5 ml-1" />
                                        {noteDate ? noteDate.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                     </span>
                                  </div>
                               </div>
                            );
                         })
                      ) : (
                         <div className="py-12 border border-dashed text-center rounded-xl text-slate-400 bg-slate-50/50">
                            <MessageSquare className="w-7 h-7 mx-auto text-slate-350 opacity-30 mb-2" />
                            <p className="text-[10px] font-bold text-slate-500 font-sans">لا توجد مذكرات مقيدة</p>
                            <p className="text-[9px] text-slate-400 font-semibold mt-0.5 font-sans">دون الملاحظات لمتابعة سلامة الإنجاز وجودته</p>
                         </div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>

        {/* Edit Subcontractor Dialog inside Detail Page */}
        <Dialog open={isEditSubDialogOpen} onOpenChange={setIsEditSubDialogOpen}>
          <DialogContent className="sm:max-w-[480px] text-right rounded-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 font-sans">تعديل بيانات المقاول</DialogTitle>
              <DialogDescription className="font-semibold text-slate-500 mt-1 font-sans">
                 تغيير وتحديث مواصفات العقد والتفاصيل الخاصة بالمقاول
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateSubcontractor} className="space-y-4 pt-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 mr-1 text-xs">اسم المقاول / الشركة</Label>
                    <Input 
                      placeholder="تعديل الاسم..." 
                      value={editSubForm.name}
                      onChange={(e) => setEditSubForm({...editSubForm, name: e.target.value})}
                      className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 mr-1 text-xs">نوع الخدمة</Label>
                    <Input 
                      placeholder="البند الفني..." 
                      value={editSubForm.serviceType}
                      onChange={(e) => setEditSubForm({...editSubForm, serviceType: e.target.value})}
                      className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                      required
                    />
                  </div>
               </div>

               <div className="space-y-2 text-right">
                 <Label className="font-bold text-slate-755 mr-1 text-xs">المشروع المرتبط</Label>
                 <Select value={editSubForm.projectId} onValueChange={(v) => setEditSubForm({...editSubForm, projectId: v})}>
                   <SelectTrigger className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold w-full">
                     <SelectValue placeholder="اختر المشروع" />
                   </SelectTrigger>
                   <SelectContent className="rounded-lg">
                     {projects.map(p => (
                       <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 mr-1 text-xs">إجمالي قيمة العقد (ر.س)</Label>
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      value={editSubForm.contractAmount}
                      onChange={(e) => setEditSubForm({...editSubForm, contractAmount: e.target.value})}
                      className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className="font-bold text-slate-700 mr-1 text-xs">بيانات التواصل</Label>
                    <Input 
                      placeholder="الهاتف..." 
                      value={editSubForm.contact}
                      onChange={(e) => setEditSubForm({...editSubForm, contact: e.target.value})}
                      className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                    />
                  </div>
               </div>

               <DialogFooter className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold gap-2 transition-all cursor-pointer text-xs"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <CheckCircle2 className="w-4 h-4" />}
                    حفظ التعديلات الطارئة
                  </Button>
               </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Existing Payment Dialog & Delete Confirm Dialog inside Detail too */}
        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-[450px] text-right rounded-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">تسجيل دفعة لمقاول</DialogTitle>
              <DialogDescription className="font-semibold text-slate-500 mt-1">
                 صرف مبالغ مالية مقابل خدمات مقدمة من {selectedSub?.name || currentSub.name}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddPayment} className="space-y-4 pt-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">المبلغ المتبقي للمقاول</p>
                    <p className="text-base font-bold text-amber-600">
                      {((selectedSub || currentSub) ? (selectedSub?.contractAmount || currentSub.contractAmount || 0) - (selectedSub?.paidAmount || currentSub.paidAmount || 0) : 0).toLocaleString()} ر.س
                    </p>
                 </div>
                 <div className="text-left text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي العقد</p>
                    <p className="text-xs font-bold text-slate-700">
                      {(selectedSub?.contractAmount || currentSub.contractAmount || 0).toLocaleString()} ر.س
                    </p>
                 </div>
              </div>

              <div className="space-y-2 text-right">
                <Label className="font-bold text-slate-700 mr-1 text-xs">قيمة الدفعة الحالية</Label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pr-10 h-10 rounded-lg bg-slate-50 border border-slate-200 font-bold text-base text-emerald-600 text-left font-sans"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-right">
                  <Label className="font-bold text-slate-700 mr-1 text-xs flex justify-end">طريقة الصرف</Label>
                  <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                    <SelectTrigger className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold w-full select-none" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="cash">نقداً (كاش)</SelectItem>
                      <SelectItem value="transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-right">
                  <Label className="font-bold text-slate-700 mr-1 text-xs flex justify-end">الحساب المصدر</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold w-full" dir="rtl">
                      <SelectValue placeholder="اختر الحساب" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="pt-4">
                 <Button 
                  type="submit" 
                  disabled={isSubmitting || !bankAccountId}
                  className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs gap-2 transition-all cursor-pointer"
                 >
                   {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                   اعتماد الصرف الآن
                 </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="sm:max-w-[400px] text-right rounded-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-red-600">تأكيد أرشفة المقاول</DialogTitle>
              <DialogDescription className="font-semibold text-slate-500 py-1.5 text-xs mt-1">
                هل أنت متأكد من رغبتك في نقل المقاول "{(subToDelete || currentSub)?.name}" إلى سلة المهملات؟ 
                ستتمكن من استعادة بياناته وتاريخ تعاملاته خلال 30 يوماً.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-4 mt-4 text-xs font-sans">
               <Button 
                variant="destructive" 
                onClick={async () => {
                   await confirmDeleteSub();
                   setViewingSubId(null);
                }}
                disabled={isSubmitting}
                className="flex-1 rounded-lg h-9 font-bold text-xs cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-white" /> : 'نعم، أرشفة'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 rounded-lg h-9 font-bold text-slate-500 text-xs cursor-pointer"
              >إلغاء</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tight">مقاولي الباطن</h1>
          <p className="text-muted-foreground text-sm font-bold">تتبع العقود، المدفوعات، والالتزامات مع المقاولين</p>
        </div>
        <div className="flex items-center gap-2">
           <Button 
            onClick={() => setIsAddSubDialogOpen(true)} 
            className="rounded-xl gap-2 font-black bg-primary hover:bg-black shadow-lg"
           >
              <Plus className="w-5 h-5" />
              إضافة مقاول جديد
           </Button>
           <Badge className="bg-blue-100 text-blue-700 border-none px-4 py-1.5 rounded-full font-black">
             {subcontractors.length} مقاول مسجل
           </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard 
          title="إجمالي العقود" 
          value={stats.totalContract} 
          icon={Briefcase} 
          color="text-primary" 
        />
        <SummaryCard 
          title="إجمالي المدفوع" 
          value={stats.totalPaid} 
          icon={CheckCircle2} 
          color="text-emerald-600" 
        />
        <SummaryCard 
          title="إجمالي المتبقي" 
          value={stats.totalRemaining} 
          icon={Clock} 
          color="text-amber-600" 
          highlight={stats.totalRemaining > 0}
        />
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="البحث عن مقاول أو خدمة..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 h-11 bg-white rounded-xl border-slate-200 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-full md:w-[200px] h-11 bg-white rounded-xl border-slate-200 font-bold">
                <SelectValue placeholder="تصفية حسب المشروع" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">كل المشاريع</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subcontractors List */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
            <p className="text-slate-400 font-bold">جاري تحميل سجلات المقاولين...</p>
          </div>
        ) : filteredSubs.length > 0 ? (
          filteredSubs.map((sub) => (
            <SubcontractorCard 
              key={sub.id} 
              sub={sub} 
              projectName={getProjectName(sub.projectId)}
              onAddPayment={() => {
                setSelectedSub(sub);
                setIsPaymentDialogOpen(true);
              }}
              onDelete={() => {
                setSubToDelete(sub);
                setIsDeleteConfirmOpen(true);
              }}
              onViewDetails={() => setViewingSubId(sub.id)}
            />
          ))
        ) : (
          <div className="p-20 text-center bg-white rounded-3xl border border-dashed flex flex-col items-center gap-4">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-slate-200" />
             </div>
             <div className="max-w-xs">
                <p className="font-black text-slate-500 text-lg">لم يتم العثور على مقاولين</p>
                <p className="text-slate-400 text-sm font-bold mt-1">جرب تغيير معايير البحث أو تصفية المشاريع</p>
             </div>
          </div>
        )}
      </div>

      {/* Add Subcontractor Dialog */}
      <Dialog open={isAddSubDialogOpen} onOpenChange={setIsAddSubDialogOpen}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">إضافة مقاول باطن جديد</DialogTitle>
            <DialogDescription className="font-semibold text-slate-500 mt-1">
               تسجيل بيانات مقاول جديد وربطه بمشروع
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubcontractor} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="font-bold text-slate-700 mr-1 text-xs">المقاول / الشركة</Label>
                 <Input 
                   placeholder="اسم المقاول..." 
                   value={subForm.name}
                   onChange={(e) => setSubForm({...subForm, name: e.target.value})}
                   className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label className="font-bold text-slate-700 mr-1 text-xs">نوع الخدمة</Label>
                 <Input 
                   placeholder="مثال: سباكة، كهرباء..." 
                   value={subForm.serviceType}
                   onChange={(e) => setSubForm({...subForm, serviceType: e.target.value})}
                   className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                   required
                 />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700 mr-1 text-xs">المشروع المرتبط</Label>
              <Select value={subForm.projectId} onValueChange={(v) => setSubForm({...subForm, projectId: v})}>
                <SelectTrigger className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold">
                  <SelectValue placeholder="اختر المشروع" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="font-bold text-slate-700 mr-1 text-xs">إجمالي مبلغ العقد</Label>
                 <Input 
                   type="number"
                   placeholder="0.00" 
                   value={subForm.contractAmount}
                   onChange={(e) => setSubForm({...subForm, contractAmount: e.target.value})}
                   className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label className="font-bold text-slate-700 mr-1 text-xs">الدفعة الأولى (إن وجد)</Label>
                 <Input 
                   type="number"
                   placeholder="0.00" 
                   value={subForm.paidAmount}
                   onChange={(e) => setSubForm({...subForm, paidAmount: e.target.value})}
                   className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
                 />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700 mr-1 text-xs">بيانات التواصل</Label>
              <Input 
                placeholder="رقم الهاتف أو العنوان..." 
                value={subForm.contact}
                onChange={(e) => setSubForm({...subForm, contact: e.target.value})}
                className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold"
              />
            </div>

            <DialogFooter className="pt-4">
               <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold gap-2 transition-all cursor-pointer text-xs"
               >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                 حفظ بيانات المقاول
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] text-right rounded-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">تسجيل دفعة لمقاول</DialogTitle>
            <DialogDescription className="font-semibold text-slate-500 mt-1">
               صرف مبالغ مالية مقابل خدمات مقدمة من {selectedSub?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPayment} className="space-y-4 pt-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
               <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">المبلغ المتبقي للمقاول</p>
                  <p className="text-base font-bold text-amber-600">
                    {(selectedSub ? (selectedSub.contractAmount || 0) - (selectedSub.paidAmount || 0) : 0).toLocaleString()} ر.س
                  </p>
               </div>
               <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي العقد</p>
                  <p className="text-xs font-bold text-slate-700">
                    {(selectedSub?.contractAmount || 0).toLocaleString()} ر.س
                  </p>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700 mr-1 text-xs">قيمة الدفعة الحالية</Label>
              <div className="relative">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pr-10 h-10 rounded-lg bg-slate-50 border border-slate-200 font-bold text-base text-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 mr-1 text-xs">طريقة الصرف</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700 mr-1 text-xs">الحساب المصدر</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger className="h-10 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold">
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {bankAccounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4">
               <Button 
                type="submit" 
                disabled={isSubmitting || !bankAccountId}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs gap-2 transition-all cursor-pointer"
               >
                 {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                 اعتماد الصرف الآن
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600">تأكيد أرشفة المقاول</DialogTitle>
            <DialogDescription className="font-semibold text-slate-500 py-1.5 text-xs mt-1">
              هل أنت متأكد من رغبتك في نقل المقاول "{subToDelete?.name}" إلى سلة المهملات؟ 
              ستتمكن من استعادة بياناته وتاريخ تعاملاته خلال 30 يوماً.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4 text-xs">
             <Button 
              variant="destructive" 
              onClick={confirmDeleteSub}
              disabled={isSubmitting}
              className="flex-1 rounded-lg h-9 font-bold text-xs cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mx-auto text-white" /> : 'نعم، أرشفة'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 rounded-lg h-9 font-bold text-slate-500 text-xs cursor-pointer"
            >إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubcontractorCard({ sub, projectName, onAddPayment, onDelete, onViewDetails }: { key?: React.Key | string | number, sub: Subcontractor, projectName: string, onAddPayment: () => void, onDelete: () => void, onViewDetails: () => void }) {
  const contractAmount = sub.contractAmount || 0;
  const paidAmount = sub.paidAmount || 0;
  const remaining = contractAmount - paidAmount;
  const progress = contractAmount === 0 ? 0 : (paidAmount / contractAmount) * 100;

  return (
    <Card 
      onClick={onViewDetails}
      className="rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white cursor-pointer hover:border-primary/40 text-right"
    >
      <CardContent className="p-0">
         <div className="flex flex-col lg:flex-row">
            {/* Main Info */}
            <div className="flex-1 p-5 md:p-6 flex flex-col md:flex-row items-center gap-5">
               <div className="w-14 h-14 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 shadow-3xs group-hover:bg-slate-900 group-hover:text-white transition-all duration-350">
                  <Users className="w-6 h-6 animate-none" />
               </div>
               
               <div className="flex-1 text-center md:text-right">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1.5 justify-center md:justify-start">
                     <h3 className="text-base font-bold text-slate-800">{sub.name}</h3>
                     <Badge className={`w-fit mx-auto md:mx-0 border-none px-2 py-0.5 text-[9px] font-bold ${
                       sub.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                     }`}>
                        {sub.status === 'completed' ? 'تمت التسوية' : 'نشط'}
                     </Badge>
                  </div>
                  
                  <div className="flex flex-wrap justify-center md:justify-start gap-3 text-xs font-semibold text-slate-400">
                     <div className="flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sub.serviceType}</span>
                     </div>
                     <div className="flex items-center gap-1 font-bold text-slate-500">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>{projectName}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sub.contact || 'لا يوجد تواصل'}</span>
                     </div>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                           e.stopPropagation();
                           onDelete();
                        }}
                        className="w-7 h-7 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 -mr-1 cursor-pointer"
                       >
                        <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                  </div>
               </div>
            </div>

            {/* Financial Side */}
            <div className="lg:w-80 bg-slate-50/50 p-5 md:p-6 border-r border-dashed border-slate-200 flex flex-col justify-between">
               <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">إجمالي العقد</p>
                     <p className="text-base font-bold text-slate-850">{contractAmount.toLocaleString()} <span className="text-[9px] font-normal opacity-50">ر.س</span></p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">المتبقي</p>
                     <p className={`text-base font-bold ${remaining > 0 ? 'text-amber-600' : 'text-emerald-500'}`}>
                        {remaining.toLocaleString()} <span className="text-[9px] font-normal opacity-50">ر.س</span>
                     </p>
                  </div>
               </div>

               <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase">
                     <span className="text-slate-400">المدفوع: {paidAmount.toLocaleString()} ر.س</span>
                     <span className="text-emerald-600">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-250 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-slate-900'}`}
                     />
                  </div>
               </div>

               <Button 
                onClick={(e) => {
                   e.stopPropagation();
                   onAddPayment();
                }}
                disabled={remaining <= 0}
                className="w-full mt-4 rounded-lg h-9 bg-white hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-200 shadow-sm font-bold transition-all text-xs cursor-pointer flex items-center justify-center gap-1"
               >
                  <DollarSign className="w-3.5 h-3.5" />
                  تسجيل دفع دفعة
               </Button>
            </div>
         </div>
      </CardContent>
    </Card>
  );
}

interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  highlight?: boolean;
}

function SummaryCard({ title, value, icon: Icon, color, highlight }: SummaryCardProps) {
  return (
    <Card className={`rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden relative group ${highlight ? 'ring-2 ring-primary/20' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-lg ${color.replace('text', 'bg')}/10 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <h3 className={`text-lg font-bold ${color} mt-0.5`}>
               {value.toLocaleString()} <span className="text-xs font-normal opacity-40">ر.س</span>
            </h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
