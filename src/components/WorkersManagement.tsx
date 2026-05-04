import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search, Phone, HardHat, DollarSign, TrendingUp, CheckCircle2, Navigation, Loader2, Edit2, UserCheck, Trash2 } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../lib/AuthContext";
import { sendNotification } from "../lib/notifications";
import { softDelete } from "../lib/softDelete";
import { toast } from "sonner";
import { motion } from "motion/react";
import WorkerView from "./WorkerView";

interface Worker {
  id: string;
  name: string;
  role: string;
  dailyRate: number;
  phone?: string;
  status: 'available' | 'at-work';
  currentProjectId?: string;
  currentProjectTitle?: string;
  photoUrl?: string;
  category?: string;
}

export default function WorkersManagement() {
  const { profile } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmDeleteWorker = async () => {
    if (!profile || !workerToDelete) return;
    setIsSubmitting(true);
    try {
      const success = await softDelete(
        'workers', 
        workerToDelete.id, 
        workerToDelete, 
        profile.uid, 
        `عامل: ${workerToDelete.name}`
      );
      if (success) {
        toast.success("تم نقل بيانات العامل إلى سلة المهملات");
        setIsDeleteConfirmOpen(false);
        setWorkerToDelete(null);
      }
    } catch (e) {
      toast.error("فشل في حذف العامل");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const [workerForm, setWorkerForm] = useState({
    name: "",
    role: "عامل",
    dailyRate: "",
    phone: "",
    category: "عمالة"
  });

  const [assignmentForm, setAssignmentForm] = useState({
    projectId: "",
    notes: ""
  });

  const [logForm, setLogForm] = useState({
    amount: "150",
    description: "أجر يومية ميدانية",
    projectId: "",
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const unsubWorkers = onSnapshot(collection(db, "workers"), (snap) => {
      setWorkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worker)));
      setIsLoading(false);
    });

    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects((snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]).filter(p => p.status !== 'completed'));
    });

    return () => {
      unsubWorkers();
      unsubProjects();
    };
  }, []);

  const handleAddOrUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerForm.name || !workerForm.dailyRate) {
      toast.error("يرجى ملء كافة الحقول الأساسية");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && selectedWorker) {
        await updateDoc(doc(db, "workers", selectedWorker.id), {
          ...workerForm,
          dailyRate: parseFloat(workerForm.dailyRate),
          updatedAt: serverTimestamp()
        });
        toast.success("تم تحديث بيانات العامل بنجاح");
      } else {
        await addDoc(collection(db, "workers"), {
          ...workerForm,
          dailyRate: parseFloat(workerForm.dailyRate),
          status: 'available',
          createdAt: serverTimestamp(),
          createdBy: profile?.uid
        });

        await sendNotification({
          title: 'عامل جديد',
          message: `تمت إضافة العامل ${workerForm.name} إلى النظام`,
          type: 'info',
          category: 'system',
          targetRole: 'manager',
          priority: 'low'
        });

        toast.success("تمت إضافة العامل بنجاح");
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("فشل في حفظ البيانات");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignWorker = async () => {
    if (!assignmentForm.projectId || !selectedWorker) {
      toast.error("يرجى اختيار المشروع");
      return;
    }

    setIsSubmitting(true);
    try {
      const project = projects.find(p => p.id === assignmentForm.projectId);
      
      // 1. Create assignment record
      await addDoc(collection(db, "worker_assignments"), {
        workerId: selectedWorker.id,
        projectId: assignmentForm.projectId,
        projectTitle: project?.title,
        workerName: selectedWorker.name,
        assignedAt: serverTimestamp(),
        status: 'active'
      });

      // 2. Update worker status
      await updateDoc(doc(db, "workers", selectedWorker.id), {
        status: 'at-work',
        currentProjectId: assignmentForm.projectId,
        currentProjectTitle: project?.title
      });

      await sendNotification({
        title: 'إسناد ميداني',
        message: `تم توجيه العامل ${selectedWorker.name} لمشروع ${project?.title}`,
        type: 'info',
        category: 'system',
        targetRole: 'manager',
        priority: 'low'
      });

      toast.success(`تم إسناد ${selectedWorker.name} بنجاح`);
      setIsAssignDialogOpen(false);
      setAssignmentForm({ projectId: "", notes: "" });
    } catch (error) {
      console.error(error);
      toast.error("فشل في إسناد العامل");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setWorkerForm({ name: "", role: "عامل", dailyRate: "", phone: "", category: "عمالة" });
    setIsEditMode(false);
    setSelectedWorker(null);
  };

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.phone?.includes(searchTerm)
  );

  const stats = {
    total: workers.length,
    assigned: workers.filter(w => w.status === 'at-work').length,
    available: workers.filter(w => w.status !== 'at-work').length,
    dailyCost: workers.reduce((acc, w) => acc + (w.dailyRate || 0), 0)
  };

  if (selectedWorkerId) {
    return <WorkerView workerId={selectedWorkerId} onBack={() => setSelectedWorkerId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 mb-2 md:mb-6">
        <div>
          <h1 className="text-lg md:text-2xl font-black text-slate-800">إدارة العمالة اليومية</h1>
          <p className="text-[10px] md:text-sm font-bold text-slate-500">مراقبة حضور العمال وإسنادهم ميدانياً.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث باسم العامل أو الجوال..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 rounded-xl h-11 text-right bg-white border-slate-100"
            />
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger render={
              <Button className="bg-primary hover:bg-black text-white rounded-lg sm:rounded-xl gap-1.5 font-bold h-9 sm:h-11 px-3 sm:px-6">
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">إضافة عامل يومية</span>
                <span className="sm:hidden text-xs">إضافة</span>
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-right">{isEditMode ? 'تحديث بيانات العامل' : 'إضافة عامل يومية جديد'}</DialogTitle>
                <DialogDescription className="text-right font-bold text-slate-500">
                  {isEditMode ? 'تعديل بيانات العامل المسجل مسبقاً.' : 'سيتم إضافة هذا العامل إلى قائمة العمالة المتاحة للإسناد للمشاريع.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOrUpdateWorker} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">اسم العامل الكامل *</Label>
                  <Input 
                    required
                    value={workerForm.name}
                    onChange={e => setWorkerForm({...workerForm, name: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="أدخل اسم العامل..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">الأجر اليومي (ر.س) *</Label>
                    <Input 
                      required
                      type="number"
                      value={workerForm.dailyRate}
                      onChange={e => setWorkerForm({...workerForm, dailyRate: e.target.value})}
                      className="rounded-xl h-11 text-right"
                      placeholder="150"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">التصنيف / الدور</Label>
                    <Select value={workerForm.role} onValueChange={v => setWorkerForm({...workerForm, role: v})}>
                      <SelectTrigger className="h-11 rounded-xl text-right">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="عامل">عامل عادي</SelectItem>
                        <SelectItem value="فني">فني</SelectItem>
                        <SelectItem value="معلم">معلم / فني ذو خبرة</SelectItem>
                        <SelectItem value="مراقب">مراقب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">رقم الجوال</Label>
                  <Input 
                    value={workerForm.phone}
                    onChange={e => setWorkerForm({...workerForm, phone: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="05..."
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-black bg-primary hover:bg-black text-white mt-4"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : isEditMode ? "تحديث البيانات" : "حفظ بيانات العامل"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        {[
          { label: "إجمالي العمال", value: stats.total, icon: HardHat, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "قيد العمل", value: stats.assigned, icon: Navigation, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "متاح", value: stats.available, icon: CheckCircle2, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "كلفة اليوم", value: `${stats.dailyCost.toLocaleString()} ر.س`, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat, i) => (
          <Card key={i} className="rounded-2xl md:rounded-3xl border-none shadow-sm overflow-hidden">
            <CardContent className="p-3 md:p-5">
              <div className="flex items-center gap-2 md:gap-3">
                <div className={`p-1.5 md:p-2.5 rounded-xl md:rounded-2xl ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase truncate">{stat.label}</p>
                  <p className="text-sm md:text-lg font-black text-slate-800 truncate">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-3xl border-none shadow-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black">قائمة العمال</CardTitle>
                <CardDescription className="text-xs font-bold font-mono">تتبع حالة العمالة اليومية في الميدان</CardDescription>
              </div>
              <Badge variant="outline" className="rounded-lg h-6 px-3 font-bold border-slate-200">
                {filteredWorkers.length} عامل
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm font-bold text-slate-400 font-mono">جارِ تحميل البيانات والمزامنة...</p>
                </div>
              ) : filteredWorkers.length > 0 ? (
                <div className="p-3 md:p-6 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                  {filteredWorkers.map((worker) => (
                    <Card 
                      key={worker.id} 
                      onClick={() => setSelectedWorkerId(worker.id)}
                      className="rounded-2xl md:rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-xl transition-all cursor-pointer group overflow-hidden"
                    >
                      <CardContent className="p-3 md:p-5">
                        <div className="flex items-center gap-2 md:gap-4 text-right">
                          <div className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-2xl bg-primary/5 text-primary flex items-center justify-center text-sm md:text-2xl font-black group-hover:scale-105 transition-transform shrink-0">
                             {worker.photoUrl ? (
                               <img src={worker.photoUrl} alt="" className="w-full h-full object-cover rounded-lg md:rounded-2xl" />
                             ) : worker.name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0 w-full overflow-hidden">
                            <h4 className="font-black text-slate-900 text-[9px] md:text-sm truncate">{worker.name}</h4>
                            <p className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase truncate">{worker.role}</p>
                            <div className={`mt-0.5 flex items-center justify-start gap-1 text-[7px] md:text-[9px] font-black ${worker.status === 'at-work' ? 'text-emerald-600' : 'text-slate-400'}`}>
                               <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${worker.status === 'at-work' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                               <span className="truncate">{worker.status === 'at-work' ? (worker.currentProjectTitle || 'ميداني') : 'متاح'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-slate-50 flex items-center justify-between gap-1">
                          <div className="text-right hidden md:block">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">الأجر</p>
                            <p className="font-black text-slate-900 text-xs md:text-base">{worker.dailyRate}<span className="text-[8px] md:text-[10px] font-normal opacity-50 mr-1">ر.س</span></p>
                          </div>
                          <div className="flex items-center gap-0.5 w-full justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => { setWorkerToDelete(worker); setIsDeleteConfirmOpen(true); }} className="w-5 h-5 md:w-8 md:h-8 rounded-md md:rounded-xl hover:text-red-600">
                              <Trash2 className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedWorker(worker); setWorkerForm({ name: worker.name, role: worker.role || "عامل", dailyRate: worker.dailyRate.toString(), phone: worker.phone || "", category: worker.category || "عمالة" }); setIsEditMode(true); setIsAddDialogOpen(true); }} className="w-5 h-5 md:w-8 md:h-8 rounded-md md:rounded-xl hover:text-primary">
                              <Edit2 className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
                            </Button>
                            <Button 
                              disabled={worker.status === 'at-work'}
                              onClick={() => { setSelectedWorker(worker); setIsAssignDialogOpen(true); }}
                              className="bg-slate-900 text-white rounded-md md:rounded-xl text-[7px] md:text-[10px] h-6 md:h-8 px-1.5 md:px-3 font-bold"
                            >
                              إسناد
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-slate-50">
                    <Search className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold">لم نجد عمالاً مسجلين بهذا الاسم</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-none shadow-sm bg-slate-900 text-white p-6">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ملخص الإنتاجية
                </h3>
             </div>
             <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>تحقيق المستهدفات</span>
                    <span className="text-emerald-400">88%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "88%" }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-white/40 uppercase">نسبة الحضور</p>
                      <p className="text-xl font-black text-white">96%</p>
                   </div>
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] font-black text-white/40 uppercase">التأخير الميداني</p>
                      <p className="text-xl font-black text-amber-400">2%</p>
                   </div>
                </div>
             </div>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm p-6">
             <h3 className="font-black text-lg mb-4">نشاط الميدان الآن</h3>
             <div className="space-y-4">
                {workers.filter(w => w.status === 'at-work').slice(0, 4).map((w, i) => (
                   <div 
                     key={i} 
                     onClick={() => setSelectedWorkerId(w.id)}
                     className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                   >
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center font-black text-xs text-primary">
                            {w.name[0]}
                         </div>
                         <div>
                            <p className="text-xs font-black text-slate-800 line-clamp-1">{w.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">{w.currentProjectTitle}</p>
                         </div>
                      </div>
                      <Badge className="bg-white border-slate-200 text-slate-600 text-[10px] font-bold h-6">جاري العمل</Badge>
                   </div>
                ))}
                {workers.filter(w => w.status === 'at-work').length === 0 && (
                   <div className="text-center py-6">
                      <p className="text-xs font-bold text-slate-400 italic">لا يوجد عمال في الميدان حالياً</p>
                   </div>
                )}
             </div>
          </Card>
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 text-right" dir="rtl">
           <DialogHeader>
              <DialogTitle className="text-xl font-black text-right">إسناد {selectedWorker?.name} لمشروع</DialogTitle>
              <DialogDescription className="text-right font-bold text-slate-500">
                اختر المشروع المناسب لتوجيه العامل إليه وتتبع أدائه.
              </DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
              <div className="space-y-2">
                 <Label className="font-bold text-slate-700">المشروع المستهدف *</Label>
                 <Select value={assignmentForm.projectId} onValueChange={v => setAssignmentForm({...assignmentForm, projectId: v})}>
                    <SelectTrigger className="h-11 rounded-xl text-right">
                       <SelectValue placeholder="اختر المشروع..." />
                    </SelectTrigger>
                    <SelectContent>
                       {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="font-bold text-slate-700">ملاحظات الإسناد</Label>
                 <Input 
                    value={assignmentForm.notes}
                    onChange={e => setAssignmentForm({...assignmentForm, notes: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="مثلاً: البدء بأعمال الدهان مباشرة..."
                 />
              </div>
              <Button 
                onClick={handleAssignWorker}
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-black bg-slate-900 hover:bg-black text-white mt-4"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "تأكيد الإسناد الميداني"}
              </Button>
           </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">تأكيد أرشفة العامل</DialogTitle>
            <DialogDescription className="font-bold text-slate-500 py-2">
              هل أنت متأكد من رغبتك في نقل العامل "{workerToDelete?.name}" إلى سلة المهملات؟ 
              ستتمكن من استعادة كافة بياناته خلال 30 يوماً.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
             <Button 
              variant="destructive" 
              onClick={confirmDeleteWorker}
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

