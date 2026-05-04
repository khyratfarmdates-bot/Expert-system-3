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
  Plus
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
  deleteDoc
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
        <DialogContent className="sm:max-w-[500px] text-right rounded-[2rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary">إضافة مقاول باطن جديد</DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
               تسجيل بيانات مقاول جديد وربطه بمشروع
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubcontractor} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="font-black text-slate-700 mr-1">المقاول / الشركة</Label>
                 <Input 
                   placeholder="اسم المقاول..." 
                   value={subForm.name}
                   onChange={(e) => setSubForm({...subForm, name: e.target.value})}
                   className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label className="font-black text-slate-700 mr-1">نوع الخدمة</Label>
                 <Input 
                   placeholder="مثال: سباكة، كهرباء..." 
                   value={subForm.serviceType}
                   onChange={(e) => setSubForm({...subForm, serviceType: e.target.value})}
                   className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                   required
                 />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-slate-700 mr-1">المشروع المرتبط</Label>
              <Select value={subForm.projectId} onValueChange={(v) => setSubForm({...subForm, projectId: v})}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-bold">
                  <SelectValue placeholder="اختر المشروع" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="font-black text-slate-700 mr-1">إجمالي مبلغ العقد</Label>
                 <Input 
                   type="number"
                   placeholder="0.00" 
                   value={subForm.contractAmount}
                   onChange={(e) => setSubForm({...subForm, contractAmount: e.target.value})}
                   className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                   required
                 />
               </div>
               <div className="space-y-2">
                 <Label className="font-black text-slate-700 mr-1">الدفعة الأولى (إن وجد)</Label>
                 <Input 
                   type="number"
                   placeholder="0.00" 
                   value={subForm.paidAmount}
                   onChange={(e) => setSubForm({...subForm, paidAmount: e.target.value})}
                   className="h-11 rounded-xl bg-slate-50 border-none font-bold"
                 />
               </div>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-slate-700 mr-1">بيانات التواصل</Label>
              <Input 
                placeholder="رقم الهاتف أو العنوان..." 
                value={subForm.contact}
                onChange={(e) => setSubForm({...subForm, contact: e.target.value})}
                className="h-11 rounded-xl bg-slate-50 border-none font-bold"
              />
            </div>

            <DialogFooter className="pt-4">
               <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-12 bg-primary hover:bg-black text-white rounded-2xl font-black gap-2 transition-all"
               >
                 {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                 حفظ بيانات المقاول
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px] text-right rounded-[2rem]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary">تسجيل دفعة لمقاول</DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
               صرف مبالغ مالية مقابل خدمات مقدمة من {selectedSub?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddPayment} className="space-y-6 pt-4">
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
               <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">المبلغ المتبقي للمقاول</p>
                  <p className="text-lg font-black text-amber-600">
                    {(selectedSub ? selectedSub.contractAmount - selectedSub.paidAmount : 0).toLocaleString()} ر.س
                  </p>
               </div>
               <div className="text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي العقد</p>
                  <p className="text-sm font-bold text-primary">
                    {selectedSub?.contractAmount.toLocaleString()} ر.س
                  </p>
               </div>
            </div>

            <div className="space-y-2">
              <Label className="font-black text-slate-700 mr-1">قيمة الدفعة الحالية</Label>
              <div className="relative">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pr-10 h-12 rounded-xl bg-slate-50 border-none font-black text-xl text-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-black text-slate-700 mr-1">طريقة الصرف</Label>
                <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="cash">نقداً (كاش)</SelectItem>
                    <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-slate-700 mr-1">الحساب المصدر</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold">
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
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
                className="w-full h-14 bg-primary hover:bg-black text-white rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]"
               >
                 {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                 اعتماد الصرف الآن
               </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">تأكيد أرشفة المقاول</DialogTitle>
            <DialogDescription className="font-bold text-slate-500 py-2">
              هل أنت متأكد من رغبتك في نقل المقاول "{subToDelete?.name}" إلى سلة المهملات؟ 
              ستتمكن من استعادة بياناته وتاريخ تعاملاته خلال 30 يوماً.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
             <Button 
              variant="destructive" 
              onClick={confirmDeleteSub}
              disabled={isSubmitting}
              className="flex-1 rounded-xl h-11 font-black"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'نعم، أرشفة'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 rounded-xl h-11 font-black text-slate-500"
            >إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubcontractorCard({ sub, projectName, onAddPayment, onDelete }: { key?: React.Key | string | number, sub: Subcontractor, projectName: string, onAddPayment: () => void, onDelete: () => void }) {
  const remaining = sub.contractAmount - sub.paidAmount;
  const progress = (sub.paidAmount / sub.contractAmount) * 100;

  return (
    <Card className="rounded-[2rem] border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
      <CardContent className="p-0">
         <div className="flex flex-col lg:flex-row">
            {/* Main Info */}
            <div className="flex-1 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
               <div className="w-20 h-20 rounded-3xl bg-primary/5 text-primary flex items-center justify-center shrink-0 border border-primary/10 shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-500">
                  <Users className="w-10 h-10" />
               </div>
               
               <div className="flex-1 text-center md:text-right">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                     <h3 className="text-xl font-black text-slate-800">{sub.name}</h3>
                     <Badge className={`w-fit mx-auto md:mx-0 border-none px-3 py-0.5 text-[10px] font-black ${
                       sub.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                     }`}>
                        {sub.status === 'completed' ? 'تمت التسوية' : 'نشط'}
                     </Badge>
                  </div>
                  
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm font-bold text-slate-400">
                     <div className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{sub.serviceType}</span>
                     </div>
                     <div className="flex items-center gap-1.5 font-black text-slate-500">
                        <Briefcase className="w-3.5 h-3.5" />
                        <span>{projectName}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>{sub.contact || 'لا يوجد تواصل'}</span>
                     </div>
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 -mr-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                  </div>
               </div>
            </div>

            {/* Financial Side */}
            <div className="lg:w-96 bg-slate-50/50 p-6 md:p-8 border-r border-dashed border-slate-200">
               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي العقد</p>
                     <p className="text-lg font-black text-primary">{sub.contractAmount.toLocaleString()} <span className="text-[10px] font-normal opacity-50">ر.س</span></p>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">المتبقي</p>
                     <p className={`text-lg font-black ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {remaining.toLocaleString()} <span className="text-[10px] font-normal opacity-50">ر.س</span>
                     </p>
                  </div>
               </div>

               <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase">
                     <span>المدفوع: {sub.paidAmount.toLocaleString()} ر.س</span>
                     <span className="text-emerald-600">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                     />
                  </div>
               </div>

               <Button 
                onClick={onAddPayment}
                disabled={remaining <= 0}
                className="w-full mt-6 rounded-2xl h-12 bg-white hover:bg-primary hover:text-white text-primary border-2 border-primary/10 shadow-sm font-black transition-all group/btn"
               >
                  <DollarSign className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                  تسجيل دفعة جديدة
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
    <Card className={`rounded-3xl border-none shadow-sm bg-white overflow-hidden relative group ${highlight ? 'ring-2 ring-primary/20' : ''}`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110 duration-700 ${color.replace('text', 'bg')}/5`} />
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl ${color.replace('text', 'bg')}/10 ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
            <h3 className={`text-2xl font-black ${color} mt-1`}>
               {value.toLocaleString()} <span className="text-sm font-bold opacity-40">ر.س</span>
            </h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
