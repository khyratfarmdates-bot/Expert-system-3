import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronRight, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  Briefcase, 
  TrendingUp, 
  Shield, 
  CheckCircle2, 
  Star,
  Activity,
  History,
  FileText,
  CreditCard,
  Target,
  Award,
  Zap,
  Loader2,
  Trash2,
  AlertTriangle,
  MapPin,
  Plus,
  Minus,
  Plane,
  Fingerprint,
  Download
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  orderBy, 
  doc, 
  getDoc,
  limit,
  addDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { sendNotification } from '@/lib/notifications';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import SmartAttendance from './SmartAttendance';

interface EmployeeProfileProps {
  employeeId: string;
  onBack: () => void;
}

export default function EmployeeProfile({ employeeId, onBack }: EmployeeProfileProps) {
  const { profile: loggedInProfile } = useAuth();
  const [employee, setEmployee] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);
  
  const [noteContent, setNoteContent] = useState('');
  const [specialRequestContent, setSpecialRequestContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [attendanceForm, setAttendanceForm] = useState({ date: new Date().toISOString().split('T')[0], status: 'present', note: '' });
  const [leaveForm, setLeaveForm] = useState({ type: 'annual', startDate: '', endDate: '', reason: '' });
  const [adjustmentForm, setAdjustmentForm] = useState({ type: 'deduction', amount: '', reason: '' });
  const [loanForm, setLoanForm] = useState({ amount: '', reason: '' });

  useEffect(() => {
    setLoading(true);
    const fetchEmployee = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', employeeId));
        if (docSnap.exists()) {
          setEmployee({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error('الموظف غير موجود');
          onBack();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();

    // Listen to activities
    const qAct = query(
      collection(db, 'activities'),
      where('userId', '==', employeeId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    // Listen to attendance
    const qAtt = query(
      collection(db, 'attendance'),
      where('userId', '==', employeeId),
      orderBy('date', 'desc'),
      limit(30)
    );

    // Listen to leaves
    const qLeaves = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', employeeId),
      orderBy('startDate', 'desc')
    );

    // Listen to adjustments
    const qAdj = query(
      collection(db, 'financialAdjustments'),
      where('userId', '==', employeeId),
      orderBy('date', 'desc')
    );

    const unsubAct = onSnapshot(qAct, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAtt = onSnapshot(qAtt, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLeaves = onSnapshot(qLeaves, (snapshot) => {
      setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAdj = onSnapshot(qAdj, (snapshot) => {
      setAdjustments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubAct();
      unsubAtt();
      unsubLeaves();
      unsubAdj();
    };
  }, [employeeId]);

  const handleAddAttendance = async () => {
    if (!attendanceForm.date) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'attendance'), {
        ...attendanceForm,
        userId: employeeId,
        timestamp: serverTimestamp(),
        createdBy: loggedInProfile?.uid
      });

      await sendNotification({
        title: 'تسجيل حضور يدوي',
        message: `قام ${loggedInProfile?.name} بتسجيل حضور لـ ${employee?.name} بتاريخ ${attendanceForm.date}`,
        type: 'info',
        category: 'employee',
        targetRole: 'manager',
        tab: 'attendance_manager',
        priority: 'medium'
      });

      setIsAttendanceDialogOpen(false);
      toast.success('تم تسجيل الحضور بنجاح');
    } catch (e) {
      toast.error('فشل في تسجيل الحضور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leaveRequests'), {
        ...leaveForm,
        userId: employeeId,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      await sendNotification({
        title: 'طلب إجازة جديد',
        message: `قام الموظف ${employee?.name} بطلب إجازة ${leaveForm.type} من ${leaveForm.startDate}`,
        type: 'approval',
        category: 'employee',
        targetRole: 'manager',
        tab: 'approvals',
        priority: 'high'
      });

      setIsLeaveDialogOpen(false);
      toast.success('تم إرسال طلب الإجازة');
    } catch (e) {
      toast.error('فشل في إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!adjustmentForm.amount || !adjustmentForm.reason) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'financialAdjustments'), {
        ...adjustmentForm,
        amount: Number(adjustmentForm.amount),
        userId: employeeId,
        date: serverTimestamp(),
        status: 'pending',
        createdBy: loggedInProfile?.uid
      });

      await sendNotification({
        title: 'تعديل مالي موظف',
        message: `تمت إضافة ${adjustmentForm.type === 'bonus' ? 'مكافأة' : 'خصم'} لـ ${employee?.name} بقيمة ${adjustmentForm.amount}`,
        type: adjustmentForm.type === 'bonus' ? 'success' : 'warning',
        category: 'financial',
        targetRole: 'manager',
        tab: 'financials',
        priority: 'high'
      });

      setIsAdjustmentDialogOpen(false);
      toast.success('تمت إضافة الحركة المالية بنجاح');
    } catch (e) {
      toast.error('فشل في إضافة الحركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestLoan = async () => {
    if (!loanForm.amount || !loanForm.reason) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'financialAdjustments'), {
        type: 'loan',
        amount: Number(loanForm.amount),
        reason: loanForm.reason,
        userId: employeeId,
        date: serverTimestamp(),
        status: 'pending',
        createdBy: loggedInProfile?.uid
      });

      await sendNotification({
        title: 'طلب سلفة جديد',
        message: `الموظف ${employee?.name} طلب سلفة بقيمة ${loanForm.amount} ر.س لسبب: ${loanForm.reason}`,
        type: 'warning',
        category: 'financial',
        targetRole: 'manager',
        tab: 'approvals',
        priority: 'high'
      });

      setLoanForm({ amount: '', reason: '' });
      setIsAdjustmentDialogOpen(false);
      toast.success('تم إرسال طلب السلفة بنجاح');
    } catch (e) {
      toast.error('فشل في إرسال طلب السلفة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSpecialRequest = async () => {
    if (!specialRequestContent.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'activities'), {
        title: 'طلب خاص من الموظف',
        description: specialRequestContent,
        type: 'warning',
        source: 'employee_request',
        userId: employeeId,
        timestamp: serverTimestamp(),
        createdBy: loggedInProfile?.uid,
        status: 'pending'
      });
      
      await sendNotification({
        title: 'طلب خاص من موظف',
        message: `الموظف ${employee?.name} أرسل طلباً خاصاً: ${specialRequestContent.slice(0, 50)}...`,
        type: 'warning',
        category: 'employee',
        targetRole: 'manager',
        tab: 'projects',
        priority: 'high'
      });

      setSpecialRequestContent('');
      setIsSpecialRequestDialogOpen(false);
      toast.success('تم إرسال طلبك الخاص بنجاح');
    } catch (e) {
      toast.error('فشل في إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = useMemo(() => {
    const base = employee.salary || employee.baseSalary || 0;
    const bonusTotal = adjustments.filter(a => a.type === 'bonus').reduce((acc, a) => acc + a.amount, 0);
    const deductionTotal = adjustments.filter(a => a.type === 'deduction').reduce((acc, a) => acc + a.amount, 0);
    return {
      base,
      bonuses: bonusTotal,
      deductions: deductionTotal,
      net: base + bonusTotal - deductionTotal
    };
  }, [employee, adjustments]);

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'activities'), {
        title: 'ملاحظة إدارية',
        description: noteContent,
        type: 'info',
        source: 'employee',
        userId: employeeId,
        timestamp: serverTimestamp(),
        createdBy: loggedInProfile?.uid || 'admin'
      });

      await sendNotification({
        title: 'تحديث في ملف الموظف',
        message: `تمت إضافة ملاحظة إدارية جديدة لملف ${employee?.name}: ${noteContent}`,
        type: 'info',
        category: 'employee',
        targetRole: 'manager',
        tab: 'employees',
        priority: 'low'
      });

      setNoteContent('');
      setIsNoteDialogOpen(false);
      toast.success('تمت إضافة الملاحظة لملف الموظف');
    } catch (e) {
      toast.error('فشل في إضافة الملاحظة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const performanceData = useMemo(() => [
    { name: 'Jan', value: 65 },
    { name: 'Feb', value: 72 },
    { name: 'Mar', value: 85 },
    { name: 'Apr', value: 82 },
    { name: 'May', value: 90 },
    { name: 'Jun', value: 95 },
  ], []);

  if (loading || !employee) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold italic underline decoration-accent underline-offset-4 animate-pulse">جاري سحب الملف الشخصي الذكي...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {loggedInProfile?.uid === employeeId && (
        <SmartAttendance />
      )}
      {/* Header Profile Section */}
      <div className="relative group overflow-hidden rounded-3xl bg-white border shadow-sm p-4 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:bg-accent/10 transition-colors duration-700" />
        
        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
          <Button 
            onClick={onBack} 
            variant="ghost" 
            size="icon" 
            className="absolute -top-2 -right-2 md:top-0 md:right-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200"
          >
            <ChevronRight className="w-5 h-5 text-primary" />
          </Button>

          <div className="relative">
            <Avatar className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl ring-2 ring-slate-100">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${employee.name}`} />
              <AvatarFallback className="bg-primary text-white text-3xl font-black">{employee.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-4 border-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg" title="نشط الآن">
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-right">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h1 className="text-3xl font-black text-primary tracking-tight">{employee.name}</h1>
              <Badge className="w-fit mx-auto md:mx-0 bg-accent text-white border-none px-3 py-1 text-xs font-bold shadow-sm">
                ID: #{employee.id.slice(0, 6).toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
              <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-full text-[13px] font-bold text-slate-600">
                <Briefcase className="w-3.5 h-3.5" />
                {employee.role === 'manager' ? 'مدير عام' : employee.role === 'supervisor' ? 'مشرف ميداني' : 'موظف تنفيذ'}
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full text-[13px] font-bold text-blue-600 border border-blue-100">
                <Shield className="w-3.5 h-3.5" />
                قسم {employee.department || 'الإنتاج'}
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full text-[13px] font-bold text-emerald-600 border border-emerald-100">
                <Calendar className="w-3.5 h-3.5" />
                منذ {employee.joinedAt ? new Date(employee.joinedAt).toLocaleDateString('ar-SA') : 'البداية'}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
              {loggedInProfile?.uid === employeeId ? (
                <>
                  <Button onClick={() => setIsLeaveDialogOpen(true)} className="rounded-xl gap-2 font-black h-11 px-6 bg-blue-600 hover:bg-blue-700 shadow-md">
                    <Plane className="w-4 h-4" />
                    طلب إجازة
                  </Button>
                  <Button onClick={() => { setAdjustmentForm({ ...adjustmentForm, type: 'loan' }); setIsAdjustmentDialogOpen(true); }} className="rounded-xl gap-2 font-black h-11 px-6 bg-amber-600 hover:bg-amber-700 shadow-md">
                    <CreditCard className="w-4 h-4" />
                    طلب سلفة
                  </Button>
                  <Button onClick={() => setIsSpecialRequestDialogOpen(true)} className="rounded-xl gap-2 font-black h-11 px-6 bg-zinc-800 hover:bg-zinc-900 shadow-md">
                    <Zap className="w-4 h-4" />
                    طلب خاص
                  </Button>
                </>
              ) : (
                <>
                  {(loggedInProfile?.role === 'manager' || loggedInProfile?.role === 'supervisor') && (
                    <Button onClick={() => setIsNoteDialogOpen(true)} className="rounded-xl gap-2 font-black h-11 px-6 bg-primary hover:bg-zinc-800 shadow-md">
                      <Activity className="w-4 h-4" />
                      إضافة تحديث للملف
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-xl gap-2 font-bold h-11 px-6 border-slate-200 hover:bg-slate-50">
                    <Mail className="w-4 h-4" />
                    مراسلة الموظف
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:grid grid-cols-2 gap-4 w-72">
            <Card className="rounded-2xl border-none bg-slate-50/50 p-4 shadow-none">
              <p className="text-[10px] text-muted-foreground font-black uppercase">التواجد الشهري</p>
              <p className="text-xl font-black text-primary mt-1">98%</p>
              <div className="mt-2 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '98%' }} />
              </div>
            </Card>
            <Card className="rounded-2xl border-none bg-slate-50/50 p-4 shadow-none">
              <p className="text-[10px] text-muted-foreground font-black uppercase">التقييم العام</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-xl font-black text-primary">4.9</span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar: Performance & Details */}
        <div className="space-y-6">
          <Card className="rounded-3xl shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                تتبع الأداء الذكي
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelStyle={{ display: 'none' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-lg text-white">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-800">تحليل الذكاء الاصطناعي</p>
                  <p className="text-[11px] text-emerald-600">موظف متميز، يحافظ على مستوى تصاعدي في الأداء خلال الربع الحالي.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                أهداف الموظف الحالية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoalItem title="إنجاز مشاريع ابريل" progress={85} />
              <GoalItem title="تقليل الهدر في المواد" progress={40} color="bg-amber-500" />
              <GoalItem title="تسليم 10 تصاميم" progress={100} color="bg-emerald-500" />
            </CardContent>
          </Card>
        </div>

        {/* Main Area: Tabs & Tables */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className={`w-full max-w-2xl bg-slate-100 p-1 rounded-2xl grid ${loggedInProfile?.role === 'manager' ? 'grid-cols-6' : 'grid-cols-5'}`}>
              <TabsTrigger value="activity" className="rounded-xl font-bold py-2.5">
                النشاطات
              </TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-xl font-bold py-2.5 text-xs">
                الحضور
              </TabsTrigger>
              <TabsTrigger value="leaves" className="rounded-xl font-bold py-2.5 text-xs">
                الإجازات
              </TabsTrigger>
              {loggedInProfile?.role === 'manager' && (
                <TabsTrigger value="finance" className="rounded-xl font-bold py-2.5 text-xs">
                  المالية
                </TabsTrigger>
              )}
              <TabsTrigger value="docs" className="rounded-xl font-bold py-2.5 text-xs">
                الوثائق
              </TabsTrigger>
              <TabsTrigger value="info" className="rounded-xl font-bold py-2.5">
                التفاصيل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-primary">سجل النشاط العام</h3>
                <Button onClick={() => setIsNoteDialogOpen(true)} variant="outline" size="sm" className="rounded-xl gap-2 font-bold">
                  <Plus className="w-4 h-4" />
                  إضافة ملاحظة
                </Button>
              </div>
              {activities.length > 0 ? (
                activities.map((act) => (
                  <div key={act.id} className="group relative bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:border-primary/20 transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl ${
                        act.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
                        act.type === 'warning' ? 'bg-amber-50 text-amber-600' : 
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {act.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <History className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-black text-primary text-sm">{act.title}</h4>
                          <span className="text-[10px] text-muted-foreground font-bold" dir="ltr">
                            {act.timestamp?.toDate?.()?.toLocaleString('ar-SA') || 'منذ قليل'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{act.description}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-muted-foreground">لا توجد نشاطات مسجلة مؤخراً</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="attendance" className="mt-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-primary">سجل الحضور والانصراف</h3>
                  <p className="text-xs text-muted-foreground font-bold">مراجعة ساعات العمل والالتزام</p>
                </div>
                <Button onClick={() => setIsAttendanceDialogOpen(true)} className="rounded-xl gap-2 font-black bg-primary">
                  <Fingerprint className="w-4 h-4" />
                  تسجيل اليدوي
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AttendanceStatCard label="أيام الحضور" value={attendance.filter(a => a.status === 'present').length} icon={CheckCircle2} color="text-emerald-600" />
                <AttendanceStatCard label="أيام الغياب" value={attendance.filter(a => a.status === 'absent').length} icon={AlertTriangle} color="text-red-500" />
                <AttendanceStatCard label="تأخير" value={attendance.filter(a => a.status === 'late').length} icon={Clock} color="text-amber-500" />
              </div>

              <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="text-[12px] font-bold">{att.date}</TableCell>
                        <TableCell>
                          <Badge className={`
                            ${att.status === 'present' ? 'bg-emerald-50 text-emerald-700' : 
                              att.status === 'absent' ? 'bg-red-50 text-red-700' :
                              att.status === 'late' ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-50 text-slate-700'} border-none text-[10px]
                          `}>
                            {att.status === 'present' ? 'حاضر' : att.status === 'absent' ? 'غائب' : att.status === 'late' ? 'متأخر' : 'درجة'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{att.note || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="leaves" className="mt-6 space-y-6">
               <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-primary">نظام الإجازات</h3>
                  <p className="text-xs text-muted-foreground font-bold">إدارة طلبات الموظف وأرصدة الإجازات</p>
                </div>
                <Button onClick={() => setIsLeaveDialogOpen(true)} className="rounded-xl gap-2 font-black bg-blue-600 hover:bg-blue-700">
                  <Plane className="w-4 h-4" />
                  طلب إجازة جديدة
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {leaves.map((leave) => (
                   <Card key={leave.id} className="p-4 rounded-2xl border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-primary">إجازة {leave.type === 'annual' ? 'سنوية' : leave.type === 'sick' ? 'مرضية' : 'اضطرارية'}</p>
                          <p className="text-[11px] text-muted-foreground font-bold">من {leave.startDate} إلى {leave.endDate}</p>
                        </div>
                      </div>
                      <Badge className={`
                        ${leave.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 
                          leave.status === 'rejected' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'} border-none text-[10px]
                      `}>
                        {leave.status === 'approved' ? 'معتمدة' : leave.status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة'}
                      </Badge>
                   </Card>
                 ))}
              </div>
            </TabsContent>

            <TabsContent value="docs" className="mt-6 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-primary">المستندات والوثائق الرقمية</h3>
                  <p className="text-xs text-muted-foreground font-bold">الأرشيف الرقمي لثبوتيات الموظف</p>
                </div>
                {employee.isSponsored && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-none px-3 py-1 font-black">على الكفالة</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DocumentCard 
                  title="الإقامة الرسمية" 
                  number={employee.iqamaNumber}
                  expiry={employee.iqamaExpiry} 
                  image={employee.iqamaPhotoURL} 
                  icon={Shield}
                />
                <DocumentCard 
                  title="رخصة القيادة" 
                  number={employee.drivingLicenseNumber}
                  expiry={employee.drivingLicenseExpiry} 
                  image={employee.drivingLicensePhotoURL} 
                  icon={Briefcase}
                />
                <DocumentCard 
                  title="جواز السفر" 
                  number={employee.passportNumber}
                  expiry={employee.passportExpiry} 
                  image={employee.passportPhotoURL} 
                  icon={Plane}
                />
                <Card className="rounded-2xl border-border bg-emerald-50/30 overflow-hidden group">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-primary">عقد العمل الموثق</h4>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Digital Work Contract</p>
                      </div>
                    </div>
                    {employee.contractURL ? (
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-2 font-black" onClick={() => window.open(employee.contractURL, '_blank')}>
                        <Download className="w-4 h-4" />
                        استعراض العقد PDF
                      </Button>
                    ) : (
                      <div className="text-center py-4 text-xs font-bold text-slate-400 italic">لا يوجد نسخة رقمية للعقد</div>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="finance" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <Card className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-all" />
                    <Zap className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
                    <p className="text-[10px] opacity-70 font-bold uppercase">صافي المستحقات الحالي</p>
                    <h3 className="text-3xl font-black mt-2">{totals.net.toLocaleString()} <span className="text-sm font-normal">ر.س</span></h3>
                    <div className="mt-6 flex items-center justify-between">
                       <Badge className="bg-white/20 hover:bg-white/30 text-white border-none rounded-lg font-bold">الراتب الشهري: {totals.base.toLocaleString()} ر.س</Badge>
                       <CreditCard className="w-6 h-6 opacity-30" />
                    </div>
                 </Card>
                 <Card className="bg-accent text-white rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/10 transition-all" />
                    <Award className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
                    <p className="text-[10px] opacity-70 font-bold uppercase">الخصميات / البدلات</p>
                    <div className="flex items-end gap-3 mt-2">
                       <h3 className="text-3xl font-black text-amber-300">-{totals.deductions.toLocaleString()}</h3>
                       <h3 className="text-3xl font-black text-emerald-300">+{totals.bonuses.toLocaleString()}</h3>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                       <Button onClick={() => setIsAdjustmentDialogOpen(true)} variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-none rounded-lg h-8 font-black">إضافة حركة مالية</Button>
                       <TrendingUp className="w-6 h-6 opacity-30" />
                    </div>
                 </Card>
              </div>

              <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
                <CardHeader className="border-b py-4 bg-slate-50/50">
                  <CardTitle className="text-sm font-bold">سجل الحركات والتعديلات المالية</CardTitle>
                </CardHeader>
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-right">الحركة</TableHead>
                      <TableHead className="text-right">السبب</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adj) => (
                      <TableRow key={adj.id}>
                        <TableCell>
                          <Badge className={`${adj.type === 'bonus' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'} border-none text-[10px]`}>
                            {adj.type === 'bonus' ? 'مكافأة' : adj.type === 'deduction' ? 'خصم' : 'سلفة'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px] font-bold">{adj.reason}</TableCell>
                        <TableCell className={`text-[12px] font-black ${adj.type === 'bonus' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {adj.type === 'bonus' ? '+' : '-'}{adj.amount.toLocaleString()} ر.س
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-bold" dir="ltr">
                           {adj.date?.toDate?.()?.toLocaleDateString('ar-SA') || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="info" className="mt-6">
               <Card className="rounded-3xl shadow-sm border-border p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <InfoItem label="الاسم الرباعي" value={employee.name} icon={FileText} />
                     <InfoItem label="البريد الإلكتروني" value={employee.email} icon={Mail} />
                     <InfoItem label="المسمى الوظيفي" value={employee.role} icon={Briefcase} />
                     <InfoItem label="الراتب الشهري" value={`${(employee.salary || 0).toLocaleString()} ر.س`} icon={CreditCard} />
                     <InfoItem label="رقم الجوال" value="+966 50 XXX XXXX" icon={Phone} />
                     <InfoItem label="العنوان / الفرع" value="الرياض - حي الرائد" icon={MapPin} />
                     <InfoItem label="تاريخ مباشرة العمل" value={employee.joinedAt ? new Date(employee.joinedAt).toLocaleDateString() : '-'} icon={Calendar} />
                  </div>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">إضافة تحديث لملف الموظف</DialogTitle>
            <DialogDescription>سيتم تسجيل هذا التحديث كجزء من السجل التاريخي للموظف.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>نص الملاحظة / التحديث</Label>
              <Input 
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="مثلاً: الموظف أنجز مهمته قبل الموعد المحدد..."
                className="h-12 rounded-xl text-right"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleAddNote}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-primary hover:bg-black font-black"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'توثيق التحديث الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">تسجيل حضور/انصراف يدوي</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input 
                type="date"
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({...attendanceForm, date: e.target.value})}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={attendanceForm.status} onValueChange={(v) => setAttendanceForm({...attendanceForm, status: v})}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">حاضر</SelectItem>
                  <SelectItem value="absent">غائب</SelectItem>
                  <SelectItem value="late">متأخر</SelectItem>
                  <SelectItem value="excused">إجازة/عذر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظة</Label>
              <Input 
                value={attendanceForm.note}
                onChange={(e) => setAttendanceForm({...attendanceForm, note: e.target.value})}
                placeholder="أضف ملاحظة (اختياري)..."
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddAttendance} disabled={isSubmitting} className="w-full h-11 rounded-xl font-black">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ السجل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">إضافة طلب إجازة</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>نوع الحجازة</Label>
              <Select value={leaveForm.type} onValueChange={(v) => setLeaveForm({...leaveForm, type: v})}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">سنوية</SelectItem>
                  <SelectItem value="sick">مرضية</SelectItem>
                  <SelectItem value="emergency">اضطرارية</SelectItem>
                  <SelectItem value="unpaid">بدون راتب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>بدءاً من</Label>
                <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({...leaveForm, startDate: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>حتى تاريخ</Label>
                <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({...leaveForm, endDate: e.target.value})} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>السبب</Label>
              <Input value={leaveForm.reason} onChange={(e) => setLeaveForm({...leaveForm, reason: e.target.value})} placeholder="أدخل سبب الإجازة..." className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddLeave} disabled={isSubmitting} className="w-full h-11 rounded-xl font-black bg-blue-600">
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إرسال الطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">
              {adjustmentForm.type === 'loan' ? 'طلب سلفة مالية' : 'تعديل مالي (خصم/مكافأة)'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
             {adjustmentForm.type !== 'loan' && (
               <div className="flex gap-4">
                  <Button 
                    onClick={() => setAdjustmentForm({...adjustmentForm, type: 'bonus'})}
                    variant={adjustmentForm.type === 'bonus' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl gap-2 font-black"
                  >
                    <Plus className="w-4 h-4" /> مكافأة
                  </Button>
                  <Button 
                    onClick={() => setAdjustmentForm({...adjustmentForm, type: 'deduction'})}
                    variant={adjustmentForm.type === 'deduction' ? 'default' : 'outline'}
                    className="flex-1 rounded-xl gap-2 font-black"
                  >
                    <Minus className="w-4 h-4" /> خصم
                  </Button>
               </div>
             )}
             
             <div className="space-y-2">
                <Label>المبلغ (ر.س)</Label>
                <Input 
                  type="number" 
                  value={adjustmentForm.type === 'loan' ? loanForm.amount : adjustmentForm.amount} 
                  onChange={(e) => adjustmentForm.type === 'loan' ? setLoanForm({...loanForm, amount: e.target.value}) : setAdjustmentForm({...adjustmentForm, amount: e.target.value})} 
                  placeholder="0.00" 
                  className="rounded-xl" 
                />
             </div>
             <div className="space-y-2">
                <Label>{adjustmentForm.type === 'loan' ? 'سبب طلب السلفة' : 'السبب / المبرر'}</Label>
                <Input 
                  value={adjustmentForm.type === 'loan' ? loanForm.reason : adjustmentForm.reason} 
                  onChange={(e) => adjustmentForm.type === 'loan' ? setLoanForm({...loanForm, reason: e.target.value}) : setAdjustmentForm({...adjustmentForm, reason: e.target.value})} 
                  placeholder={adjustmentForm.type === 'loan' ? "لماذا تحتاج السلفة؟" : "مثلاً: تأخير متكرر / عمل إضافي..."} 
                  className="rounded-xl" 
                />
             </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={adjustmentForm.type === 'loan' ? handleRequestLoan : handleAddAdjustment} 
              disabled={isSubmitting} 
              className="w-full h-11 rounded-xl font-black bg-primary"
            >
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (adjustmentForm.type === 'loan' ? 'إرسال طلب السلفة' : 'اعتماد الحركة المالية')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Special Request Dialog */}
      <Dialog open={isSpecialRequestDialogOpen} onOpenChange={setIsSpecialRequestDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">رفع طلب خاص للإدارة</DialogTitle>
            <DialogDescription>سيصل طلبك مباشرة للمدير العام للمراجعة.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>محتوى الطلب</Label>
              <Input 
                value={specialRequestContent}
                onChange={(e) => setSpecialRequestContent(e.target.value)}
                placeholder="اكتب طلبك هنا بالتفصيل..."
                className="h-24 rounded-xl text-right"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleAddSpecialRequest}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-zinc-800 hover:bg-black font-black"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إرسال الطلب الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceStatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-4 rounded-2xl border-slate-100 flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-slate-50 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground font-bold uppercase">{label}</p>
        <p className="text-xl font-black text-primary">{value} <span className="text-xs font-normal">أيام</span></p>
      </div>
    </Card>
  );
}

function GoalItem({ title, progress, color = 'bg-primary' }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span>{title}</span>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-4 group">
      <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-300">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">{label}</label>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function DocumentCard({ title, number, expiry, image, icon: Icon }: any) {
  const isExpired = expiry && new Date(expiry) < new Date();
  
  return (
    <Card className={`rounded-2xl border-border overflow-hidden transition-all hover:shadow-md ${isExpired ? 'border-red-200 bg-red-50/10' : ''}`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl shadow-sm ${isExpired ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-primary'}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h4 className="font-black text-primary leading-tight">{title}</h4>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {number && <p className="text-[10px] font-bold text-primary/60">رقم: {number}</p>}
                <p className={`text-[11px] font-bold ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
                  {expiry ? `ينتهي في: ${expiry}` : 'تاريخ الصلاحية غير متوفر'}
                </p>
              </div>
            </div>
          </div>
          {isExpired && (
            <Badge variant="destructive" className="text-[9px] font-black animate-pulse">منتهية</Badge>
          )}
        </div>
        
        {image ? (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-slate-100 group">
            <img src={image} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <Button variant="secondary" size="sm" className="rounded-lg gap-2 font-bold" onClick={() => window.open(image, '_blank')}>
                 <Activity className="w-4 h-4" />
                 عرض الحجم الكامل
               </Button>
            </div>
          </div>
        ) : (
          <div className="aspect-[16/9] rounded-xl bg-slate-50 border border-dashed flex flex-col items-center justify-center gap-2 text-slate-300">
            <Icon className="w-8 h-8 opacity-20" />
            <span className="text-[10px] font-bold">بانتظار الرفع</span>
          </div>
        )}
      </div>
    </Card>
  );
}
