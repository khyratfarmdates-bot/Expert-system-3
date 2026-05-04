import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Plus, 
  Save, 
  Trash2, 
  Loader2, 
  Building2, 
  Settings as SettingsIcon, 
  Globe, 
  Radius,
  ShieldCheck,
  Building,
  CreditCard,
  Wallet,
  Database,
  Trash,
  Volume2,
  ShieldAlert,
  RefreshCw,
  Paintbrush,
  Palette,
  Home,
  Mail,
  Send
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc, 
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch,
  where
} from 'firebase/firestore';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { BankAccount } from '../types';
import { useAuth } from '../lib/AuthContext';
import { sendNotification } from '../lib/notifications';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SystemSettings() {
  const { user, profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'attendance' | 'ai' | 'locations' | 'banks' | 'theme' | 'data'>('general');
  const [showHub, setShowHub] = useState(true);
  const [offices, setOffices] = useState<any[]>([]);
  const [housing, setHousing] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Locations State
  const [newOffice, setNewOffice] = useState({
    name: '',
    type: 'office',
    latitude: '',
    longitude: '',
    address: ''
  });

  // Bank Account State
  const [newAccount, setNewAccount] = useState({
    name: '',
    iban: '',
    type: 'bank' as 'bank' | 'cash',
    initialBalance: '0'
  });

  // Global Settings State
  const [settings, setSettings] = useState({
    companyName: 'خبراء الرسم',
    companySub: 'للمقاولات والديكور',
    language: 'ar',
    attendanceRadius: 100,
    allowManualAttendance: false,
    currency: 'SAR',
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    taxRate: 15,
    taxNumber: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    logoUrl: 'https://i.imgur.com/yYZDeHZ.jpg',
    allowOvertime: false,
    weekendDays: 'الجمعة والسبت',
    sidebarColor: '#1a4d4e',
    primaryColor: '#2c7a7d',
    enableSmartSupplierMatching: true,
    calendarType: 'gregorian',

    enableAutoCategorization: true,
    housingLocations: [],
    emailTemplates: {
      payroll: {
        subject: 'إشعار صرف راتب - {month}',
        body: 'عزيزي الموظف {name}، تم إيداع راتبك لشهر {month} في حسابك البنكي بنجاح.\n\nنتمنى لك دوام التوفيق والنجاح.',
        enabled: true
      },
      welcome: {
        subject: 'مرحباً بك في {companyName}',
        body: 'أهلاً بك {name} في فريق عملنا.\n\nيسعدنا انضمامك لأسرة {companyName}. تم تفعيل حسابك على النظام الإداري بنجاح.',
        enabled: true
      },
      expiry: {
        subject: 'تنبيه انتهاء وثيقة: {documentName}',
        body: 'عزيزي {name}، نود تذكيركم بأن وثيقة {documentName} ستنتهي بتاريخ {expiryDate}. يرجى اتخاذ الإجراء اللازم.',
        enabled: true
      }
    },
    briefingSettings: {
      includeFinance: true,
      includeAttendance: true,
      includeProjects: true,
      includePurchases: true,
      voiceSpeed: 1,
      voicePitch: 1
    }
  });

  useEffect(() => {
    // Load Locations
    const unsubOffices = onSnapshot(
      query(collection(db, 'offices'), orderBy('name', 'asc')),
      (snapshot) => {
        setOffices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );

    // Load Global Settings
    const loadSettings = async () => {
      const docRef = doc(db, 'system', 'settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({ ...prev, ...data }));
        if (data.housingLocations) setHousing(data.housingLocations);
      }
    };
    loadSettings();

    // Load Bank Accounts
    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
    });

    return () => {
      unsubOffices();
      unsubBanks();
    };
  }, []);

  const handleSaveSettings = async () => {
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'system', 'settings'), {
        ...settings,
        updatedAt: new Date().toISOString()
      });

      await sendNotification({
        title: 'تحديث إعدادات النظام',
        message: `قام ${profile?.name} بتعديل إعدادات النظام العامة أو ألوان الهوية`,
        type: 'info',
        category: 'system',
        targetRole: 'manager',
        priority: 'medium'
      });

      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSystemReset = async () => {
    if (!user) return;
    setIsSubmitting(true);
    const loadingToast = toast.loading('جاري تنظيف النظام من البيانات التجريبية...');
    
    try {
      const collectionsToClear = [
        'projects', 
        'transactions', 
        'inventory', 
        'attendance', 
        'dailyLogs', 
        'notifications', 
        'workerTransactions', 
        'workers', 
        'subcontractors',
        'activities'
      ];

      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // Special case for users: Keep only the current admin
      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '!=', user.email?.toLowerCase())));
      const userBatch = writeBatch(db);
      userSnap.docs.forEach((d) => userBatch.delete(d.ref));
      await userBatch.commit();

      toast.dismiss(loadingToast);
      toast.success('تم تنظيف النظام بنجاح. يمكنك الآن البدء بإدخال البيانات الفعلية.');
      window.location.reload(); // Refresh to clear state
    } catch (error) {
      console.error("Reset Error:", error);
      toast.dismiss(loadingToast);
      toast.error('حدث خطأ أثناء تنظيف البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setIsSubmitting(true);
      const loadingToast = toast.loading('جاري مسح الذاكرة المؤقتة...');
      
      // 1. Clear Local Storage
      localStorage.clear();
      
      // 2. Clear Session Storage
      sessionStorage.clear();
      
      // 3. Clear Service Worker Caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      toast.dismiss(loadingToast);
      toast.success('تم مسح الذاكرة المؤقتة بنجاح، سيتم تحديث النظام', { icon: '🔄' });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء مسح الذاكرة المؤقتة');
      setIsSubmitting(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name) {
      toast.error('يرجى إدخال اسم الحساب');
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'bankAccounts'), {
        ...newAccount,
        initialBalance: parseFloat(newAccount.initialBalance) || 0,
        createdAt: serverTimestamp()
      });

      await sendNotification({
        title: 'حساب مالي جديد',
        message: `تمت إضافة حساب ${newAccount.name} (${newAccount.type}) إلى ميزانية المؤسسة`,
        type: 'success',
        category: 'financial',
        targetRole: 'manager',
        priority: 'medium'
      });

      toast.success('تمت إضافة الحساب بنجاح');
      setNewAccount({ name: '', iban: '', type: 'bank', initialBalance: '0' });
    } catch (e) {
      toast.error('فشل في إضافة الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    try {
      await deleteDoc(doc(db, 'bankAccounts', id));
      toast.success('تم حذف الحساب');
    } catch (error) {
      toast.error('فشل في حذف الحساب');
    }
  };

  const handleAddOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!newOffice.latitude || !newOffice.longitude) {
        throw new Error('يرجى تحديد الإحداثيات');
      }
      await addDoc(collection(db, 'offices'), {
        ...newOffice,
        latitude: parseFloat(newOffice.latitude),
        longitude: parseFloat(newOffice.longitude),
        createdAt: new Date().toISOString()
      });

      await sendNotification({
        title: 'إضافة مقر جديد',
        message: `تم تسجيل مقر جديد: ${newOffice.name}`,
        type: 'info',
        category: 'system',
        targetRole: 'manager',
        priority: 'low'
      });

      toast.success('تمت إضافة المقر بنجاح');
      setNewOffice({ name: '', type: 'office', latitude: '', longitude: '', address: '' });
    } catch (error: any) {
      toast.error(error.message || 'فشل في إضافة المقر');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOffice = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المقر؟')) return;
    try {
      await deleteDoc(doc(db, 'offices', id));
      toast.success('تم حذف المقر');
    } catch (error) {
      toast.error('فشل في حذف المقر');
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      toast.promise(
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setNewOffice(prev => ({
                ...prev,
                latitude: pos.coords.latitude.toString(),
                longitude: pos.coords.longitude.toString()
              }));
              resolve(pos);
            },
            reject
          );
        }),
        {
          loading: 'جاري تحديد موقعك الحالي...',
          success: 'تم التقاط الإحداثيات بنجاح',
          error: 'فشل في تحديد الموقع'
        }
      );
    }
  };

  const tabs = [
    { id: 'general', label: 'الإعدادات العامة', icon: Building2, roles: ['manager'] },
    { id: 'notifications', label: 'البريد والإشعارات', icon: Mail, roles: ['manager'] },
    { id: 'attendance', label: 'نظام الدوام', icon: SettingsIcon, roles: ['manager'] },
    { id: 'ai', label: 'الذكاء الاصطناعي', icon: Globe, roles: ['manager'] },
    { id: 'locations', label: 'المقرات والسكن', icon: MapPin, roles: ['manager'] },
    { id: 'banks', label: 'الحسابات البنكية', icon: CreditCard, roles: ['manager'] },
    { id: 'theme', label: 'ثيمي الخاص', icon: Paintbrush, roles: ['manager', 'supervisor', 'employee'] },
    { id: 'data', label: 'إدارة البيانات', icon: Database, roles: ['manager'] }
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(profile?.role || 'employee'));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm font-black text-slate-400">جاري تحميل إعدادات النظام...</p>
      </div>
    );
  }

  const renderBackHeader = (title: string, Icon: any) => (
    <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setShowHub(true)}
          className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-primary transition-all"
        >
          <RefreshCw className="w-6 h-6 rotate-180" />
        </Button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Icon className="w-7 h-7 text-primary" />
            {title}
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1">تخصيص الخيارات والإعدادات المتقدمة</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-black text-primary uppercase">وصول آمن للمدير</span>
      </div>
    </div>
  );

  if (showHub) {
    return (
      <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4" dir="rtl">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">إعدادات النظام</h1>
          <p className="text-slate-500 font-bold max-w-md mx-auto">تحكم في هوية المؤسسة، الأمان، والذكاء الاصطناعي من مكان واحد</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {visibleTabs.map((tab) => {
            return (
              <motion.div
                key={tab.id}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setShowHub(false);
                }}
                className="cursor-pointer group flex flex-col col-span-1"
              >
                <Card className="aspect-square border-none shadow-[0_10px_40px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all overflow-hidden relative flex flex-col rounded-2xl md:rounded-3xl">
                  <CardContent className="flex flex-col items-center justify-center h-full p-4 md:p-6 text-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl mb-4 flex items-center justify-center transition-all bg-slate-50 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary">
                      <tab.icon className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    
                    <h3 className="font-black text-slate-800 text-sm md:text-lg mb-1">
                      {tab.label}
                    </h3>
                    
                    <p className="text-[10px] md:text-xs font-bold text-slate-400 opacity-60 line-clamp-1">
                      {tab.id === 'general' && 'الهوية والبيانات'}
                      {tab.id === 'notifications' && 'القوالب والتنبيهات'}
                      {tab.id === 'attendance' && 'المعايير والدوام'}
                      {tab.id === 'ai' && 'تخصيص الذكاء'}
                      {tab.id === 'locations' && 'المواقع والسكن'}
                      {tab.id === 'banks' && 'الحسابات والمالية'}
                      {tab.id === 'theme' && 'الألوان والواجهة'}
                      {tab.id === 'data' && 'الأدوات والحذف'}
                    </p>

                    <div className="mt-4 flex items-center gap-2 text-primary font-black text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      دخول الآن <RefreshCw className="w-3 h-3 rotate-180" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="p-8 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden">
           <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-right">
                 <h4 className="text-2xl font-black text-amber-400 flex items-center justify-center md:justify-start gap-3">
                    <ShieldAlert className="w-7 h-7" /> ميزة النسخ المتقدم
                 </h4>
                 <p className="text-sm font-bold text-slate-300 max-w-lg">هل تريد أخذ نسخة كاملة من النظام الحالية أو نقل البيانات؟ تواصل مع الدعم الفني للحصول على صلاحيات التصدير الكاملة.</p>
              </div>
              <Button className="h-14 px-8 rounded-2xl bg-white text-slate-900 font-black hover:bg-amber-400 transition-all gap-3 shrink-0">
                 <Send className="w-5 h-5" /> تواصل مع الدعم
              </Button>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-32" dir="rtl">
      {/* Detail Pages Content Area */}
      <div className="flex-1 px-4">
        {activeTab === 'general' && (
        <div className="space-y-8">
          {renderBackHeader('الإعدادات العامة وهويتك', Building2)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="rounded-[2.5rem] border-none shadow-sm h-fit hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                هوية المؤسسة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">اسم المؤسسة</Label>
                <Input 
                  value={settings.companyName}
                  onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">وصف المؤسسة (Subtitle)</Label>
                <Input 
                  value={(settings as any).companySub || ''}
                  placeholder="مثال: لإدارة الإنتاج والمقارات"
                  onChange={(e) => setSettings({...settings, companySub: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">العنوان الرسمي</Label>
                <Input 
                  value={settings.companyAddress}
                  placeholder="مثال: الرياض، حي الملز"
                  onChange={(e) => setSettings({...settings, companyAddress: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">رقم التواصل</Label>
                <Input 
                  value={settings.companyPhone}
                  onChange={(e) => setSettings({...settings, companyPhone: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <Button 
                onClick={handleSaveSettings}
                disabled={isSubmitting}
                className="w-full mt-4 h-11 rounded-xl font-black bg-primary text-white hover:bg-black transition-all gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ هوية المؤسسة</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                الضرائب والفواتير
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">الرقم الضريبي</Label>
                <Input 
                  value={settings.taxNumber}
                  onChange={(e) => setSettings({...settings, taxNumber: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">نسبة القيمة المضافة (%)</Label>
                <Input 
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({...settings, taxRate: parseInt(e.target.value)})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">العملة المستخدمة</Label>
                <select 
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  value={settings.currency}
                  onChange={(e) => setSettings({...settings, currency: e.target.value})}
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                </select>
              </div>
              <Button 
                onClick={handleSaveSettings}
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl font-black bg-primary text-white hover:bg-black transition-all gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ البيانات المالية</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                تفضيلات التقويم واللغة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">لغة النظام</Label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({...settings, language: e.target.value})}
                  className="w-full h-11 rounded-xl text-right px-3 border border-slate-200 bg-white"
                >
                  <option value="ar">العربية</option>
                  <option value="en">English (Coming Soon)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">نوع التاريخ (لعرض الأرشيف والنظام)</Label>
                <select
                  value={settings.calendarType}
                  onChange={(e) => setSettings({...settings, calendarType: e.target.value as any})}
                  className="w-full h-11 rounded-xl text-right px-3 border border-slate-200 bg-white"
                >
                  <option value="gregorian">ميلادي</option>
                  <option value="hijri">هجري</option>
                </select>
              </div>
              <Button 
                onClick={handleSaveSettings}
                disabled={isSubmitting}
                className="w-full mt-2 h-11 rounded-xl font-black bg-primary text-white hover:bg-black transition-all gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ التقويم</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          {renderBackHeader('نظام الإشعارات والبريد التلقائي', Mail)}
          <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden">
            <div className="bg-gradient-to-l from-primary/10 to-transparent p-8 border-b">
              <h3 className="text-xl font-black text-primary flex items-center gap-3">
                <Mail className="w-6 h-6" /> نظام الإشعارات والبريد التلقائي
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-1">تخصيص تصاميم رسائل الشركة والبريد المرسل للموظفين</p>
            </div>
            <CardContent className="p-8 space-y-8">
              {/* Branding Section */}
              <div className="space-y-4">
                 <h4 className="text-sm font-black text-slate-800 border-r-4 border-primary pr-3 leading-none">هوية البريد الإلكتروني</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase">لوجو الشركة في البريد</Label>
                        <Input 
                          value={settings.logoUrl}
                          onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                          className="h-10 rounded-xl"
                          placeholder="رابط الصورة المباشر..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase">لون الزر في البريد</Label>
                        <div className="flex gap-2">
                           <Input 
                              type="color"
                              value={settings.primaryColor}
                              onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                              className="w-12 h-10 p-1 rounded-lg cursor-pointer"
                           />
                           <Input 
                              value={settings.primaryColor}
                              onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                              className="flex-1 h-10 rounded-xl text-left font-mono"
                              dir="ltr"
                           />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl border p-4 shadow-inner">
                       <p className="text-[10px] font-black text-slate-300 uppercase mb-4 text-center border-b pb-2">معاينة الهوية</p>
                       <div className="flex flex-col items-center gap-4 py-4">
                          <img src={settings.logoUrl} alt="Logo" className="h-12 object-contain" />
                          <div className="w-full h-2 bg-slate-100 rounded-full" />
                          <div className="w-3/4 h-2 bg-slate-50 rounded-full" />
                          <Button className="w-32 h-8 rounded-lg text-[10px] font-black" style={{ backgroundColor: settings.primaryColor }}>زر الإجراء</Button>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Templates Section */}
              <div className="space-y-4">
                 <h4 className="text-sm font-black text-slate-800 border-r-4 border-primary pr-3 leading-none">قوالب الرسائل الجاهزة</h4>
                 <div className="space-y-4">
                    {Object.entries((settings as any).emailTemplates || {}).map(([key, template]: [string, any]) => (
                      <div key={key} className="p-6 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm hover:border-primary/20 transition-all">
                         <div className="flex items-center justify-between">
                            <Badge className="bg-primary/10 text-primary border-none rounded-lg px-3 py-1 font-black text-[10px] uppercase">
                              {key === 'payroll' ? 'إشعار الراتب' : key === 'welcome' ? 'رسالة ترحيب' : 'تنبيه انتهاء'}
                            </Badge>
                            <SettingToggle 
                              title="" 
                              description="" 
                              enabled={template.enabled} 
                              onToggle={() => {
                                const newTemplates = { ...(settings as any).emailTemplates };
                                newTemplates[key].enabled = !template.enabled;
                                setSettings({...settings, emailTemplates: newTemplates} as any);
                              }} 
                            />
                         </div>
                         <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-black text-slate-400">موضوع الرسالة</Label>
                              <Input 
                                value={template.subject}
                                onChange={(e) => {
                                  const newTemplates = { ...(settings as any).emailTemplates };
                                  newTemplates[key].subject = e.target.value;
                                  setSettings({...settings, emailTemplates: newTemplates} as any);
                                }}
                                className="h-10 rounded-xl font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-black text-slate-400">محتوى الرسالة</Label>
                              <textarea 
                                value={template.body}
                                onChange={(e) => {
                                  const newTemplates = { ...(settings as any).emailTemplates };
                                  newTemplates[key].body = e.target.value;
                                  setSettings({...settings, emailTemplates: newTemplates} as any);
                                }}
                                className="w-full min-h-[100px] p-4 rounded-2xl border border-slate-200 text-sm font-medium outline-primary"
                                dir="rtl"
                              />
                              <p className="text-[9px] font-bold text-slate-400 mt-1">
                                الوسوم المتاحة: {'{name}, {companyName}, {month}, {date}, {documentName}'}
                              </p>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="pt-6 border-t flex flex-col md:flex-row gap-4">
                <Button 
                  onClick={handleSaveSettings}
                  disabled={isSubmitting}
                  className="flex-1 h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-lg shadow-primary/20 gap-3"
                >
                   <Send className="w-5 h-5" /> حفظ قوالب الإشعارات
                </Button>
                <Button 
                  variant="outline"
                  className="h-14 px-8 rounded-2xl font-black border-2 border-slate-200 text-slate-600 gap-2 hover:bg-slate-50 transition-all"
                  onClick={() => toast.info('سيتم إرسال بريد تجريبي لهوية شركتك الآن...')}
                >
                  إرسال بريد تجريبي
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          {renderBackHeader('نظام الدوام ومعايير الحضور', SettingsIcon)}
          <Card className="rounded-[2.5rem] border-none shadow-sm max-w-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Radius className="w-5 h-5 text-primary" />
              معايير الحضور والدوام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs text-slate-500">نطاق الحضور المسموح (متر)</Label>
              <div className="relative">
                <Input 
                  type="number"
                  value={settings.attendanceRadius}
                  onChange={(e) => setSettings({...settings, attendanceRadius: parseInt(e.target.value)})}
                  className="h-11 rounded-xl text-right pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Meter</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">بداية الدوام</Label>
                <Input 
                  type="time"
                  value={settings.workingHoursStart}
                  onChange={(e) => setSettings({...settings, workingHoursStart: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs text-slate-500">نهاية الدوام</Label>
                <Input 
                  type="time"
                  value={settings.workingHoursEnd}
                  onChange={(e) => setSettings({...settings, workingHoursEnd: e.target.value})}
                  className="h-11 rounded-xl text-right"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs text-slate-500">أيام الإجازة الأسبوعية</Label>
              <Input 
                value={settings.weekendDays}
                placeholder="الجمعة والسبت"
                onChange={(e) => setSettings({...settings, weekendDays: e.target.value})}
                className="h-11 rounded-xl text-right"
              />
            </div>
            
            <SettingToggle 
              title="تفعيل الحضور اليدوي"
              description="السماح بتجاوز نظام الـ GPS في حالات الطوارئ"
              enabled={settings.allowManualAttendance}
              onToggle={() => setSettings({...settings, allowManualAttendance: !settings.allowManualAttendance})}
            />

            <SettingToggle 
              title="السماح بالوقت الإضافي (Overtime)"
              description="احتساب أوقات عمل إضافية بعد نهاية الدوام الرسمي"
              enabled={settings.allowOvertime}
              onToggle={() => setSettings({...settings, allowOvertime: !settings.allowOvertime})}
            />

            <Button 
              onClick={handleSaveSettings}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl font-black bg-primary hover:bg-black transition-all gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ معايير الحضور</>}
            </Button>
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          {renderBackHeader('خوارزميات الذكاء الاصطناعي', Globe)}
          <Card className="rounded-[2.5rem] border-none shadow-sm max-w-3xl overflow-hidden">
          <div className="bg-gradient-to-l from-primary/10 to-transparent p-6 border-b border-slate-100">
            <h3 className="text-xl font-black text-primary flex items-center gap-2">
              <Globe className="w-6 h-6" />
              خوارزميات الذكاء الاصطناعي
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">تخصيص أداء النظام وعمليات الربط التلقائية</p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-2">
              <div className="flex items-center gap-2 text-primary font-black text-sm">
                <ShieldCheck className="w-4 h-4" />
                منطق الربط الذكي (Fuzzy Matching)
              </div>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                يستخدم النظام خوارزمية Levenshtein لمطابقة أسماء الموردين. تم ضبط نسبة المطابقة عند <span className="text-primary font-black">90%</span>. 
                هذا يعني أنه إذا كانت الفاتورة تحمل اسم "شركة الكهرباء" والمسجل "شركة الكهرباء " (بمساحة إضافية) أو "شركه الكهرباء" (بإختلاف الهاء والتاء)، سيقوم النظام بربطها تلقائياً بنفس السجل.
              </p>
            </div>

            <SettingToggle 
              title="التعرف الذكي على الموردين"
              description="تجنب تكرار سجلات الموردين ودمج الفواتير تلقائياً بناءً على تقارب الاسم"
              enabled={settings.enableSmartSupplierMatching}
              onToggle={() => setSettings({...settings, enableSmartSupplierMatching: !settings.enableSmartSupplierMatching})}
            />

            <SettingToggle 
              title="التصنيف التلقائي للطلبات"
              description="توقع قسم المشتريات (مواد، عمالة، الخ) بناءً على سجل التعاملات السابق مع المورد"
              enabled={settings.enableAutoCategorization}
              onToggle={() => setSettings({...settings, enableAutoCategorization: !settings.enableAutoCategorization})}
            />

            <div className="pt-4 border-t border-dashed space-y-4">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-primary" />
                تخصيص الموجز الصوتي الذكي
              </h4>
              <p className="text-[10px] text-slate-500 font-bold mb-4">حدد المعلومات التي يلخصها الذكاء الاصطناعي في التقرير الصوتي اليومي</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SettingToggle 
                  title="الوضع المالي"
                  description="الدخل، المصروفات، والسيولة"
                  enabled={settings.briefingSettings?.includeFinance}
                  onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includeFinance: !settings.briefingSettings?.includeFinance}})}
                />
                <SettingToggle 
                  title="إحصائيات الحضور"
                  description="نسب الغياب والتأخير اليومي"
                  enabled={settings.briefingSettings?.includeAttendance}
                  onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includeAttendance: !settings.briefingSettings?.includeAttendance}})}
                />
                <SettingToggle 
                  title="تطور المشاريع"
                  description="نسبة الإنجاز والمشاريع الحرجة"
                  enabled={settings.briefingSettings?.includeProjects}
                  onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includeProjects: !settings.briefingSettings?.includeProjects}})}
                />
                <SettingToggle 
                  title="طلبات القيد"
                  description="المشتريات والطلبات المعلقة"
                  enabled={settings.briefingSettings?.includePurchases}
                  onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includePurchases: !settings.briefingSettings?.includePurchases}})}
                />
              </div>
            </div>

            <Button 
              onClick={handleSaveSettings}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl font-black bg-primary hover:bg-black transition-all gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ إعدادات الذكاء الاصطناعي</>}
            </Button>
          </CardContent>
        </Card>
      </div>
      )}

      {activeTab === 'theme' && (
        <div className="space-y-8">
          {renderBackHeader('الهوية البصرية والمظهر', Paintbrush)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-left-4 duration-500">
          <Card className="rounded-3xl border-none shadow-sm h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Paintbrush className="w-5 h-5 text-primary" />
                </div>
                {isManager ? 'تخصيص مظهر النظام (أو ثيمك الخاص)' : 'تخصيص ثيمك الشخصي'}
              </CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 pr-12">
                {isManager 
                  ? 'يمكنك تغيير ألوان النظام للجميع، أو حفظ ثيم خاص بك فقط'
                  : 'غير ألوان الواجهة التي تظهر لك أنت فقط لتناسب ذوقك الخاص'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 border-r-2 border-primary pr-3">الألوان الأساسية</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs text-slate-500 flex justify-between px-1">
                      <span>لون القائمة الجانبية (Sidebar)</span>
                      <span className="font-mono text-xs text-slate-400" dir="ltr">{settings.sidebarColor}</span>
                    </Label>
                    <div className="flex gap-4">
                      <Input 
                        type="color"
                        value={settings.sidebarColor}
                        onChange={(e) => setSettings({...settings, sidebarColor: e.target.value})}
                        className="w-16 h-12 p-1 rounded-xl cursor-pointer border-2"
                      />
                      <Input 
                        type="text"
                        value={settings.sidebarColor}
                        onChange={(e) => setSettings({...settings, sidebarColor: e.target.value})}
                        className="flex-1 h-12 rounded-xl text-left font-mono border-2 focus:ring-primary"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs text-slate-500 flex justify-between px-1">
                      <span>اللون الأساسي (Primary)</span>
                      <span className="font-mono text-xs text-slate-400" dir="ltr">{settings.primaryColor}</span>
                    </Label>
                    <div className="flex gap-4">
                      <Input 
                        type="color"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                        className="w-16 h-12 p-1 rounded-xl cursor-pointer border-2"
                      />
                      <Input 
                        type="text"
                        value={settings.primaryColor}
                        onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                        className="flex-1 h-12 rounded-xl text-left font-mono border-2 focus:ring-primary"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 border-r-2 border-amber-400 pr-3">خيارات العرض المتقدمة</p>
                <div className="space-y-4">
                  <SettingToggle 
                    title="تأثير الزجاج (Glassmorphism)"
                    description="تفعيل الشفافية والتمويه في القوائم والبطاقات لتعطي مظهراً عصرياً"
                    enabled={(settings as any).enableGlassEffect || false}
                    onToggle={() => setSettings({...settings, enableGlassEffect: !(settings as any).enableGlassEffect} as any)}
                  />

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 border-r-2 border-primary pr-3">الإعلانات والترحيب</p>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black text-slate-400 uppercase">📢 الإعلان العام (للجميع)</Label>
                      <Input 
                        value={settings.generalAnnouncement || ""}
                        onChange={(e) => setSettings({...settings, generalAnnouncement: e.target.value} as any)}
                        className="h-10 text-xs rounded-xl border-slate-200"
                        placeholder="رسالة تظهر في الشريط العلوي لكل الموظفين..."
                      />
                    </div>

                    <div className="pt-2">
                       <SettingToggle 
                        title="تفعيل شاشة الترحيب الذكية"
                        description="إظهار شاشة كاملة عند الدخول تحتوي على نصائح مخصصة لكل دور"
                        enabled={settings.showWelcomeMessage !== false}
                        onToggle={() => setSettings({...settings, showWelcomeMessage: settings.showWelcomeMessage === false} as any)}
                      />
                    </div>
                    
                    {settings.showWelcomeMessage !== false && (
                      <div className="space-y-6 pt-4 animate-in fade-in duration-300">
                        {['manager', 'supervisor', 'employee'].map((role) => (
                          <div key={role} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-black text-primary uppercase">
                                {role === 'manager' ? '👑 نصائح المدير' : role === 'supervisor' ? '⚡ نصائح المشرف' : '💎 نصائح الموظف'}
                              </Label>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-400 italic">عنوان الترحيب</Label>
                              <Input 
                                value={settings.roleWelcomeMessages?.[role]?.title || ""}
                                onChange={(e) => {
                                  const newMessages = { ...settings.roleWelcomeMessages };
                                  if (typeof newMessages[role] !== 'object' || newMessages[role] === null) {
                                    newMessages[role] = { title: typeof newMessages[role] === 'string' ? newMessages[role] : '', tips: [] };
                                  }
                                  newMessages[role].title = e.target.value;
                                  setSettings({ ...settings, roleWelcomeMessages: newMessages } as any);
                                }}
                                className="h-9 text-[11px] rounded-xl"
                                placeholder="مثال: مرحباً أيها القائد..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-slate-400 italic">النصائح (تفصل بفاصلة ,)</Label>
                              <textarea 
                                value={settings.roleWelcomeMessages?.[role]?.tips?.join(',') || ""}
                                onChange={(e) => {
                                  const newMessages = { ...settings.roleWelcomeMessages };
                                  if (typeof newMessages[role] !== 'object' || newMessages[role] === null) {
                                    newMessages[role] = { title: typeof newMessages[role] === 'string' ? newMessages[role] : '', tips: [] };
                                  }
                                  newMessages[role].tips = e.target.value.split(',').filter(t => t.trim());
                                  setSettings({ ...settings, roleWelcomeMessages: newMessages } as any);
                                }}
                                className="w-full min-h-[80px] p-3 text-[11px] rounded-xl border border-slate-200 bg-white"
                                placeholder="نصيحة 1, نصيحة 2, نصيحة 3..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="font-bold text-xs text-slate-500 px-1">انحناء الزوايا (Radius)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'none', label: 'حاد', val: '0px' },
                        { id: 'sm', label: 'بسيط', val: '4px' },
                        { id: 'md', label: 'متوسط', val: '12px' },
                        { id: 'lg', label: 'دائري', val: '24px' }
                      ].map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSettings({...settings, borderRadius: r.val} as any)}
                          className={`py-2 rounded-lg text-[10px] font-black border-2 transition-all ${
                            (settings as any).borderRadius === r.val 
                            ? 'bg-primary border-primary text-white' 
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-primary/20'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={async () => {
                    if (!user) return;
                    setIsSubmitting(true);
                    try {
                      const { updateDoc, doc } = await import('firebase/firestore');
                      await updateDoc(doc(db, 'users', profile?.uid || user.uid), {
                        userTheme: {
                          sidebarColor: settings.sidebarColor,
                          primaryColor: settings.primaryColor,
                          borderRadius: (settings as any).borderRadius || '12px',
                          enableGlassEffect: (settings as any).enableGlassEffect || false
                        }
                      });
                      toast.success('تم حفظ ثيمك الخاص بنجاح');
                    } catch (err) {
                      toast.error('فشل في حفظ الثيم الخاص');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full h-14 rounded-2xl font-black bg-slate-900 text-white hover:bg-black transition-all gap-2"
                >
                  <Save className="w-5 h-5" /> حفظ في ثيمي الخاص
                </Button>

                {isManager && (
                  <Button 
                    onClick={handleSaveSettings}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full h-12 rounded-2xl font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-all gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Globe className="w-4 h-4" /> تطبيق كإعداد عام للنظام</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl">
                  <Palette className="w-5 h-5 text-amber-600" />
                </div>
                سمات فخمة جاهزة
              </CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 pr-12">
                اختر من تشكيلة السمات المصممة بعناية لتعكس طبيعة عملك
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: "الهوية العامة (Default)", sidebar: "#1a4d4e", primary: "#2c7a7d", radius: "12px", glass: false },
                  { name: "النايت أليت (Professional)", sidebar: "#020617", primary: "#6366f1", radius: "12px", glass: true },
                  { name: "العصرية (Modern)", sidebar: "#fafafa", primary: "#10b981", radius: "24px", glass: true },
                  { name: "الفخامة (Luxury)", sidebar: "#1c1917", primary: "#d4af37", radius: "0px", glass: false },
                  { name: "تقني (Tech)", sidebar: "#0f172a", primary: "#38bdf8", radius: "8px", glass: true },
                  { name: "كلاسيك (Classic)", sidebar: "#27272a", primary: "#f43f5e", radius: "4px", glass: false },
                ].map((theme, i) => (
                  <button
                    key={i}
                    onClick={() => setSettings({
                      ...settings, 
                      sidebarColor: theme.sidebar, 
                      primaryColor: theme.primary,
                      borderRadius: theme.radius,
                      enableGlassEffect: theme.glass
                    } as any)}
                    className="flex flex-col gap-3 p-4 rounded-2xl border-2 border-slate-50 bg-white hover:border-primary/30 hover:bg-slate-50 transition-all text-right group shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-700">{theme.name}</span>
                      {theme.glass && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                    </div>
                    <div className="flex h-10 rounded-xl overflow-hidden border-2 border-white shadow-inner">
                      <div className="w-1/3" style={{ backgroundColor: theme.sidebar }} />
                      <div className="w-2/3" style={{ backgroundColor: theme.primary }} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
                <div className="p-2 h-fit bg-amber-200/50 rounded-full">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                </div>
                <p className="text-[10px] font-bold text-amber-800 leading-relaxed">
                  نصيحة: السمات التي تحتوي على علامة زرقاء تستفيد من "تأثير الزجاج" مما يعطي جمالية أكبر للواجهات على الأجهزة القوية.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {activeTab === 'locations' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          {renderBackHeader('إدارة المقرات والسكن الجغرافي', MapPin)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  إضافة مقر جديد
                </CardTitle>
                <CardDescription className="text-xs font-bold text-slate-500">تحديد موقع رسمي جديد للحضور والانصراف</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddOffice} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">اسم المقر</Label>
                    <Input 
                      required
                      placeholder="مثال: المعرض الرئيسي، مكتب الإدارة"
                      value={newOffice.name}
                      onChange={(e) => setNewOffice({...newOffice, name: e.target.value})}
                      className="h-11 rounded-xl text-right"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">نوع المقر</Label>
                    <select 
                      className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                      value={newOffice.type}
                      onChange={(e) => setNewOffice({...newOffice, type: e.target.value})}
                    >
                      <option value="office">مكتب إداري</option>
                      <option value="gallery">معرض</option>
                      <option value="warehouse">مخزن / مستودع</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs text-slate-500">خط العرض (Lat)</Label>
                      <Input 
                        required
                        placeholder="24.7136"
                        value={newOffice.latitude}
                        onChange={(e) => setNewOffice({...newOffice, latitude: e.target.value})}
                        className="h-11 rounded-xl text-right font-mono text-xs"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs text-slate-500">خط الطول (Lng)</Label>
                      <Input 
                        required
                        placeholder="46.6753"
                        value={newOffice.longitude}
                        onChange={(e) => setNewOffice({...newOffice, longitude: e.target.value})}
                        className="h-11 rounded-xl text-right font-mono text-xs"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={getCurrentLocation}
                    className="w-full h-11 rounded-xl gap-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 font-bold"
                  >
                    <MapPin className="w-4 h-4" />
                    استخدام موقعي الحالي
                  </Button>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl font-black bg-primary hover:bg-black transition-all"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ المقر الجديد'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black flex items-center gap-2 text-primary">
                  <Home className="w-5 h-5" />
                  إدارة سكن الموظفين
                </CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400">
                  إضافة وتحديث مواقع سكن عمال وموظفي الشركة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const newLoc = {
                      id: Math.random().toString(36).substr(2, 9),
                      name: (form.elements.namedItem('housingName') as HTMLInputElement).value,
                      address: (form.elements.namedItem('housingAddress') as HTMLInputElement).value,
                      coordinates: (form.elements.namedItem('housingCoords') as HTMLInputElement).value,
                      status: 'active'
                    };
                    
                    const updatedHousing = [...housing, newLoc];
                    setHousing(updatedHousing);
                    await updateDoc(doc(db, 'system', 'settings'), {
                      housingLocations: updatedHousing
                    });
                    form.reset();
                    toast.success('تمت إضافة موقع السكن بنجاح');
                  }}
                  className="space-y-3 bg-slate-50 p-4 rounded-2xl"
                >
                  <Input name="housingName" placeholder="اسم السكن" required className="h-10 rounded-xl" />
                  <Input name="housingAddress" placeholder="العنوان" required className="h-10 rounded-xl" />
                  <Input name="housingCoords" placeholder="رابط الموقع أو إحداثيات" className="h-10 rounded-xl text-left" />
                  <Button type="submit" className="w-full h-10 rounded-xl font-black gap-2">
                    <Plus className="w-4 h-4" /> إضافة سكن
                  </Button>
                </form>

                <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                  {housing.map((loc) => (
                    <div key={loc.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl group hover:border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Home className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-xs">{loc.name}</p>
                          <p className="text-[9px] font-bold text-slate-400">{loc.address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={async () => {
                            const updated = housing.filter(h => h.id !== loc.id);
                            setHousing(updated);
                            await updateDoc(doc(db, 'system', 'settings'), {
                              housingLocations: updated
                            });
                            toast.success('تم حذف موقع السكن');
                          }}
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">المقارات الحالية والمساكن ({offices.length + housing.length})</h2>
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-tight">المقارات الرسمية ({offices.length})</p>
              {offices.map(office => (
                <Card key={office.id} className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-2xl text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-primary leading-tight">{office.name}</h4>
                          <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                            {office.type === 'office' ? 'مكتب إداري' : office.type === 'gallery' ? 'معرض' : 'مستودع'} 
                            • {office.latitude}, {office.longitude}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteOffice(office.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <p className="text-[10px] font-black text-slate-400 px-2 uppercase tracking-tight pt-4">سكن الموظفين ({housing.length})</p>
              {housing.map(loc => (
                <Card key={loc.id} className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-50 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
                          <Home className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-black text-amber-700 leading-tight">{loc.name}</h4>
                          <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                            {loc.address}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={async () => {
                          const updated = housing.filter(h => h.id !== loc.id);
                          setHousing(updated);
                          await updateDoc(doc(db, 'system', 'settings'), {
                            housingLocations: updated
                          });
                          toast.success('تم حذف موقع السكن');
                        }}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'housing' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2 text-primary">
                <Home className="w-5 h-5" />
                إدارة سكن الموظفين
              </CardTitle>
              <CardDescription className="text-xs font-bold text-slate-400">
                إضافة وتحديث مواقع سكن عمال وموظفي الشركة للرقابة الأمنية والصحية
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const newLoc = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: (form.elements.namedItem('name') as HTMLInputElement).value,
                    address: (form.elements.namedItem('address') as HTMLInputElement).value,
                    coordinates: (form.elements.namedItem('coords') as HTMLInputElement).value,
                    status: 'active'
                  };
                  
                  const updatedHousing = [...housing, newLoc];
                  setHousing(updatedHousing);
                  await updateDoc(doc(db, 'system', 'settings'), {
                    housingLocations: updatedHousing
                  });
                  form.reset();
                  toast.success('تمت إضافة موقع السكن بنجاح');
                }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl mb-6"
              >
                <div className="md:col-span-1">
                  <Input name="name" placeholder="اسم السكن" required className="h-11 rounded-xl" />
                </div>
                <div className="md:col-span-1">
                  <Input name="address" placeholder="العنوان" required className="h-11 rounded-xl" />
                </div>
                <div className="md:col-span-1">
                  <Input name="coords" placeholder="رابط الموقع أو إحداثيات" className="h-11 rounded-xl text-left" />
                </div>
                <div className="md:col-span-1">
                  <Button type="submit" className="w-full h-11 rounded-xl font-black gap-2">
                    <Plus className="w-4 h-4" /> إضافة
                  </Button>
                </div>
              </form>

              <div className="space-y-3">
                {housing.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm">{loc.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{loc.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {loc.coordinates && (loc.coordinates.startsWith('http') || loc.coordinates.length > 5) && (
                        <Button 
                          onClick={() => window.open(loc.coordinates.startsWith('http') ? loc.coordinates : `https://www.google.com/maps/search/?api=1&query=${loc.coordinates}`)}
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-full text-blue-500 hover:text-blue-600"
                        >
                          <Globe className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        onClick={async () => {
                          const updated = housing.filter(h => h.id !== loc.id);
                          setHousing(updated);
                          await updateDoc(doc(db, 'system', 'settings'), {
                            housingLocations: updated
                          });
                          toast.success('تم حذف موقع السكن');
                        }}
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 rounded-full text-red-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {housing.length === 0 && (
                  <div className="text-center py-10">
                    <Home className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400">لا يوجد مواقع سكن مضافة حالياً</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
            <div className="p-6 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <ShieldCheck className="w-5 h-5" />
                <h4 className="font-black">فوائد نظام مراقبة السكن</h4>
              </div>
              <ul className="space-y-2">
                {[
                  'تتبع التواجد الليلي للعاملين لضمان السلامة',
                  'إصدار تقارير التزام بالساعات الراحة للموظفين',
                  'دمج الموقع مع الفواتير اللوجستية للموردين',
                  'تحسين تقييمات الموظفين بناءً على الالتزام بمواقع السكن'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-blue-600/80">
                    <div className="w-1 h-1 rounded-full bg-blue-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'banks' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
          {renderBackHeader('الحسابات البنكية والخزينة كاش', CreditCard)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="rounded-3xl border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                إضافة حساب بنكي / خزينة
              </CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500">تعريف الحسابات البنكية للمؤسسة أو صناديق الكاش (الخزينة)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">اسم الحساب (أو الصندوق)</Label>
                  <Input 
                    required
                    placeholder="مثال: البنك الأهلي، خزينة المكتب..."
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                    className="h-11 rounded-xl text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">نوع الحساب</Label>
                  <select 
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({...newAccount, type: e.target.value as any})}
                  >
                    <option value="bank">حساب بنكي</option>
                    <option value="cash">خزينة / كاش</option>
                  </select>
                </div>

                {newAccount.type === 'bank' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">رقم الآيبان (IBAN)</Label>
                    <Input 
                      placeholder="SA000000..."
                      value={newAccount.iban}
                      onChange={(e) => setNewAccount({...newAccount, iban: e.target.value})}
                      className="h-11 rounded-xl text-left"
                      dir="ltr"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-wider text-slate-500">الرصيد الافتتاحي (ر.س)</Label>
                  <Input 
                    type="number"
                    placeholder="0.00"
                    value={newAccount.initialBalance}
                    onChange={(e) => setNewAccount({...newAccount, initialBalance: e.target.value})}
                    className="h-11 rounded-xl text-right"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-black bg-primary hover:bg-black transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ الحساب'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest px-2">الحسابات الحالية ({bankAccounts.length})</h2>
            {bankAccounts.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                 <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                 <p className="text-xs font-bold text-slate-400">لا يوجد حسابات مسجلة بعد</p>
              </div>
            ) : (
              bankAccounts.map(account => (
                <Card key={account.id} className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow group">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl transition-all ${
                          account.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {account.type === 'bank' ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-black text-primary leading-tight">{account.name}</h4>
                          <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                            {account.type === 'bank' ? `بنك • IBAN: ${account.iban || '...'}` : 'خزينة كاش'} 
                            • رصيد افتتاحي: {account.initialBalance} ر.س
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteAccount(account.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === 'advanced' && (
        <Card className="rounded-3xl border-none shadow-sm max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2 text-amber-600">
              <ShieldCheck className="w-5 h-5" />
              أمان النظام والوصول المتقدم
            </CardTitle>
            <CardDescription className="text-xs font-bold">إعدادات حساسة لا يراها إلا مؤسس الحساب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
              <p className="text-xs font-black text-amber-800 uppercase tracking-widest">تحديثات النظام</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-amber-900 leading-tight">وضع الصيانة</p>
                  <p className="text-[10px] text-amber-600 font-bold">منع الموظفين من الدخول مؤقتاً للتحديث</p>
                </div>
                <div className="w-12 h-6 rounded-full bg-slate-300 relative cursor-not-allowed transparence-50">
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
               <p className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">تراخيص الذكاء الاصطناعي</p>
               <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Gemini API Integration</span>
                    <span className="text-[10px] font-black text-emerald-500 p-1 bg-emerald-50 rounded-md">CONNECTED</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Daily Scan Limit</span>
                    <span className="text-[10px] font-black text-primary">500 Documents</span>
                 </div>
               </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
               <div>
                  <h4 className="text-sm font-black text-slate-800 mb-1">اختبار نظام التنبيهات الصاخب</h4>
                  <p className="text-[10px] text-muted-foreground font-bold">استخدم هذا الزر لاختبار الصوت والظهور للهواتف والأجهزة</p>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <Button 
                   variant="outline" 
                   className="rounded-xl font-black h-12 bg-blue-50 text-blue-600 border-blue-100 gap-2"
                   onClick={async () => {
                     try {
                        const { sendNotification } = await import('../lib/notifications');
                        await sendNotification({
                          title: 'اختبار تنبيه عادي',
                          message: 'هذا مجرد اختبار لنظام الإشعارات للتأكد من وصول الصوت.',
                          priority: 'high',
                          type: 'info',
                          category: 'system',
                          targetRole: 'manager'
                        });
                        toast.success('تم إرسال إشعار اختبار بنجاح');
                     } catch (e) {
                        toast.error('فشل إرسال إشعار الاختبار');
                     }
                   }}
                 >
                   <Volume2 className="w-4 h-4" />
                   اختبار صوت (عالي)
                 </Button>
                 
                 <Button 
                   className="rounded-xl font-black h-12 bg-red-600 hover:bg-red-700 text-white gap-2 shadow-lg shadow-red-200"
                   onClick={async () => {
                     try {
                        const { sendNotification } = await import('../lib/notifications');
                        await sendNotification({
                          title: '🚨 اختبار تنبيه عاجل جداً',
                          message: 'هل تسمع صوت الإنذار؟ هذا التنبيه سيتطلب منك ضغط زر التأكيد ليختفي.',
                          priority: 'high',
                          type: 'error',
                          category: 'system',
                          targetRole: 'manager'
                        });
                        toast.success('تم إرسال تنبيه تأكيد استلام (صاخب)');
                     } catch (e) {
                        toast.error('فشل إرسال تنبيه الاختبار');
                     }
                   }}
                 >
                   <ShieldAlert className="w-4 h-4" />
                   اختبار تنبيه صاخب + تأكيد
                 </Button>
               </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'data' && (
        <Card className="rounded-3xl border-none shadow-sm max-w-2xl mx-auto overflow-hidden">
          <CardHeader className="bg-red-50/50">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Database className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-red-900">إدارة البيانات والتنظيف</CardTitle>
                <CardDescription className="text-sm font-bold text-red-700">هذا القسم يسمح لك ببدء العمل على "بياض"</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 font-black text-slate-500">١</div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">ما هي البيانات التي سيتم مسحها؟</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-bold mt-1">
                    سيتم مسح كافة المشاريع، المعاملات المالية، العمال، بيانات الحضور، المخازن، سجلات النشاط، التنبيهات، واليوميات. 
                    لن يتم مسح أي بيانات بنكية أو إعدادات الشركة الأساسية.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 font-black text-slate-500">٢</div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">ماذا سيحدث للموظفين؟</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-bold mt-1">
                    سيتم مسح كافة حسابات الموظفين والمشرفين. حسابك الحالي كمدير (amanrental2020@gmail.com) هو الوحيد الذي لن يتم مسحه.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 font-black text-slate-500">٣</div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">هل يمكن التراجع؟</h4>
                  <p className="text-xs text-red-500 leading-relaxed font-bold mt-1">
                    لا، هذه العملية نهائية وغير قابلة للتراجع. تأكد من أنك انتهيت من كافة التجارب وترغب في بدء العمل الفعلي.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 space-y-6">
              <div className="space-y-3">
                 <div>
                    <h4 className="text-sm font-black text-slate-800 mb-1">تهيئة الذاكرة المؤقتة (Clear Cache)</h4>
                    <p className="text-[10px] text-muted-foreground font-bold">يقوم بمسح البيانات المخزنة مؤقتاً في متصفحك لحل مشاكل العرض أو التحديثات العالقة دون التأثير على قواعد البيانات، سيقوم بالخروج من النظام للمستخدم الحالي.</p>
                 </div>
                 <Button 
                   onClick={handleClearCache}
                   variant="outline"
                   className="w-full h-14 rounded-2xl font-black bg-slate-50 text-slate-700 border-slate-200 gap-2 hover:bg-slate-100"
                 >
                   <RefreshCw className="w-5 h-5" />
                   مسح الذاكرة المؤقتة وتحديث النظام
                 </Button>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div>
                    <h4 className="text-sm font-black text-red-800 mb-3">حذف بيانات النظام كاملة (إعادة ضبط المصنع)</h4>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-lg shadow-lg shadow-red-200 hover:shadow-xl transition-all flex items-center justify-center gap-2 shadow-red-200">
                      <Trash className="w-5 h-5" />
                      تنظيف النظام وإعادة ضبط المصنع
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black text-red-900 text-right">هل أنت متأكد تماماً؟</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-bold text-slate-500 text-right">
                        هذا الإجراء سيقوم بمسح كافة البيانات التجريبية نهائياً. سيتم تسجيل خروجك وسيكون عليك البدء من جديد كأنك تستخدم النظام لأول مرة.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-row-reverse gap-3 sm:justify-start">
                      <AlertDialogAction 
                        onClick={handleSystemReset}
                        variant="destructive"
                        size="default"
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black px-8"
                      >
                        نعم، امسح كل شيء
                      </AlertDialogAction>
                      <AlertDialogCancel variant="outline" size="default" className="bg-slate-100 hover:bg-slate-200 border-none rounded-xl font-black px-8">
                        إلغاء
                      </AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  </div>
);
}

function SettingToggle({ title, description, enabled, onToggle }: { 
  title: string; 
  description: string; 
  enabled: boolean; 
  onToggle: () => void; 
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all">
      <div className="space-y-0.5">
        <p className="text-sm font-black text-slate-800">{title}</p>
        <p className="text-[10px] font-bold text-slate-400">{description}</p>
      </div>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none ${enabled ? 'bg-primary' : 'bg-slate-300'}`}
      >
        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 transform ${enabled ? 'translate-x-6' : ''}`} />
      </button>
    </div>
  );
}
