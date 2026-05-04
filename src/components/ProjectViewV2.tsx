import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Plus, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Zap, 
  LayoutDashboard, 
  Camera, 
  MessageCircle, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  FileText,
  User,
  Info,
  Settings2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { 
  doc, 
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  updateDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { toast } from 'sonner';
import { Project, Worker, ProjectUpdate, Transaction, ProjectMilestone } from '../types';
import { calculateProjectProgress } from '../lib/projectUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import {
  Dialog,
  DialogContent,
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
  SelectValue 
} from "@/components/ui/select";

interface ProjectViewV2Props {
  projectId: string;
  onBack: () => void;
}

export default function ProjectViewV2({ projectId, onBack }: ProjectViewV2Props) {
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  const loadData = () => {
    setIsLoading(true);
    setError(null);

    const unsubProject = onSnapshot(doc(db, 'projects', projectId), 
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Project;
          setProject(data);
          setEditForm(data);
        } else {
          toast.error("المشروع غير موجود");
          onBack();
        }
        setIsLoading(false);
      },
      (err) => {
        setError("فشل الاتصال: تعذر جلب بيانات المشروع");
        handleFirestoreError(err, OperationType.GET, `projects/${projectId}`, auth);
      }
    );

    const unsubWorkers = onSnapshot(collection(db, 'employees'), 
      (snapshot) => {
        setWorkers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worker)));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'employees', auth)
    );

    const unsubUpdates = onSnapshot(
      query(collection(db, 'projectUpdates'), where('projectId', '==', projectId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setUpdates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectUpdate)));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'projectUpdates', auth)
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), where('projectId', '==', projectId), orderBy('date', 'desc')),
      (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'project-transactions', auth)
    );

    return () => {
      unsubProject();
      unsubWorkers();
      unsubUpdates();
      unsubTransactions();
    };
  };

  useEffect(() => {
    const unsub = loadData();
    return () => unsub();
  }, [projectId]);

  const projectWorkers = useMemo(() => {
    if (!project?.workerIds) return [];
    return workers.filter(w => project.workerIds?.includes(w.id));
  }, [project, workers]);

  const siteSupervisor = useMemo(() => {
    const supervisor = projectWorkers.find(w => w.role?.toLowerCase().includes('supervisor') || w.role?.toLowerCase().includes('manager'));
    return supervisor ? supervisor.name : 'قيد التعيين';
  }, [projectWorkers]);

  const handleUpdateProject = async () => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        ...editForm,
        updatedAt: new Date().toISOString()
      });
      toast.success("تم تحديث بيانات المشروع");
      setIsEditOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`, auth);
    }
  };

  const financialStats = useMemo(() => {
    if (!project) return { paid: 0, balance: 0 };
    const paid = (project.depositAmount || 0) + (project.payments?.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0) || 0);
    const balance = (project.budget || 0) - paid;
    return { paid, balance };
  }, [project]);

  const achievementStats = useMemo(() => {
    if (!project) return 0;
    return calculateProjectProgress(project as Project);
  }, [project]);

  const [newStage, setNewStage] = useState({ title: '', weight: 10 });
  const [isAddingStage, setIsAddingStage] = useState(false);

  const handleAddStage = async () => {
    if (!newStage.title || newStage.weight <= 0) {
      toast.error("يرجى إدخال اسم المرحلة ووزنها");
      return;
    }

    try {
      const milestone: ProjectMilestone = {
        title: newStage.title,
        weight: newStage.weight,
        status: 'pending',
        date: new Date().toISOString()
      };

      await updateDoc(doc(db, 'projects', projectId), {
        milestones: arrayUnion(milestone)
      });
      
      toast.success("تم إضافة المرحلة بنجاح");
      setNewStage({ title: '', weight: 10 });
      setIsAddingStage(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`, auth);
    }
  };

  const handleDeleteStage = async (milestone: ProjectMilestone) => {
     try {
        await updateDoc(doc(db, 'projects', projectId), {
           milestones: arrayRemove(milestone)
        });
        toast.success("تم حذف المرحلة");
     } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`, auth);
     }
  };

  const handleToggleMilestone = async (stageTitle: string) => {
    if (!project) return;
    
    try {
      const newMilestones = (project.milestones || []).map(m => {
        if (m.title === stageTitle) {
          return {
            ...m,
            status: (m.status === 'completed' ? 'pending' : 'completed') as ProjectMilestone['status'],
            date: new Date().toISOString()
          };
        }
        return m;
      });

      const allCompleted = newMilestones.length > 0 && newMilestones.every(m => m.status === 'completed');
      const nextStatus = allCompleted ? 'completed' : 'active';

      await updateDoc(doc(db, 'projects', projectId), {
        milestones: newMilestones,
        status: nextStatus
      });
      toast.success("تم تحديث حالة المرحلة");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}`, auth);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" dir="rtl">
        <div className="h-14 w-14 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        <p className="font-black text-slate-500 animate-pulse">جاري تحميل منصة المشروع...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-6" dir="rtl">
        <div className="h-20 w-20 bg-rose-50 text-rose-500 rounded-[2.5rem] flex items-center justify-center">
           <Zap className="w-10 h-10" />
        </div>
        <div className="space-y-2">
           <h2 className="text-2xl font-black text-slate-900">انقطع الاتصال بالقاعدة</h2>
           <p className="text-slate-500 font-bold text-sm max-w-xs mx-auto">{error}</p>
        </div>
        <Button onClick={() => loadData()} className="h-14 w-full max-w-xs rounded-2xl bg-slate-900 font-black">
           إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!project) return null;

  const tabs = [
    { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard /> },
    { id: 'milestones', label: 'مراحل المشروع', icon: <Layers /> },
    { id: 'team', label: 'الفريق الفني', icon: <Users /> },
    { id: 'financials', label: 'الحسابات', icon: <DollarSign /> },
    { id: 'monitoring', label: 'التوثيق', icon: <Camera /> },
    { id: 'chat', label: 'تواصل', icon: <MessageCircle /> },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 flex flex-col gap-6" dir="rtl">
      
      {/* 🚀 Header: Compacted for better visibility */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between w-full">
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="rounded-xl bg-white shadow-sm border border-slate-100 h-8 w-8"
           >
              <ArrowLeft className="w-4 h-4 text-slate-900" />
           </Button>
           <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] px-3 py-1 rounded-lg uppercase tracking-widest">
              ID: {project.id.slice(-6)}
           </Badge>
        </div>
        
        <div className="space-y-2">
           <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{project.status === 'active' ? 'قيد التنفيذ والمتابعة' : 'مشروع منتهي'}</span>
           </div>
           <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                 {project.title}
              </h1>
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                 <DialogTrigger render={
                    <button className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-background h-8 px-3 font-black text-[9px] gap-2 hover:bg-muted transition-all outline-none cursor-pointer">
                       <Settings2 className="w-2.5 h-2.5" />
                       إدارة
                    </button>
                 } />
                 <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none" dir="rtl">
                    <DialogHeader>
                       <DialogTitle className="text-right font-black">تعديل بيانات المشروع</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 mt-4">
                       <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400">عنوان المشروع</Label>
                          <Input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="rounded-xl border-slate-100 font-bold" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <Label className="text-xs font-black text-slate-400">الحالة</Label>
                             <Select value={editForm.status} onValueChange={v => setEditForm({...editForm, status: v as any})}>
                                <SelectTrigger className="rounded-xl">
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="active">نشط</SelectItem>
                                   <SelectItem value="completed">مكتمل</SelectItem>
                                   <SelectItem value="on-hold">متوقف مؤقتاً</SelectItem>
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-2">
                             <Label className="text-xs font-black text-slate-400">الميزانية</Label>
                             <Input type="number" value={editForm.budget} onChange={e => setEditForm({...editForm, budget: Number(e.target.value)})} className="rounded-xl border-slate-100 font-bold" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400">رابط الموقع</Label>
                           <Input value={editForm.locationLink} onChange={e => setEditForm({...editForm, locationLink: e.target.value})} className="rounded-xl border-slate-100 font-bold" />
                        </div>
                        <Button onClick={handleUpdateProject} className="w-full h-12 rounded-2xl bg-slate-900 font-black mt-4">حفظ التغييرات</Button>
                     </div>
                  </DialogContent>
               </Dialog>
            </div>
            <p className="text-slate-500 font-bold text-[11px] leading-relaxed max-w-xl">
              {project.description || 'لا يوجد وصف مفصل لهذا المشروع حالياً في النظام.'}
           </p>
        </div>
      </section>

      {/* 📞 Urgent Actions: Compacted */}
      <section className="grid grid-cols-2 gap-2">
            <Button 
               size="sm"
               onClick={() => window.open(`tel:${project.clientPhone || '0500000000'}`, '_self')}
               className="h-10 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-[10px] gap-2 shadow-sm transition-all active:scale-95"
            >
               <Phone className="w-3.5 h-3.5 text-emerald-400" />
               اتصال سريع
            </Button>
            <Button 
               size="sm"
               variant="outline"
               onClick={() => window.open(project.locationLink, '_blank')}
               className="h-10 rounded-xl border border-slate-100 bg-white text-slate-900 font-black text-[10px] gap-2 hover:bg-slate-50 transition-all active:scale-95"
            >
               <MapPin className="w-3.5 h-3.5 text-primary" />
               تحديد الموقع
            </Button>
      </section>

      {/* 📑 Dynamic Tab Switcher: Full Width Vertical Column */}
      <section className="flex flex-col gap-8">
         <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 shadow-sm rounded-3xl overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-xs whitespace-nowrap transition-all duration-300 ${
                     activeTab === tab.id 
                     ? 'bg-slate-900 text-white shadow-xl scale-105' 
                     : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
               >
                  {React.cloneElement(tab.icon as React.ReactElement, { className: "w-4 h-4" })}
                  {tab.label}
               </button>
            ))}
         </div>

         {/* 📦 Tab Content Viewer */}
         <div className="flex flex-col gap-8 min-h-[400px]">
            <AnimatePresence mode="wait">
               {activeTab === 'overview' && (
                  <motion.div 
                     key="overview"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-8"
                  >
                     <div className="grid grid-cols-3 gap-3">
                        <div 
                           role="button"
                           tabIndex={0}
                           onClick={() => setActiveTab('financials')}
                           onKeyDown={(e) => e.key === 'Enter' && setActiveTab('financials')}
                           className="w-full text-right transition-transform active:scale-95 cursor-pointer outline-none"
                        >
                           <StatusCard label="الميزانية" value={project.budget?.toLocaleString()} unit="ر.س" icon={<DollarSign />} color="primary" />
                        </div>
                        <StatusCard label="الإنجاز" value={achievementStats} unit="%" icon={<TrendingUp />} color="emerald" progress={achievementStats} />
                        <div 
                           role="button"
                           tabIndex={0}
                           onClick={() => setActiveTab('milestones')}
                           onKeyDown={(e) => e.key === 'Enter' && setActiveTab('milestones')}
                           className="w-full text-right transition-transform active:scale-95 cursor-pointer outline-none"
                        >
                           <StatusCard label="المراحل" value={project.milestones?.filter(m => m.status === 'completed').length || 0} unit={`/ ${project.milestones?.length || 0}`} icon={<Layers />} color="primary" />
                        </div>
                     </div>

                     <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                              <Info className="w-5 h-5 text-primary" />
                              المعلومات الأساسية
                           </h3>
                           <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => window.print()}
                              className="rounded-xl border-slate-200 font-black text-[10px] gap-2"
                           >
                              <FileText className="w-3 h-3" />
                              تحميل تقرير PDF
                           </Button>
                        </div>
                        <div className="bg-white border border-slate-100 shadow-sm rounded-[2.5rem] p-8 space-y-4">
                           <DetailLine label="العميل" value={project.clientName} icon={<User />} />
                           <DetailLine label="تاريخ البدء" value={project.createdAt ? new Date(project.createdAt).toLocaleDateString('ar-SA') : '---'} icon={<CalendarDays />} />
                           <DetailLine label="مشرف الموقع" value={siteSupervisor} icon={<ShieldCheck />} />
                        </div>
                     </div>

                     <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                           <Clock className="w-5 h-5 text-primary" />
                           مراحل العمل الرئيسية
                        </h3>
                        <div className="flex flex-col gap-4">
                           {project.milestones?.map((m, i) => (
                              <MilestoneBox key={i} title={m.title} date={m.date} status={m.status} index={i} />
                           ))}
                        </div>
                     </div>
                  </motion.div>
               )}

               {activeTab === 'milestones' && (
                  <motion.div 
                     key="milestones"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-8"
                  >
                     <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/20 blur-3xl rounded-full" />
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                           <div className="space-y-4">
                              <h3 className="text-2xl font-black">هيكلة مراحل التنفيذ</h3>
                              <p className="text-slate-400 font-bold max-w-md">قم بتعريف المراحل المخصصة لهذا المشروع وتحديد أوزانها لضبط دقة الإنجاز.</p>
                              <div className="pt-4 flex items-center gap-6">
                                 <div>
                                    <p className="text-xs font-black text-slate-500 uppercase mb-1">نسبة الإنجاز</p>
                                    <p className="text-4xl font-black text-emerald-400">{achievementStats}%</p>
                                 </div>
                                 <div className="h-10 w-[1px] bg-slate-800" />
                                 <div>
                                    <p className="text-xs font-black text-slate-500 uppercase mb-1">المراحل المعتمدة</p>
                                    <p className="text-4xl font-black text-white">{project.milestones?.length || 0}</p>
                                 </div>
                              </div>
                           </div>
                           
                           <Dialog open={isAddingStage} onOpenChange={setIsAddingStage}>
                              <DialogTrigger render={
                                 <button className="group/button inline-flex shrink-0 items-center justify-center h-14 px-8 rounded-2xl bg-white text-slate-900 font-black hover:bg-slate-100 gap-3 shadow-xl transition-all outline-none cursor-pointer">
                                    <Plus className="w-5 h-5" />
                                    إضافة مرحلة عمل
                                 </button>
                              } />
                              <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none" dir="rtl">
                                 <DialogHeader>
                                    <DialogTitle className="text-right font-black">إضافة مرحلة جديدة للمشروع</DialogTitle>
                                 </DialogHeader>
                                 <div className="space-y-5 mt-4">
                                    <div className="space-y-2">
                                       <Label className="text-xs font-black text-slate-400">اسم المرحلة</Label>
                                       <Input 
                                          value={newStage.title} 
                                          onChange={e => setNewStage({...newStage, title: e.target.value})} 
                                          placeholder="مثال: أعمال الحفر والقواعد"
                                          className="rounded-xl h-12 bg-slate-50 border-none font-bold" 
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <Label className="text-xs font-black text-slate-400">وصف المرحلة</Label>
                                       <textarea 
                                          value={(newStage as any).description || ''} 
                                          onChange={e => setNewStage({...newStage, description: e.target.value} as any)} 
                                          placeholder="تفاصيل فنية عن هذه المرحلة..."
                                          className="w-full rounded-xl bg-slate-50 border-none font-bold p-4 text-sm focus:ring-0 min-h-[100px]"
                                       />
                                    </div>
                                    <div className="space-y-2">
                                       <Label className="text-xs font-black text-slate-400">الوزن النسبي (%)</Label>
                                       <Input 
                                          type="number" 
                                          value={newStage.weight} 
                                          onChange={e => setNewStage({...newStage, weight: Number(e.target.value)})} 
                                          className="rounded-xl h-12 bg-slate-50 border-none font-bold" 
                                       />
                                    </div>
                                    <Button onClick={handleAddStage} className="w-full h-12 rounded-2xl bg-slate-900 font-black mt-4 shadow-lg shadow-slate-100">إضافة المرحلة</Button>
                                 </div>
                              </DialogContent>
                           </Dialog>
                        </div>
                     </div>

                     <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between mb-2">
                           <h3 className="text-xl font-black text-slate-900 border-r-4 border-primary pr-3">المراحل التشغيلية الحالية</h3>
                           <Badge className="bg-slate-100 text-slate-500 border-none font-bold">إجمالي الأوزان: {project.milestones?.reduce((a,c) => a + (c.weight || 0), 0)}%</Badge>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                           {(!project?.milestones || project.milestones.length === 0) && (
                              <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50">
                                 <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                                 <p className="font-black text-slate-400">لم يتم تعريف أي مراحل لهذا المشروع بعد</p>
                                 <p className="text-xs font-bold text-slate-300 mt-1">ابدأ بإضافة المراحل لبناء هيكل المشروع الميداني</p>
                              </div>
                           )}
                           
                           {project.milestones?.map((milestone, i) => {
                              const isCompleted = milestone.status === 'completed';
                              const associatedTransactions = transactions.filter(t => t.description?.includes(milestone.title) || t.category?.includes(milestone.title));
                              
                              return (
                                 <Card key={i} className={`p-6 rounded-[2.5rem] border-slate-100 transition-all duration-500 ${isCompleted ? 'bg-emerald-50/50 border-emerald-100 shadow-none' : 'bg-white hover:border-primary/20 shadow-sm'}`}>
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-5">
                                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                             {i + 1}
                                          </div>
                                          <div>
                                             <h4 className="font-black text-slate-900">{milestone.title}</h4>
                                             <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">التأثير: {milestone.weight}%</span>
                                                {associatedTransactions.length > 0 && (
                                                   <Badge variant="outline" className="text-[8px] font-black border-amber-200 text-amber-600 px-2 py-0">مصاريف مرتبطة</Badge>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-3">
                                          <Button 
                                             variant="ghost"
                                             size="icon"
                                             onClick={() => handleDeleteStage(milestone)}
                                             className="h-10 w-10 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                                          >
                                             <Trash2 className="w-4 h-4" />
                                          </Button>
                                          <Button 
                                             onClick={() => handleToggleMilestone(milestone.title)}
                                             size="sm"
                                             className={`rounded-xl px-6 font-black text-xs h-10 transition-all ${isCompleted ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 shadow-none' : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-100'}`}
                                          >
                                             {isCompleted ? <CheckCircle2 className="w-4 h-4 ml-2" /> : null}
                                             {isCompleted ? 'مرحلة مكتملة' : 'اعتماد الإنجاز'}
                                          </Button>
                                       </div>
                                    </div>
                                    
                                    {isCompleted && milestone.date && (
                                       <div className="mt-4 pt-4 border-t border-emerald-100/50 flex items-center justify-between">
                                          <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-2">
                                             <Clock className="w-3 h-3" />
                                             تم الاعتماد في {new Date(milestone.date).toLocaleDateString('ar-SA')}
                                          </p>
                                          <Button variant="ghost" size="sm" className="text-[10px] font-black gap-2 h-7 px-2 hover:bg-emerald-100" onClick={() => setActiveTab('monitoring')}>
                                             <Camera className="w-3 h-3" />
                                             معاينة التوثيق الميداني
                                          </Button>
                                       </div>
                                    )}
                                 </Card>
                              );
                           })}
                        </div>
                     </div>

                     <div className="bg-amber-50 rounded-[2.5rem] p-8 border border-amber-100 flex gap-6">
                        <div className="h-12 w-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                           <AlertCircle className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="space-y-1">
                           <p className="text-sm font-black text-amber-900">تعليمات الربط الميداني</p>
                           <p className="text-xs font-bold text-amber-700 leading-relaxed">
                              يجب أن يتطابق تسمية المرحلة مع وصف المشتريات أو المصاريف ليتم ربطها تلقائياً. 
                              يمكنك إضافة صور التوثيق لكل مرحلة من تبويب "التوثيق" لضمان صرف الدفعات من العميل.
                           </p>
                        </div>
                     </div>
                  </motion.div>
               )}
               {activeTab === 'team' && (
                  <motion.div 
                     key="team"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-6"
                  >
                     <h3 className="text-xl font-black text-slate-900 border-r-4 border-primary pr-3">الكادر الميداني</h3>
                     <div className="flex flex-col gap-3">
                        {projectWorkers.map(worker => (
                           <Card key={worker.id} className="p-6 rounded-[2rem] border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                              <div className="flex items-center gap-4">
                                 <div className="h-14 w-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl">
                                    {worker.name.charAt(0)}
                                 </div>
                                 <div>
                                    <p className="font-black text-slate-900">{worker.name}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{worker.role === 'worker' ? 'فني مختص' : 'مشرف ميداني'}</p>
                                 </div>
                              </div>
                              <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12 text-emerald-500 bg-emerald-50">
                                 <Phone className="w-5 h-5" />
                              </Button>
                           </Card>
                        ))}
                     </div>
                  </motion.div>
               )}

               {activeTab === 'financials' && (
                  <motion.div 
                     key="financials"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-8"
                  >
                     <Card className="rounded-[3rem] bg-slate-900 text-white p-10 overflow-hidden relative shadow-2xl">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 blur-3xl rounded-full" />
                        <div className="relative z-10 space-y-8">
                           <div>
                              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2 uppercase">ميزانية المشروع المعتمدة</p>
                              <div className="flex items-baseline gap-2">
                                 <span className="text-5xl font-black tracking-tighter">{project.budget?.toLocaleString()}</span>
                                 <span className="text-sm font-bold text-slate-500">SAR</span>
                              </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div>
                                 <p className="text-slate-500 font-black text-[10px] uppercase mb-1">المحـصل (ر.س)</p>
                                 <p className="text-3xl font-black text-emerald-400">{financialStats.paid.toLocaleString()}</p>
                              </div>
                              <div>
                                 <p className="text-slate-500 font-black text-[10px] uppercase mb-1">المصروف (ميداني)</p>
                                 <p className="text-3xl font-black text-amber-400">
                                    {transactions.filter(t => t.type === 'expense' || t.type === 'purchase').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                                 </p>
                              </div>
                              <div>
                                 <p className="text-slate-500 font-black text-[10px] uppercase mb-1">صافي الربح المتوقع</p>
                                 <p className="text-3xl font-black text-primary">
                                    {(financialStats.paid - transactions.filter(t => t.type === 'expense' || t.type === 'purchase').reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString()}
                                 </p>
                              </div>
                           </div>
                        </div>
                     </Card>

                     <div className="space-y-6">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xl font-black text-slate-900 border-r-4 border-primary pr-3">سجل العمليات المالية</h3>
                           <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" className="h-9 rounded-xl border-slate-200 text-slate-900 font-black text-[10px] gap-2 shadow-sm hover:bg-slate-50">
                                 <Plus className="w-3.5 h-3.5" />
                                 إضافة دفعة
                              </Button>
                              <Button size="sm" className="h-9 rounded-xl bg-primary text-white font-black text-[10px] gap-2 shadow-md">
                                 <Plus className="w-3.5 h-3.5" />
                                 إضافة عملية
                              </Button>
                           </div>
                        </div>
                        
                        <div className="flex flex-col gap-4">
                           {transactions.length === 0 && (
                              <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-dashed border-2 border-slate-200 opacity-50">
                                 <DollarSign className="w-12 h-12 mx-auto mb-4" />
                                 <p className="font-black">لا توجد حركات مالية مسجلة لهذا المشروع</p>
                              </div>
                           )}
                           {transactions.map((tx) => (
                              <div key={tx.id} className="p-6 bg-white border border-slate-100 rounded-3xl flex items-center justify-between hover:border-primary/20 transition-all shadow-sm">
                                 <div className="flex items-center gap-5">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black ${
                                       tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 
                                       tx.type === 'purchase' ? 'bg-amber-50 text-amber-600' : 
                                       'bg-rose-50 text-rose-600'
                                    }`}>
                                       {tx.type === 'income' ? '+' : '-'}
                                    </div>
                                    <div>
                                       <p className="font-black text-slate-900">{tx.description || tx.category}</p>
                                       <p className="text-xs font-bold text-slate-400">{new Date(tx.date).toLocaleDateString('ar-SA')}</p>
                                    </div>
                                 </div>
                                 <div className="text-left">
                                    <p className={`font-black text-lg ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                       {tx.amount.toLocaleString()} ر.س
                                    </p>
                                    <span className="text-[10px] font-black text-slate-400 uppercase">{tx.paymentMethod === 'cash' ? 'نقدي' : 'تحويل'}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     <h3 className="text-xl font-black text-slate-900 border-r-4 border-primary pr-3">جدولة الدفعات المستحقة</h3>
                     <div className="flex flex-col gap-4">
                        {project.payments?.map((payment, i) => (
                           <div key={payment.id} className="p-6 bg-white border border-slate-100 rounded-3xl flex items-center justify-between hover:bg-slate-50 transition-all">
                              <div className="flex items-center gap-5">
                                 <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black ${payment.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    {i + 1}
                                 </div>
                                 <div>
                                    <p className="font-black text-slate-900">{payment.description || `المرحلة ${i+1}`}</p>
                                    <p className="text-xs font-bold text-slate-400">{payment.amount.toLocaleString()} ر.س</p>
                                 </div>
                              </div>
                              <Badge className={`rounded-lg px-4 py-2 font-black text-[10px] border-none ${payment.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                 {payment.status === 'paid' ? 'تم التحصيل' : 'مستحق'}
                              </Badge>
                           </div>
                        ))}
                     </div>
                  </motion.div>
               )}

               {activeTab === 'monitoring' && (
                  <motion.div 
                     key="monitoring"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-6"
                  >
                     <div className="flex items-center justify-between mb-4">
                        <div className="border-r-4 border-primary pr-3 text-right">
                           <h3 className="text-xl font-black text-slate-900 leading-none">الأرشيف المرئي</h3>
                           <p className="text-slate-500 font-bold text-[10px] mt-1">توثيق كامل لمراحل الإنشـاء</p>
                        </div>
                        <Button size="sm" className="h-9 rounded-xl bg-primary text-white font-black text-[10px] gap-2 shadow-md">
                           <Plus className="w-3.5 h-3.5" />
                           إضافة توثيق
                        </Button>
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {project.photoUrls?.map((url, i) => (
                           <div key={i} className="group overflow-hidden rounded-[3rem] border-8 border-white shadow-2xl relative aspect-video cursor-zoom-in">
                              <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="توثيق" referrerPolicy="no-referrer" />
                              <div className="absolute bottom-6 right-6">
                                 <Badge className="bg-white/90 text-slate-900 border-none px-4 py-2 rounded-xl font-black text-[10px] shadow-2xl">صورة ميدانية #{i+1}</Badge>
                              </div>
                           </div>
                        ))}
                        {(!project.photoUrls || project.photoUrls.length === 0) && (
                           <div className="py-32 flex flex-col items-center justify-center text-center opacity-30 gap-6">
                              <Camera className="w-16 h-16" />
                              <p className="font-black text-xl">لا توجد وسائط لهذا المشروع حالياً</p>
                           </div>
                        )}
                     </div>
                  </motion.div>
               )}

               {activeTab === 'chat' && (
                  <motion.div 
                     key="chat"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-6"
                  >
                     <Card className="rounded-[2.5rem] overflow-hidden border-slate-100 h-[600px] flex flex-col shadow-2xl shadow-slate-200">
                        <div className="p-6 bg-slate-900 text-white flex items-center gap-4">
                           <MessageCircle className="w-6 h-6" />
                           <h3 className="font-black">سجل تواصل الفريق</h3>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-slate-50/30">
                           {updates.map(update => (
                              <div key={update.id} className={`flex flex-col gap-1.5 ${update.authorId === profile?.uid ? 'items-end' : 'items-start'}`}>
                                 <p className="text-[9px] font-black text-slate-400 px-3 uppercase tracking-widest">{update.authorName}</p>
                                 <div className={`p-5 rounded-[2rem] text-sm font-bold max-w-[85%] leading-relaxed ${
                                    update.authorId === profile?.uid ? 'bg-slate-900 text-white rounded-tr-none shadow-xl shadow-slate-200' : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'
                                 }`}>
                                    {update.content}
                                 </div>
                              </div>
                           ))}
                           {updates.length === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-center text-slate-300 gap-4">
                                 <MessageCircle className="w-12 h-12" />
                                 <p className="font-black">ابدأ تواصلك الآن مع الفريق الميداني</p>
                              </div>
                           )}
                        </div>
                        <div className="p-6 bg-white border-t border-slate-50">
                           <div className="relative">
                              <Input placeholder="أرسل تحديثاً للمشروع..." className="h-16 pr-6 pl-14 rounded-3xl bg-slate-100 border-none font-bold text-slate-900 focus:bg-white transition-all shadow-inner" />
                              <Button size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-2xl bg-slate-900 group">
                                 <ChevronRight className="w-5 h-5 -rotate-180 group-hover:-translate-x-1 transition-transform" />
                              </Button>
                           </div>
                        </div>
                     </Card>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </section>

      <footer className="py-12 text-center opacity-10">
         <p className="text-[10px] font-black uppercase tracking-[0.6em]">Aman Management System • Next Gen Construction</p>
      </footer>
    </div>
  );
}

// --- 🏗️ Clean Internal UI Components ---

interface StatusCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactElement;
  color: 'primary' | 'emerald';
  progress?: number;
}

const StatusCard = React.memo(({ label, value, unit, icon, color, progress }: StatusCardProps) => {
   const colorMap: Record<string, string> = {
      primary: 'bg-primary text-white',
      emerald: 'bg-emerald-500 text-white',
   };

   return (
      <Card className="rounded-3xl min-h-[110px] border-slate-100 p-4 flex flex-col justify-between group overflow-hidden relative shadow-sm hover:shadow-md transition-all duration-300 bg-white">
         <div className="relative z-10 flex flex-col gap-3">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${colorMap[color]} shadow-sm transition-transform group-hover:rotate-6`}>
               {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
            </div>
            <div>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5 whitespace-nowrap">{label}</p>
               <div className="flex items-baseline gap-1 flex-wrap">
                  <span className="text-lg font-black text-slate-900 tracking-tighter leading-none">{value}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{unit}</span>
               </div>
            </div>
         </div>
         {progress !== undefined && (
            <div className="mt-2 w-full">
               <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-emerald-600">{progress}%</span>
               </div>
               <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${progress}%` }}
                     transition={{ duration: 1.5, ease: "easeOut" }}
                     className="h-full bg-emerald-500 rounded-full"
                  />
               </div>
            </div>
         )}
      </Card>
   );
});

const DetailLine = React.memo(({ label, value, icon }: { label: string, value: string | undefined, icon: React.ReactNode }) => {
   return (
      <div className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0 group">
         <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
               {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
            </div>
            <span className="text-slate-400 font-black text-sm">{label}</span>
         </div>
         <span className="font-black text-slate-900 text-sm tracking-tight">{value || '---'}</span>
      </div>
   );
});

const MilestoneBox = React.memo(({ title, date, status, index }: { title: string; date?: string; status: ProjectMilestone['status']; index: number }) => {
   const statusStyles: Record<string, string> = {
      completed: 'bg-emerald-500 text-white border-emerald-500',
      'in-progress': 'bg-primary text-white border-primary',
      'review-requested': 'bg-amber-500 text-white border-amber-500',
      active: 'bg-primary text-white border-primary',
      pending: 'bg-slate-100 text-slate-400 border-slate-200',
   };

   return (
      <div className="flex gap-6 group">
         <div className="flex flex-col items-center">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 transition-all duration-500 ${statusStyles[status] || statusStyles.pending}`}>
               {index + 1}
            </div>
            <div className="w-1 flex-1 bg-slate-100 my-2 rounded-full" />
         </div>
         <div className="flex-1 pb-8">
            <div className="p-6 rounded-[2rem] bg-white border border-slate-100 group-hover:bg-slate-50 group-hover:shadow-xl group-hover:border-primary/20 transition-all duration-700">
               <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-black text-slate-900 tracking-tight">{title}</h4>
                  <Badge className={`rounded-xl px-3 py-1 font-black text-[9px] border-none ${
                     status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                     status === 'in-progress' ? 'bg-primary/10 text-primary' :
                     status === 'review-requested' ? 'bg-amber-50 text-amber-600' :
                     'bg-slate-50 text-slate-400'
                  }`}>
                     {status === 'completed' ? 'مكتمل' : 
                      status === 'in-progress' ? 'قيد العمل' : 
                      status === 'review-requested' ? 'بانتظار المراجعة' : 
                      'مجدول'}
                  </Badge>
               </div>
               <p className="text-xs font-bold text-slate-400">{date || 'موعد لم يحدد بعد'}</p>
            </div>
         </div>
      </div>
   );
});
