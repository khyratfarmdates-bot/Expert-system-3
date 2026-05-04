import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Plus, 
  Download,
  Target,
  Clock,
  Search,
  Grid,
  List,
  Calendar,
  MoreVertical,
  ArrowUpRight,
  MapPin,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { toast } from 'sonner';
import { Project } from '../types';
import ProjectViewV2 from './ProjectViewV2';
import { motion, AnimatePresence } from 'motion/react';
import { calculateProjectProgress } from '../lib/projectUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function ProjectsV2() {

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    budget: 0,
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    locationLink: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    projectType: 'residential',
    supervisor: '',
    contractNumber: '',
    engOffice: '',
    totalArea: '',
    projectStatus: 'planning'
  });

  const handleCreateProject = async () => {
    if (!newProject.title) {
      toast.error("يرجى إدخال عنوان المشروع");
      return;
    }

    try {
      await addDoc(collection(db, 'projects'), {
        ...newProject,
        status: 'active',
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        workerIds: [],
        milestones: [],
        photoUrls: [],
        payments: [],
        progress: 0
      });
      toast.success("تم إنشاء المشروع بنجاح");
      setIsAddOpen(false);
      setNewProject({ 
        title: '', 
        description: '', 
        budget: 0, 
        clientName: '', 
        clientPhone: '', 
        clientEmail: '',
        locationLink: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        projectType: 'residential',
        supervisor: '',
        contractNumber: '',
        engOffice: '',
        totalArea: '',
        projectStatus: 'planning'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'projects', auth);
    }
  };

  useEffect(() => {
    const unsubProjects = onSnapshot(
      query(collection(db, 'projects'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      },
      (error) => {
        console.error("Firestore Error (Projects):", error);
        toast.error("خطأ في تحميل المشاريع");
      }
    );

    return () => unsubProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (p.description?.toLowerCase().includes(searchQuery.toLowerCase() ?? ''));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const totalBudget = projects.reduce((acc, curr) => acc + (curr.budget || 0), 0);
    return { active, completed, totalBudget };
  }, [projects]);

  if (selectedProjectId) {
    return <ProjectViewV2 projectId={selectedProjectId} onBack={() => setSelectedProjectId(null)} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 animate-in fade-in duration-700" dir="rtl">
      {/* 🌌 High-End Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 md:space-y-2">
          <div className="flex items-center gap-2">
             <div className="h-5 w-5 md:h-7 md:w-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Briefcase className="w-3 h-3 md:w-4 md:h-4" />
             </div>
             <span className="text-[7px] md:text-[9px] font-black text-primary uppercase tracking-[0.2em]">لوحة التحكم الأكاديمية</span>
          </div>
          <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
            المشاريع <span className="text-primary italic">الميدانية</span>
          </h1>
          <p className="text-slate-500 font-bold max-w-lg text-[10px] md:text-sm leading-relaxed">
            متابعة دقيقة لسير العمليات والبيانات ميدانياً.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => window.print()}
            className="h-11 px-5 rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            تحميل التقرير العام
          </Button>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger 
              render={
                <Button 
                  className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-primary text-white font-black gap-2 shadow-lg shadow-slate-200 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  مشروع جديد
                </Button>
              }
            />
            <DialogContent className="max-w-3xl rounded-[2.5rem] p-8 border-none shadow-2xl overflow-y-auto max-h-[90vh]" dir="rtl">
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                   <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Briefcase className="w-6 h-6" />
                   </div>
                   <div className="text-right">
                      <DialogTitle className="text-2xl font-black text-slate-900">تأسيس ملف مشروع متكامل</DialogTitle>
                      <p className="text-slate-500 font-bold text-[10px] mt-0.5 uppercase tracking-widest">نموذج المواصفات الفنية والهندسية</p>
                   </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-8 mt-8 pb-4">
                {/* القسم الأول: المعلومات الأساسية */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 border-r-4 border-primary pr-3">
                      <span className="text-xs font-black text-slate-900 uppercase">المعلومات الأساسية للهوية</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">عنوان المشروع</Label>
                       <Input 
                         value={newProject.title}
                         onChange={e => setNewProject({...newProject, title: e.target.value})}
                         placeholder="مثال: قصر الأميرة - حي الملقا" 
                         className="h-12 rounded-xl bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white transition-all font-bold text-sm shadow-inner"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">رقم العقد / المرجع</Label>
                       <Input 
                         value={newProject.contractNumber}
                         onChange={e => setNewProject({...newProject, contractNumber: e.target.value})}
                         placeholder="CN-2024-XXX" 
                         className="h-12 rounded-xl bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white transition-all font-bold text-sm shadow-inner"
                       />
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">نوع المشروع</Label>
                       <select 
                         value={newProject.projectType}
                         onChange={e => setNewProject({...newProject, projectType: e.target.value})}
                         className="w-full h-12 rounded-xl bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white transition-all font-bold text-sm px-4 shadow-inner appearance-none"
                       >
                         <option value="residential">سكني فاخر</option>
                         <option value="commercial">تجاري استثماري</option>
                         <option value="industrial">منشأة صناعية</option>
                         <option value="renovation">تطوير وترميم</option>
                       </select>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">المكتب الهندسي</Label>
                       <Input 
                         value={newProject.engOffice}
                         onChange={e => setNewProject({...newProject, engOffice: e.target.value})}
                         placeholder="اسم المكتب الاستشاري" 
                         className="h-12 rounded-xl bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white transition-all font-bold text-sm shadow-inner"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">المساحة الإجمالية (م²)</Label>
                       <Input 
                         value={newProject.totalArea}
                         onChange={e => setNewProject({...newProject, totalArea: e.target.value})}
                         placeholder="مثال: 500" 
                         className="h-12 rounded-xl bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white transition-all font-bold text-sm shadow-inner"
                       />
                     </div>
                   </div>
                </div>

                {/* القسم الثاني: التفاصيل المالية وتعيين المسؤولين */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 border-r-4 border-emerald-500 pr-3">
                      <span className="text-xs font-black text-slate-900 uppercase">التفاصيل المالية والمسؤوليات</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">إجمالي قيمة العقد (ر.س)</Label>
                       <div className="relative">
                          <Input 
                            type="text"
                            inputMode="numeric"
                            value={newProject.budget}
                            onChange={e => {
                               const val = e.target.value.replace(/[^0-9]/g, '');
                               setNewProject({...newProject, budget: Number(val)});
                            }}
                            className="h-14 rounded-xl bg-slate-50 border-transparent focus:border-emerald-500/20 focus:bg-white transition-all font-black text-xl text-emerald-600 shadow-inner pr-12"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">SAR</div>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">المشرف المسؤول</Label>
                       <Input 
                         value={newProject.supervisor}
                         onChange={e => setNewProject({...newProject, supervisor: e.target.value})}
                         placeholder="اسم المهندس المشرف" 
                         className="h-14 rounded-xl bg-slate-50 border-transparent focus:border-primary/20 focus:bg-white transition-all font-bold text-sm shadow-inner"
                       />
                     </div>
                   </div>
                </div>

                {/* القسم الثالث: معلومات العميل والاتصال */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 border-r-4 border-blue-500 pr-3">
                      <span className="text-xs font-black text-slate-900 uppercase">سجل العميل وبيانات الاتصال</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="space-y-2 md:col-span-1">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">اسم العميل</Label>
                       <Input 
                         value={newProject.clientName}
                         onChange={e => setNewProject({...newProject, clientName: e.target.value})}
                         className="h-12 rounded-xl bg-slate-50 border-transparent shadow-inner font-bold"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">رقم الجوال</Label>
                       <Input 
                         value={newProject.clientPhone}
                         onChange={e => setNewProject({...newProject, clientPhone: e.target.value})}
                         placeholder="05xxxxxxx"
                         className="h-12 rounded-xl bg-slate-50 border-transparent shadow-inner font-bold"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">البريد الإلكتروني</Label>
                       <Input 
                         type="email"
                         value={newProject.clientEmail}
                         onChange={e => setNewProject({...newProject, clientEmail: e.target.value})}
                         placeholder="client@mail.com"
                         className="h-12 rounded-xl bg-slate-50 border-transparent shadow-inner font-bold text-left"
                       />
                     </div>
                   </div>
                </div>

                {/* القسم الرابع: التخطيط والجدول الزمني */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 border-r-4 border-slate-900 pr-3">
                      <span className="text-xs font-black text-slate-900 uppercase">المواقع والجدولة الزمنية</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">تاريـخ البدء</Label>
                       <Input 
                         type="date"
                         value={newProject.startDate}
                         onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                         className="h-12 rounded-xl bg-slate-50 border-transparent shadow-inner font-bold"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">تاريـخ الانتهاء (تقديري)</Label>
                       <Input 
                         type="date"
                         value={newProject.endDate}
                         onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                         className="h-12 rounded-xl bg-slate-50 border-transparent shadow-inner font-bold"
                       />
                     </div>
                   </div>
                   <div className="space-y-2">
                     <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">الموقع الجغرافي (Google Maps Link)</Label>
                     <Input 
                       value={newProject.locationLink}
                       onChange={e => setNewProject({...newProject, locationLink: e.target.value})}
                       placeholder="https://maps.app.goo.gl/..."
                       className="h-12 rounded-xl bg-slate-50 border-transparent shadow-inner font-bold text-left"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="font-black text-slate-400 text-[10px] uppercase tracking-wider pr-1">نطاق العمل الفني</Label>
                     <textarea 
                       value={newProject.description}
                       onChange={e => setNewProject({...newProject, description: e.target.value})}
                       rows={3}
                       placeholder="أدخل تفاصيل الهيكل الإنشائي، التشطيبات، والملاحظات الهندسية الهامة..."
                       className="w-full rounded-2xl bg-slate-50 border-transparent shadow-inner font-bold p-4 text-sm focus:ring-0 focus:bg-white transition-all"
                     />
                   </div>
                </div>

                <Button 
                  onClick={handleCreateProject}
                  className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-primary text-white font-black text-xl shadow-2xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  اعتماد الملف والمباشرة بالتأسيس
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 📊 Bento Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Card className="rounded-3xl border-2 border-slate-100 shadow-sm p-6 bg-white opacity-100 relative overflow-hidden group ring-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700" />
          <div className="relative z-10">
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">إجمالي الميزانيات</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{stats.totalBudget.toLocaleString()}</span>
              <span className="text-[9px] font-bold text-slate-500">SAR</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-100 shadow-sm p-6 bg-white opacity-100 relative overflow-hidden group ring-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700" />
          <div className="relative z-10">
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
              <Briefcase className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">المشاريع النشطة</p>
            <span className="text-2xl font-black text-slate-900">{stats.active}</span>
          </div>
        </Card>

        <Card className="rounded-3xl border-2 border-slate-100 shadow-sm p-6 bg-white opacity-100 relative overflow-hidden group ring-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-125 transition-transform duration-700" />
          <div className="relative z-10">
            <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">مشاريع مكتملة</p>
            <span className="text-2xl font-black text-slate-900">{stats.completed}</span>
          </div>
        </Card>

        <Card className="rounded-3xl bg-slate-900 border-none shadow-xl p-6 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 blur-2xl" />
          <div className="relative z-10">
            <div className="h-10 w-10 bg-white/10 text-white rounded-lg flex items-center justify-center mb-4 border border-white/20">
              <Target className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">معدل الإنجاز</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{projects.length > 0 ? Math.round((stats.completed / projects.length) * 100) : 0}</span>
              <span className="text-[9px] font-bold text-slate-500">%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 🔍 Search and Filters */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث عن مشروع بالاسم أو الوصف..." 
            className="w-full h-12 pl-4 pr-12 rounded-xl bg-white border border-slate-200 shadow-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex items-center gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden lg:block mx-1" />

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${statusFilter === 'all' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100 hover:border-primary/50'}`}
            >
              الكل
            </button>
            <button 
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${statusFilter === 'active' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100 hover:border-primary/50'}`}
            >
              نشط
            </button>
            <button 
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${statusFilter === 'completed' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100 hover:border-primary/50'}`}
            >
              مكتمل
            </button>
          </div>
        </div>
      </div>

      {/* 🖼️ Projects Display */}
      <AnimatePresence mode="popLayout">
        {filteredProjects.length > 0 ? (
          viewMode === 'grid' ? (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
            >
              {filteredProjects.map((project) => (
                <ProjectGridCard key={project.id} project={project} onSelect={() => setSelectedProjectId(project.id)} />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              layout
              className="space-y-4"
            >
              <div className="bg-slate-900/5 rounded-2xl p-4 flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:flex">
                 <div className="w-[40%] px-4">اسم المشروع والمعلومات الأساسية</div>
                 <div className="w-[15%] text-center">الميزانية</div>
                 <div className="w-[15%] text-center">تاريخ البدء</div>
                 <div className="w-[15%] text-center">الحالة</div>
                 <div className="w-[15%] text-center">العمليات</div>
              </div>
              {filteredProjects.map((project) => (
                <ProjectListCard key={project.id} project={project} onSelect={() => setSelectedProjectId(project.id)} />
              ))}
            </motion.div>
          )
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-center"
          >
            <div className="w-24 h-24 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center mb-8 text-slate-300">
               <Briefcase className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">لا توجد نتائج</h3>
            <p className="text-slate-500 font-bold max-w-sm px-6">
              لم يتم العثور على أي مشاريع تطابق شروط البحث الحالية. حاول تغيير الفلتر أو إضافة مشروع جديد.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ProjectGridCard = React.memo(({ project, onSelect }: { project: Project, onSelect: () => void }) => {
  const hasPhotos = project.photoUrls && project.photoUrls.length > 0;
  const progress = calculateProjectProgress(project);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={onSelect}
      className="group cursor-pointer"
    >
      <Card className="rounded-[2.5rem] border-none bg-white overflow-hidden shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 h-full flex flex-col ring-0 relative">
        {/* Subtle Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 shrink-0">
          {hasPhotos ? (
            <img 
              src={project.photoUrls[0]} 
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
              alt={project.title}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300">
              <div className="h-16 w-16 rounded-3xl bg-white/50 border border-white flex items-center justify-center">
                <Briefcase className="w-8 h-8 opacity-40 text-slate-400" />
              </div>
            </div>
          )}

          {/* Glassmorphism Badge */}
          <div className="absolute top-4 right-4 z-20">
            <Badge className={`border-none backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl ring-1 ring-white/20 ${
              project.status === 'active' 
                ? 'bg-slate-900/80 text-white' 
                : 'bg-emerald-500/80 text-white'
            }`}>
              {project.status === 'active' ? '• نشط' : '• مكتمل'}
            </Badge>
          </div>

          {/* Progress Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
             <div className="flex items-center justify-between text-white mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">نسبة الإنجاز</span>
                <span className="text-xs font-black">{progress}%</span>
             </div>
             <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   transition={{ duration: 1, delay: 0.5 }}
                   className="h-full bg-primary" 
                />
             </div>
          </div>
        </div>

        <CardContent className="p-6 flex-1 flex flex-col relative bg-white">
          <div className="flex items-center gap-2 mb-3 text-slate-400">
            <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
               <Calendar className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {project.createdAt ? new Date(project.createdAt).toLocaleDateString('ar-SA') : 'منذ وقت قريب'}
            </span>
          </div>

          <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight group-hover:text-primary transition-colors line-clamp-1">
            {project.title}
          </h3>
          
          <p className="text-xs font-bold text-slate-500 line-clamp-2 mb-6 leading-relaxed flex-1">
            {project.description || 'لا يوجد وصف متاح لهذا المشروع حالياً في السجلات..'}
          </p>

          <div className="pt-5 border-t border-slate-50 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">الميزانية التقديرية</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900 tracking-tight">{project.budget?.toLocaleString()}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">SAR</span>
              </div>
            </div>
            
            <div className="h-10 w-10 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-12 shadow-sm border border-slate-100 group-hover:border-primary">
               <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

const ProjectListCard = React.memo(({ project, onSelect }: { project: Project, onSelect: () => void }) => {
  const hasPhotos = project.photoUrls && project.photoUrls.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01, y: -2 }}
      onClick={onSelect}
      className="group cursor-pointer"
    >
      <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 overflow-hidden ring-0">
        <div className="p-3 flex flex-col lg:flex-row lg:items-center gap-5">
           {/* Project Info */}
           <div className="lg:w-[40%] flex items-center gap-4 px-1">
              <div className="h-14 w-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                 {hasPhotos ? (
                    <img src={project.photoUrls[0]} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" referrerPolicy="no-referrer" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200">
                       <Briefcase className="w-5 h-5 opacity-30" />
                    </div>
                 )}
              </div>
              <div className="min-w-0">
                 <h4 className="text-base font-black text-slate-900 group-hover:text-primary transition-colors truncate">{project.title}</h4>
                 <div className="flex items-center gap-3 mt-0.5 text-slate-400">
                    <div className="flex items-center gap-1.5">
                       <MapPin className="w-2.5 h-2.5" />
                       <span className="text-[9px] font-bold">الرياض، المملكة</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Budget */}
           <div className="lg:w-[15%] text-center">
              <p className="text-[9px] font-black text-slate-300 lg:hidden uppercase mb-1">الميزانية</p>
              <div className="flex items-baseline justify-center gap-1">
                 <span className="text-xl font-black text-slate-900">{project.budget?.toLocaleString()}</span>
                 <span className="text-[9px] font-bold text-slate-400">SAR</span>
              </div>
           </div>

           {/* Date */}
           <div className="lg:w-[15%] text-center">
              <p className="text-[9px] font-black text-slate-300 lg:hidden uppercase mb-1">تاريخ البدء</p>
              <div className="flex items-center justify-center gap-2 text-slate-500 font-bold text-sm underline decoration-slate-200 underline-offset-4">
                 <Clock className="w-3 h-3" />
                 <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('ar-SA') : '-'}</span>
              </div>
           </div>

           {/* Status */}
           <div className="lg:w-[15%] text-center flex justify-center">
              <p className="text-[9px] font-black text-slate-300 lg:hidden uppercase mb-1">الحالة</p>
              <Badge className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border-none ${
                 project.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-emerald-50 text-emerald-600'
              }`}>
                 {project.status === 'active' ? 'نشط ميدانياً' : 'مكتمل'}
              </Badge>
           </div>

           {/* More */}
           <div className="lg:w-[15%] flex justify-center gap-2">
              <Button size="icon" variant="ghost" className="rounded-xl hover:bg-slate-50 font-black text-slate-400 hover:text-primary">
                 <MoreVertical className="w-4 h-4" />
              </Button>
              <Button size="icon" className="rounded-xl bg-slate-900 hover:bg-primary text-white shadow-lg shadow-slate-200">
                 <ArrowUpRight className="w-4 h-4" />
              </Button>
           </div>
        </div>
      </Card>
    </motion.div>
  );
});
