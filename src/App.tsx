import * as React from "react";
import {
  useState,
  useEffect,
  ErrorInfo,
} from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  Bell,
  ChevronDown,
  Menu,
  LogOut,
  Zap,
  LayoutDashboard,
  TrendingUp,
  Wallet,
  ShoppingCart,
  ShieldCheck,
  CreditCard,
  Users,
  Briefcase,
  Package,
  FileText,
  PieChart,
  Store,
  UsersRound,
  Clock,
  ClipboardPaste,
  Landmark,
  Receipt,
  Settings,
  Scan,
  Archive as ArchiveIcon,
  Image as ImageIcon,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

import GlobalNotificationListener from "./components/GlobalNotificationListener";

import { WelcomeOverlay } from "./components/WelcomeOverlay";

// Views
import Dashboard from "./components/Dashboard";
import Financials from "./components/Financials";
import Employees from "./components/Employees";
import Payrolls from "./components/Payrolls";
import CameraCapture from "./components/CameraCapture";
import Purchases from "./components/Purchases";
import Notifications from "./components/Notifications";
import ProjectsV2 from "./components/ProjectsV2";
import EmployeeProfile from "./components/EmployeeProfile";
import SmartButler from "./components/SmartButler";
import ApprovalCenter from "./components/ApprovalCenter";
import Inventory from "./components/Inventory";
import PerformanceEvaluation from "./components/PerformanceEvaluation";
import AttendanceManager from "./components/AttendanceManager";
import SystemSettings from "./components/SystemSettings";
import Analytics from "./components/Analytics";
import ExecutiveBriefingSystem from "./components/ExecutiveBriefingSystem";
import WorkerView from "./components/WorkerView";
import OnboardingGuide from "./components/OnboardingGuide";
import SuppliersList from "./components/SuppliersList";
import Sales from "./components/Sales";
import Production from "./components/Production";
import WorkersManagement from "./components/WorkersManagement";
import Expenses from "./components/Expenses";
import Archive from "./components/Archive";
import AssetsManagement from "./components/AssetsManagement";
import Gallery from "./components/Gallery";

import Subcontractors from "./components/Subcontractors";

