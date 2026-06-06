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
  Send,
  Sparkles,
  Clock,
  Check,
  HelpCircle,
  Eye,
  EyeOff
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
import { motion, AnimatePresence } from 'motion/react';
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
import CompanyProfile from './CompanyProfile';
import GeminiKeyCard from './GeminiKeyCard';

export default function SystemSettings() {
  const { user, profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const [activeTab, setActiveTab] = useState<string>('');
  const [offices, setOffices] = useState<any[]>([]);
  const [housing, setHousing] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

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
    geminiApiKey: '',

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

  // Define All Navigation Tabs
  const tabs = [
    { id: 'company_profile', label: 'هوية الشركة والأرشيف', icon: Building2, roles: ['manager'] },
    { id: 'general', label: 'الإعدادات العامة', icon: SettingsIcon, roles: ['manager'] },
    { id: 'notifications', label: 'البريد والإشعارات', icon: Mail, roles: ['manager'] },
    { id: 'attendance', label: 'نظام الدوام والـ GPS', icon: Clock, roles: ['manager'] },
    { id: 'ai', label: 'الذكاء الاصطناعي', icon: Sparkles, roles: ['manager'] },
    { id: 'locations', label: 'المقرات والسكن', icon: MapPin, roles: ['manager'] },
    { id: 'banks', label: 'الحسابات البنكية', icon: CreditCard, roles: ['manager'] },
    { id: 'theme', label: 'المظهر والثيم البصري', icon: Paintbrush, roles: ['manager', 'supervisor', 'employee'] },
    { id: 'data', label: 'إدارة البيانات والأمان', icon: Database, roles: ['manager'] }
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(profile?.role || 'employee'));

  useEffect(() => {
    if (visibleTabs.length > 0 && !activeTab) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4" dir="rtl">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-sm font-black text-slate-400">جاري تحميل إعدادات النظام وتحديث المظهر...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-24 px-2 md:px-4" dir="rtl">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="p-2.5 bg-primary/10 rounded-2xl text-primary inline-flex">
              <SettingsIcon className="w-8 h-8 animate-[spin_20s_linear_infinite]" />
            </span>
            لوحة الإعدادات والتحكم
          </h1>
          <p className="text-slate-500 font-bold text-sm">إدارة هوية الشركة، نظام الأمان، تفضيلات المظهر والذكاء الاصطناعي</p>
        </div>
        <div className="flex items-center gap-3 bg-white/80 border border-slate-200/60 backdrop-blur-md rounded-2xl py-2.5 px-4 shadow-sm h-fit">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-[10px] font-black text-slate-400 leading-none">صلاحية الدخول الحالية</p>
            <p className="text-xs font-black text-slate-800 mt-1">
              {profile?.role === 'manager' ? '👑 مدير عام النظام' : profile?.role === 'supervisor' ? '⚡ مشرف النظام' : '💎 موظف'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Dual-Pane Dashboard */}
      <div className="grid grid-cols-12 gap-8 items-start">
        
        {/* RIGHT SIDEBAR TABS */}
        <div className="col-span-12 lg:col-span-3 lg:sticky lg:top-8 z-10">
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 shadow-xl rounded-[2rem] p-4 space-y-1.5">
            <div className="px-3 py-2 pb-4 border-b border-slate-100 mb-2 hidden lg:block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">أقسام لوحة التحكم</span>
              <span className="text-xs font-bold text-slate-500 block mt-1">اضغط للتنقل المباشر</span>
            </div>

            {/* Mobile Tab List Container (scrolls horizontally) */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-2 lg:mx-0 px-2 lg:px-0 no-scrollbar snap-x">
              {visibleTabs.map((tab) => {
                const IsActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-right transition-all font-black text-sm shrink-0 snap-center lg:w-full select-none ${
                      IsActive 
                        ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02] border-none' 
                        : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <tab.icon className={`w-5 h-5 shrink-0 ${IsActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'}`} />
                    <span>{tab.label}</span>
                    {IsActive && (
                      <motion.div 
                        layoutId="activeTabIndicator" 
                        className="w-1.5 h-6 bg-white rounded-full mr-auto hidden lg:block"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* LEFT CONTENT AREA */}
        <div className="col-span-12 lg:col-span-9">
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 shadow-xl rounded-[2.5rem] p-5 md:p-8 min-h-[600px] transition-all">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                
                {/* 1. COMPANY PROFILE TAB */}
                {activeTab === 'company_profile' && (
                  <div className="space-y-6">
                    <div className="border-b pb-4 mb-6">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Building2 className="w-7 h-7 text-primary" />
                        هوية الشركة والأرشيف الرسمي
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تحديث الأوراق الحكومية والعناوين الموحدة واشتراكات السحابة</p>
                    </div>
                    
                    {/* Embedded CompanyProfile Component */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-2 md:p-4 overflow-hidden">
                      <CompanyProfile />
                    </div>
                  </div>
                )}

                {/* 2. GENERAL SETTINGS */}
                {activeTab === 'general' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Building2 className="w-7 h-7 text-primary" />
                        الإعدادات العامة وهويتك
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">إدارة معلومات المنشأة والتفضيلات المالية وتخصيص الفواتير</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Identity Card */}
                      <Card className="rounded-[2rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <Building className="w-5 h-5 text-primary" />
                          معلومات المؤسسة الأساسية
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">اسم المؤسسة</Label>
                            <Input 
                              value={settings.companyName}
                              onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white focus:ring-primary/20 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">وصف المؤسسة الفرعي (Subtitle)</Label>
                            <Input 
                              value={settings.companySub || ''}
                              placeholder="مثال: للمقاولات العامة والديكور"
                              onChange={(e) => setSettings({...settings, companySub: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white focus:ring-primary/20 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">العنوان الرسمي</Label>
                            <Input 
                              value={settings.companyAddress}
                              placeholder="مثال: الرياض، حي السليمانية"
                              onChange={(e) => setSettings({...settings, companyAddress: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white focus:ring-primary/20 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">رقم التواصل</Label>
                            <Input 
                              value={settings.companyPhone}
                              onChange={(e) => setSettings({...settings, companyPhone: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white focus:ring-primary/20 border-slate-200"
                            />
                          </div>
                        </div>
                      </Card>

                      {/* Taxes and billing */}
                      <Card className="rounded-[2rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <CreditCard className="w-5 h-5 text-primary" />
                          الضرائب والفوترة
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">الرقم الضريبي الرسمي</Label>
                            <Input 
                              value={settings.taxNumber}
                              placeholder="300000000000003"
                              onChange={(e) => setSettings({...settings, taxNumber: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white focus:ring-primary/20 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">نسبة ضريبة القيمة المضافة (%)</Label>
                            <Input 
                              type="number"
                              value={settings.taxRate}
                              onChange={(e) => setSettings({...settings, taxRate: parseInt(e.target.value) || 0})}
                              className="h-11 rounded-xl text-right bg-white focus:ring-primary/20 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">العملة الافتراضية</Label>
                            <select 
                              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                              value={settings.currency}
                              onChange={(e) => setSettings({...settings, currency: e.target.value})}
                            >
                              <option value="SAR">ريال سعودي (SAR)</option>
                              <option value="USD">دولار أمريكي (USD)</option>
                            </select>
                          </div>
                        </div>
                      </Card>

                      {/* Language and Calendar */}
                      <Card className="rounded-[2rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4 md:col-span-2">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <Globe className="w-5 h-5 text-primary" />
                          التاريخ واللغة المفضلة للنظام
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">لغة الواجهة</Label>
                            <select
                              value={settings.language}
                              onChange={(e) => setSettings({...settings, language: e.target.value})}
                              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                              <option value="ar">العربية (Default)</option>
                              <option value="en">English (Coming Soon)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">نوع التقويم</Label>
                            <select
                              value={settings.calendarType}
                              onChange={(e) => setSettings({...settings, calendarType: e.target.value as any})}
                              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                            >
                              <option value="gregorian">ميلادي (Gregorian)</option>
                              <option value="hijri">هجري (Hijri)</option>
                            </select>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={handleSaveSettings}
                        disabled={isSubmitting}
                        className="h-12 px-8 rounded-2xl font-black bg-primary text-white hover:bg-black transition-all gap-2 shadow-lg shadow-primary/20"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ الإعدادات العامة</>}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. NOTIFICATIONS TAB */}
                {activeTab === 'notifications' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Mail className="w-7 h-7 text-primary" />
                        نظام الإشعارات والبريد التلقائي
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تخصيص تصاميم رسائل البريد وقوالب الإشعارات التلقائية للموظفين</p>
                    </div>

                    <div className="space-y-6">
                      
                      {/* Logo and Primary Color for Email Branding */}
                      <Card className="rounded-[2rem] border-none bg-slate-50/50 shadow-sm p-6">
                        <h3 className="text-lg font-black text-slate-800 border-r-4 border-primary pr-3 leading-none mb-4">هوية البريد الإلكتروني للشركة</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black text-slate-400 uppercase">شعار الشركة (رابط لوجو مباشر)</Label>
                              <Input 
                                value={settings.logoUrl}
                                onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                                className="h-11 rounded-xl bg-white border-slate-200 focus:ring-primary/20"
                                placeholder="رابط الصورة المباشر..."
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-black text-slate-400 uppercase">لون أزرار البريد (Accent Color)</Label>
                              <div className="flex gap-2">
                                 <Input 
                                    type="color"
                                    value={settings.primaryColor}
                                    onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                                    className="w-14 h-11 p-1 rounded-xl cursor-pointer border border-slate-200"
                                 />
                                 <Input 
                                    value={settings.primaryColor}
                                    onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                                    className="flex-1 h-11 rounded-xl text-left font-mono bg-white border-slate-200 focus:ring-primary/20"
                                    dir="ltr"
                                 />
                              </div>
                            </div>
                          </div>

                          {/* Email Preview Frame */}
                          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-inner relative overflow-hidden">
                             <div className="absolute top-0 right-0 left-0 h-1.5" style={{ backgroundColor: settings.primaryColor }} />
                             <p className="text-[9px] font-black text-slate-300 uppercase mb-3 text-center border-b pb-2">معاينة الهوية بالبريد</p>
                             <div className="flex flex-col items-center gap-4 py-2">
                                <img src={settings.logoUrl} alt="Logo" className="h-10 object-contain rounded-lg shadow-sm" onError={(e) => {
                                  (e.target as any).src = 'https://i.imgur.com/yYZDeHZ.jpg';
                                }} />
                                <div className="w-full space-y-2">
                                  <div className="w-full h-2.5 bg-slate-100 rounded-full" />
                                  <div className="w-3/4 h-2.5 bg-slate-50 rounded-full" />
                                </div>
                                <Button className="w-36 h-9 rounded-xl text-xs font-black shadow-sm text-white" style={{ backgroundColor: settings.primaryColor }}>
                                  زر التفعيل أو الرابط
                                </Button>
                             </div>
                          </div>
                        </div>
                      </Card>

                      {/* Email Templates Section */}
                      <div className="space-y-4">
                         <h3 className="text-lg font-black text-slate-800 border-r-4 border-primary pr-3 leading-none">قوالب الرسائل البريدية الجاهزة</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Object.entries((settings as any).emailTemplates || {}).map(([key, template]: [string, any]) => (
                              <div key={key} className="bg-slate-50/50 border border-slate-100 rounded-[2rem] p-6 space-y-4 shadow-sm hover:border-primary/20 transition-all flex flex-col justify-between">
                                 <div className="flex items-center justify-between">
                                    <Badge className="bg-primary/10 text-primary border-none rounded-xl px-3 py-1 font-black text-[10px] uppercase">
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
                                 <div className="space-y-3 mt-3">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] font-black text-slate-400">موضوع الرسالة</Label>
                                      <Input 
                                        value={template.subject}
                                        onChange={(e) => {
                                          const newTemplates = { ...(settings as any).emailTemplates };
                                          newTemplates[key].subject = e.target.value;
                                          setSettings({...settings, emailTemplates: newTemplates} as any);
                                        }}
                                        className="h-10 rounded-xl font-bold bg-white border-slate-200"
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
                                        className="w-full min-h-[110px] p-3 rounded-2xl border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                        dir="rtl"
                                      />
                                      <p className="text-[9px] font-bold text-slate-400 mt-1">
                                        الوسوم الذكية المتاحة: {'{name}, {companyName}, {month}, {date}, {documentName}'}
                                      </p>
                                    </div>
                                 </div>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t">
                      <Button 
                        variant="outline"
                        className="h-12 px-6 rounded-2xl font-black border-2 border-slate-200 text-slate-600 gap-2 hover:bg-slate-50 transition-all text-xs"
                        onClick={() => toast.info('سيتم إرسال بريد تجريبي لهوية شركتك الآن...')}
                      >
                        إرسال بريد تجريبي
                      </Button>
                      <Button 
                        onClick={handleSaveSettings}
                        disabled={isSubmitting}
                        className="h-12 px-8 rounded-2xl bg-primary text-white font-black hover:bg-black transition-all gap-2 shadow-lg shadow-primary/20 text-xs"
                      >
                         {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ تصاميم البريد</>}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 4. ATTENDANCE RADAR & GPS TAB */}
                {activeTab === 'attendance' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Clock className="w-7 h-7 text-primary" />
                        نظام الدوام وسياج الـ GPS
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تحديد النطاقات الجغرافية للحضور والانصراف، وضبط الأوقات والإجازات</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Attendance settings */}
                      <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <Radius className="w-5 h-5 text-primary" />
                          ضوابط وساعات العمل
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">نطاق الحضور المسموح به (بالمتر)</Label>
                            <div className="relative">
                              <Input 
                                type="number"
                                value={settings.attendanceRadius}
                                onChange={(e) => setSettings({...settings, attendanceRadius: parseInt(e.target.value) || 100})}
                                className="h-11 rounded-xl text-right pl-16 bg-white border-slate-200 focus:ring-primary/20"
                              />
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-md border">متر</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="font-bold text-xs text-slate-500">بداية الدوام اليومي</Label>
                              <Input 
                                type="time"
                                value={settings.workingHoursStart}
                                onChange={(e) => setSettings({...settings, workingHoursStart: e.target.value})}
                                className="h-11 rounded-xl text-right bg-white border-slate-200"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="font-bold text-xs text-slate-500">نهاية الدوام اليومي</Label>
                              <Input 
                                type="time"
                                value={settings.workingHoursEnd}
                                onChange={(e) => setSettings({...settings, workingHoursEnd: e.target.value})}
                                className="h-11 rounded-xl text-right bg-white border-slate-200"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500">أيام العطلة الإسبوعية</Label>
                            <Input 
                              value={settings.weekendDays}
                              placeholder="الجمعة والسبت"
                              onChange={(e) => setSettings({...settings, weekendDays: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white border-slate-200"
                            />
                          </div>
                        </div>
                      </Card>

                      {/* Dynamic toggles */}
                      <div className="space-y-6">
                        <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                          <h3 className="text-lg font-black text-slate-800 leading-none">تجاوزات الحضور</h3>
                          <p className="text-xs font-bold text-slate-400">تفعيل/إلغاء قيود التوقيع الجغرافي للموظفين والعمالة</p>
                          <div className="space-y-4 mt-2">
                            <SettingToggle 
                              title="تفعيل التوقيع اليدوي"
                              description="السماح للموظف بتسجيل الحضور يدوياً دون سياج الـ GPS"
                              enabled={settings.allowManualAttendance}
                              onToggle={() => setSettings({...settings, allowManualAttendance: !settings.allowManualAttendance})}
                            />

                            <SettingToggle 
                              title="تفعيل احتساب الساعات الإضافية"
                              description="احتساب ساعات عمل إضافية بعد انتهاء وقت الدوام الرسمي تلقائياً"
                              enabled={settings.allowOvertime}
                              onToggle={() => setSettings({...settings, allowOvertime: !settings.allowOvertime})}
                            />
                          </div>
                        </Card>
                        
                        <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-100 flex gap-3">
                          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                            <strong>تنبيه الأمان الجغرافي:</strong> النطاق الجغرافي القياسي هو 100 متر حول إحداثيات المقر. زيادة النطاق تسمح للموظفين بتسجيل الحضور من مسافات أبعد. يفضل تدوين المقرات الحقيقية بدقة.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <Button 
                        onClick={handleSaveSettings}
                        disabled={isSubmitting}
                        className="h-12 px-8 rounded-2xl bg-primary text-white font-black hover:bg-black transition-all gap-2 shadow-lg shadow-primary/20"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ إعدادات الدوام</>}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 5. ARTIFICIAL INTELLIGENCE TAB */}
                {activeTab === 'ai' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                        خوارزميات الذكاء الاصطناعي والموجز الصوتي
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تخصيص أداء المساعد الذكي وربط الفواتير اليومية وإدارة مفاتيح API</p>
                    </div>

                    <div className="space-y-6">
                      
                      {/* Explain algorithms */}
                      <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-emerald-500" />
                          خوارزمية المطابقة التقريبية (Fuzzy Matching)
                        </h3>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                          يستعين نظام الذكاء بمطابقة Levenshtein الذكية لمسح ومطابقة أسماء الموردين بمعدل دقة <strong className="text-primary">90%</strong>. 
                          هذا يمكن النظام من ربط فواتير "شركة الاتصالات السعودية" بالفاتورة المرفوعة باسم "شركة الاتصالات" وتجنب تكرار الموردين في قاعدة البيانات.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <SettingToggle 
                            title="المطابقة الذكية للموردين"
                            description="ربط الفواتير تلقائياً بنفس المورد بناء على الاسم التقريبي"
                            enabled={settings.enableSmartSupplierMatching}
                            onToggle={() => setSettings({...settings, enableSmartSupplierMatching: !settings.enableSmartSupplierMatching})}
                          />
                          <SettingToggle 
                            title="تنبؤ وتصنيف بنود الشراء"
                            description="توقع أقسام المشتريات والمواد بناء على التاريخ الحركي للمورد"
                            enabled={settings.enableAutoCategorization}
                            onToggle={() => setSettings({...settings, enableAutoCategorization: !settings.enableAutoCategorization})}
                          />
                        </div>
                      </Card>

                      {/* API credentials */}
                      <GeminiKeyCard
                        value={settings.geminiApiKey || ''}
                        onChange={(v) => setSettings({...settings, geminiApiKey: v})}
                        showKey={showGeminiKey}
                        onToggleShow={() => setShowGeminiKey(!showGeminiKey)}
                      />

                      {/* Briefing settings */}
                      <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                          <Volume2 className="w-5 h-5 text-primary" />
                          تخصيص الموجز الصوتي الذكي (Voice Briefing)
                        </h3>
                        <p className="text-xs font-bold text-slate-400">حدد البنود التي تود سماعها في الملخص الصوتي اليومي في بداية اليوم</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <SettingToggle 
                            title="ملخص الميزانية والسيولة"
                            description="إدراج الدخل والمصروفات وصافي الأرباح المتوقعة"
                            enabled={settings.briefingSettings?.includeFinance}
                            onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includeFinance: !settings.briefingSettings?.includeFinance}})}
                          />
                          <SettingToggle 
                            title="ملخص الحضور والدوام"
                            description="معدل غياب وتأخر موظفي المكاتب والمواقع"
                            enabled={settings.briefingSettings?.includeAttendance}
                            onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includeAttendance: !settings.briefingSettings?.includeAttendance}})}
                          />
                          <SettingToggle 
                            title="تطور ونسب إنجاز المشاريع"
                            description="تنبيهات المشاريع النشطة والمتأخرة"
                            enabled={settings.briefingSettings?.includeProjects}
                            onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includeProjects: !settings.briefingSettings?.includeProjects}})}
                          />
                          <SettingToggle 
                            title="طلبات التوريد والمشتريات"
                            description="عروض الأسعار المعلقة والاعتمادات المالية المفتوحة"
                            enabled={settings.briefingSettings?.includePurchases}
                            onToggle={() => setSettings({...settings, briefingSettings: {...settings.briefingSettings, includePurchases: !settings.briefingSettings?.includePurchases}})}
                          />
                        </div>
                      </Card>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <Button 
                        onClick={handleSaveSettings}
                        disabled={isSubmitting}
                        className="h-12 px-8 rounded-2xl bg-primary text-white font-black hover:bg-black transition-all gap-2 shadow-lg shadow-primary/20"
                      >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> حفظ تفضيلات الذكاء</>}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 6. LOCATIONS & HOUSING TAB */}
                {activeTab === 'locations' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <MapPin className="w-7 h-7 text-primary" />
                        إدارة المقرات وسكن الموظفين
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تسجيل الفروع والمعارض الرسمية وتتبع إحداثيات سكن العمال</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        
                        {/* Add Office Form */}
                        <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                          <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                            <Plus className="w-5 h-5 text-primary" />
                            تسجيل فرع أو مستودع جديد
                          </h3>
                          <form onSubmit={handleAddOffice} className="space-y-4">
                            <div className="space-y-1">
                              <Label className="font-bold text-xs text-slate-500">اسم الفرع/المقر</Label>
                              <Input 
                                required
                                placeholder="مثال: مكتب الإدارة الرئيسي، معرض الملز..."
                                value={newOffice.name}
                                onChange={(e) => setNewOffice({...newOffice, name: e.target.value})}
                                className="h-11 rounded-xl text-right bg-white border-slate-200"
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="font-bold text-xs text-slate-500">نوع المقر</Label>
                              <select 
                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                value={newOffice.type}
                                onChange={(e) => setNewOffice({...newOffice, type: e.target.value})}
                              >
                                <option value="office">مكتب إداري رئيسي</option>
                                <option value="gallery">معرض مبيعات</option>
                                <option value="warehouse">مستودع / مخزن لوجستي</option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="font-bold text-xs text-slate-500">خط العرض (Latitude)</Label>
                                <Input 
                                  required
                                  placeholder="24.7136"
                                  value={newOffice.latitude}
                                  onChange={(e) => setNewOffice({...newOffice, latitude: e.target.value})}
                                  className="h-11 rounded-xl text-right font-mono text-xs bg-white border-slate-200"
                                  dir="ltr"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="font-bold text-xs text-slate-500">خط الطول (Longitude)</Label>
                                <Input 
                                  required
                                  placeholder="46.6753"
                                  value={newOffice.longitude}
                                  onChange={(e) => setNewOffice({...newOffice, longitude: e.target.value})}
                                  className="h-11 rounded-xl text-right font-mono text-xs bg-white border-slate-200"
                                  dir="ltr"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={getCurrentLocation}
                                className="flex-1 h-11 rounded-xl gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/5 font-black text-xs"
                              >
                                <MapPin className="w-4 h-4" />
                                التقاط موقعي الحالي
                              </Button>
                              
                              <Button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="flex-1 h-11 rounded-xl font-black bg-primary hover:bg-black text-white transition-all text-xs"
                              >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ المقر'}
                              </Button>
                            </div>
                          </form>
                        </Card>

                        {/* Add Housing Form */}
                        <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                          <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                            <Home className="w-5 h-5 text-primary" />
                            إضافة سكن للموظفين والعمالة
                          </h3>
                          <form 
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.target as HTMLFormElement;
                              const newLoc = {
                                id: Math.random().toString(36).substring(2, 11),
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
                            className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100"
                          >
                            <Input name="housingName" placeholder="اسم السكن (مثال: سكن مخرج 15)" required className="h-10 rounded-xl" />
                            <Input name="housingAddress" placeholder="العنوان بالتفصيل" required className="h-10 rounded-xl" />
                            <Input name="housingCoords" placeholder="رابط خرائط جوجل أو إحداثيات (مثال: 24.5, 46.5)" className="h-10 rounded-xl text-left" dir="ltr" />
                            <Button type="submit" className="w-full h-10 rounded-xl font-black text-xs gap-2">
                              <Plus className="w-4 h-4" /> إضافة موقع السكن
                            </Button>
                          </form>
                        </Card>
                      </div>

                      {/* Display current offices & housing */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">المقارات والمنشآت الرسمية ({offices.length})</h3>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                            {offices.map(office => (
                              <div key={office.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all group">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                    <MapPin className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-black text-slate-800 leading-tight text-sm">{office.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">
                                      {office.type === 'office' ? 'مكتب إداري' : office.type === 'gallery' ? 'معرض مبيعات' : 'مستودع'} 
                                      • Lat: {office.latitude}, Lng: {office.longitude}
                                    </p>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteOffice(office.id)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl w-9 h-9"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            {offices.length === 0 && (
                              <div className="text-center py-8 bg-slate-50/40 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-400">لا توجد فروع أو معارض مضافة</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-dashed">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">مواقع سكن العمال والموظفين ({housing.length})</h3>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                            {housing.map(loc => (
                              <div key={loc.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all group">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
                                    <Home className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-black text-slate-800 leading-tight text-sm">{loc.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">{loc.address}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {loc.coordinates && (
                                    <Button 
                                      onClick={() => window.open(loc.coordinates.startsWith('http') ? loc.coordinates : `https://www.google.com/maps/search/?api=1&query=${loc.coordinates}`)}
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-9 w-9 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                                    >
                                      <Globe className="w-4 h-4" />
                                    </Button>
                                  )}
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
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl w-9 h-9"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {housing.length === 0 && (
                              <div className="text-center py-8 bg-slate-50/40 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-xs font-bold text-slate-400">لا توجد مواقع سكن مسجلة حالياً</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. BANK ACCOUNTS TAB */}
                {activeTab === 'banks' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <CreditCard className="w-7 h-7 text-primary" />
                        الحسابات البنكية وصناديق الخزينة
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تحديد حسابات المؤسسة الرسمية، وإدارة رؤوس الأموال النقدية والـ Cash</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* Add Account Card */}
                      <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-4">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <Plus className="w-5 h-5 text-primary" />
                          إضافة حساب أو خزينة كاش
                        </h3>
                        <form onSubmit={handleAddAccount} className="space-y-4">
                          <div className="space-y-1">
                            <Label className="font-bold text-xs text-slate-500">اسم الحساب (أو الصندوق المالي)</Label>
                            <Input 
                              required
                              placeholder="مثال: مصرف الراجحي المؤسسي، خزينة العهدة..."
                              value={newAccount.name}
                              onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white border-slate-200"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="font-bold text-xs text-slate-500">نوع الصندوق</Label>
                            <select 
                              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                              value={newAccount.type}
                              onChange={(e) => setNewAccount({...newAccount, type: e.target.value as any})}
                            >
                              <option value="bank">حساب بنكي (Bank Account)</option>
                              <option value="cash">خزينة مكتبية / نقد كاش (Vault Cash)</option>
                            </select>
                          </div>

                          {newAccount.type === 'bank' && (
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                              <Label className="font-bold text-xs text-slate-500">رقم الآيبان (IBAN)</Label>
                              <Input 
                                placeholder="SA0000000000000000000000"
                                value={newAccount.iban}
                                onChange={(e) => setNewAccount({...newAccount, iban: e.target.value})}
                                className="h-11 rounded-xl text-left font-mono"
                                dir="ltr"
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <Label className="font-bold text-xs text-slate-500">الرصيد الافتتاحي المقدر (ر.س)</Label>
                            <Input 
                              type="number"
                              placeholder="0.00"
                              value={newAccount.initialBalance}
                              onChange={(e) => setNewAccount({...newAccount, initialBalance: e.target.value})}
                              className="h-11 rounded-xl text-right bg-white border-slate-200"
                            />
                          </div>

                          <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full h-12 rounded-xl font-black bg-primary hover:bg-black text-white transition-all text-xs"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تسجيل وحفظ الحساب المالي'}
                          </Button>
                        </form>
                      </Card>

                      {/* Display bank accounts list */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">الحسابات والصناديق النشطة ({bankAccounts.length})</h3>
                        
                        <div className="space-y-3 max-h-[450px] overflow-y-auto no-scrollbar">
                          {bankAccounts.map(account => (
                            <div key={account.id} className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-[2rem] transition-all group">
                              <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl transition-all ${
                                  account.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {account.type === 'bank' ? <CreditCard className="w-4.5 h-4.5" /> : <Wallet className="w-4.5 h-4.5" />}
                                </div>
                                <div>
                                  <h4 className="font-black text-slate-800 leading-tight text-sm">{account.name}</h4>
                                  <p className="text-[10px] font-bold text-slate-400 mt-1">
                                    {account.type === 'bank' ? `IBAN: ${account.iban || ' SA...'}` : 'خزينة عهدة كاش'} 
                                    • الرصيد: <strong className="text-slate-700">{account.initialBalance.toLocaleString()} ر.س</strong>
                                  </p>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteAccount(account.id)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl w-9 h-9"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}

                          {bankAccounts.length === 0 && (
                            <div className="p-8 text-center bg-slate-50/40 rounded-[2rem] border border-dashed border-slate-200">
                               <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-55" />
                               <p className="text-xs font-bold text-slate-400">لا يوجد حسابات مالية مضافة للنظام</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 8. VISUAL IDENTITY & THEMES TAB */}
                {activeTab === 'theme' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Paintbrush className="w-7 h-7 text-primary animate-[bounce_2s_infinite]" />
                        تخصيص المظهر والهوية البصرية
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تحديد طابع النظام، الألوان الخاصة، وتعديل إعلانات شاشة الترحيب</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      
                      {/* Theme settings form */}
                      <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-6">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <Palette className="w-5 h-5 text-primary" />
                          ألوان وسمات الواجهة
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500 flex justify-between px-1">
                              <span>لون القائمة الجانبية (Sidebar)</span>
                              <span className="font-mono text-xs text-slate-400" dir="ltr">{settings.sidebarColor}</span>
                            </Label>
                            <div className="flex gap-3">
                              <Input 
                                type="color"
                                value={settings.sidebarColor}
                                onChange={(e) => setSettings({...settings, sidebarColor: e.target.value})}
                                className="w-16 h-12 p-1 rounded-xl cursor-pointer border border-slate-200 bg-white"
                              />
                              <Input 
                                type="text"
                                value={settings.sidebarColor}
                                onChange={(e) => setSettings({...settings, sidebarColor: e.target.value})}
                                className="flex-1 h-12 rounded-xl text-left font-mono border border-slate-200 bg-white focus:ring-primary/20"
                                dir="ltr"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="font-bold text-xs text-slate-500 flex justify-between px-1">
                              <span>اللون الأساسي المتوهج (Primary Accent)</span>
                              <span className="font-mono text-xs text-slate-400" dir="ltr">{settings.primaryColor}</span>
                            </Label>
                            <div className="flex gap-3">
                              <Input 
                                type="color"
                                value={settings.primaryColor}
                                onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                                className="w-16 h-12 p-1 rounded-xl cursor-pointer border border-slate-200 bg-white"
                              />
                              <Input 
                                type="text"
                                value={settings.primaryColor}
                                onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                                className="flex-1 h-12 rounded-xl text-left font-mono border border-slate-200 bg-white focus:ring-primary/20"
                                dir="ltr"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest border-r-2 border-primary pr-2">خيارات الواجهة الإضافية</p>
                          
                          <SettingToggle 
                            title="مؤثرات المظهر الزجاجي (Glassmorphism)"
                            description="إضافة مؤثرات التمويه والشفافية الرائعة للنظام"
                            enabled={(settings as any).enableGlassEffect || false}
                            onToggle={() => setSettings({...settings, enableGlassEffect: !(settings as any).enableGlassEffect} as any)}
                          />

                          <div className="space-y-1.5 pt-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase">📢 شريط الإعلانات العام (لكل المستخدمين)</Label>
                            <Input 
                              value={settings.generalAnnouncement || ""}
                              onChange={(e) => setSettings({...settings, generalAnnouncement: e.target.value} as any)}
                              className="h-10 text-xs rounded-xl bg-white border-slate-200"
                              placeholder="أدخل رسالة تظهر كشريط علوي لكل الموظفين..."
                            />
                          </div>
                          
                          <div className="pt-2">
                             <SettingToggle 
                              title="شاشة الترحيب الذكية (Onboarding)"
                              description="تفعيل ظهور رسالة ترحيبية وإرشادات عند بدء الدخول"
                              enabled={settings.showWelcomeMessage !== false}
                              onToggle={() => setSettings({...settings, showWelcomeMessage: settings.showWelcomeMessage === false} as any)}
                            />
                          </div>

                          {settings.showWelcomeMessage !== false && (
                            <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                              {['manager', 'supervisor', 'employee'].map((role) => (
                                <div key={role} className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3 shadow-inner">
                                  <Label className="text-xs font-black text-primary uppercase">
                                    {role === 'manager' ? '👑 رسائل المدير العام' : role === 'supervisor' ? '⚡ رسائل المشرف' : '💎 رسائل الموظف'}
                                  </Label>
                                  <div className="space-y-2">
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
                                      className="h-9 text-xs rounded-lg"
                                      placeholder="مثال: أهلاً بك أيها القائد..."
                                    />
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
                                      className="w-full min-h-[70px] p-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 outline-none"
                                      placeholder="نصائح تظهر أسفل الترحيب (افصل بفاصلة ,)"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label className="font-bold text-xs text-slate-500">حواف الأزرار والبطاقات (Radius)</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { id: 'none', label: 'حادة 📐', val: '0px' },
                                { id: 'sm', label: 'كلاسيك 📂', val: '4px' },
                                { id: 'md', label: 'دائرية 📱', val: '12px' },
                                { id: 'lg', label: 'انسيابية 🔮', val: '24px' }
                              ].map((r) => (
                                <button
                                  type="button"
                                  key={r.id}
                                  onClick={() => setSettings({...settings, borderRadius: r.val} as any)}
                                  className={`py-2 rounded-xl text-[11px] font-black border transition-all ${
                                    (settings as any).borderRadius === r.val 
                                    ? 'bg-primary border-primary text-white shadow-sm' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-primary/20'
                                  }`}
                                >
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
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
                                toast.success('تم حفظ وتثبيت ثيمك الخاص بنجاح');
                              } catch (err) {
                                toast.error('فشل في حفظ الثيم الخاص بك');
                              } finally {
                                setIsSubmitting(false);
                              }
                            }}
                            disabled={isSubmitting}
                            className="w-full h-12 rounded-2xl font-black bg-slate-900 text-white hover:bg-black transition-all gap-2 text-xs"
                          >
                            <Save className="w-4 h-4" /> حفظ في ثيمي الخاص
                          </Button>

                          {isManager && (
                            <Button 
                              onClick={handleSaveSettings}
                              disabled={isSubmitting}
                              variant="outline"
                              className="w-full h-11 rounded-2xl font-black border-2 border-primary text-primary hover:bg-primary/5 transition-all gap-2 text-xs"
                            >
                              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Globe className="w-4 h-4" /> تطبيق للجميع بالمنشأة</>}
                            </Button>
                          )}
                        </div>
                      </Card>

                      {/* Display preset templates */}
                      <Card className="rounded-[2.5rem] border-none bg-slate-50/50 shadow-sm p-6 space-y-6">
                        <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                          <Palette className="w-5 h-5 text-primary" />
                          سمات وستايلات فخمة جاهزة
                        </h3>
                        <p className="text-xs font-bold text-slate-400">اختر من تشكيلتنا المصممة بعناية لتلائم ذوقك ونظامك بضغطة زر واحدة</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { name: "الهوية العامة (Default)", sidebar: "#1a4d4e", primary: "#2c7a7d", radius: "12px", glass: false },
                            { name: "النايت أليت (Elite Dark)", sidebar: "#020617", primary: "#6366f1", radius: "12px", glass: true },
                            { name: "العصرية (Modern)", sidebar: "#fafafa", primary: "#10b981", radius: "24px", glass: true },
                            { name: "الفخامة الكلاسيكية (Luxury)", sidebar: "#1c1917", primary: "#d4af37", radius: "0px", glass: false },
                            { name: "تقنية المستقبل (Tech Cyber)", sidebar: "#0f172a", primary: "#38bdf8", radius: "8px", glass: true },
                            { name: "الربيع المفعم (Classic)", sidebar: "#27272a", primary: "#f43f5e", radius: "4px", glass: false },
                          ].map((theme, i) => (
                            <button
                              type="button"
                              key={i}
                              onClick={() => setSettings({
                                ...settings, 
                                sidebarColor: theme.sidebar, 
                                primaryColor: theme.primary,
                                borderRadius: theme.radius,
                                enableGlassEffect: theme.glass
                              } as any)}
                              className="flex flex-col gap-3 p-4 rounded-2xl border bg-white hover:border-primary/40 hover:bg-slate-50/60 transition-all text-right shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-slate-700">{theme.name}</span>
                                {theme.glass && <Badge className="bg-blue-500/10 text-blue-500 rounded-md border-none p-0 px-1 text-[8px] scale-90">زجاجي</Badge>}
                              </div>
                              <div className="flex h-10 rounded-xl overflow-hidden border border-slate-100 shadow-inner">
                                <div className="w-1/3" style={{ backgroundColor: theme.sidebar }} />
                                <div className="w-2/3 animate-pulse" style={{ backgroundColor: theme.primary }} />
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex gap-2">
                          <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold text-slate-500 leading-normal">
                            ملاحظة: السمات ذات الطابع الزجاجي تستخدم الشفافية المتأصلة مما يعطي جمالية ملفتة عند التمرير والعمل على الأجهزة الذكية.
                          </p>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* 9. DATA RESET & DATABASE SECURITY TAB */}
                {activeTab === 'data' && (
                  <div className="space-y-8">
                    <div className="border-b pb-4">
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Database className="w-7 h-7 text-red-600" />
                        إدارة البيانات وصيانة النظام
                      </h2>
                      <p className="text-xs font-bold text-slate-400 mt-1">تفريغ قواعد البيانات التجريبية، تهيئة الكاش، وضوابط الوصول للملفات</p>
                    </div>

                    <Card className="rounded-[2.5rem] border border-red-100 overflow-hidden bg-red-50/10">
                      <div className="p-6 bg-red-500/10 border-b border-red-100 flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                        <div>
                          <h3 className="text-lg font-black text-red-950">منطقة الأمان الحساسة للغاية</h3>
                          <p className="text-xs font-bold text-red-700">هذه الإجراءات غير قابلة للتراجع وتؤثر على كامل المنشأة مباشرة</p>
                        </div>
                      </div>

                      <CardContent className="p-6 space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <span className="w-7 h-7 bg-red-100 text-red-600 font-black rounded-full inline-flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">حذف وتطهير البيانات التجريبية</h4>
                              <p className="text-xs font-bold text-slate-500 leading-relaxed mt-1">
                                سيقوم هذا الإجراء بإزالة كامل المشاريع، المعاملات، القيود اليومية، المشتريات، ملفات المناديب، الحضور والانصراف، والعمالة. 
                                لن يتم مسح بيانات حسابك كمدير أو حسابات البنوك لتسهيل البدء الفعلي.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-4 border-t pt-4">
                            <span className="w-7 h-7 bg-red-100 text-red-600 font-black rounded-full inline-flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                            <div>
                              <h4 className="text-sm font-black text-slate-800">حظر وتطهير الموظفين والعمالة</h4>
                              <p className="text-xs font-bold text-slate-500 leading-relaxed mt-1">
                                سيتم إزالة حسابات المشرفين والموظفين والمناديب المرتبطين للمنشأة بشكل كامل لإتاحة تسجيل فريق عملك الحقيقي على بياض.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actions buttons container */}
                        <div className="pt-6 border-t border-slate-100 space-y-6">
                          
                          {/* Cache clean */}
                          <div className="space-y-2">
                             <h4 className="text-sm font-black text-slate-800 leading-none">تهيئة الذاكرة المؤقتة (Clear Cache)</h4>
                             <p className="text-[10px] font-bold text-slate-400">امسح الكوكيز والبيانات المخزنة محلياً بالمتصفح لتحديث الواجهات وحل المشاكل الفنية الطارئة دون المساس بالبيانات في السحابة.</p>
                             <Button 
                               onClick={handleClearCache}
                               variant="outline"
                               className="w-full h-12 rounded-xl font-black bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 text-xs gap-2"
                             >
                               <RefreshCw className="w-4 h-4" />
                               تهيئة الكاش وإعادة تشغيل النظام
                             </Button>
                          </div>

                          {/* Factory Reset */}
                          <div className="pt-4 border-t border-red-100/50">
                             <h4 className="text-sm font-black text-red-900 mb-2 leading-none">إعادة ضبط المصنع وتطهير الخادم</h4>
                             <p className="text-[10px] font-bold text-red-700 mb-4">احذف كامل الأنشطة والمشاريع والموردين للبدء فوراً في العمل الفعلي الفوري.</p>
                             
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button 
                                   className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs gap-2 shadow-lg shadow-red-100"
                                 >
                                   <Trash className="w-4 h-4" />
                                   تطهير النظام وإعادة ضبط المصنع الكامل
                                 </Button>
                               </AlertDialogTrigger>
                               
                               <AlertDialogContent className="rounded-3xl border-none">
                                 <AlertDialogHeader>
                                   <AlertDialogTitle className="text-xl font-black text-red-900 text-right">هل أنت متأكد تماماً من قرار الحذف؟</AlertDialogTitle>
                                   <AlertDialogDescription className="text-sm font-bold text-slate-500 text-right mt-2">
                                     هذا الإجراء سيقوم بحذف كافة السجلات والمشاريع والعمالة والمعاملات بشكل قطعي. لن تتوفر صلاحية تراجع أو استعادة.
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 
                                 <AlertDialogFooter className="flex flex-row-reverse gap-2 sm:justify-start mt-4">
                                   <AlertDialogAction 
                                     variant="destructive" size="default"
                                     onClick={handleSystemReset}
                                     className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black px-6"
                                   >
                                     نعم، امسح البيانات نهائياً
                                   </AlertDialogAction>
                                   <AlertDialogCancel variant="outline" size="default" className="bg-slate-100 hover:bg-slate-200 border-none rounded-xl font-black px-6">
                                     إلغاء الأمر
                                   </AlertDialogCancel>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}

// PREMIUM CUSTOM TOGGLE BUTTON COMPONENT
function SettingToggle({ title, description, enabled, onToggle }: { 
  title: string; 
  description: string; 
  enabled: boolean; 
  onToggle: () => void; 
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200/60 hover:border-primary/20 hover:shadow-sm transition-all duration-200 select-none">
      <div className="space-y-1">
        <p className="text-sm font-black text-slate-800 leading-tight">{title}</p>
        <p className="text-[10px] font-bold text-slate-400 leading-snug">{description}</p>
      </div>
      <button 
        type="button"
        onClick={onToggle}
        className={`w-12 h-6.5 rounded-full relative transition-colors duration-300 focus:outline-none shrink-0 ${enabled ? 'bg-primary' : 'bg-slate-200'}`}
      >
        <div className={`absolute top-1 left-1 w-4.5 h-4.5 bg-white rounded-full transition-all duration-300 transform shadow-sm ${enabled ? 'translate-x-5.5' : ''}`} />
      </button>
    </div>
  );
}
