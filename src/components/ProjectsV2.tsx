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
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  User,
  AlertCircle,
  Loader2,
  Paperclip,
  UploadCloud,
  Trash2
} from 'lucide-react';
import { parseProjectFromText, analyzeProjectDocument } from '../lib/gemini';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { fetchAliphiaClients } from '../lib/aliphia';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth, storage } from '../lib/firebase';
import { toast } from 'sonner';
import { Project, UserProfile } from '../types';
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
  const [activeStep, setActiveStep] = useState(1);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Record<string, boolean>>({});

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [aliphiaClientsList, setAliphiaClientsList] = useState<{ id: string; name: string; phone: string; email: string; }[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ id: string; file: File; progress: number; status: 'pending' | 'uploading' | 'success' | 'error'; url?: string; }[]>([]);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);

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
    projectType: 'hoardings',
    supervisor: '',
    contractNumber: '',
    engOffice: '',
    totalArea: '',
    projectStatus: 'planning'
  });

  // Fetch Firestore users and Aliphia clients
  useEffect(() => {
    // Firestore users
    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => {
      console.error("Failed to load users", err);
    });

    // Aliphia clients
    setIsLoadingClients(true);
    fetchAliphiaClients().then(clients => {
      setAliphiaClientsList(clients);
    }).catch(err => {
      console.error("Failed to load Aliphia clients", err);
    }).finally(() => {
      setIsLoadingClients(false);
    });

    return () => {
      unsubUsers();
    };
  }, []);

  // إعادة تهيئة النموذج عند إغلاق النافذة
  useEffect(() => {
    if (!isAddOpen) {
      setActiveStep(1);
      setAiInputText('');
      setHighlightedFields({});
      setSelectedFiles([]);
      setIsSavingProject(false);
      setAnalyzingFileId(null);
    }
  }, [isAddOpen]);

  const handleAiAutofill = async () => {
    if (!aiInputText.trim()) {
      toast.error("يرجى إدخال تفاصيل المشروع أولاً ليتم تحليلها");
      return;
    }
    
    setIsAiParsing(true);
    const toastId = toast.loading("جاري تحليل النص بالذكاء الاصطناعي وتعبئة الحقول...");
    
    try {
      const extracted = await parseProjectFromText(aiInputText);
      if (extracted) {
        setNewProject(prev => ({
          ...prev,
          title: extracted.title || prev.title,
          description: extracted.description || prev.description,
          budget: extracted.budget || prev.budget,
          clientName: extracted.clientName || prev.clientName,
          clientPhone: extracted.clientPhone || prev.clientPhone,
          clientEmail: extracted.clientEmail || prev.clientEmail,
          locationLink: extracted.locationLink || prev.locationLink,
          startDate: extracted.startDate || prev.startDate,
          endDate: extracted.endDate || prev.endDate,
          projectType: extracted.projectType || prev.projectType,
          supervisor: extracted.supervisor || prev.supervisor,
          contractNumber: extracted.contractNumber || prev.contractNumber,
          engOffice: extracted.engOffice || prev.engOffice,
          totalArea: extracted.totalArea || prev.totalArea,
        }));

        // تحديد الحقول التي تم تعبئتها للإضاءة البصرية
        const highlights: Record<string, boolean> = {};
        Object.keys(extracted).forEach((key) => {
          if ((extracted as any)[key] !== undefined && (extracted as any)[key] !== null && (extracted as any)[key] !== '') {
            highlights[key] = true;
          }
        });
        setHighlightedFields(highlights);
        toast.dismiss(toastId);
        toast.success("تم استخراج البيانات وتعبئة الحقول بنجاح! ✨");
        
        // إيقاف الإضاءة بعد 4 ثوانٍ
        setTimeout(() => {
          setHighlightedFields({});
        }, 4000);
      } else {
        toast.dismiss(toastId);
        toast.error("لم نتمكن من استخراج تفاصيل المشروع. يرجى توضيح النص أكثر.");
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err.message || "فشلت عملية التعبئة التلقائية بالذكاء الاصطناعي");
    } finally {
      setIsAiParsing(false);
    }
  };

  // Phone validation: Saudi mobile format 05xxxxxxxx, 9665xxxxxxxx, +9665xxxxxxxx
  const validatePhone = (phone: string) => {
    if (!phone) return true;
    return /^(05|9665|\+9665)\d{8}$/.test(phone.trim());
  };

  // Location validation: Google Maps link
  const validateLocationLink = (link: string) => {
    if (!link) return true;
    return /^(https?:\/\/)?(www\.)?(google\.\w+\/maps|maps\.google\.\w+|maps\.app\.goo\.gl)/.test(link.trim());
  };

  const handleAnalyzeFile = async (fileId: string) => {
    const item = selectedFiles.find(f => f.id === fileId);
    if (!item) return;

    setAnalyzingFileId(fileId);
    const toastId = toast.loading(`جاري تحليل الملف "${item.file.name}" بالذكاء الاصطناعي...`);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(item.file);
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const result = await analyzeProjectDocument(dataUrl, item.file.type);
          if (result) {
            setNewProject(prev => ({
              ...prev,
              title: result.title || prev.title,
              description: result.description || prev.description,
              budget: result.budget || prev.budget,
              clientName: result.clientName || prev.clientName,
              clientPhone: result.clientPhone || prev.clientPhone,
              clientEmail: result.clientEmail || prev.clientEmail,
              startDate: result.startDate || prev.startDate,
              endDate: result.endDate || prev.endDate,
              projectType: result.projectType || prev.projectType,
              totalArea: result.totalArea || prev.totalArea,
              contractNumber: result.contractNumber || prev.contractNumber,
            }));

            // تحديد الحقول التي تم تعبئتها للإضاءة البصرية
            const highlights: Record<string, boolean> = {};
            Object.keys(result).forEach((key) => {
              if ((result as any)[key] !== undefined && (result as any)[key] !== null && (result as any)[key] !== '') {
                highlights[key] = true;
              }
            });
            setHighlightedFields(highlights);

            toast.dismiss(toastId);
            toast.success("✨ تم تحليل مستند المشروع بنجاح وتعبئة الحقول بالقيم المستخرجة!");

            // إيقاف الإضاءة بعد 4 ثوانٍ
            setTimeout(() => {
              setHighlightedFields({});
            }, 4000);
          } else {
            toast.dismiss(toastId);
            toast.error("تعذر استخراج البيانات من هذا المستند. يرجى توضيح محتوى الملف أو تعبئته يدوياً.");
          }
        } catch (innerErr: any) {
          toast.dismiss(toastId);
          toast.error(innerErr.message || "فشل تحليل المستند بالذكاء الاصطناعي.");
        } finally {
          setAnalyzingFileId(null);
        }
      };
      reader.onerror = () => {
        toast.dismiss(toastId);
        toast.error("فشل قراءة الملف محلياً.");
        setAnalyzingFileId(null);
      };
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error(err);
      toast.error(err.message || "حدث خطأ أثناء قراءة أو تحليل الملف.");
      setAnalyzingFileId(null);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.title) {
      toast.error("يرجى إدخال عنوان المشروع");
      return;
    }

    if (newProject.clientPhone && !validatePhone(newProject.clientPhone)) {
      toast.error("يرجى تصحيح رقم هاتف العميل ليطابق التنسيق السعودي (05xxxxxxxx)");
      return;
    }

    if (newProject.locationLink && !validateLocationLink(newProject.locationLink)) {
      toast.error("يرجى تصحيح رابط موقع المشروع (يجب أن يكون رابطاً صالحاً لخرائط جوجل)");
      return;
    }

    setIsSavingProject(true);
    const toastId = toast.loading("جاري رفع المرفقات وحفظ بيانات المشروع في النظام...");

    // تجهيز مراحل عمل افتراضية للمشروع تناسب أعمال الدعاية والإعلان
    const defaultMilestones = [
      { title: 'التصميم وإعداد المخططات الفنية', weight: 15, status: 'pending' as const, date: newProject.startDate || '' },
      { title: 'تجهيز وتوريد المواد وتصنيع الهياكل', weight: 30, status: 'pending' as const, date: '' },
      { title: 'أعمال الطباعة أو الكلادينج أو تركيب الشاشات', weight: 25, status: 'pending' as const, date: '' },
      { title: 'التوصيلات الكهربائية والإضاءة والتجربة الفنية', weight: 15, status: 'pending' as const, date: '' },
      { title: 'التركيب النهائي والتسليم للعميل', weight: 15, status: 'pending' as const, date: newProject.endDate || '' }
    ];

    try {
      // 1. توليد معرّف فريد للمشروع أولاً لتخزين مرفقاته في مجلد خاص به
      const projectRef = doc(collection(db, 'projects'));
      const projectId = projectRef.id;

      const photoUrls: string[] = [];
      const fileAttachments: { name: string; url: string; uploadedAt: string }[] = [];

      // 2. رفع الملفات إلى Firebase Storage
      for (const item of selectedFiles) {
        try {
          const storageRef = ref(storage, `projects/${projectId}/attachments/${item.file.name}`);
          const uploadResult = await uploadBytes(storageRef, item.file);
          const downloadUrl = await getDownloadURL(uploadResult.ref);

          if (item.file.type.startsWith('image/')) {
            photoUrls.push(downloadUrl);
          } else {
            fileAttachments.push({
              name: item.file.name,
              url: downloadUrl,
              uploadedAt: new Date().toISOString()
            });
          }
        } catch (uploadErr) {
          console.error("Failed to upload file:", item.file.name, uploadErr);
          toast.dismiss(toastId);
          toast.error(`فشل رفع الملف: ${item.file.name}`);
          setIsSavingProject(false);
          return;
        }
      }

      // 3. حفظ مستند المشروع بقاعدة البيانات
      await setDoc(projectRef, {
        ...newProject,
        id: projectId,
        name: newProject.title, // حقل الاسم لضمان التوافقية البرمجية مع كافة واجهات النظام
        status: 'active',
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        workerIds: [],
        milestones: defaultMilestones,
        photoUrls,
        fileAttachments,
        payments: [],
        progress: 0
      });

      toast.dismiss(toastId);
      toast.success("تم إنشاء المشروع بنجاح مع رفع المرفقات وتهيئة مراحل العمل الافتراضية");
      setIsAddOpen(false);

      // إعادة تهيئة الحقول
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
        projectType: 'hoardings',
        supervisor: '',
        contractNumber: '',
        engOffice: '',
        totalArea: '',
        projectStatus: 'planning'
      });
      setSelectedFiles([]);
    } catch (error) {
      toast.dismiss(toastId);
      handleFirestoreError(error, OperationType.WRITE, 'projects', auth);
    } finally {
      setIsSavingProject(false);
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
            <DialogContent className="max-w-4xl sm:max-w-4xl rounded-[2.5rem] p-8 border-none shadow-2xl overflow-y-auto max-h-[90vh]" dir="rtl">
              <DialogHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-4">
                     <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                        <Briefcase className="w-6 h-6" />
                     </div>
                     <div className="text-right">
                        <DialogTitle className="text-2xl font-black text-slate-900">تأسيس ملف مشروع متكامل</DialogTitle>
                        <p className="text-slate-500 font-bold text-[10px] mt-0.5 uppercase tracking-widest">نموذج المواصفات الفنية والهندسية</p>
                     </div>
                  </div>
                  
                  {/* مؤشر الخطوات */}
                  <div className="flex items-center gap-2 self-center md:self-auto">
                    {[1, 2, 3, 4].map((step) => (
                      <React.Fragment key={step}>
                        <div 
                          onClick={() => {
                            // تمكين التنقل المباشر للخطوات السابقة فقط لسهولة التعديل
                            if (step < activeStep) setActiveStep(step);
                          }}
                          className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black transition-all cursor-pointer ${
                            activeStep === step 
                              ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 scale-110' 
                              : activeStep > step 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {activeStep > step ? <CheckCircle2 className="w-4 h-4" /> : step}
                        </div>
                        {step < 4 && (
                          <div className={`h-1 w-8 rounded-full transition-all ${
                            activeStep > step ? 'bg-emerald-500' : 'bg-slate-100'
                          }`} />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </DialogHeader>

              {/* 🌟 قسم التعبئة التلقائية بالذكاء الاصطناعي */}
              <div className="mt-6 bg-gradient-to-br from-primary/5 via-indigo-500/5 to-transparent border border-primary/10 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <h4 className="font-black text-sm text-slate-800">التأسيس السريع بالذكاء الاصطناعي ✨</h4>
                </div>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                  انسخ نص العقد أو تفاصيل المشروع من الواتساب والصقها بالأسفل، وسيقوم نظام Gemini بملء النموذج بالكامل بلمحة عين!
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    placeholder="مثال: مشروع قصر سكني للمالك محمد العتيبي 0555123456 بقيمة 950,000 ريال، المساحة 600 متر، يبدأ العمل في 2026-07-01 بإشراف المهندس عبدالمحسن ومكتب الرياض للاستشارات..."
                    rows={2}
                    className="flex-1 rounded-2xl bg-white border border-slate-200 shadow-inner font-bold p-3 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                  />
                  <Button 
                    type="button"
                    onClick={handleAiAutofill}
                    disabled={isAiParsing}
                    className="h-auto px-6 rounded-2xl bg-slate-900 hover:bg-primary text-white font-black text-xs transition-all flex items-center justify-center gap-2 shrink-0 shadow-md self-stretch sm:self-auto"
                  >
                    {isAiParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري التحليل...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        تعبئة ذكية
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* محتوى الخطوات مع تأثيرات Framer Motion */}
              <div className="min-h-[350px] mt-8 pb-4">
                <AnimatePresence mode="wait">
                  {activeStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-2 border-r-4 border-primary pr-3 mb-2">
                        <span className="text-xs font-black text-slate-900 uppercase">الخطوة 1: المعلومات الأساسية والنوعية</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">عنوان المشروع *</Label>
                          <Input 
                            value={newProject.title}
                            onChange={e => setNewProject({...newProject, title: e.target.value})}
                            placeholder="مثال: لوحة واجهة محل - فرع السليمانية" 
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all font-bold text-sm shadow-inner ${
                              highlightedFields.title ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">رقم العقد / المرجع</Label>
                          <Input 
                            value={newProject.contractNumber}
                            onChange={e => setNewProject({...newProject, contractNumber: e.target.value})}
                            placeholder="CN-2026-XXX" 
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all font-bold text-sm shadow-inner ${
                              highlightedFields.contractNumber ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">نوع عمل مقاولة الدعاية والإعلان *</Label>
                          <select
                            value={newProject.projectType}
                            onChange={e => setNewProject({...newProject, projectType: e.target.value})}
                            className={`w-full h-12 rounded-xl bg-slate-50 border-transparent transition-all font-bold text-sm shadow-inner pr-4 pl-8 focus:border-primary/20 focus:bg-white focus:ring-0 ${
                              highlightedFields.projectType ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : ''
                            }`}
                          >
                            <option value="hoardings">أسوار دعائية (تجهيز المواقع والمشاريع الخارجية)</option>
                            <option value="signage_printing">لوحات وطباعة (واجهات محلات، يوني بول، بنر وفليكس)</option>
                            <option value="cladding_letters">كلادينج وحروف بارزة (حروف مضيئة، زنكور، اكريليك واستيل)</option>
                            <option value="digital_screens">شاشات ومجسمات (شاشات LED وتجهيز معارض ومؤتمرات)</option>
                            <option value="exhibition_booths">تجهيز معارض ومؤتمرات (بناء أجنحة وبوثات معارض)</option>
                            <option value="megastructures">مجسمات ضخمة (مجسمات جمالية وهندسية ضخمة)</option>
                            <option value="wrapping_branding">تغليف مركبات (تغليف وتغيير هوية أساطيل السيارات)</option>
                            <option value="maintenance">صيانة لوحات وشاشات (صيانة وقائية وتصحيحية للوحات والشاشات)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">المساحة الإجمالية أو المقاسات الفنية</Label>
                          <Input 
                            value={newProject.totalArea}
                            onChange={e => setNewProject({...newProject, totalArea: e.target.value})}
                            placeholder="مثال: لوحة 4x3 م أو مساحة 120م٢" 
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all font-bold text-sm shadow-inner ${
                              highlightedFields.totalArea ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-2 border-r-4 border-emerald-500 pr-3 mb-2">
                        <span className="text-xs font-black text-slate-900 uppercase">الخطوة 2: التفاصيل المالية والمسؤوليات</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">إجمالي قيمة العقد (ر.س) *</Label>
                          <div className="relative">
                            <Input 
                              type="text"
                              inputMode="numeric"
                              value={newProject.budget}
                              onChange={e => {
                                 const val = e.target.value.replace(/[^0-9]/g, '');
                                 setNewProject({...newProject, budget: Number(val)});
                              }}
                              className={`h-14 rounded-xl bg-slate-50 border-transparent transition-all font-black text-xl text-emerald-600 shadow-inner pr-12 ${
                                highlightedFields.budget ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-emerald-500/20 focus:bg-white'
                              }`}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">SAR</div>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 pr-1">القيمة المالية الكلية المدونة في العقد الأصلي.</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">المشرف المسؤول (اختر من موظفي النظام) *</Label>
                          <select
                            value={newProject.supervisor}
                            onChange={e => setNewProject({...newProject, supervisor: e.target.value})}
                            className={`w-full h-14 rounded-xl bg-slate-50 border-transparent transition-all font-bold text-sm shadow-inner pr-4 pl-8 focus:border-primary/20 focus:bg-white focus:ring-0 ${
                              highlightedFields.supervisor ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : ''
                            }`}
                          >
                            <option value="">-- اختر المشرف المسؤول --</option>
                            {usersList.map(u => (
                              <option key={u.uid} value={u.name}>
                                {u.name} ({u.role === 'manager' ? 'مدير' : u.role === 'supervisor' ? 'مشرف' : u.role === 'sales_rep' ? 'مندوب' : 'موظف'})
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] font-bold text-slate-400 pr-1">المهندس أو المندوب الذي سيتولى المراقبة الميدانية للتصنيع والتركيب.</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-2 border-r-4 border-blue-500 pr-3 mb-2">
                        <span className="text-xs font-black text-slate-900 uppercase">الخطوة 3: سجل العميل والجدولة الزمنية</span>
                      </div>

                      {/* اختيار العميل من نظام ألف ياء */}
                      <div className="space-y-2">
                        <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">اختر عميل من النظام (ألف ياء ERP)</Label>
                        {isLoadingClients ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 h-12 pr-4 bg-slate-50 rounded-xl">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            جاري تحميل العملاء من نظام ألف ياء...
                          </div>
                        ) : (
                          <select
                            onChange={e => {
                              const selectedId = e.target.value;
                              const client = aliphiaClientsList.find(c => c.id === selectedId);
                              if (client) {
                                setNewProject(prev => ({
                                  ...prev,
                                  clientName: client.name,
                                  clientPhone: client.phone || prev.clientPhone,
                                  clientEmail: client.email || prev.clientEmail
                                }));
                                toast.success(`تم اختيار العميل وتعبئة البيانات تلقائياً: ${client.name}`);
                              }
                            }}
                            className="w-full h-12 rounded-xl bg-slate-50 border-transparent transition-all font-bold text-sm shadow-inner pr-4 pl-8 focus:border-primary/20 focus:bg-white focus:ring-0"
                          >
                            <option value="">-- اختر عميل من النظام أو اكتب البيانات يدوياً بالأسفل --</option>
                            {aliphiaClientsList.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.phone ? `(${c.phone})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">اسم العميل</Label>
                          <Input 
                            value={newProject.clientName}
                            onChange={e => setNewProject({...newProject, clientName: e.target.value})}
                            placeholder="اسم المالك أو العميل"
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all shadow-inner font-bold text-sm ${
                              highlightedFields.clientName ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">رقم الجوال *</Label>
                          <Input 
                            value={newProject.clientPhone}
                            onChange={e => setNewProject({...newProject, clientPhone: e.target.value})}
                            placeholder="05xxxxxxx"
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all shadow-inner font-bold text-sm ${
                              highlightedFields.clientPhone ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                          {!validatePhone(newProject.clientPhone) && (
                            <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1 pr-1 animate-pulse">
                              <AlertCircle className="w-3 h-3" /> رقم الجوال غير صحيح (يجب أن يبدأ بـ 05 ويحتوي على 10 أرقام)
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">البريد الإلكتروني</Label>
                          <Input 
                            type="email"
                            value={newProject.clientEmail}
                            onChange={e => setNewProject({...newProject, clientEmail: e.target.value})}
                            placeholder="client@mail.com"
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all shadow-inner font-bold text-sm text-left ${
                              highlightedFields.clientEmail ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">تاريـخ البدء</Label>
                          <Input 
                            type="date"
                            value={newProject.startDate}
                            onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all shadow-inner font-bold text-sm ${
                              highlightedFields.startDate ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">تاريـخ الانتهاء (تقديري)</Label>
                          <Input 
                            type="date"
                            value={newProject.endDate}
                            onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                            className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all shadow-inner font-bold text-sm ${
                              highlightedFields.endDate ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">الموقع الجغرافي (Google Maps Link)</Label>
                        <Input 
                          value={newProject.locationLink}
                          onChange={e => setNewProject({...newProject, locationLink: e.target.value})}
                          placeholder="https://maps.app.goo.gl/..."
                          className={`h-12 rounded-xl bg-slate-50 border-transparent transition-all shadow-inner font-bold text-sm text-left ${
                            highlightedFields.locationLink ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:border-primary/20 focus:bg-white'
                          }`}
                        />
                        {!validateLocationLink(newProject.locationLink) && (
                          <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1 pr-1 animate-pulse">
                            <AlertCircle className="w-3 h-3" /> رابط الخريطة غير صحيح (يجب أن يكون رابط خرائط جوجل)
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="font-black text-slate-500 text-[11px] uppercase tracking-wider pr-1">نطاق العمل الفني والملاحظات</Label>
                        <textarea 
                          value={newProject.description}
                          onChange={e => setNewProject({...newProject, description: e.target.value})}
                          rows={3}
                          placeholder="أدخل المواصفات الفنية للوحات، نوع الحديد، الاكريليك، تفاصيل الطباعة والتغليف..."
                          className={`w-full rounded-2xl bg-slate-50 border-transparent shadow-inner font-bold p-4 text-sm focus:ring-0 transition-all ${
                            highlightedFields.description ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 border-emerald-500/20' : 'focus:bg-white focus:border-primary/20'
                          }`}
                        />
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-2 border-r-4 border-purple-500 pr-3 mb-2">
                        <span className="text-xs font-black text-slate-900 uppercase">الخطوة 4: المرفقات والتحليل الذكي (عقود، مخططات، لوحات)</span>
                      </div>

                      {/* Upload Box */}
                      <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 text-center bg-slate-50/50 relative hover:bg-slate-50 transition-all group">
                        <input 
                          type="file" 
                          multiple 
                          onChange={e => {
                            if (e.target.files) {
                              const filesArray = Array.from(e.target.files).map(file => ({
                                id: Math.random().toString(36).substring(7),
                                file,
                                progress: 0,
                                status: 'pending' as const
                              }));
                              setSelectedFiles(prev => [...prev, ...filesArray]);
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <div className="flex flex-col items-center gap-3 relative z-0">
                          <div className="h-16 w-16 bg-white rounded-3xl border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors shadow-sm">
                            <UploadCloud className="w-8 h-8" />
                          </div>
                          <div>
                            <p className="font-black text-slate-700 text-sm">اسحب المرفقات هنا أو انقر للاختيار</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-1">يمكنك رفع صور فنية للموقع أو ملفات عقود وعروض أسعار بصيغة PDF</p>
                          </div>
                        </div>
                      </div>

                      {/* Files list */}
                      {selectedFiles.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المستندات والمرفقات المختارة ({selectedFiles.length})</p>
                          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                            {selectedFiles.map((item) => {
                              const isImage = item.file.type.startsWith('image/');
                              const isPdf = item.file.type === 'application/pdf';
                              const canAnalyze = isImage || isPdf;

                              return (
                                <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between shadow-sm">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                                      <Paperclip className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 text-right">
                                      <p className="text-xs font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[300px]">{item.file.name}</p>
                                      <p className="text-[9px] text-slate-400 font-bold">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {canAnalyze && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={analyzingFileId !== null}
                                        onClick={() => handleAnalyzeFile(item.id)}
                                        className="h-8 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[10px] border-none shadow-none flex items-center gap-1.5"
                                      >
                                        {analyzingFileId === item.id ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            جاري التحليل...
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
                                            تحليل بالذكاء الاصطناعي 🧠
                                          </>
                                        )}
                                      </Button>
                                    )}

                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setSelectedFiles(prev => prev.filter(f => f.id !== item.id))}
                                      className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* أزرار التحكم بالخطوات والاعتماد */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
                <div>
                  {activeStep > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSavingProject}
                      onClick={() => setActiveStep(prev => prev - 1)}
                      className="h-12 px-6 rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                      السابق
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {activeStep < 4 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        // التحقق من الحقول المطلوبة قبل الانتقال للخطوات التالية
                        if (activeStep === 1) {
                          if (!newProject.title) {
                            toast.error("يرجى إدخال عنوان المشروع قبل الانتقال");
                            return;
                          }
                        }
                        if (activeStep === 2) {
                          if (!newProject.supervisor) {
                            toast.error("يرجى اختيار المشرف المسؤول قبل الانتقال");
                            return;
                          }
                        }
                        if (activeStep === 3) {
                          if (newProject.clientPhone && !validatePhone(newProject.clientPhone)) {
                            toast.error("يرجى تصحيح رقم هاتف العميل ليطابق التنسيق السعودي (05xxxxxxxx)");
                            return;
                          }
                          if (newProject.locationLink && !validateLocationLink(newProject.locationLink)) {
                            toast.error("يرجى تصحيح رابط موقع المشروع (يجب أن يكون رابطاً صالحاً لخرائط جوجل)");
                            return;
                          }
                        }
                        setActiveStep(prev => prev + 1);
                      }}
                      className="h-12 px-8 rounded-xl bg-slate-900 hover:bg-primary text-white font-black text-sm transition-all flex items-center gap-2"
                    >
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      type="button"
                      onClick={handleCreateProject}
                      disabled={isSavingProject}
                      className="h-14 px-8 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-black text-base shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                    >
                      {isSavingProject ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          جاري تأسيس المشروع...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          اعتماد وتأسيس المشروع
                        </>
                      )}
                    </Button>
                  )}
                </div>
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