const scrollbarStyles = `
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error?: null | Error }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Layout Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center"
          dir="rtl"
          style={{ fontFamily: "'Cairo', sans-serif" }}
        >
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-4">
              عذراً، حدث خطأ تقني
            </h2>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">
              واجه النظام مشكلة أثناء تحميل هذه الصفحة. يرجى محاولة تحديث الصفحة
              أو تسجيل الخروج وإعادة الدخول.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => window.location.reload()}
                className="bg-primary hover:bg-black text-white font-bold h-12 rounded-xl transition-all"
              >
                تحديث الصفحة
              </Button>
              <Button
                onClick={() => signOut(auth)}
                variant="outline"
                className="text-slate-600 font-bold h-12 rounded-xl hover:bg-slate-50 transition-all"
              >
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["overview"]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial status
    if (!navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [sysSettings, setSysSettings] = useState<any>({
    companyName: "خبراء الرسم",
    companySub: "للدعاية والإعلان",
    logoUrl: "https://i.imgur.com/yYZDeHZ.jpg",
    sidebarColor: "#1a4d4e",
    primaryColor: "#2c7a7d",
    borderRadius: "24px",
    enableGlassEffect: true,
    showWelcomeMessage: true,
    generalAnnouncement: "📢 أهلاً بكم في نظام خبراء الرسم المتكامل. نتمنى لكم يوماً سعيداً!",
    roleWelcomeMessages: {
      manager: {
        title: "مرحباً أيها القائد",
        tips: ["راجع لوحة التقارير لمتابعة الأداء", "تأكد من الموافقات المعلقة", "رؤيتك اليوم تصنع نجاح الغد"]
      },
      supervisor: {
        title: "أهلاً بك يا مشرفنا",
        tips: ["تابع حضور وانصراف فريقك", "تأكد من سير العمل في المواقع", "دعمك للفريق هو سر الجودة"]
      },
      employee: {
        title: "يسعدنا وجودك معنا",
        tips: ["سجل حضورك الآن لتبدأ يومك", "راجع مهامك اليومية بدقة", "إنجازك الصغير اليوم يكمل نجاحنا"]
      }
    }
  });
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [publicWorkerId, setPublicWorkerId] = useState<string | null>(null);

  useEffect(() => {
    // Initial splash screen timeout
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPublicWorkerOnboarding, setShowPublicWorkerOnboarding] =
    useState(false);

  const menuGroups = [
    {
      id: "dashboardGroup",
      title: "عام",
      items: [
        { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["manager", "supervisor", "employee"] },
        { id: "briefing", label: "موجز AI", icon: Zap, roles: ["manager"] },
      ],
    },
    {
      id: "finance",
      title: "المالية",
      items: [
        { id: "financials", label: "المالية", icon: Wallet, roles: ["manager"] },
        { id: "approvals", label: "الاعتمادات", icon: ShieldCheck, roles: ["manager"] },
        { id: "sales", label: "المبيعات", icon: TrendingUp, roles: ["manager"] },
        { id: "expenses", label: "المصروفات", icon: Receipt, roles: ["manager"] },
        { id: "banking", label: "البنوك", icon: Landmark, roles: ["manager"] },
      ],
    },
    {
      id: "purchasesGroup",
      title: "المشتريات",
      items: [
        { id: "purchases", label: "المشتريات", icon: ShoppingCart, roles: ["manager", "supervisor"] },
        { id: "suppliers", label: "الموردين", icon: Store, roles: ["manager"] },
        { id: "camera", label: "مسح الفواتير", icon: Scan, roles: ["manager", "supervisor"] },
      ],
    },
    {
      id: "inventoryGroup",
      title: "المخزون",
      items: [
        { id: "inventory", label: "المخزن", icon: Package, roles: ["manager", "supervisor"] },
        { id: "assets", label: "الأصول", icon: ShieldCheck, roles: ["manager", "supervisor"] },
        { id: "production", label: "الإنتاج", icon: Settings, roles: ["manager", "supervisor"] },
      ],
    },
    {
      id: "hr",
      title: "الموارد",
      items: [
        { id: "employees", label: "الموظفين", icon: UsersRound, roles: ["manager", "supervisor"] },
        { id: "attendance_manager", label: "الحضور", icon: Clock, roles: ["manager", "supervisor"] },
        { id: "payrolls", label: "الرواتب", icon: CreditCard, roles: ["manager"] },
        { id: "workers_management", label: "العمالة", icon: Users, roles: ["manager", "supervisor"] },
        { id: "evaluation", label: "الأداء", icon: TrendingUp, roles: ["manager", "supervisor"] },
      ],
    },
    {
      id: "ops",
      title: "المشاريع",
      items: [
        { id: "projects", label: "المشاريع", icon: Briefcase, roles: ["manager", "supervisor"] },
        { id: "subcontractors", label: "المقاولين", icon: Users, roles: ["manager", "supervisor"] },
        { id: "tasks", label: "المهام", icon: ClipboardPaste, roles: ["manager", "supervisor"] },
      ],
    },
    {
      id: "reports",
      title: "التقارير",
      items: [
        { id: "analytics", label: "التحليلات", icon: PieChart, roles: ["manager"] },
        { id: "archive", label: "الأرشيف", icon: ArchiveIcon, roles: ["manager"] },
        { id: "gallery", label: "المعرض", icon: ImageIcon, roles: ["manager", "supervisor", "employee"] },
        { id: "general_ledger", label: "الأستاذ", icon: FileText, roles: ["manager"] },
      ],
    },
  ];

  const isTabAllowed = (tabId: string) => {
    if (["profile", "notifications", "camera"].includes(tabId)) return true;
    const allItems = menuGroups.flatMap((g) => g.items);
    const item = allItems.find((i) => i.id === tabId);
    if (!item) return true;
    return item.roles.includes(profile?.role || "employee");
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  useEffect(() => {
    if (profile && !isTabAllowed(activeTab)) {
      setActiveTab("dashboard");
      toast.error("ليس لديك صلاحية الوصول لهذه الصفحة");
    }
  }, [profile, activeTab]);

  useEffect(() => {
    // Check URL for public worker view

    const params = new URLSearchParams(window.location.search);
    const workerId = params.get("workerId");
    const view = params.get("view");
    if (workerId && view === "public") {
      setPublicWorkerId(workerId);
      if (!localStorage.getItem("hasSeenGuide_publicWorker_" + workerId)) {
        setShowPublicWorkerOnboarding(true);
      }
    }
  }, []);

  useEffect(() => {
    if (user && profile) {
      if (!localStorage.getItem("hasSeenGuide_" + user.uid)) {
        setShowOnboarding(true);
      }
    }
  }, [user, profile]);

  useEffect(() => {
    // Reactive System Settings for Branding
    const unsubSys = onSnapshot(
      doc(db, "system", "settings"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const baseSettings = {
            companyName: data.companyName || "خبراء الرسم",
            companySub: data.companySub || "لإدارة المشاريع والمقارات",
            logoUrl: data.logoUrl || "https://i.imgur.com/yYZDeHZ.jpg",
            sidebarColor: data.sidebarColor || "#1a4d4e",
            primaryColor: data.primaryColor || "#2c7a7d",
            borderRadius: data.borderRadius || "12px",
            enableGlassEffect: data.enableGlassEffect || false,
            showWelcomeMessage: data.showWelcomeMessage !== undefined ? data.showWelcomeMessage : true,
            generalAnnouncement: data.generalAnnouncement || "📢 أهلاً بكم في نظام خبراء الرسم المتكامل.",
            roleWelcomeMessages: (() => {
              const msgs = data.roleWelcomeMessages || {};
              const defaultTips = {
                manager: ["راجع لوحة التقارير لمتابعة الأداء", "تأكد من الموافقات المعلقة", "رؤيتك اليوم تصنع نجاح الغد"],
                supervisor: ["تابع حضور وانصراف فريقك", "تأكد من سير العمل في المواقع", "دعمك للفريق هو سر الجودة"],
                employee: ["سجل حضورك الآن لتبدأ يومك", "راجع مهامك اليومية بدقة", "إنجازك الصغير اليوم يكمل نجاحنا"]
              };
              const roles = ['manager', 'supervisor', 'employee'];
              const result: any = {};
              roles.forEach(role => {
                const val = msgs[role];
                if (typeof val === 'string') {
                  result[role] = { title: val, tips: (defaultTips as any)[role] };
                } else if (typeof val === 'object' && val !== null) {
                  result[role] = val;
                } else {
                  result[role] = { 
                    title: role === 'manager' ? "مرحباً أيها القائد" : role === 'supervisor' ? "أهلاً بك يا مشرفنا" : "يسعدنا وجودك معنا", 
                    tips: (defaultTips as any)[role] 
                  };
                }
              });
              return result;
            })()
          };
          
          setSysSettings((prev: any) => ({ ...prev, ...baseSettings }));
          applyTheme(baseSettings);
        }
      }
    );

    return () => unsubSys();
  }, []);

  useEffect(() => {
    if (!user || !profile) return;

    // Listener for user-specific theme overrides
    const unsubUser = onSnapshot(
      doc(db, "users", profile.uid),
      (snap) => {
        if (snap.exists()) {
          const userData = snap.data();
          if (userData.userTheme) {
            const theme = userData.userTheme;
            setSysSettings((prev: any) => ({ ...prev, ...theme }));
            applyTheme(theme);
          }
        }
      }
    );

    return () => unsubUser();
  }, [user, profile]);

  const applyTheme = (theme: any) => {
    const root = document.documentElement;
    if (theme.sidebarColor) root.style.setProperty('--sidebar', theme.sidebarColor);
    if (theme.primaryColor) root.style.setProperty('--primary', theme.primaryColor);
    if (theme.borderRadius) root.style.setProperty('--radius', theme.borderRadius);
    
    if (theme.enableGlassEffect) {
      root.classList.add('glass-theme');
    } else {
      root.classList.remove('glass-theme');
    }

    if (theme.isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (!profile) return;

    // Listener for notifications badge - only count UNREAD
    let q = query(
      collection(db, "notifications"),
      where("read", "==", false),
      orderBy("timestamp", "desc"),
      limit(20),
    );

    if (profile.role !== "manager") {
      q = query(
        collection(db, "notifications"),
        where("targetRole", "in", ["all", profile.role]),
        where("read", "==", false),
        orderBy("timestamp", "desc"),
        limit(20),
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
      },
      (error: Error) => console.error("App Notifications Listen Error:", error),
    );

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    setSelectedEmployeeId(null);
  }, [activeTab]);

  const handleSidebarCollapseToggle = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    if (newState) {
      setExpandedGroups([]);
    }
  };

  useEffect(() => {
    const handleTabChange = (e: CustomEvent<any>) => {
      const data = e.detail;
      if (typeof data === "string") {
        setActiveTab(data);
      } else if (data && data.tab) {
        setActiveTab(data.tab);
        // Special logic for specific tabs
        if (data.employeeId) {
          setSelectedEmployeeId(data.employeeId);
        }
        if (data.projectId) {
          // If Projects component has a way to receive a selection, we'd trigger it here
        }
      }
      window.scrollTo(0, 0);
    };
    window.addEventListener("changeTab", handleTabChange as any);
    window.addEventListener("showOnboarding", (() =>
      setShowOnboarding(true)) as any);
    return () => {
      window.removeEventListener("changeTab", handleTabChange as any);
      window.removeEventListener("showOnboarding", (() =>
        setShowOnboarding(true)) as any);
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setShowWelcomeScreen(true);
      toast.success("تم تسجيل الدخول بنجاح");
    } catch {
      toast.error("فشل تسجيل الدخول");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info("تم تسجيل الخروج");
    } catch {
      toast.error("خطأ في تسجيل الخروج");
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#1a4d4e] flex flex-col items-center justify-center relative overflow-hidden" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="z-10 flex flex-col items-center"
        >
          <div className="w-32 h-32 bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 mb-8 animate-pulse">
             <img src="https://i.imgur.com/yYZDeHZ.jpg" alt="Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white text-3xl font-black tracking-tight mb-2"
          >
            نظام خبراء الرسم
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.6 }}
            className="text-white font-bold text-sm tracking-[0.2em]"
          >
            جاري تهيئة النظام الرقمي...
          </motion.p>
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        
        <div className="absolute bottom-10 flex items-center gap-2">
           <Zap className="w-4 h-4 text-primary animate-bounce" />
           <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Powered by Advanced AI</span>
        </div>
      </div>
    );
  }

  if (publicWorkerId) {
    if (showPublicWorkerOnboarding) {
      return (
        <OnboardingGuide
          role="worker"
          onComplete={() => {
            localStorage.setItem(
              "hasSeenGuide_publicWorker_" + publicWorkerId,
              "true",
            );
            setShowPublicWorkerOnboarding(false);
          }}
        />
      );
    }
    return (
      <div
        className="min-h-screen bg-slate-50 p-4 md:p-8"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        <div className="max-w-5xl mx-auto">
          <WorkerView
            workerId={publicWorkerId}
            onBack={() => setPublicWorkerId(null)}
            readOnly={true}
          />
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground font-bold italic">
              هذه الصفحة للعرض فقط. لا يمكن تعديل البيانات من هنا.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className="min-h-screen bg-[#f0f7f7] flex flex-col items-center justify-center p-4 relative overflow-hidden"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Abstract Background Shapes */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(44,122,125,0.1)] p-10 border border-white relative z-10"
        >
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="mb-6 relative"
            >
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse" />
              <img
                src={sysSettings.logoUrl}
                alt="Logo"
                className="w-24 h-24 object-contain rounded-3xl relative z-10 shadow-lg border-4 border-white"
              />
            </motion.div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center">
              نظام إدارة خبراء الرسم
            </h1>
            <div className="h-1 w-12 bg-primary rounded-full mt-4 mb-2" />
            <p className="text-slate-500 font-bold text-sm text-center leading-relaxed">
              البوابة الرسمية الموحدة <br />
              لمتابعة سجلات الميدان والمالية
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleLogin}
              className="w-full h-16 bg-primary hover:bg-[#1a4d4e] text-white rounded-2xl text-lg font-black flex items-center justify-center gap-3 transition-all hover:shadow-[0_10px_30px_rgba(44,122,125,0.3)] active:scale-95 group"
            >
              <span className="bg-white/20 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                <UsersRound className="w-6 h-6" />
              </span>
              تسجيل الدخول للموظفين
            </Button>
            
            <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest px-4">
              الدخول متاح فقط للموظفين المعتمدين لدى الشركة
            </p>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 border-t border-slate-100 pt-8">
            <div className="flex items-center gap-2 text-slate-300">
               <ShieldCheck className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Secure Enterprise System</span>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-bold">
              جميع الحقوق محفوظة لشركة خبراء الرسم <br />
              المملكة العربية السعودية © 2026
            </p>
          </div>
        </motion.div>

        {/* Decorative badge for PWA/App feeling */}
        <div className="absolute top-10 flex flex-col items-center gap-1 opacity-20">
           <Zap className="w-6 h-6 text-primary animate-bounce" />
           <span className="text-[8px] font-black text-primary uppercase tracking-[0.3em]">V.2.0 Production</span>
        </div>
      </div>
    );
  }

  if (showOnboarding && profile) {
    return (
      <OnboardingGuide
        role={profile.role || "employee"}
        onComplete={() => {
          localStorage.setItem("hasSeenGuide_" + user.uid, "true");
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col lg:flex-row text-right"
      dir="rtl"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <style>{scrollbarStyles}</style>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50 h-[72px]">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <div
              onClick={() => setActiveTab("profile")}
              className="flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <img
                src={sysSettings.logoUrl}
                alt="logo"
                className="w-8 h-8 object-contain rounded-lg"
              />
            </div>
            {sysSettings.showWelcomeMessage && (
               <Dialog>
                 <DialogTrigger asChild>
                   <div className="max-w-[100px] md:max-w-[200px] overflow-hidden truncate cursor-pointer hover:opacity-80 transition-opacity">
                      <span className="text-[7px] md:text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10 whitespace-nowrap block truncate">
                        {sysSettings.generalAnnouncement}
                      </span>
                   </div>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-2xl" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-primary" />
                        رسالة إدارية
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-slate-700 font-bold leading-relaxed text-sm">
                        {sysSettings.generalAnnouncement}
                      </p>
                    </div>
                 </DialogContent>
               </Dialog>
            )}
          </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setActiveTab("notifications")}
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                {unreadCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTab("profile")}
            className="rounded-full overflow-hidden w-9 h-9 border-2 border-slate-100"
          >
            <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
              {(
                profile?.name?.[0] ||
                user?.displayName?.[0] ||
                "U"
              ).toUpperCase()}
            </div>
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {(isSidebarOpen || window.innerWidth >= 1024) && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{
              width: isSidebarCollapsed && window.innerWidth >= 1024 ? 80 : 180,
              opacity: 1,
              x: 0,
            }}
            exit={{ width: 0, opacity: 0 }}
            className={`fixed inset-y-0 right-0 lg:h-screen bg-sidebar text-sidebar-foreground border-l border-white/5 z-40 lg:relative lg:translate-x-0 transition-all duration-300 shadow-[0_0_50px_rgba(0,0,0,0.5)] lg:shadow-none flex flex-col overflow-hidden rounded-l-[1.5rem] lg:rounded-none lg:top-0 top-16 bottom-[88px] h-auto`}
          >
            <div
              className={`px-6 py-8 border-b border-white/10 mb-2 transition-all duration-300 ${isSidebarCollapsed ? "items-center px-4" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={sysSettings.logoUrl}
                    alt="خبراء الرسم"
                    className="w-10 h-10 object-contain rounded-md shrink-0 transition-all"
                  />
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col overflow-hidden"
                    >
                      <span 
                        className={`font-black text-white tracking-tight leading-[1.1] mb-0.5 transition-all ${
                          (sysSettings.companyName?.length || 0) > 20 ? 'text-[11px]' : 
                          (sysSettings.companyName?.length || 0) > 15 ? 'text-xs' : 
                          'text-sm md:text-base'
                        } line-clamp-2`}
                      >
                        {sysSettings.companyName}
                      </span>
                      <span className={`uppercase font-bold opacity-50 tracking-widest ${
                        (sysSettings.companySub?.length || 0) > 30 ? 'text-[7px]' : 
                        'text-[8px] md:text-[9px]'
                      } truncate`}>
                        {sysSettings.companySub}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 no-scrollbar">
              {menuGroups.map((group) => {
                const visibleItems = group.items.filter((item) =>
                  item.roles.includes(profile?.role || "employee"),
                );
                if (visibleItems.length === 0) return null;
                const showFull = !isSidebarCollapsed;

                return (
                  <div key={group.id} className="mb-4">
                    {showFull && (
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center justify-between px-6 mb-3 mt-4 group/title"
                      >
                        <span className="text-xs font-black text-white/90 tracking-wide group-hover/title:text-white transition-colors">
                          {group.title}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-white/40 transition-transform ${expandedGroups.includes(group.id) ? "" : "rotate-90"}`}
                        />
                      </button>
                    )}

                    <motion.div
                      animate={{
                        height:
                          expandedGroups.includes(group.id) || !showFull
                            ? "auto"
                            : 0,
                        opacity:
                          expandedGroups.includes(group.id) || !showFull
                            ? 1
                            : 0,
                      }}
                      className="overflow-hidden space-y-1"
                    >
                      {visibleItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            if (window.innerWidth < 1024)
                              setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 transition-all group relative ${
                            !showFull
                              ? "justify-center px-0 py-4"
                              : "px-6 py-2"
                          } ${
                            activeTab === item.id
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:bg-white/10 hover:text-white/90"
                          }`}
                        >
                          {activeTab === item.id && showFull && (
                            <motion.div
                              layoutId="activeTabIndicator"
                              className="absolute right-0 top-0 bottom-0 w-1 bg-sidebar-primary"
                            />
                          )}
                          <item.icon
                            className={`shrink-0 transition-colors ${
                              !showFull ? "w-6 h-6" : "w-4 h-4"
                            } ${activeTab === item.id ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100"}`}
                          />
                          {showFull && (
                            <span className="text-xs font-bold truncate">
                              {item.label}
                            </span>
                          )}
                          {item.id === "notifications" && unreadCount > 0 && (
                            <span
                              className={`absolute bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-sidebar ${
                                !showFull ? "top-2 right-2" : "left-4"
                              }`}
                            >
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      ))}
                    </motion.div>

                    {!showFull && (
                      <div className="mx-4 my-2 border-b border-white/5" />
                    )}
                  </div>
                );
              })}
            </nav>

            <div
              className={`p-4 border-t border-white/10 mt-auto transition-all ${isSidebarCollapsed ? "items-center px-2" : ""}`}
            >
              {profile?.role === "manager" && (
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 hover:text-white hover:bg-white/5 rounded-xl py-5 ${isSidebarCollapsed ? "px-0 justify-center" : ""}`}
                  onClick={() => setActiveTab("settings")}
                >
                  <Settings className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && (
                    <span className="font-bold text-sm">الإعدادات</span>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                className={`w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-xl py-5 ${isSidebarCollapsed ? "px-0 justify-center" : ""}`}
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="font-bold text-sm">تسجيل الخروج</span>
                )}
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-500 text-white text-[10px] font-black py-1 px-4 flex items-center justify-center gap-2 z-[60] shrink-0"
            >
              <Zap className="w-3 h-3 animate-pulse" />
              <span>أنت تعمل الآن في وضع المتصل (أوفلاين) - قد لا تظهر بعض البيانات المحدثة</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header (Desktop) */}
        <header className="hidden lg:flex h-[72px] bg-white border-b border-border items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-primary transition-colors"
              onClick={handleSidebarCollapseToggle}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <div className="flex flex-col">
              {sysSettings.showWelcomeMessage && (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="mb-0.5 animate-in fade-in slide-in-from-right-4 duration-1000 delay-500 cursor-pointer hover:opacity-80 transition-opacity">
                      <div className="inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full border border-primary/20 shadow-sm shadow-primary/5">
                        <span className="text-[10px] font-black text-primary leading-none max-w-[250px] truncate block">
                          {sysSettings.generalAnnouncement}
                        </span>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-2xl" dir="rtl">
                     <DialogHeader>
                       <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                         <MessageCircle className="w-5 h-5 text-primary" />
                         رسالة إدارية
                       </DialogTitle>
                     </DialogHeader>
                     <div className="mt-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                       <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                         <Bell className="w-5 h-5 text-primary" />
                       </div>
                       <p className="text-slate-700 font-bold leading-relaxed text-sm">
                         {sysSettings.generalAnnouncement}
                       </p>
                     </div>
                  </DialogContent>
                </Dialog>
              )}
              <div className="font-bold text-lg text-primary tracking-tight">
                مرحباً،{" "}
                <span className="text-slate-900">{profile?.role === "manager" ? "مدير النظام" : profile?.name}</span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-slate-50 transition-colors"
              onClick={() => setActiveTab("notifications")}
            >
              <Bell className="w-5 h-5 text-slate-400 group-hover:text-primary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </div>
          <div
            onClick={() => setActiveTab("profile")}
            className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 px-4 py-2 rounded-2xl transition-all group active:scale-95"
          >
            <div className="text-left">
              <div className="text-sm font-black text-primary leading-tight group-hover:text-accent">
                {profile?.name}
              </div>
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                {profile?.role === "manager"
                  ? "مدير عام المؤسسة"
                  : "عضو الفريق"}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-primary font-black group-hover:bg-primary group-hover:text-white transition-all overflow-hidden">
              {(
                profile?.name?.[0] ||
                user?.displayName?.[0] ||
                "U"
              ).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-background pb-28 lg:pb-8">
          <GlobalNotificationListener />
          <div className="p-2 md:p-8 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "dashboard" && <Dashboard goToTab={setActiveTab} />}
                {activeTab === "analytics" && (
                  <Analytics onBack={() => setActiveTab("dashboard")} />
                )}
                {activeTab === "profile" && (
                  <EmployeeProfile
                    employeeId={user.uid}
                    onBack={() => setActiveTab("dashboard")}
                  />
                )}
                {/* Finance Group */}
                {(activeTab === "financials" || activeTab === "banking") && <Financials />}
                {activeTab === "expenses" && <Expenses />}
                {activeTab === "archive" && <Archive />}
                {activeTab === "gallery" && <Gallery />}
                {activeTab === "sales" && <Sales />}
                {activeTab === "subcontractors" && <Subcontractors />}
                
                {/* Purchases Group */}
                {activeTab === "purchases" && <Purchases />}
                {activeTab === "suppliers" && <SuppliersList />}
                
                {/* Inventory Group */}
                {activeTab === "inventory" && <Inventory />}
                {activeTab === "production" && <Production />}
                {activeTab === "assets" && <AssetsManagement />}
                
                {/* Employees Group */}
                {activeTab === "employees" && (
                  <>
                    {!selectedEmployeeId ? (
                      <Employees onSelectEmployee={setSelectedEmployeeId} />
                    ) : (
                      <EmployeeProfile
                        employeeId={selectedEmployeeId}
                        onBack={() => setSelectedEmployeeId(null)}
                      />
                    )}
                  </>
                )}
                {activeTab === "workers_management" && <WorkersManagement />}
                {(activeTab === "projects" || activeTab === "tasks") && <ProjectsV2 />}
                {activeTab === "payrolls" && <Payrolls />}
                {activeTab === "approvals" && <ApprovalCenter />}
                {activeTab === "evaluation" && <PerformanceEvaluation />}
                {activeTab === "notifications" && <Notifications />}
                {activeTab === "camera" && <CameraCapture />}
                {activeTab === "briefing" && <ExecutiveBriefingSystem />}
                {activeTab === "general_ledger" && <Analytics onBack={() => setActiveTab("dashboard")} />}
                {activeTab === "attendance_manager" && <AttendanceManager />}
                {activeTab === "settings" && <SystemSettings />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <Toaster position="bottom-center" richColors theme="light" />
      <SmartButler />

      {/* Native-style Bottom Navigation for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-xl border-t border-slate-100 z-50 px-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.05)] h-[70px]">
        {/* Button 1: Workers */}
        <button
          onClick={() => {
            setActiveTab("workers_management");
            if ('vibrate' in navigator) navigator.vibrate(5);
          }}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative px-1 flex-1 min-w-0 h-[60px] -translate-y-1 ${
            activeTab === "workers_management" ? "text-primary opacity-100" : "text-muted-foreground opacity-50"
          }`}
        >
          <Users className="w-5 h-5 transition-transform" />
          <span className="text-[9px] font-black truncate w-full text-center tracking-tighter leading-none">العمالة</span>
        </button>

        {/* Button 2: Finance */}
        <button
          onClick={() => {
            setActiveTab("financials");
            if ('vibrate' in navigator) navigator.vibrate(5);
          }}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative px-1 flex-1 min-w-0 h-[60px] -translate-y-1 ${
            activeTab === "financials" ? "text-primary opacity-100" : "text-muted-foreground opacity-50"
          }`}
        >
          <Wallet className="w-5 h-5 transition-transform" />
          <span className="text-[9px] font-black truncate w-full text-center tracking-tighter leading-none">المالية</span>
        </button>

        {/* Button 3: HOME (Center) - Distinctive Styling */}
        <button
          onClick={() => {
            setActiveTab("dashboard");
            if ('vibrate' in navigator) navigator.vibrate(5);
          }}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative px-1 flex-1 min-w-0 h-[60px] -translate-y-1 ${
            activeTab === "dashboard" ? "text-slate-900 opacity-100" : "text-muted-foreground opacity-60"
          }`}
        >
          <div className={`p-2.5 rounded-2xl transition-all shadow-lg shadow-primary/20 ${activeTab === 'dashboard' ? 'bg-primary text-white scale-110' : 'bg-primary/5 text-primary opacity-80'}`}>
            <LayoutDashboard className="w-6 h-6 transition-transform" />
          </div>
          <span className="text-[9px] font-black truncate w-full text-center tracking-tighter leading-none mt-0.5">الرئيسية</span>
        </button>

        {/* Button 4: Field (Scan) */}
        <button
          onClick={() => {
            setActiveTab("camera");
            if ('vibrate' in navigator) navigator.vibrate([10, 30, 10]);
          }}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative px-1 flex-1 min-w-0 h-[60px] -translate-y-1 ${
            activeTab === 'camera' ? "text-primary opacity-100" : "text-muted-foreground opacity-50"
          }`}
        >
          <Scan className="w-5 h-5 transition-transform" />
          <span className="text-[9px] font-black truncate w-full text-center tracking-tighter leading-none">ميداني</span>
        </button>

        {/* Button 5: More (Right) */}
        <button
          onClick={() => {
            setIsSidebarOpen(true);
            if ('vibrate' in navigator) navigator.vibrate(5);
          }}
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground opacity-50 px-1 flex-1 min-w-0 h-[60px] -translate-y-1"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-black truncate w-full text-center tracking-tighter leading-none">المزيد</span>
        </button>
      </div>
      {showWelcomeScreen && (
        <WelcomeOverlay 
          user={user} 
          profile={profile} 
          sysSettings={sysSettings} 
          onComplete={() => setShowWelcomeScreen(false)} 
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
