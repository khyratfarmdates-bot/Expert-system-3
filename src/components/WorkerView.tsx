import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ChevronRight, 
  Phone, 
  CreditCard, 
  Download, 
  Calendar, 
  History, 
  Plus, 
  Minus, 
  Star,
  Loader2,
  Trash2,
  AlertTriangle,
  Zap,
  Shield,
  DollarSign,
  CheckCircle2,
  SendHorizontal,
  Share2,
  Bell,
  Banknote,
  Building2,
  ShieldAlert,
  Clock,
  Smartphone,
  Check
} from 'lucide-react';
import { softDelete } from '@/lib/softDelete';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  where,
  doc,
  deleteDoc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { sendNotification } from '@/lib/notifications';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { exportToCSV } from '../lib/export';
import { exportToPDF } from '../lib/pdfExport';
import PrintableReport from './PrintableReport';
import ExportDateRangeDialog from './ExportDateRangeDialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WorkerViewProps {
  workerId: string;
  onBack: () => void;
  readOnly?: boolean;
}

export default function WorkerView({ workerId, onBack, readOnly = false }: WorkerViewProps) {
  const { profile } = useAuth();
  const [worker, setWorker] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [workerNotifications, setWorkerNotifications] = useState<any[]>([]);
  const [bankAccountInput, setBankAccountInput] = useState('');
  const [isUpdatingBank, setIsUpdatingBank] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLanguage, setShareLanguage] = useState<'ar' | 'en' | 'ur' | 'bn' | 'hi'>('ar');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAckLoading, setIsAckLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'default');

  const queryParams = new URLSearchParams(window.location.search);
  const currentLang = (queryParams.get('lang') as 'ar' | 'en' | 'ur' | 'bn' | 'hi') || 'ar';

  const translations = {
    ar: {
      workerProfile: "ملف العامل",
      role: "المسمى الوظيفي",
      phone: "رقم الجوال",
      dailyRate: "اليومية",
      attendance: "إثبات حضور جديد",
      payments: "تسجيل دفعة / خصم",
      shareLink: "مشاركة الرابط",
      totalEarned: "إجمالي اليوميات",
      totalBonuses: "إجمالي المكافآت",
      totalPaid: "إجمالي المدفوعات",
      totalDeductions: "خصومات وغرامات",
      remainingBalance: "الرصيد المتبقي",
      settleBalance: "يرجى تسوية الرصيد قريباً",
      reliability: "الالتزام بالموقع",
      high: "عالي",
      notifications: "إشعارات الإدارة",
      lastMessages: "آخر الرسائل والتوجيهات الموجهة لك",
      attendanceTab: "سجل الحضور",
      financeTab: "الحركات المالية",
      date: "التاريخ",
      project: "المشروع",
      amount: "المبلغ",
      action: "إجراء",
      bankAccount: "الحساب البنكي (IBAN)",
      save: "حفظ",
      back: "رجوع",
      notAvailable: "غير متاح",
      available: "متاح للعمل",
      noNotifications: "لا توجد إشعارات حالياً",
      acknowledge: "تأكيد الاستلام",
      acknowledged: "تم تأكيد الاستلام والفهم",
      waitingAcknowledge: "بانتظار تأكيد العامل",
      adminAlert: "تنبيه إداري رسمي",
      sendAlert: "إرسال تنبيه عاجل",
      sendMessage: "إرسال رسالة عادية",
      sar: "ر.س",
      general: "عام",
      accountReport: "كشف حساب",
      exportPDF: "تصدير كشف حساب فاخر",
      exportCSV: "تصدير ملف Excel",
      bankUpdate: "تم حفظ الحساب البنكي بنجاح",
      bankError: "حدث خطأ أثناء حفظ البيانات",
      copyLinkOnly: "نسخ الرابط فقط",
      shareViaWhatsapp: "مشاركة عبر واتساب",
      shareDialogTitle: "مشاركة رابط العامل",
      shareDialogDesc: "اختر لغة الرسالة التي ترغب في إرسالها للعامل عبر واتساب."
    },
    en: {
      workerProfile: "Worker Profile",
      role: "Job Role",
      phone: "Phone Number",
      dailyRate: "Daily Rate",
      attendance: "Mark New Attendance",
      payments: "Record Payment/Deduction",
      shareLink: "Share Link",
      totalEarned: "Total Earned",
      totalBonuses: "Total Bonuses",
      totalPaid: "Total Paid",
      totalDeductions: "Deductions",
      remainingBalance: "Remaining Balance",
      settleBalance: "Balance settlement due soon",
      reliability: "Site Reliability",
      high: "High",
      notifications: "Admin Notifications",
      lastMessages: "Latest messages and directions for you",
      attendanceTab: "Attendance Log",
      financeTab: "Financial Actions",
      date: "Date",
      project: "Project",
      amount: "Amount",
      action: "Action",
      bankAccount: "Bank Account (IBAN)",
      save: "Save",
      back: "Back",
      notAvailable: "Not Available",
      available: "Available for Work",
      noNotifications: "No current notifications",
      acknowledge: "Confirm Receipt",
      acknowledged: "Receipt & understanding confirmed",
      waitingAcknowledge: "Waiting for worker confirmation",
      adminAlert: "Official Admin Alert",
      sendAlert: "Send Urgent Alert",
      sendMessage: "Send Regular Message",
      sar: "SAR",
      general: "General",
      accountReport: "Account Statement",
      exportPDF: "Export Premium Statement",
      exportCSV: "Export Excel File",
      bankUpdate: "Bank account saved successfully",
      bankError: "Error saving bank details",
      copyLinkOnly: "Copy link only",
      shareViaWhatsapp: "Share via WhatsApp",
      shareDialogTitle: "Share Worker Link",
      shareDialogDesc: "Choose the message language to send via WhatsApp."
    },
    ur: {
      workerProfile: "ورکر پروفائل",
      role: "عہدہ",
      phone: "فون نمبر",
      dailyRate: "یومیہ اجرت",
      attendance: "حاضری درج کریں",
      payments: "ادائیگی/کٹوتی درج کریں",
      shareLink: "لنک شیئر کریں",
      totalEarned: "کل کمائی",
      totalBonuses: "کل بونس",
      totalPaid: "کل ادائیگی",
      totalDeductions: "کٹوتیاں",
      remainingBalance: "بقیہ رقم",
      settleBalance: "جلد تصفیہ متوقع ہے",
      reliability: "سائٹ پر حاضری",
      high: "بہترین",
      notifications: "انتظامی اطلاعات",
      lastMessages: "آپ کے لیے تازہ ترین پیغامات",
      attendanceTab: "حاضری کا ریکارڈ",
      financeTab: "مالی لین دین",
      date: "تاریخ",
      project: "پراجیکٹ",
      amount: "رقم",
      action: "کارروائی",
      bankAccount: "بینک اکاؤنٹ (IBAN)",
      save: "محفوظ کریں",
      back: "واپس",
      notAvailable: "دستیاب نہیں",
      available: "کام کے لیے دستیاب",
      noNotifications: "کوئی اطلاع نہیں ہے",
      acknowledge: "وصولی کی تصدیق",
      acknowledged: "وصولی کی تصدیق ہو گئی",
      waitingAcknowledge: "ورکر کی تصدیق کا انتظار ہے",
      adminAlert: "سرکاری انتظامی الرٹ",
      sendAlert: "فوری الرٹ بھیجیں",
      sendMessage: "عام پیغام بھیجیں",
      sar: "ریاط",
      general: "عام",
      accountReport: "اکاؤنٹ اسٹیٹمنٹ",
      exportPDF: "رپورٹ ڈاؤن لوڈ کریں",
      exportCSV: "ایکسل فائل ڈاؤن لوڈ کریں",
      bankUpdate: "بینک تفصیلات محفوظ ہو گئیں",
      bankError: "محفوظ کرنے میں غلطی ہوئی",
      copyLinkOnly: "صرف لنک کاپی کریں",
      shareViaWhatsapp: "واٹس ایپ پر شیئر کریں",
      shareDialogTitle: "ورکر لنک شیئر کریں",
      shareDialogDesc: "پیغام کی زبان منتخب کریں۔"
    },
    bn: {
      workerProfile: "কর্মীর প্রোফাইল",
      role: "পদবি",
      phone: "ফোন নম্বর",
      dailyRate: "দৈনিক মজুরি",
      attendance: "নতুন হাজিরা দিন",
      payments: "পেমেন্ট/ডিডাকশন রেকর্ড",
      shareLink: "লিঙ্ক শেয়ার করুন",
      totalEarned: "মোট উপার্জন",
      totalBonuses: "মোট বোনাস",
      totalPaid: "মোট প্রদান",
      totalDeductions: "কর্তন",
      remainingBalance: "অবশিষ্ট ব্যালেন্স",
      settleBalance: "শীঘ্রই ব্যালেন্স সেটেল হবে",
      reliability: "সাইটে নির্ভরযোগ্যতা",
      high: "উচ্চ",
      notifications: "অ্যাডমিন বিজ্ঞপ্তি",
      lastMessages: "আপনার জন্য সর্বশেষ বার্তা",
      attendanceTab: "হাজিরা লগ",
      financeTab: "আর্থিক লেনদেন",
      date: "তারিখ",
      project: "প্রকল্প",
      amount: "পরিমাণ",
      action: "পদক্ষেপ",
      bankAccount: "ব্যাংক অ্যাকাউন্ট (IBAN)",
      save: "সংরক্ষণ করুন",
      back: "পিছনে",
      notAvailable: "উপলব্ধ নেই",
      available: "কাজের জন্য প্রস্তুত",
      noNotifications: "কোনো বিজ্ঞপ্তি নেই",
      acknowledge: "প্রাপ্তি স্বীকার",
      acknowledged: "প্রাপ্তি স্বীকার নিশ্চিত",
      waitingAcknowledge: "কর্মীর নিশ্চিতকরণের অপেক্ষায়",
      adminAlert: "অফিসিয়াল সতর্কতা",
      sendAlert: "জরুরি সতর্কতা পাঠান",
      sendMessage: "সাধারণ বার্তা পাঠান",
      sar: "রিয়াল",
      general: "সাধারণ",
      accountReport: "অ্যাকাউন্ট স্টেটমেন্ট",
      exportPDF: "পিডিএফ ডাউনলোড করুন",
      exportCSV: "এক্সেল ফাইল ডাউনলোড করুন",
      bankUpdate: "ব্যাংক অ্যাকাউন্ট সংরক্ষিত হয়েছে",
      bankError: "সংরক্ষণ করতে ত্রুটি হয়েছে",
      copyLinkOnly: "শুধুমাত্র লিঙ্ক কপি",
      shareViaWhatsapp: "হোয়াটসঅ্যাপে শেয়ার",
      shareDialogTitle: "লিঙ্ক শেয়ার করুন",
      shareDialogDesc: "বার্তার ভাষা নির্বাচন করুন।"
    },
    hi: {
      workerProfile: "वर्कर प्रोफाइल",
      role: "पद",
      phone: "फ़ोन नंबर",
      dailyRate: "दैनिक वेतन",
      attendance: "हाजिरी लगाएँ",
      payments: "भुगतान/कटौती दर्ज करें",
      shareLink: "लिंक साझा करें",
      totalEarned: "कुल कमाई",
      totalBonuses: "कुल बोनस",
      totalPaid: "कुल भुगतान",
      totalDeductions: "कटौती",
      remainingBalance: "शेष राशि",
      settleBalance: "जल्द ही भुगतान होने वाला है",
      reliability: "विश्वसनीयता",
      high: "उच्च",
      notifications: "व्यवस्थापक सूचनाएं",
      lastMessages: "आपके लिए नवीनतम संदेश",
      attendanceTab: "हाजिरी का रिकॉर्ड",
      financeTab: "वित्तीय लेनदेन",
      date: "तारीख",
      project: "परियोजना",
      amount: "राशि",
      action: "कार्रवाई",
      bankAccount: "बैंक खाता (IBAN)",
      save: "सहेजें",
      back: "पीछे",
      notAvailable: "उपलब्ध नहीं",
      available: "काम के लिए उपलब्ध",
      noNotifications: "कोई सूचना नहीं है",
      acknowledge: "पावती की पुष्टि",
      acknowledged: "पावती की पुष्टि हो गई",
      waitingAcknowledge: "वर्कर की पुष्टि का इंतज़ार है",
      adminAlert: "आधिकारिक अलर्ट",
      sendAlert: "त्वरित अलर्ट भेजें",
      sendMessage: "सामान्य संदेश भेजें",
      sar: "रियाल",
      general: "सामान्य",
      accountReport: "खाता विवरण",
      exportPDF: "रिपोर्ट डाउनलोड करें",
      exportCSV: "एक्सेल डाउनलोड करें",
      bankUpdate: "बैंक विवरण सहेजा गया",
      bankError: "सहेजने में त्रुटि हुई",
      copyLinkOnly: "केवल लिंक कॉपी करें",
      shareViaWhatsapp: "व्हाट्सएप पर साझा करें",
      shareDialogTitle: "लिंक साझा करें",
      shareDialogDesc: "संदेश की भाषा चुनें।"
    }
  };

  const t = translations[currentLang];

  const changeLanguage = (lang: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.location.href = url.toString();
  };

  const shareMessages = {
    ar: {
      label: 'العربية',
      msg: (name: string, url: string) => `السلام عليكم يا ${name}، هذا رابط ملفك الشخصي في شركة خبراء الرسم لمتابعة حضورك وأجورك اليومية والدفعات المستلمة. يمكنك فتح الرابط في أي وقت: \n\n${url}`
    },
    en: {
      label: 'English',
      msg: (name: string, url: string) => `Hello ${name}, this is your personal work link at Experts Painting Co. to track your attendance, daily wages, and payments. You can open it anytime: \n\n${url}`
    },
    ur: {
      label: 'اردو (Urdu)',
      msg: (name: string, url: string) => `سلام ${name}، یہ آپ کے حاضری، یومیہ اجرت اور ادائیگیوں کو ٹریک کرنے کے لیے ایکسپرٹس پینٹنگ کمپنی میں آپ کا ذاتی کام کا لنک ہے۔ آپ اسے کسی بھی وقت کھول سکتے ہیں: \n\n${url}`
    },
    bn: {
      label: 'বাংলা (Bengali)',
      msg: (name: string, url: string) => `হ্যালো ${name}, এটি এক্সপার্টস পেইন্টিং কোং-এ আপনার উপস্থিতি, দৈনিক মজুরি এবং অর্থপ্রদান ট্র্যাক করার জন্য আপনার ব্যক্তিগত কাজের লিঙ্ক। আপনি এটি যে কোনো সময় খুলতে পারেন: \n\n${url}`
    },
    hi: {
      label: 'हिन्दी (Hindi)',
      msg: (name: string, url: string) => `नमस्ते ${name}, यह एक्सपर्ट्स पेंटिंग कंपनी में आपकी उपस्थिति, दैनिक मजدूरी और भुगतान को ट्रैक करने के लिए आपका व्यक्तिगत कार्य लिंक है। आप इसे कभी भी खोल सकते हैं: \n\n${url}`
    }
  };

  const fullReportData = useMemo(() => {
    if (!worker) return [];
    
    const logData = logs.map(l => {
      const project = projects.find(p => p.id === l.projectId);
      return {
        dateOriginal: l.date,
        date: l.date,
        type: 'يومية عمل',
        amount: l.amountEarned,
        description: `مستحقات يومية - مشروع: ${project?.title || 'غير محدد'}`
      };
    });

    const txData = transactions.map(t => ({
      dateOriginal: t.date,
      date: new Date(t.date).toLocaleString('ar-SA'),
      type: t.type === 'payment' ? 'دفعة مستلمة' : t.type === 'bonus' ? 'مكافأة' : 'خصم',
      amount: t.type === 'payment' || t.type === 'deduction' ? -t.amount : t.amount,
      description: t.description
    }));

    return [...logData, ...txData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [worker, logs, transactions, projects]);


  // Forms
  const [logForm, setLogForm] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    amount: ''
  });

  const [criticalNotif, setCriticalNotif] = useState<any>(null);
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);

  const [txForm, setTxForm] = useState({
    projectId: '',
    type: 'payment',
    amount: '',
    description: ''
  });

  useEffect(() => {
    // Fetch worker data
    const fetchWorker = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'workers', workerId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWorker({ id: docSnap.id, ...data });
          setLogForm(prev => ({ ...prev, amount: data.dailyRate?.toString() || '0' }));
        } else {
          toast.error('العامل غير موجود');
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching worker:", error);
        if (!readOnly) toast.error('خطأ في تحميل بيانات العامل');
        setLoading(false);
      }
    };

    fetchWorker();

    // Fetch projects for selection (admin only or cached)
    const unsubProjects = onSnapshot(query(collection(db, 'projects')), 
      (snapshot) => {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => console.error("Projects access denied:", error)
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'dailyLogs'), where('workerId', '==', workerId), orderBy('date', 'desc')),
      (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => {
        console.error("Logs access denied:", error);
        if (readOnly) setLoading(false); // Stop loading if this was the last expected data
      }
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'workerTransactions'), where('workerId', '==', workerId), orderBy('date', 'desc')),
      (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Transactions access denied:", error);
        setLoading(false);
      }
    );

    const unsubNotifications = onSnapshot(
      query(collection(db, 'workerNotifications'), where('workerId', '==', workerId), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const docChanges = snapshot.docChanges();
        const newNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorkerNotifications(newNotifs);
        
        if (readOnly && docChanges.length > 0) {
          docChanges.forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              
              if (data.requiresAcknowledge && !data.acknowledged) {
                setCriticalNotif({ id: change.doc.id, ...data });
                setIsCriticalModalOpen(true);
              }

              // Check if it's new (last 2 minutes) for sound and toast
              const isRecent = data.createdAt?.toMillis ? (Date.now() - data.createdAt.toMillis() < 60000) : true;
              if (isRecent) {
                try {
                  const audioUrl = data.priority === 'critical' ? 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3' : 'https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3';
                  const audio = new Audio(audioUrl);
                  audio.play().catch(e => console.error("Audio play failed:", e));
                } catch(e) {}
                
                toast.error(data.title || 'إشعار من الإدارة', {
                  description: data.message,
                  duration: 20000,
                  icon: <AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" />
                });

                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                   new Notification(data.title || 'تنبيه من إدارة المتجر', { body: data.message });
                }
              }
            }
          });
        }
      },
      (error) => console.error("Notifications access denied:", error)
    );

    if (readOnly && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    return () => {
      unsubProjects();
      unsubLogs();
      unsubTx();
      unsubNotifications();
    };
  }, [workerId, readOnly]);

  const handleAcknowledge = async (notifId?: string | React.MouseEvent) => {
    const targetId = typeof notifId === 'string' ? notifId : criticalNotif?.id;
    if (!targetId) return;
    setIsAckLoading(true);
    try {
      await updateDoc(doc(db, 'workerNotifications', targetId), {
        acknowledged: true,
        acknowledgedAt: serverTimestamp()
      });

      // Notify admin about the acknowledgement
      if (criticalNotif?.createdBy) {
        await addDoc(collection(db, 'notifications'), {
          title: `تم استلام التنبيه: ${worker?.name}`,
          message: `أكد العامل ${worker?.name} استلامه وفهمه للرسالة: ${criticalNotif.message.substring(0, 50)}...`,
          type: 'success',
          category: 'system',
          timestamp: serverTimestamp(),
          read: false,
          targetRole: 'manager',
          workerId: worker?.id
        });
      }

      // Also update local results to avoid flicker
      setWorkerNotifications(prev => prev.map(n => n.id === targetId ? { ...n, acknowledged: true, acknowledgedAt: { toDate: () => new Date() } } : n));
      
      if (criticalNotif?.id === targetId) {
        setIsCriticalModalOpen(false);
        setCriticalNotif(null);
      }
      toast.success(t.acknowledged, {
        icon: '✅'
      });
    } catch (e) {
      console.error("Acknowledge error:", e);
      toast.error(t.bankError);
    } finally {
      setIsAckLoading(false);
    }
  };

  const requestNotifPermission = () => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(permission => {
        setNotifPermission(permission);
        if (permission === 'granted') {
          toast.success('تم تفعيل التنبيهات بنجاح');
          new Notification('تم التفعيل', { body: 'ستصلك التنبيهات الإدارية هنا' });
        }
      });
    }
  };

  const testNotifSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3');
      audio.play();
      toast.info('إذا سمعت الصوت، فإن التنبيهات تعمل جيداً');
    } catch (e) {
      toast.error('لم نتمكن من تشغيل الصوت، تأكد من إعدادات المتصفح');
    }
  };
  const handleUpdateBankAccount = async () => {
    if (!bankAccountInput.trim()) return;
    setIsUpdatingBank(true);
    try {
      await updateDoc(doc(db, 'workers', workerId), {
        bankAccount: bankAccountInput.trim(),
        bankAccountUpdatedAt: serverTimestamp()
      });
      toast.success('تم حفظ الحساب البنكي بنجاح');
      setWorker((prev: any) => ({ ...prev, bankAccount: bankAccountInput.trim() }));
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ البيانات');
      console.error(error);
    } finally {
      setIsUpdatingBank(false);
    }
  };

  const myProjectIds = Array.from(new Set(logs.map(l => l.projectId)));
  const myProjects = projects.filter(p => myProjectIds.includes(p.id));

  const totalEarned = logs.reduce((acc, log) => acc + (log.amountEarned || 0), 0);
  const totalBonuses = transactions.filter(t => t.type === 'bonus').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalDeductions = transactions.filter(t => t.type === 'deduction').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalPaid = transactions.filter(t => t.type === 'payment').reduce((acc, t) => acc + (t.amount || 0), 0);
  
  const balance = (totalEarned + totalBonuses) - (totalPaid + totalDeductions);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !worker) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'dailyLogs'), {
        workerId,
        projectId: logForm.projectId,
        date: logForm.date,
        amountEarned: parseFloat(logForm.amount || '0'),
        createdBy: profile.uid
      });

      await sendNotification({
        title: 'تسجيل إنتاجية يومية',
        message: `تم تسجيل يومية جديدة لـ ${worker.name} بقيمة ${logForm.amount} ر.س بتاريخ ${logForm.date}`,
        type: 'info',
        category: 'employee',
        targetRole: 'manager',
        priority: 'low'
      });

      toast.success('تم تسجيل الحضور واليومية بنجاح');
      setIsLogDialogOpen(false);
    } catch (e) {
      toast.error('فشل في تسجيل اليومية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !worker) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'workerTransactions'), {
        workerId,
        projectId: txForm.projectId,
        type: txForm.type,
        amount: parseFloat(txForm.amount || '0'),
        description: txForm.description,
        date: new Date().toISOString(),
        createdBy: profile.uid
      });

      await sendNotification({
        title: txForm.type === 'payment' ? 'صرف دفعة لعامل' : 'سلفة / خصم عامل',
        message: `تم تسجيل ${txForm.type === 'payment' ? 'دفعة' : 'حركة'} بقيمة ${txForm.amount} ر.س للعامل ${worker.name}`,
        type: txForm.type === 'payment' ? 'success' : 'warning',
        category: 'financial',
        targetRole: 'manager',
        priority: 'medium'
      });

      toast.success('تم تسجيل الحركة المالية بنجاح');
      setIsTxDialogOpen(false);
      setTxForm({ projectId: '', type: 'payment', amount: '', description: '' });
    } catch (e) {
      toast.error('فشل في تسجيل الحركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (!worker || fullReportData.length === 0) return;
    
    const csvData = fullReportData.map(row => ({
      'التاريخ': row.date,
      'النوع': row.type,
      'المبلغ': row.amount,
      'البيان': row.description
    }));

    exportToCSV(`كشف_حساب_${worker.name}`, csvData);
    toast.success(`تم تصدير تقرير العامل: ${worker.name}`);
  };

  const handleStartPDFExport = () => {
    if (!worker) return;
    setIsDateRangeDialogOpen(true);
  };

  const handleConfirmDateRange = (start: string, end: string) => {
    setDateRange({ start, end });
    setIsExportingPDF(true);
    toast.loading('جاري تجهيز كشف الحساب الفاخر...');
    
    setTimeout(async () => {
      try {
        await exportToPDF('worker-account-pdf', `كشف_حساب_${worker.name}_${start}_إلى_${end}`);
        toast.dismiss();
        toast.success('تم تحميل كشف الحساب بنجاح');
      } catch (error) {
        toast.dismiss();
        toast.error('فشل في تصدير التقرير');
      } finally {
        setIsExportingPDF(false);
      }
    }, 800);
  };

  const reportData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return fullReportData.filter(row => {
      const rowDate = new Date(row.dateOriginal || row.date);
      return rowDate >= start && rowDate <= end;
    });
  }, [fullReportData, dateRange]);

  const reportStats = useMemo(() => {
    const earned = reportData.filter(r => r.type === 'يومية عمل').reduce((acc, r) => acc + (r.amount || 0), 0);
    const bonuses = reportData.filter(r => r.type === 'مكافأة').reduce((acc, r) => acc + (r.amount || 0), 0);
    const deductions = reportData.filter(r => r.type === 'خصم').reduce((acc, r) => acc + Math.abs(r.amount || 0), 0);
    const payments = reportData.filter(r => r.type === 'دفعة مستلمة').reduce((acc, r) => acc + Math.abs(r.amount || 0), 0);
    return {
      earned,
      bonuses,
      deductions,
      payments,
      balance: (earned + bonuses) - (deductions + payments)
    };
  }, [reportData]);

  const handleDeleteEntry = async (col: string, id: string) => {
    if (!confirm('هل أنت متأكد من أرشفة هذا السجل؟')) return;
    try {
      let data: any = null;
      if (col === 'dailyLogs') {
        data = logs.find(l => l.id === id);
      } else if (col === 'workerTransactions') {
        data = transactions.find(t => t.id === id);
      } else {
        const snap = await getDoc(doc(db, col, id));
        if (snap.exists()) data = snap.data();
      }

      if (data) {
        await softDelete(col, id, data, profile!.uid, `سجل عامل: ${worker?.name}`);
        toast.success('تم نقل السجل إلى الأرشيف');
      } else {
        toast.error('لم يتم العثور على البيانات');
      }
    } catch (e) {
      toast.error('فشل في الأرشفة');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <h3 className="text-xl font-bold text-slate-800">تعذر تحميل بيانات العامل</h3>
        <p className="text-slate-500 max-w-md">تأكد من صحة الرابط أو من وجود العامل في النظام. قد تحتاج لتسجيل الدخول إذا لم يكن هذا الرابط عاماً.</p>
        <Button onClick={onBack} variant="outline" className="rounded-xl">العودة للرئيسية</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Smart Profile Header */}
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
            <div className="w-32 h-32 rounded-3xl bg-primary text-white flex items-center justify-center text-4xl font-black shadow-xl ring-2 ring-slate-100 relative z-10 select-none">
              {worker.name?.[0] || 'W'}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-4 border-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg x-50" title={worker.status === 'active' ? t.available : t.notAvailable}>
               <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>

            <div className="flex-1 text-center md:text-right">
              {readOnly && (
                <div className="flex justify-center md:justify-end gap-2 mb-4">
                  {['ar', 'en', 'ur', 'bn', 'hi'].map((l) => (
                    <button
                      key={l}
                      onClick={() => changeLanguage(l)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${
                        currentLang === l ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              {/* Notifications Status for Worker */}
              {readOnly && (
                <Card className="rounded-2xl border-none bg-slate-50 p-4 shadow-none mb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                       <Smartphone className={`w-4 h-4 ${notifPermission === 'granted' ? 'text-emerald-500' : 'text-amber-500'}`} />
                       <span className="text-[10px] font-black text-slate-600">حالة التنبيهات على جهازك</span>
                    </div>
                    <div className="flex gap-2">
                       {notifPermission !== 'granted' && (
                         <Button size="sm" onClick={requestNotifPermission} className="h-7 text-[10px] font-black bg-blue-600 hover:bg-blue-700">تفعيل</Button>
                       )}
                       <Button size="sm" onClick={testNotifSound} variant="ghost" className="h-7 text-[10px] font-black border border-slate-200">تجربة الصوت</Button>
                    </div>
                  </div>
                  {notifPermission !== 'granted' && (
                    <p className="text-[9px] text-amber-600 font-bold mt-2">ملاحظة: لضمان وصول التنبيهات الإدارية، يرجى تفعيل التنبيهات وإبقاء هذه الصفحة مفتوحة في المتصفح.</p>
                  )}
                </Card>
              )}

              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h1 className="text-3xl font-black text-primary tracking-tight">{worker.name}</h1>
              <Badge className="w-fit mx-auto md:mx-0 bg-blue-600 text-white border-none px-3 py-1 text-xs font-bold shadow-sm select-none">
                {worker.role}
              </Badge>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
              <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-full text-[13px] font-bold text-slate-600">
                <Phone className="w-3.5 h-3.5" />
                {worker.phone}
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full text-[13px] font-bold text-emerald-600 border border-emerald-100">
                <Calendar className="w-3.5 h-3.5" />
                {t.dailyRate}: {(worker.dailyRate || 0).toLocaleString()} {t.sar}
              </div>
            </div>

            {!readOnly && (
              <div className="mt-4 sm:mt-6 flex flex-wrap justify-center md:justify-start gap-2">
                <Button onClick={() => setIsLogDialogOpen(true)} size="sm" className="rounded-lg gap-1.5 font-black h-9 sm:h-11 px-3 sm:px-6 bg-emerald-600 hover:bg-emerald-700 shadow-md text-[11px] sm:text-sm flex-1 sm:flex-none">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.attendance}
                </Button>
                <Button onClick={() => setIsTxDialogOpen(true)} variant="outline" size="sm" className="rounded-lg gap-1.5 font-bold h-9 sm:h-11 px-3 sm:px-6 border-slate-200 hover:bg-slate-50 text-[11px] sm:text-sm flex-1 sm:flex-none">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.payments}
                </Button>
                <Button 
                  onClick={() => setIsShareDialogOpen(true)} 
                  variant="outline" 
                  size="sm"
                  className="rounded-lg gap-1.5 font-bold h-9 sm:h-11 px-3 sm:px-6 border-slate-200 hover:bg-slate-50 text-blue-600 text-[11px] sm:text-sm w-full sm:w-auto"
                >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.shareLink}
                </Button>
              </div>
            )}
          </div>

          <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
            <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{t.shareDialogTitle}</DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-500">
                  {t.shareDialogDesc}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">لغة الرسالة</Label>
                  <Select value={shareLanguage} onValueChange={(v: any) => setShareLanguage(v)}>
                    <SelectTrigger className="w-full h-11 rounded-xl text-right">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(shareMessages).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-2">معاينة الرسالة:</p>
                  <p className="text-xs leading-relaxed text-slate-600 italic">
                    {shareMessages[shareLanguage].msg(worker?.name || '...', 'https://...')}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 text-white"
                    onClick={() => {
                      const baseUrl = window.location.origin;
                      const url = `${baseUrl}?workerId=${workerId}&view=public&lang=${shareLanguage}`;
                      const message = shareMessages[shareLanguage].msg(worker?.name || '', url);
                      const whatsappUrl = `https://wa.me/${worker?.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
                      window.open(whatsappUrl, '_blank');
                      setIsShareDialogOpen(false);
                    }}
                  >
                    <SendHorizontal className="w-4 h-4" />
                    {t.shareViaWhatsapp}
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-12 rounded-xl font-bold gap-2"
                    onClick={() => {
                      const baseUrl = window.location.origin;
                      const url = `${baseUrl}?workerId=${workerId}&view=public&lang=${shareLanguage}`;
                      navigator.clipboard.writeText(url);
                      toast.success(t.copyLinkOnly);
                    }}
                  >
                    {t.copyLinkOnly}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="hidden lg:grid grid-cols-2 gap-4 w-72">
            <Card className="rounded-2xl border-none bg-emerald-50/50 p-4 shadow-none">
              <p className="text-[10px] text-emerald-700 font-black uppercase">{t.remainingBalance}</p>
              <p className="text-xl font-black text-emerald-800 mt-1">{(balance || 0).toLocaleString()} {t.sar}</p>
              <div className="mt-2 text-[9px] text-emerald-600 font-bold">{t.settleBalance}</div>
            </Card>
            <Card className="rounded-2xl border-none bg-slate-50/50 p-4 shadow-none">
              <p className="text-[10px] text-muted-foreground font-black uppercase">{t.reliability}</p>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xl font-black text-primary">{t.high}</span>
              </div>
            </Card>
          </div>
        </div>
      </div>

            {!readOnly && (
               <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100 mb-6 shadow-sm">
                  <h4 className="font-bold text-sm text-slate-700 mb-4 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    إرسال تنبيه إداري للعامل (يتطلب تأكيد استلام وسيصدر صوتاً)
                   </h4>
                  <div className="flex flex-col gap-3">
                    <Input 
                      placeholder="اكتب رسالة رسمية للعامل... سيصل التنبيه بصوت مرتفع جداً"
                      className="bg-white border-slate-200 rounded-xl"
                      id="admin-notif-input"
                    />
                    <div className="flex gap-2">
                        <Button 
                          className="rounded-xl bg-red-600 hover:bg-red-700 font-bold flex-1"
                          onClick={async () => {
                            const input = document.getElementById('admin-notif-input') as HTMLInputElement;
                            if (!input.value.trim()) return;
                            try {
                              await addDoc(collection(db, 'workerNotifications'), {
                                title: 'تنبيه إداري رسمي',
                                message: input.value.trim(),
                                workerId,
                                priority: 'critical',
                                requiresAcknowledge: true,
                                type: 'error',
                                category: 'system',
                                createdAt: serverTimestamp(),
                                createdBy: profile?.uid,
                              });
                              toast.success('تم إرسال التنبيه الرسمي بنجاح');
                              input.value = '';
                            } catch (e) {
                              toast.error('فشل في إرسال التنبيه');
                            }
                          }}
                        >
                          إرسال تنبيه عاجل
                        </Button>
                        <Button 
                          variant="outline"
                          className="rounded-xl font-bold"
                          onClick={async () => {
                            const input = document.getElementById('admin-notif-input') as HTMLInputElement;
                            if (!input.value.trim()) return;
                            try {
                              await addDoc(collection(db, 'workerNotifications'), {
                                title: 'رسالة إدارية',
                                message: input.value.trim(),
                                workerId,
                                priority: 'medium',
                                requiresAcknowledge: false,
                                type: 'info',
                                category: 'system',
                                createdAt: serverTimestamp(),
                                createdBy: profile?.uid,
                              });
                              toast.success('تم إرسال الرسالة بنجاح');
                              input.value = '';
                            } catch (e) {

                            }
                          }}
                        >
                          إرسال رسالة عادية
                        </Button>
                    </div>
                  </div>
               </div>
            )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <SummaryCard title={t.totalEarned} value={totalEarned} color="text-primary" icon={Calendar} sarLabel={t.sar} />
        <SummaryCard title={t.totalBonuses} value={totalBonuses} color="text-blue-600" icon={Star} sarLabel={t.sar} />
        <SummaryCard title={t.totalPaid} value={totalPaid} color="text-emerald-600" icon={CheckCircle2} sarLabel={t.sar} />
        <SummaryCard title={t.totalDeductions} value={totalDeductions} color="text-red-600" icon={AlertTriangle} sarLabel={t.sar} />
        <SummaryCard 
          title={t.remainingBalance} 
          value={balance} 
          color={balance > 0 ? "text-amber-600" : "text-emerald-600"} 
          icon={CreditCard}
          highlight
          sarLabel={t.sar}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Notifications Section */}
          <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white mb-6">
            <CardHeader className="border-b bg-slate-50/50 pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">{t.notifications}</CardTitle>
                  <p className="text-[11px] text-muted-foreground font-bold italic">{t.lastMessages}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-64 overflow-y-auto">
              {workerNotifications.length > 0 ? (
                <div className="divide-y">
                  {workerNotifications.map(notif => (
                    <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col gap-2 text-right" dir="rtl">
                      <div className="flex gap-4">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.priority === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800 leading-relaxed mb-1">
                            {notif.message || notif.text}
                          </p>
                          <span className="text-[10px] text-muted-foreground font-bold">
                            {notif.createdAt?.toDate ? new Date(notif.createdAt.toDate()).toLocaleString('ar-SA') : 'الآن'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Show acknowledgement status */}
                      {notif.requiresAcknowledge && (
                        <div className={`mt-2 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold gap-3 ${
                          notif.acknowledged 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            : 'bg-amber-50 border-amber-100 text-amber-700'
                        }`}>
                          <div className="flex items-center gap-2">
                            {notif.acknowledged ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            <span>
                              {notif.acknowledged ? 'تم تأكيد الاستلام والفهم' : 'بانتظار تأكيد العامل'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {notif.acknowledgedAt?.toDate && (
                              <span className="opacity-75" dir="ltr">
                                {new Date(notif.acknowledgedAt.toDate()).toLocaleString('ar-SA')}
                              </span>
                            )}
                            {!notif.acknowledged && readOnly && (
                              <Button 
                                size="sm" 
                                onClick={() => handleAcknowledge(notif.id)}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200"
                              >
                                تأكيد الاستلام
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 opacity-20" />
                  <p className="font-bold text-sm">{t.noNotifications}</p>
                </div>
              )}
            </CardContent>
          </Card>

           <Tabs defaultValue="logs" className="w-full">
              <TabsList className="w-full max-w-sm bg-slate-100 p-1 rounded-2xl grid grid-cols-2">
                 <TabsTrigger value="logs" className="rounded-xl font-bold">سجل الحضور</TabsTrigger>
                 <TabsTrigger value="finance" className="rounded-xl font-bold">الحركات المالية</TabsTrigger>
              </TabsList>

              <TabsContent value="logs" className="mt-6">
                 <Card className="rounded-3xl border-border bg-white shadow-sm overflow-hidden">
                   <div className="p-0 overflow-auto">
                    <Table className="text-right">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">المشروع</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          {!readOnly && <TableHead className="text-center">إجراء</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(log => (
                          <TableRow key={log.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-bold">{log.date}</TableCell>
                            <TableCell className="text-xs">{projects.find(p => p.id === log.projectId)?.title || 'عام'}</TableCell>
                            <TableCell className="font-black text-primary">{(log.amountEarned || 0).toLocaleString()} ر.س</TableCell>
                            {!readOnly && (
                              <TableCell className="text-center">
                                <Button onClick={() => handleDeleteEntry('dailyLogs', log.id)} variant="ghost" size="icon" className="text-red-400 w-8 h-8 hover:text-red-600"><Trash2 className="w-4 h-4"/></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {logs.length === 0 && <div className="p-10 text-center text-muted-foreground italic text-sm">لا توجد سجلات حضور بعد</div>}
                   </div>
                 </Card>
              </TabsContent>

              <TabsContent value="finance" className="mt-6">
                 <Card className="rounded-3xl border-border bg-white shadow-sm overflow-hidden">
                   <div className="p-0 overflow-auto">
                    <Table className="text-right">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-right">البيان</TableHead>
                          <TableHead className="text-right">النوع</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          {!readOnly && <TableHead className="text-center">إجراء</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(tx => (
                          <TableRow key={tx.id} className="hover:bg-slate-50/50">
                            <TableCell className="max-w-[200px] text-xs font-bold leading-tight">{tx.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-bold ${
                                tx.type === 'payment' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 
                                tx.type === 'bonus' ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-red-200 text-red-600 bg-red-50'
                              }`}>
                                {tx.type === 'payment' ? 'دفعة' : tx.type === 'bonus' ? 'مكافأة' : 'خصم'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-black">{(tx.amount || 0).toLocaleString()} ر.س</TableCell>
                            {!readOnly && (
                              <TableCell className="text-center">
                                <Button onClick={() => handleDeleteEntry('workerTransactions', tx.id)} variant="ghost" size="icon" className="text-red-400 w-8 h-8 hover:text-red-600"><Trash2 className="w-4 h-4"/></Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {transactions.length === 0 && <div className="p-10 text-center text-muted-foreground italic text-sm">لا توجد حركات مالية مسجلة</div>}
                   </div>
                 </Card>
              </TabsContent>
           </Tabs>

           {/* My Projects Visibility for Worker */}
           <div className="mt-8">
              <h3 className="font-black text-primary flex items-center gap-2 text-lg mb-4">
                <Building2 className="w-5 h-5" />
                المشاريع المرتبطة بك
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {myProjects.length > 0 ? myProjects.map(proj => (
                   <div key={proj.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-primary transition-all group shadow-sm">
                     <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">
                       {proj.title?.[0] || 'P'}
                     </div>
                     <div>
                       <p className="font-bold text-sm text-slate-800 leading-none mb-1 text-right">{proj.title || 'مشروع عام'}</p>
                       <Badge variant="outline" className="text-[10px] font-bold h-5">{proj.status}</Badge>
                     </div>
                   </div>
                 )) : (
                   <div className="col-span-full p-8 rounded-2xl border-2 border-dashed flex flex-col items-center text-muted-foreground gap-2">
                     <Building2 className="w-8 h-8 opacity-20" />
                     <p className="text-sm font-bold">لم تظهر مشاريع مرتبطة بعد</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        <div className="space-y-6">
            {/* Bank account section */}
            <Card className={`rounded-3xl shadow-xl transition-all border-none overflow-hidden group ${worker.bankAccount ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white' : 'bg-white border-2 border-dashed border-primary/20'}`}>
              <CardContent className="p-6 relative">
                <Banknote className={`absolute -bottom-6 -right-6 w-32 h-32 rotate-12 group-hover:scale-110 transition-transform duration-700 ${worker.bankAccount ? 'text-white/5' : 'text-primary/5'}`} />
                <div className="relative z-10 h-full flex flex-col">
                  <h4 className={`font-black text-sm mb-4 flex items-center gap-2 ${worker.bankAccount ? 'text-white' : 'text-primary'}`}>
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    بيانات الحساب البنكي / IBAN
                  </h4>
                  
                  <div className="flex-1">
                    {worker.bankAccount ? (
                      <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 space-y-3">
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-wider">الحساب المسجل حالياً</p>
                        <p className="font-mono text-xl tracking-wider font-bold truncate">{worker.bankAccount}</p>
                        <div className="flex items-center gap-2 p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                           <Shield className="w-4 h-4 text-emerald-400" />
                           <span className="text-[10px] font-bold text-emerald-300">تم الحفظ ولا يمكن التعديل إلا عبر الإدارة</span>
                        </div>
                        <Button variant="ghost" className="w-full mt-2 h-9 text-[10px] text-white/50 hover:bg-white/10 font-bold" onClick={() => {
                          navigator.clipboard.writeText(worker.bankAccount);
                          toast.success('تم نسخ الحساب البنكي');
                        }}>نسخ للحافظة</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">يرجى إدخال بيانات حسابك البنكي لاستقبال مستحقاتك إلكترونياً. يمكنك الحفظ لمرة واحدة فقط.</p>
                        <div className="space-y-3">
                          <Input 
                            value={bankAccountInput}
                            onChange={(e) => setBankAccountInput(e.target.value)}
                            placeholder="أدخل رقم الحساب أو الآيبان..."
                            className="bg-slate-50 border-slate-200 text-primary placeholder:text-slate-300 rounded-xl h-12 pr-4 font-mono font-bold text-lg text-right"
                          />
                          <Button 
                            onClick={handleUpdateBankAccount}
                            disabled={!bankAccountInput.trim() || isUpdatingBank}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-black shadow-lg shadow-emerald-900/40"
                          >
                            {isUpdatingBank ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizontal className="w-5 h-5" />}
                            <span className="mr-2">حفظ بيانات الحساب البنكي</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden group">
               <Zap className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
               <h4 className="font-black text-sm mb-3 flex items-center gap-2">
                 <Shield className="w-4 h-4 text-accent" />
                 إجراءات {readOnly ? 'العامل' : 'إدارية ذكية'}
               </h4>
               <div className="space-y-3 relative z-10">
                  <Button onClick={handleStartPDFExport} className="w-full justify-start gap-3 bg-white/10 hover:bg-white/20 border-none rounded-xl h-11 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="text-[12px] font-bold">تحميل كشف الحساب الفاخر</span>
                  </Button>
                  {!readOnly && (
                    <Button onClick={() => toast.info('جاري التجهيز...')} className="w-full justify-start gap-3 bg-white/10 hover:bg-white/20 border-none rounded-xl h-11 transition-all">
                      <Star className="w-4 h-4 text-amber-400" />
                      <span className="text-[12px] font-bold">تقييم الموظف لهذا الشهر</span>
                    </Button>
                  )}
               </div>
            </div>
        </div>
      </div>

      {isExportingPDF && (
        <PrintableReport 
          id="worker-account-pdf"
          title="كشف حساب مالي - عامل"
          subtitle={`بيان المستحقات: ${worker.name} | فترة من ${dateRange.start} إلى ${dateRange.end}`}
          headers={['التاريخ', 'الحركة', 'البيان', 'المبلغ (ر.س)']}
          data={reportData.map(row => [
          row.date,
          row.type,
          row.description,
          (row.amount || 0).toLocaleString()
        ])}
        summary={[
          { label: 'إجمالي المستحقات للفترة', value: (reportStats.earned + reportStats.bonuses).toLocaleString() + ' ر.س' },
          { label: 'إجمالي المدفوعات للفترة', value: (reportStats.payments + reportStats.deductions).toLocaleString() + ' ر.س' },
          { label: 'صافي الرصيد للفترة', value: (reportStats.balance || 0).toLocaleString() + ' ر.س' }
        ]}
        />
      )}

      <ExportDateRangeDialog 
        isOpen={isDateRangeDialogOpen}
        onOpenChange={setIsDateRangeDialogOpen}
        onConfirm={handleConfirmDateRange}
        title={`تصدير كشف حساب: ${worker.name}`}
      />
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">إثبات حضور جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">تسجيل يومية عمل للعامل في مشروع محدد.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLog} className="space-y-4 py-4 text-right">
            <div className="space-y-2">
              <Label className="font-bold text-gray-700 text-sm">المشروع</Label>
              <Select value={logForm.projectId} onValueChange={(v) => setLogForm({...logForm, projectId: v})}>
                <SelectTrigger className="h-11 rounded-lg text-right"><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-gray-700 text-sm">التاريخ</Label>
              <Input 
                type="date"
                required
                value={logForm.date}
                onChange={(e) => setLogForm({...logForm, date: e.target.value})}
                className="h-11 rounded-lg text-right"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-gray-700 text-sm">المبلغ المستحق (ليوم واحد)</Label>
              <Input 
                type="number"
                required
                value={logForm.amount}
                onChange={(e) => setLogForm({...logForm, amount: e.target.value})}
                className="h-11 rounded-lg text-right"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تسجيل الحضور'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTxDialogOpen} onOpenChange={setIsTxDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">تسجيل حركة مالية</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">إضافة دفعة مستلمة، مكافأة، أو خصم من رصيد العامل.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTx} className="space-y-4 py-4 text-right">
            <div className="space-y-2">
              <Label className="font-bold text-gray-700 text-sm">نوع الحركة</Label>
              <Select value={txForm.type} onValueChange={(v) => setTxForm({...txForm, type: v})}>
                <SelectTrigger className="h-11 rounded-lg text-right"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">صرف دفعة (نقدي)</SelectItem>
                  <SelectItem value="bonus">مكافأة إضافية</SelectItem>
                  <SelectItem value="deduction">خصم / غرامة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-gray-700 text-sm">المبلغ (ر.س)</Label>
              <Input 
                type="number"
                required
                value={txForm.amount}
                onChange={(e) => setTxForm({...txForm, amount: e.target.value})}
                className="h-11 rounded-lg text-right"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-gray-700 text-sm">البيان / الوصف</Label>
              <Input 
                required
                value={txForm.description}
                onChange={(e) => setTxForm({...txForm, description: e.target.value})}
                placeholder="مثلاً: دفعة عن أسبوع العمل الأول"
                className="h-11 rounded-lg text-right"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-primary hover:bg-black font-bold"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ الحركة'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isCriticalModalOpen} onOpenChange={setIsCriticalModalOpen}>
        <DialogContent 
           className="sm:max-w-md bg-white rounded-3xl border-4 border-red-500 shadow-2xl p-0 overflow-hidden" 
           showCloseButton={false}
           onInteractOutside={(e) => e.preventDefault()}
           onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="bg-red-500 p-8 text-white text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black mb-2">تنبيه إداري هام جداً</DialogTitle>
              <DialogDescription className="text-white/80 font-bold">
                توجيه عاجل من الإدارة يتطلب تأكيد الاستلام المباشر منك
              </DialogDescription>
            </div>
          </div>
          
          <div className="p-8 text-right space-y-6">
            <div className="space-y-2">
              <h4 className="font-black text-xl text-slate-800">{criticalNotif?.title || 'تنبيه جديد'}</h4>
              <p className="text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {criticalNotif?.message}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
               <Bell className="w-3 h-3" />
               بمجرد الضغط على زر التأكيد أدناه، سيتم تسجيل استلامك للرسالة في النظام لدى الإدارة ولا يمكنك التراجع.
            </div>

            <DialogFooter className="sm:justify-start">
              <Button 
                type="button" 
                onClick={handleAcknowledge}
                disabled={isAckLoading}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-lg gap-2 shadow-xl shadow-red-900/20"
              >
                {isAckLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                {t.acknowledge}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, color, highlight, icon: Icon, sarLabel }: any) {
  const displayValue = value || 0;
  return (
    <Card className={`rounded-xl border-border bg-white shadow-sm transition-all ${highlight ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : ''}`}>
      <CardContent className="p-4 flex flex-col gap-1 text-right">
        {Icon && <Icon className={`w-5 h-5 mb-1 opacity-50 ${color}`} />}
        <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase">{title}</p>
        <h3 className={`text-lg md:text-xl font-black mt-1 ${color}`}>
          {displayValue.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{sarLabel}</span>
        </h3>
      </CardContent>
    </Card>
  );
}
