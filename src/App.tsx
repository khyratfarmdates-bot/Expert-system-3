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
  Building2,
  Scan,
  Archive as ArchiveIcon,
  Image as ImageIcon,
  MessageCircle,
  Volume2,
  Factory,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";

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
import GeneralLedger from "./components/GeneralLedger";
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
import BankingAndVault from "./components/BankingAndVault";

import Subcontractors from "./components/Subcontractors";
import CompanyProfile from "./components/CompanyProfile";
import SalesRepDashboard from "./components/SalesRepDashboard";
import PrivateJobsWorkspace from "./components/PrivateJobsWorkspace";
import SalesRepsManagement from "./components/SalesRepsManagement";
import SalesRepProfile from "./components/SalesRepProfile";

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
class ErrorBoundary extends React.Component<any, any> {
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
    return (this as any).props.children;
  }
}

function AppContent() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["overview"]);
  const [expandedSubMenus, setExpandedSubMenus] = useState<string[]>([]);
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

  const menuGroups: any[] = profile?.role === "sales_rep" ? [
    {
      id: "repWorkspace",
      items: [
        { id: "rep_dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["sales_rep"] },
        { id: "rep_smart_bot", label: "المساعد الذكي (ألف ياء)", icon: Sparkles, roles: ["sales_rep"] },
        { id: "rep_documents", label: "وثائقي الصادرة", icon: FileSpreadsheet, roles: ["sales_rep"] },
        { id: "rep_statement", label: "كشف حسابي الرسمي", icon: Wallet, roles: ["sales_rep"] },
        { id: "private_jobs_page", label: "المقاولات الخاصة", icon: Briefcase, roles: ["sales_rep"] },
      ]
    }
  ] : [
    {
      id: "dashboardGroup",
      items: [
        { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard, roles: ["manager", "supervisor", "employee"] },
        { id: "briefing", label: "موجز AI", icon: Zap, roles: ["manager"] },
      ],
    },
    {
      id: "commercialGroup",
      title: "النشاط التجاري",
      items: [
        {
          id: "sales_group",
          label: "المبيعات",
          icon: TrendingUp,
          roles: ["manager"],
          subItems: [
            { id: "sales", label: "سجل المبيعات", roles: ["manager"] },
            { id: "private_jobs_page", label: "المقاولات الخاصة", roles: ["manager"] },
            { id: "sales_reps", label: "إدارة المناديب", roles: ["manager"] },
          ]
        },
        {
          id: "purchases_group",
          label: "المشتريات",
          icon: ShoppingCart,
          roles: ["manager", "supervisor"],
          subItems: [
            { id: "purchases", label: "سجل المشتريات", roles: ["manager", "supervisor"] },
            { id: "suppliers", label: "الموردين", roles: ["manager"] },
            { id: "camera", label: "الماسح الذكي", roles: ["manager", "supervisor"] },
          ]
        },
      ]
    },
    {
      id: "financialGroup",
      title: "المالية والمحاسبة",
      items: [
        {
          id: "finance_group",
          label: "المالية",
          icon: Wallet,
          roles: ["manager"],
          subItems: [
            { id: "financials", label: "الحالة المالية", roles: ["manager"] },
            { id: "general_ledger", label: "الأستاذ العام", roles: ["manager"] },
            { id: "expenses", label: "المصروفات", roles: ["manager"] },
            { id: "banking", label: "البنوك والخزينة", roles: ["manager"] },
            { id: "approvals", label: "الاعتمادات", roles: ["manager"] },
          ]
        }
      ]
    },
    {
      id: "operationsGroup",
      title: "المشاريع والعمليات",
      items: [
        {
          id: "ops_group",
          label: "المشاريع",
          icon: Briefcase,
          roles: ["manager", "supervisor"],
          subItems: [
            { id: "projects", label: "سجل المشاريع", roles: ["manager", "supervisor"] },
            { id: "tasks", label: "المهام", roles: ["manager", "supervisor"] },
            { id: "subcontractors", label: "المقاولين", roles: ["manager", "supervisor"] },
          ]
        },
        {
          id: "inventory_group",
          label: "المخازن",
          icon: Package,
          roles: ["manager", "supervisor"],
          subItems: [
            { id: "inventory", label: "المخزون والمواد", roles: ["manager", "supervisor"] },
            { id: "production", label: "خطوط الإنتاج", roles: ["manager", "supervisor"] },
            { id: "assets", label: "الأصول والمعدات", roles: ["manager", "supervisor"] },
          ]
        }
      ]
    },
    {
      id: "hrGroup",
      title: "الموارد البشرية",
      items: [
        {
          id: "hr_group",
          label: "الموارد",
          icon: UsersRound,
          roles: ["manager", "supervisor"],
          subItems: [
            { id: "employees", label: "الموظفين", roles: ["manager", "supervisor"] },
            { id: "attendance_manager", label: "الحضور والغياب", roles: ["manager", "supervisor"] },
            { id: "payrolls", label: "الرواتب", roles: ["manager"] },
            { id: "workers_management", label: "العمالة اليومية", roles: ["manager", "supervisor"] },
            { id: "evaluation", label: "تقييم الأداء", roles: ["manager", "supervisor"] },
          ]
        }
      ]
    },
    {
      id: "mediaGroup",
      title: "التقارير والأرشيف",
      items: [
        {
          id: "reports_group",
          label: "التقارير",
          icon: PieChart,
          roles: ["manager", "supervisor", "employee"],
          subItems: [
            { id: "analytics", label: "التحليلات", roles: ["manager"] },
            { id: "archive", label: "الأرشيف", roles: ["manager"] },
            { id: "gallery", label: "المعرض", roles: ["manager", "supervisor", "employee"] },
          ]
        }
      ]
    }
  ];

  const isTabAllowed = (tabId: string) => {
    if (["profile", "notifications", "camera"].includes(tabId)) return true;
    const allItems: any[] = [];
    menuGroups.forEach((g) => {
      g.items.forEach((item) => {
        allItems.push(item);
        if (item.subItems) {
          allItems.push(...item.subItems);
        }
      });
    });
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

  const toggleSubMenu = (menuId: string) => {
    setExpandedSubMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  useEffect(() => {
    menuGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.subItems && item.subItems.some((s: any) => s.id === activeTab)) {
          setExpandedSubMenus((prev) =>
            prev.includes(item.id) ? prev : [...prev, item.id]
          );
        }
      });
    });
  }, [activeTab]);

  useEffect(() => {
    if (profile) {
      if ((activeTab === "dashboard" || activeTab === "sales_rep_dashboard") && profile.role === "sales_rep") {
        setActiveTab("rep_dashboard");
        return;
      }
      if (!isTabAllowed(activeTab)) {
        setActiveTab(profile.role === "sales_rep" ? "rep_dashboard" : "dashboard");
        toast.error("ليس لديك صلاحية الوصول لهذه الصفحة");
      }
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
    const unsubSys = onSnapshot(
      doc(db, "system", "settings"),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.geminiApiKey) {
            localStorage.setItem("VITE_GEMINI_API_KEY", data.geminiApiKey);
            (window as any).VITE_GEMINI_API_KEY = data.geminiApiKey;
          }
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
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });
      await signInWithPopup(auth, provider);
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
      <div 
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" 
        dir="rtl"
        style={{ 
          background: 'radial-gradient(circle at center, #0f2a2c 0%, #030809 100%)',
          fontFamily: "'Cairo', sans-serif"
        }}
      >
        {/* Animated ambient background elements */}
        <div className="absolute top-[-20%] right-[-20%] w-[35rem] h-[35rem] bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[35rem] h-[35rem] bg-emerald-500/5 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="z-10 flex flex-col items-center"
        >
          {/* Pulsing Glowing Logo Container */}
          <div className="relative mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-[2.5rem] blur-xl opacity-35 animate-pulse" />
            <div className="relative w-36 h-36 bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] p-6 shadow-2xl border border-slate-800 flex items-center justify-center">
              <img 
                src="https://i.imgur.com/yYZDeHZ.jpg" 
                alt="Logo" 
                className="w-full h-full object-contain rounded-2xl shadow-inner border border-slate-700 bg-white p-1" 
              />
            </div>
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white text-3xl font-black tracking-tight mb-2"
          >
            نظام خبراء الرسم
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.5 }}
            className="text-teal-400 font-bold text-xs tracking-[0.25em]"
          >
            جاري تهيئة البيئة الرقمية...
          </motion.p>
          
          {/* Spinner Loader */}
          <div className="mt-8 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce"></span>
          </div>
        </motion.div>

        <div className="absolute bottom-10 flex items-center gap-2 text-white/30 text-[9px] font-black tracking-widest">
           <Zap className="w-3.5 h-3.5 text-teal-500 animate-pulse" />
           <span>POWERED BY ADVANCED INTELLIGENCE</span>
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
        <div className="max-w-5xl mx-auto w-full">
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
        className="min-h-screen bg-slate-950 flex flex-col lg:flex-row relative overflow-hidden text-right"
        dir="rtl"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Ambient Glowing Orbs */}
        <div className="absolute top-[-10%] right-[-10%] w-[35rem] h-[35rem] bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[35rem] h-[35rem] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Side (visible on large screens) */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-950 p-12 flex-col justify-between relative overflow-hidden border-l border-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(20,184,166,0.1),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 p-2">
              <img src={sysSettings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg bg-white p-0.5" />
            </div>
            <span className="text-white font-black text-xs tracking-wide">مؤسسة خبراء الرسم للمقاولات</span>
          </div>

          <div className="space-y-6 relative z-10 my-auto">
            <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-3 py-1.5 text-[10px] font-bold w-fit rounded-full">
              بوابة الوصول الموحدة للموظفين والمناديب
            </Badge>
            <h2 className="text-3xl xl:text-4xl font-black text-white leading-snug">
              نظام الأتمتة المالي المتقدم <br />
              وإدارة المبيعات الذكية والمشاريع.
            </h2>
            <p className="text-slate-400 text-xs max-w-md font-bold leading-relaxed">
              منصة سحابية متكاملة لربط إدارة العمليات في الميدان بالفواتير والمبيعات التشاركية وإرسال الإشعارات والاعتمادات للإدارة بشكل فوري.
            </p>
          </div>

          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold relative z-10">
            <span>المملكة العربية السعودية © 2026</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-500" />
              <span>نظام مشفر ومؤمن بالكامل</span>
            </div>
          </div>
        </div>

        {/* Login Form Side */}
        <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-slate-900/40 backdrop-blur-2xl rounded-[2.5rem] border border-slate-900 p-8 md:p-12 shadow-2xl relative"
          >
            {/* Logo on mobile view */}
            <div className="flex flex-col items-center lg:items-start mb-8 text-center lg:text-right">
              <div className="mb-6 relative lg:hidden">
                <div className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full scale-125 animate-pulse" />
                <img
                  src={sysSettings.logoUrl}
                  alt="Logo"
                  className="w-20 h-20 object-contain rounded-2xl relative z-10 shadow-lg border border-slate-800 bg-white p-1"
                />
              </div>
              
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                تسجيل الدخول للمنصة
              </h1>
              <p className="text-slate-400 font-bold text-xs mt-2 leading-relaxed">
                سجل الدخول باستخدام حساب Google الخاص بالشركة للبدء.
              </p>
            </div>

            <div className="space-y-6">
              <Button
                onClick={handleLogin}
                className="w-full h-15 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-650 hover:to-emerald-700 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-3 transition-all hover:shadow-[0_10px_30px_rgba(20,184,166,0.15)] active:scale-98 group border-none shadow-lg"
              >
                <div className="bg-white/10 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                  <UsersRound className="w-5 h-5" />
                </div>
                دخول من خلال حساب Google
              </Button>
              
              <div className="bg-slate-950/50 p-4.5 rounded-2xl border border-slate-900">
                <p className="text-[10px] text-center text-slate-400 font-bold leading-relaxed">
                  ⚠️ الدخول مقيد للبريد الإلكتروني المعتمد من الموارد البشرية. إذا لم يكن لديك حساب، يرجى تقديم طلب التسجيل للمدير.
                </p>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-900 flex flex-col items-center gap-3 text-slate-500 text-[10px] font-bold">
              <div className="flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-teal-600" />
                 <span>Authorized Employees Only</span>
              </div>
              <p className="text-center lg:hidden">
                المملكة العربية السعودية © 2026
              </p>
            </div>
          </motion.div>
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
              onClick={() => setActiveTab(profile?.role === "sales_rep" ? "rep_dashboard" : "dashboard")}
              className="flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <img
                src={sysSettings.logoUrl}
                alt="logo"
                className="w-8 h-8 object-contain rounded-lg"
              />
            </div>
            {sysSettings.showWelcomeMessage && sysSettings.generalAnnouncement && (
               <Dialog>
                 <DialogTrigger asChild>
                   <div className="max-w-[130px] overflow-hidden truncate cursor-pointer hover:opacity-90 transition-opacity ml-2 shrink-0">
                      <span className="text-[9px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 whitespace-nowrap flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[80px]">{sysSettings.generalAnnouncement}</span>
                      </span>
                   </div>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px] rounded-xl p-5 border border-slate-200 bg-white" dir="rtl">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-slate-600" />
                        الرسالة العامة والتوجه الإداري
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-3.5 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                        <Bell className="w-4 h-4 text-slate-700" />
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed text-xs">
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
                <div 
                  onClick={() => setActiveTab(profile?.role === "sales_rep" ? "rep_dashboard" : "dashboard")}
                  className="flex items-center gap-3 min-w-0 cursor-pointer active:scale-95 transition-all"
                  title="الذهاب للوحة الرئيسية"
                >
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
                    {showFull && group.title && (
                      <div className="px-6 mb-2 mt-5 text-[10px] font-extrabold text-white/35 tracking-widest select-none flex items-center gap-2">
                        <span>{group.title}</span>
                        <div className="flex-1 h-[1px] bg-white/5" />
                      </div>
                    )}

                    <motion.div
                      animate={{
                        height: "auto",
                        opacity: 1,
                      }}
                      className="overflow-hidden space-y-1"
                    >
                      {visibleItems.map((item) => {
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const allowedSubItems = hasSubItems
                          ? item.subItems.filter((s: any) => s.roles.includes(profile?.role || "employee"))
                          : [];
                          
                        if (hasSubItems && allowedSubItems.length === 0) return null;
                        
                        const isExpanded = expandedSubMenus.includes(item.id);
                        const isSubActive = hasSubItems && allowedSubItems.some((s: any) => activeTab === s.id);
                        
                        if (hasSubItems) {
                          return (
                            <div key={item.id} className="space-y-0.5">
                              <button
                                onClick={() => {
                                  if (showFull) {
                                    toggleSubMenu(item.id);
                                  } else {
                                    if (allowedSubItems.length > 0) {
                                      setActiveTab(allowedSubItems[0].id);
                                    }
                                  }
                                }}
                                className={`w-full flex items-center justify-between transition-all group relative ${
                                  !showFull ? "justify-center px-0 py-4" : "px-6 py-2"
                                } ${
                                  isSubActive
                                    ? "bg-white/5 text-white"
                                    : "text-white/50 hover:bg-white/10 hover:text-white/90"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <item.icon
                                    className={`shrink-0 transition-colors ${
                                      !showFull ? "w-6 h-6" : "w-4 h-4"
                                    } ${isSubActive ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100"}`}
                                  />
                                  {showFull && (
                                    <span className="text-xs font-bold truncate">
                                      {item.label}
                                    </span>
                                  )}
                                </div>
                                
                                {showFull && (
                                  <ChevronDown 
                                    className={`w-3.5 h-3.5 opacity-55 transition-transform ${isExpanded ? "" : "rotate-90"}`} 
                                  />
                                )}
                              </button>
                              
                              {showFull && isExpanded && (
                                <div className="space-y-0.5 pr-4 border-r border-white/5 mr-6 mt-0.5">
                                  {allowedSubItems.map((sub: any) => (
                                    <button
                                      key={sub.id}
                                      onClick={() => {
                                        setActiveTab(sub.id);
                                        if (window.innerWidth < 1024)
                                          setIsSidebarOpen(false);
                                      }}
                                      className={`w-full flex items-center gap-3 transition-all px-4 py-1.5 rounded-lg text-right relative text-[11px] font-bold ${
                                        activeTab === sub.id
                                          ? "bg-white/10 text-white"
                                          : "text-white/40 hover:bg-white/5 hover:text-white/70"
                                      }`}
                                    >
                                      {activeTab === sub.id && (
                                        <div className="absolute right-0 top-1 bottom-1 w-0.5 bg-sidebar-primary" />
                                      )}
                                      <span>{sub.label}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        return (
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
                        );
                      })}
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
              <span>أنت تعمل الآن في وضع أوفلاين - قد لا تظهر بعض البيانات المحدثة</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ DESKTOP HEADER ══ */}
        <header className="hidden lg:flex h-14 bg-white border-b border-slate-100 items-center justify-between px-5 shrink-0" dir="rtl">

          {/* يمين = زر القائمة + الترحيب (جانب الشريط الجانبي) */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSidebarCollapseToggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold leading-none mb-0.5">مرحباً</p>
              <p className="text-sm font-black text-slate-900 leading-none">
                {profile?.role === "manager" ? "مدير النظام" : profile?.name}
              </p>
            </div>
          </div>

          {/* يسار = الإعلان + الجرس + البروفايل */}
          <div className="flex items-center gap-3">

            {/* الإعلان */}
            {sysSettings.generalAnnouncement && (
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1.5 text-[10px] font-bold max-w-[200px] hover:bg-amber-100 transition">
                    <Volume2 className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate">{sysSettings.generalAnnouncement}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-sm rounded-2xl" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-sm font-black">
                      <Bell className="w-4 h-4 text-amber-500" /> إعلان الإدارة
                    </DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-slate-700 leading-relaxed bg-amber-50 rounded-xl p-4 border border-amber-100">
                    {sysSettings.generalAnnouncement}
                  </p>
                </DialogContent>
              </Dialog>
            )}

            {/* الجرس */}
            <button
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
              onClick={() => setActiveTab("notifications")}
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <div className="w-px h-6 bg-slate-200" />

            {/* البروفايل */}
            <div
              onClick={() => setActiveTab(profile?.role === "sales_rep" ? "sales_rep_profile" : "profile")}
              className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-all group active:scale-95"
            >
              <div className="text-right">
                <p className="text-sm font-black text-slate-800 leading-tight">{profile?.name}</p>
                <p className="text-[10px] text-slate-400 font-bold">
                  {profile?.role === "manager" ? "مدير عام" :
                   profile?.role === "supervisor" ? "مشرف" :
                   profile?.role === "sales_rep" ? "مندوب مبيعات" : "موظف"}
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                {(profile?.name?.[0] || user?.displayName?.[0] || "U").toUpperCase()}
              </div>
            </div>

          </div>

        </header>

        <main className="flex-1 overflow-auto bg-background pb-28 lg:pb-8">
          <GlobalNotificationListener />
            <div className="p-2 md:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === "dashboard" && <Dashboard goToTab={setActiveTab} />}
                {activeTab === "company_profile" && <CompanyProfile />}
                {activeTab === "analytics" && (
                  <Analytics onBack={() => setActiveTab("dashboard")} />
                )}
                {activeTab === "profile" && (
                  <EmployeeProfile
                    employeeId={user.uid}
                    onBack={() => setActiveTab("dashboard")}
                  />
                )}
                {activeTab === "sales_rep_profile" && (
                  <SalesRepProfile
                    salesRepId={user.uid}
                    onBack={() => setActiveTab("rep_dashboard")}
                  />
                )}
                {/* Finance Group */}
                {activeTab === "financials" && <Financials />}
                {activeTab === "banking" && <BankingAndVault />}
                {activeTab === "expenses" && <Expenses />}
                {activeTab === "archive" && <Archive />}
                {activeTab === "gallery" && <Gallery />}
                {activeTab === "sales" && <Sales />}
                {activeTab === "sales_reps" && (
                  <>
                    {!selectedSalesRepId ? (
                      <SalesRepsManagement onSelectRep={setSelectedSalesRepId} />
                    ) : (
                      <SalesRepProfile
                        salesRepId={selectedSalesRepId}
                        onBack={() => setSelectedSalesRepId(null)}
                      />
                    )}
                  </>
                )}
                {activeTab === "rep_dashboard" && (
                  <SalesRepDashboard subPage="dashboard" onNavigate={setActiveTab} />
                )}
                {activeTab === "rep_smart_bot" && (
                  <SalesRepDashboard subPage="bot" onNavigate={setActiveTab} />
                )}
                {activeTab === "rep_documents" && (
                  <SalesRepDashboard subPage="documents" onNavigate={setActiveTab} />
                )}
                {activeTab === "rep_statement" && (
                  <SalesRepDashboard subPage="statement" onNavigate={setActiveTab} />
                )}
                {activeTab === "private_jobs_page" && (
                  <PrivateJobsWorkspace onNavigate={setActiveTab} />
                )}
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
                {activeTab === "projects" && <ProjectsV2 viewModeType="projects" />}
                {activeTab === "tasks" && <ProjectsV2 viewModeType="tasks" />}
                {activeTab === "payrolls" && <Payrolls />}
                {activeTab === "approvals" && <ApprovalCenter />}
                {activeTab === "evaluation" && <PerformanceEvaluation />}
                {activeTab === "notifications" && <Notifications />}
                {activeTab === "camera" && <CameraCapture />}
                {activeTab === "briefing" && <ExecutiveBriefingSystem goToTab={setActiveTab} />}
                {activeTab === "general_ledger" && <GeneralLedger />}
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
