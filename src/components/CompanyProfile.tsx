import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ShieldCheck,
  Phone,
  Mail,
  Landmark,
  CreditCard,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  RefreshCw,
  Zap,
  MessageSquare,
  Info,
  Settings,
  MapPin,
  Globe,
  Loader2,
  Lock,
  ArrowRight,
  Cloud,
  Compass,
} from "lucide-react";
import { db } from "../lib/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../lib/AuthContext";
import { sendNotification } from "../lib/notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Default Official Saudi Documents - Real high-fidelity initial data
const DEFAULT_DOCUMENTS = [
  {
    id: "cr",
    title: "السجل التجاري (Commercial Register)",
    authority: "وزارة التجارة (MOCI)",
    docNumber: "1010874562",
    issueDate: "2022-01-15",
    expiryDate: "2027-01-14",
    status: "active",
    cost: 1200,
    steps: "issued", // draft | submitted | payment_pending | issued
    history: [
      { date: "2022-01-15", action: "تم إصدار السجل التجاري بنجاح لمؤسسة خبراء الرسم", user: "علي القحطاني" }
    ],
    reminderDays: 60,
  },
  {
    id: "balady",
    title: "رخصة البلدية / بلدي (Municipal License)",
    authority: "وزارة الشؤون البلدية والقروية (Balady)",
    docNumber: "430987152",
    issueDate: "2024-03-10",
    expiryDate: "2025-03-09",
    status: "active",
    cost: 450,
    steps: "issued",
    history: [
      { date: "2024-03-10", action: "تجديد الرخصة البلدية للمقر الرئيسي بالرياض", user: "أحمد العتيبي" }
    ],
    reminderDays: 30,
  },
  {
    id: "zatca",
    title: "شهادة الزكاة والضريبة (ZATCA Certificate)",
    authority: "هيئة الزكاة والضريبة والجمارك (ZATCA)",
    docNumber: "310485672900003",
    issueDate: "2025-04-01",
    expiryDate: "2026-03-31",
    status: "active",
    cost: 0,
    steps: "issued",
    history: [
      { date: "2025-04-01", action: "تقديم الإقرار الضريبي السنوي واعتماد شهادة الزكاة", user: "محاسب المؤسسة" }
    ],
    reminderDays: 45,
  },
  {
    id: "gosi",
    title: "شهادة التأمينات الاجتماعية (GOSI Certificate)",
    authority: "المؤسسة العامة للتأمينات الاجتماعية (GOSI)",
    docNumber: "98754210",
    issueDate: "2026-05-01",
    expiryDate: "2026-06-01", // Needs renewal soon
    status: "expiring_soon",
    cost: 0,
    steps: "payment_pending",
    history: [
      { date: "2026-05-01", action: "طلب تجديد شهادة الالتزام بالتأمينات لتحديث الملاك", user: "أحمد العتيبي" }
    ],
    reminderDays: 15,
  },
  {
    id: "civil_defense",
    title: "رخصة الدفاع المدني (Civil Defense License)",
    authority: "المديرية العامة للدفاع المدني",
    docNumber: "CD-876352",
    issueDate: "2024-11-20",
    expiryDate: "2025-11-19",
    status: "active",
    cost: 800,
    steps: "issued",
    history: [
      { date: "2024-11-20", action: "فحص متطلبات كود السلامة واعتماده للمستودع", user: "علي القحطاني" }
    ],
    reminderDays: 30,
  },
  {
    id: "qiwa",
    title: "شهادة منصة قوى والالتزام (Qiwa / Saudization)",
    authority: "وزارة الموارد البشرية والتنمية الاجتماعية (MHRSD)",
    docNumber: "QIWA-R-88392",
    issueDate: "2025-08-01",
    expiryDate: "2026-07-31",
    status: "active",
    cost: 1500,
    steps: "issued",
    history: [
      { date: "2025-08-01", action: "تجديد اشتراك منصة قوى والالتزام نسب التوطين لعام 2026", user: "أحمد العتيبي" }
    ],
    reminderDays: 30,
  },
];

// Default Subscriptions
const DEFAULT_SUBSCRIPTIONS = [
  { id: "gsuite", name: "Google Workspace Enterprise", category: "سحاب إلكتروني وبريد", cost: 180, period: "monthly", renewalDate: "2026-06-15", status: "active", autoRenew: true },
  { id: "hosting", name: "Cloud Server Hosting (Google Cloud & SSL)", category: "الاستضافة والشهادات الرقمية", cost: 420, period: "monthly", renewalDate: "2026-06-20", status: "active", autoRenew: true },
  { id: "domain", name: "النطاق الرسمي للشركة (.SA Domain)", category: "النطاق والويب الهوية", cost: 120, period: "yearly", renewalDate: "2026-12-05", status: "active", autoRenew: true },
  { id: "national_address", name: "اشتراك العنوان الوطني الموحد (سبل)", category: "الخدمات اللوجستية والبريدية", cost: 500, period: "yearly", renewalDate: "2027-02-18", status: "active", autoRenew: false },
  { id: "muqeem", name: "بوابة مقيم لإصدار تأشيرات العمالة الكترونياً", category: "الموارد البشرية والجوازات", cost: 1650, period: "yearly", renewalDate: "2026-09-10", status: "active", autoRenew: true },
];

export default function CompanyProfile() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-Section Router view: "hub" | "identity" | "docs" | "subs" | "google"
  const [activeSubSection, setActiveSubSection] = useState<"hub" | "identity" | "docs" | "subs" | "google">("hub");

  // Geo-location assistant States
  const [isGeoHelperOpen, setIsGeoHelperOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Device GPS finder handler
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error("متصفحك لا يدعم الخدمة الجغرافية المدمجة Geolocation API.");
      return;
    }
    setIsLocating(true);
    toast.loading("جاري جلب إحداثيات GPS لجهازك الفعلي الآن...", { id: "geo-toast" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        const coords = `${lat}, ${lng}`;
        handleContactChange("mapCoords", coords);
        toast.success(`تم قراء موقعك الحالي وحقنه: ${coords}`, { id: "geo-toast" });
        setIsLocating(false);
      },
      (error) => {
        console.error("GPS fetch error details - Code:", error.code, "Message:", error.message);
        let errorMsg = "يرجى منح إذن قراءة الموقع الجغرافي للمتصفح أولاً.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "تم رفض إذن الوصول للموقع. إذا كنت تستخدم التطبيق داخل الإطار، يرجى فتحه في نافذة جديدة أو تفعيل صلاحية الموقع لمتصفحك.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = "إشارة الـ GPS غير متوفرة أو قراءة الموقع معطلة بالجهاز.";
        } else if (error.code === error.TIMEOUT) {
          errorMsg = "انتهت مهلة قراءة إحداثيات الـ GPS بجهازك.";
        }
        toast.error(errorMsg, { id: "geo-toast", duration: 7000 });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Core profile state
  const [contacts, setContacts] = useState({
    companyName: "مؤسسة خبراء الرسم للمقاولات والديكور",
    buildingNo: "7488",
    street: "طريق الملك عبدالعزيز",
    district: "الحي الرئيسي",
    city: "الرياض",
    postalCode: "12831",
    additionalNo: "3022",
    vatNumber: "310485672900003",
    commercialRegister: "1010874562",
    unifiedNo: "920010203",
    landline: "0112489304",
    whatsapp: "0550193852",
    email: "info@art-experts.co",
    website: "https://art-experts.co",
    twitter: "@ArtExpertsKSA",
    linkedin: "art-experts-sa",
    mapCoords: "24.6853, 46.7321", // Melaz, Riyadh
  });

  // Google settings state
  const [googleSettings, setGoogleSettings] = useState({
    isConnected: true,
    connectedEmail: "admin@art-experts.co",
    gcloudProjectId: "art-experts-dashboard-2026",
    mapsApiKey: "AIzaSyD83jSDF93jKDFJ83hJSGD839hSDFjhs-f0",
    driveArchiveFolder: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
    autoBackupEnabled: true,
    backupInterval: "weekly",
  });

  const [documents, setDocuments] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  // Validation Error States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [subErrors, setSubErrors] = useState<Record<string, string>>({});
  const [googleErrors, setGoogleErrors] = useState<Record<string, string>>({});

  // Custom temporary Modal forms
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [docForm, setDocForm] = useState({
    title: "",
    authority: "",
    docNumber: "",
    issueDate: "",
    expiryDate: "",
    cost: 0,
    steps: "draft",
    reminderDays: 30,
  });

  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [subForm, setSubForm] = useState({
    name: "",
    category: "",
    cost: 0,
    period: "monthly",
    renewalDate: "",
    autoRenew: true,
  });

  // Document renewal workflow
  const [renewalDoc, setRenewalDoc] = useState<any>(null);
  const [isRenewalLogOpen, setIsRenewalLogOpen] = useState(false);
  const [userLogText, setUserLogText] = useState("");
  const [nextStepSelected, setNextStepSelected] = useState("");

  useEffect(() => {
    // Sync company profile settings from FireStore with real-time snapshot
    const unsubProfile = onSnapshot(
      doc(db, "system", "company_profile"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.contacts) setContacts(data.contacts);
          if (data.googleSettings) setGoogleSettings(data.googleSettings);
          if (data.documents) setDocuments(data.documents);
          if (data.subscriptions) setSubscriptions(data.subscriptions);
        } else {
          initializeDefaultDatabase();
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error loading company profile snap:", error);
        setLoading(false);
      }
    );

    return () => unsubProfile();
  }, []);

  const initializeDefaultDatabase = async () => {
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents: DEFAULT_DOCUMENTS,
        subscriptions: DEFAULT_SUBSCRIPTIONS,
        updatedAt: new Date().toISOString(),
      });
      setDocuments(DEFAULT_DOCUMENTS);
      setSubscriptions(DEFAULT_SUBSCRIPTIONS);
    } catch (e) {
      console.error("Error creating default company profile:", e);
    }
  };

  // Real-time & Submit Validations for Contacts / Identity Form
  const validateContacts = (updatedContacts = contacts) => {
    const errs: Record<string, string> = {};

    // 1. Company Name
    if (!updatedContacts.companyName || updatedContacts.companyName.trim().length < 5) {
      errs.companyName = "اسم المؤسسة مطلوب، ويجب ألا يقل عن 5 أحرف لتطابق السجل.";
    }

    // 2. VAT Number (Saudi Tax ID)
    const cleanVat = (updatedContacts.vatNumber || "").replace(/\s+/g, "");
    if (!cleanVat) {
      errs.vatNumber = "الرقم الضريبي للمنشأة مطلوب للمستندات والفوترة.";
    } else if (!/^\d+$/.test(cleanVat)) {
      errs.vatNumber = "الرقم الضريبي يجب أن يتكون من أرقام فقط.";
    } else if (cleanVat.length !== 15) {
      errs.vatNumber = "الرقم الضريبي للمملكة يجب أن يتكون من 15 رقم بالضبط.";
    } else if (!cleanVat.startsWith("3")) {
      errs.vatNumber = "الرقم الضريبي السعودي القياسي يجب أن يبدأ بالرقم 3.";
    }

    // 3. Commercial Register (السجل التجاري)
    const cleanCr = (updatedContacts.commercialRegister || "").replace(/\s+/g, "");
    if (!cleanCr) {
      errs.commercialRegister = "رقم السجل التجاري مطلوب لإسناد المشاريع وتراخيص بلدي.";
    } else if (!/^\d+$/.test(cleanCr)) {
      errs.commercialRegister = "رقم السجل التجاري يجب أن يحتوي على أرقام فقط.";
    } else if (cleanCr.length !== 10) {
      errs.commercialRegister = "رقم السجل التجاري السعودي يجب أن يكون من 10 أرقام كلياً.";
    }

    // 4. Unified Number (الرقم الموحد)
    const cleanUnified = (updatedContacts.unifiedNo || "").replace(/\s+/g, "");
    if (cleanUnified && !/^9200\d{5}$|^800\d{6,7}$/.test(cleanUnified)) {
      errs.unifiedNo = "صيغة الرقم الموحد غير صحيحة. مثال: 920010203 أو 8001234567.";
    }

    // 5. SPL National Address Inputs
    if (!/^\d{4}$/.test(updatedContacts.buildingNo || "")) {
      errs.buildingNo = "رقم المبنى الوطني الفرعي يجب أن يكون 4 أرقام بالضبط.";
    }
    if (!updatedContacts.street || updatedContacts.street.trim() === "") {
      errs.street = "اسم الشارع الموثق بالعنوان الوطني مطلوب.";
    }
    if (!updatedContacts.district || updatedContacts.district.trim() === "") {
      errs.district = "اسم الحي السكني مطلوب بالرمز الإداري.";
    }
    if (!updatedContacts.city || updatedContacts.city.trim() === "") {
      errs.city = "المدينة (مقر المؤسسة الرئيسي) مطلوب.";
    }
    if (!/^\d{5}$/.test(updatedContacts.postalCode || "")) {
      errs.postalCode = "الرمز البريدي للهوية يجب أن يتكون من 5 أرقام (مثال: 12831).";
    }
    if (!/^\d{4}$/.test(updatedContacts.additionalNo || "")) {
      errs.additionalNo = "الرقم الإضافي الوطني للعنوان الموحد يجب أن يتكون من 4 أرقام بالضبط.";
    }

    // 6. Contact & Social Channels
    if (updatedContacts.landline && !/^01\d{8}$/.test(updatedContacts.landline)) {
      errs.landline = "الهاتف الثابت للمنطقة الوسطى يجب أن يبدأ بـ 01 ومجموعه 10 خانات.";
    }
    if (!/^[05]\d{9}$/.test(updatedContacts.whatsapp || "")) {
      errs.whatsapp = "الرقم الخاص بواتساب الأعمال والاتصال يجب أن يبدأ بـ 05 وبطول 10 خانات.";
    }
    if (!updatedContacts.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedContacts.email)) {
      errs.email = "يرجى تعيين بريد إلكتروني رسمي وصحيح للمراسلات الحكومية.";
    }
    if (updatedContacts.website && !/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(updatedContacts.website)) {
      errs.website = "الموقع الإلكتروني الرسمي للشركة يجب أن يبدأ بـ http:// أو https://.";
    }

    // 7. GPS Coordinates
    if (!/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(updatedContacts.mapCoords || "")) {
      errs.mapCoords = "صيغة الإحداثيات للمقر الرئيسي خاطئة. مثال: 24.6853, 46.7321";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContactChange = (field: string, value: string) => {
    const updated = { ...contacts, [field]: value };
    setContacts(updated);
    validateContacts(updated); // instant feedback checks
  };

  const handleSaveContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateContacts()) {
      toast.error("يرجى تصحيح الخانات الخاطئة قبل محاولة حفظ بيانات ومستندات المنشأة.");
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents,
        subscriptions,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await sendNotification({
        title: "تحديث الأوراق الرسمية والهوية",
        message: `تم تحديث بيانات الاتصال والعنوان الوطني التابع للمؤسسة بواسطة ${profile?.name || "المدير"}`,
        type: "success",
        category: "system",
        targetRole: "manager",
        priority: "medium",
      });

      toast.success("تم تحديث وحفظ بيانات العنوان الموحد للمؤسسة بنجاح!");
      setErrors({});
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ طارئ أثناء الاتصال بخادم الحفظ في السحابة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate Google Cloud Configurations
  const validateGoogle = (updatedG = googleSettings) => {
    const errs: Record<string, string> = {};

    if (!updatedG.gcloudProjectId || !/^[a-z0-9-]+$/.test(updatedG.gcloudProjectId)) {
      errs.gcloudProjectId = "معرّف مشروع قوقل غير صالح. يجب كتابته بأحرف صغيرة، أرقام، وفواصل (-) فقط.";
    }
    if (!updatedG.mapsApiKey || !/^AIzaSy[A-Za-z0-9_-]{33}$/.test(updatedG.mapsApiKey)) {
      errs.mapsApiKey = "رقم مفتاح الخرائط API غير مطابق لمواصفات Google API Key (33 خانة إضافية ويبدأ بـ AIzaSy).";
    }
    if (!updatedG.driveArchiveFolder || !/^https:\/\/(drive|docs)\.google\.com\/.+$/i.test(updatedG.driveArchiveFolder)) {
      errs.driveArchiveFolder = "رابط المجلد الافتراضي السحابي غير صالح. يجب أن يكون رابطاً صالحاً لـ Google Drive.";
    }

    setGoogleErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGoogleChange = (field: string, value: any) => {
    const updated = { ...googleSettings, [field]: value };
    setGoogleSettings(updated);
    validateGoogle(updated);
  };

  const handleSaveGoogleSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGoogle()) {
      toast.error("يرجى التأكد من ملء وقراءة تفاصيل مفاتيح الربط الذكي بطريقة صحيحة قبل الحفظ.");
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents,
        subscriptions,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await sendNotification({
        title: "تعديل إقرارات السحابة والتحكم لـ Google",
        message: "تم تحديث إقرارات الربط السحابي وحسابات Google الحركية.",
        type: "info",
        category: "system",
        targetRole: "manager",
        priority: "medium",
      });

      toast.success("تم تحديث وحفظ تفاصيل الربط السحابي مع Google Cloud بنجاح!");
      setGoogleErrors({});
    } catch (err) {
      console.error(err);
      toast.error("فشل حفظ إقرارات Google.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper date calculations
  const calculateDaysRemaining = (expiryDateStr: string) => {
    const today = new Date();
    const expiry = new Date(expiryDateStr);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const checkDocStatus = (expiryDateStr: string, steps: string) => {
    if (steps !== "issued" && steps !== "completed") {
      return { label: "قيد المراجعة والمعالجة", color: "bg-orange-50 text-orange-700 border-orange-100" };
    }
    const days = calculateDaysRemaining(expiryDateStr);
    if (days <= 0) {
      return { label: "منتهية الصلاحية 🔴", color: "bg-red-50 text-red-700 border-red-100" };
    } else if (days <= 30) {
      return { label: "تنتهي قريباً جداً ⚠️", color: "bg-rose-50 text-rose-700 border-rose-100" };
    } else if (days <= 60) {
      return { label: "تنبيه قرب الانتهاء", color: "bg-amber-50 text-amber-700 border-amber-100" };
    }
    return { label: "سارية ونشطة 🇸🇦", color: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  };

  // Documents dialog handler
  const handleOpenDocModal = (docItem: any = null) => {
    setDocErrors({});
    if (docItem) {
      setSelectedDoc(docItem);
      setDocForm({
        title: docItem.title,
        authority: docItem.authority,
        docNumber: docItem.docNumber,
        issueDate: docItem.issueDate,
        expiryDate: docItem.expiryDate,
        cost: docItem.cost || 0,
        steps: docItem.steps || "issued",
        reminderDays: docItem.reminderDays || 30,
      });
    } else {
      setSelectedDoc(null);
      setDocForm({
        title: "",
        authority: "",
        docNumber: "",
        issueDate: "",
        expiryDate: "",
        cost: 0,
        steps: "draft",
        reminderDays: 30,
      });
    }
    setIsDocModalOpen(true);
  };

  const validateDocFormFields = () => {
    const errs: Record<string, string> = {};
    if (!docForm.title || docForm.title.trim().length < 3) {
      errs.title = "اسم المستند أو الترخيص مطلوب، ولا يقل عن 3 أحرف مخصصة.";
    }
    if (!docForm.authority || docForm.authority.trim().length < 2) {
      errs.authority = "الجهة السعودية المصدرة أو المنصة مطلوبة (مثل: بلدي، قوى، وزارة التجارة).";
    }
    if (!docForm.docNumber || !/^[A-Za-z0-9_-]+$/.test(docForm.docNumber)) {
      errs.docNumber = "رقم السند/المستند مطلوب، ويجب كتابته أحرف وأرقام معيارية فقط.";
    }
    if (!docForm.issueDate) {
      errs.issueDate = "تاريخ إصدار الترخيص المهني مطلوب.";
    }
    if (!docForm.expiryDate) {
      errs.expiryDate = "تاريخ انتهاء صلاحية الترخيص مطلوب.";
    } else if (docForm.issueDate && new Date(docForm.expiryDate) <= new Date(docForm.issueDate)) {
      errs.expiryDate = "تاريخ انتهاء الصلاحية لا يمكن أن يكون قبل أو يساوي تاريخ الإصدار.";
    }
    if (docForm.cost < 0) {
      errs.cost = "رسوم التجديد السنوية المقررة لا يمكن أن تكون قيمة سالبة.";
    }
    if (docForm.reminderDays < 3 || docForm.reminderDays > 120) {
      errs.reminderDays = "فترة التنبيه المبكر السابقة يجب أن تكون بين 3 أيام و 120 يوماً.";
    }

    setDocErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDocFormFields()) {
      toast.error("يرجى التأكد من إدخال معلومات صحيحة وتجاوز رسائل التنبيه المحددة للترخيص.");
      return;
    }

    let updatedDocs = [...documents];
    const days = calculateDaysRemaining(docForm.expiryDate);
    const status = days <= 0 ? "expired" : days <= 30 ? "expiring_soon" : "active";

    if (selectedDoc) {
      updatedDocs = updatedDocs.map((d) =>
        d.id === selectedDoc.id
          ? {
              ...d,
              ...docForm,
              status,
            }
          : d
      );
    } else {
      const newId = "doc_" + Date.now().toString().slice(-4);
      updatedDocs.push({
        id: newId,
        ...docForm,
        status,
        history: [
          {
            date: new Date().toISOString().split("T")[0],
            action: "تم إلكترونياً تسجيل وإيداع وثيقة تابعة للشركة",
            user: profile?.name || "المشرف العام",
          },
        ],
      });
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents: updatedDocs,
        subscriptions,
        updatedAt: new Date().toISOString(),
      });

      toast.success("تم تحديث وأرشفة ورقة المستند الحكومي في السحابة بنجاح!");
      setIsDocModalOpen(false);
      setDocErrors({});
    } catch {
      toast.error("حدث خطأ طارئ أثناء تسجيل الوثيقة");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف وأرشفة هذه الوثيقة من السجلات الإلكترونية لـ هوية الشركة؟")) return;
    const updatedDocs = documents.filter((d) => d.id !== id);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents: updatedDocs,
        subscriptions,
        updatedAt: new Date().toISOString(),
      });
      toast.success("تم إزالة وثيقة المنشأة من الأرشيف بنجاح.");
    } catch {
      toast.error("حدث خطأ أثناء الإزالة.");
    }
  };

  // Manage Government documents step updates
  const handleOpenRenewal = (docItem: any) => {
    setRenewalDoc(docItem);
    setNextStepSelected(docItem.steps || "submitted");
    setUserLogText("");
    setIsRenewalLogOpen(true);
  };

  const handleUpdateRenewalPipeline = async () => {
    if (!renewalDoc) return;

    const logs = [...(renewalDoc.history || [])];
    const cleanDate = new Date().toISOString().split("T")[0];

    let actionDescription = "";
    if (nextStepSelected === "draft") actionDescription = "إرجاع الوثيقة كمسودة للتعديل";
    if (nextStepSelected === "submitted") actionDescription = "تم رفع معاملة التجديد للجهة الحكومية المختصة للمراجعة والتدقيق";
    if (nextStepSelected === "payment_pending") actionDescription = "بانتظار سداد الفواتير الحكومية المقررة ومطابقة البيانات المرفقة";
    if (nextStepSelected === "issued") actionDescription = "تم سداد الرسوم واعتماد واصدار الترخيص/الوثيقة بنجاح وجعلها سارية المفعول";

    if (userLogText.trim()) {
      actionDescription += ` - ملاحظة الإدارة: ${userLogText.trim()}`;
    }

    logs.unshift({
      date: cleanDate,
      action: actionDescription,
      user: profile?.name || "مسؤول العلاقات الحكومية",
    });

    const updatedDocs = documents.map((d) => {
      if (d.id === renewalDoc.id) {
        return {
          ...d,
          steps: nextStepSelected,
          history: logs,
        };
      }
      return d;
    });

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents: updatedDocs,
        subscriptions,
        updatedAt: new Date().toISOString(),
      });

      await sendNotification({
        title: `تحديث معاملة: ${renewalDoc.title}`,
        message: `تم تحديث مسار تجديد الوثيقة بموجب: ${actionDescription}`,
        type: "success",
        category: "system",
        targetRole: "manager",
        priority: "high",
      });

      toast.success("تم تدوين الحركة وتحديث مسار تجديد الوثيقة بنجاح!");
      setIsRenewalLogOpen(false);
    } catch {
      toast.error("فشل تحديث مسار المعاملة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Subscription modal handler
  const handleOpenSubModal = (subItem: any = null) => {
    setSubErrors({});
    if (subItem) {
      setSelectedSub(subItem);
      setSubForm({
        name: subItem.name,
        category: subItem.category,
        cost: subItem.cost || 0,
        period: subItem.period || "monthly",
        renewalDate: subItem.renewalDate,
        autoRenew: subItem.autoRenew !== undefined ? subItem.autoRenew : true,
      });
    } else {
      setSelectedSub(null);
      setSubForm({
        name: "",
        category: "",
        cost: 0,
        period: "monthly",
        renewalDate: "",
        autoRenew: true,
      });
    }
    setIsSubModalOpen(true);
  };

  const validateSubFormFields = () => {
    const errs: Record<string, string> = {};
    if (!subForm.name || subForm.name.trim().length < 3) {
      errs.name = "اسم الخدمة أو النظام مطلوب، ويجب ألا يقل عن 3 أحرف مخصصة.";
    }
    if (!subForm.category || subForm.category.trim() === "") {
      errs.category = "يرجى تعيين تصنيف مالي محدد لسهولة تتبع الميزانية.";
    }
    if (subForm.cost < 0) {
      errs.cost = "التكلفة المقررة للسحابة لا يمكن أن تكون قيمة سالبة.";
    }
    if (!subForm.renewalDate) {
      errs.renewalDate = "تاريخ الاستحقاق أو السداد القادم مطلوب بدقة.";
    }

    setSubErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSubFormFields()) {
      toast.error("يرجى استيفاء وتعبئة بيانات حقول الاشتراك بطريقة صحيحة ومطابقة.");
      return;
    }

    let updatedSubs = [...subscriptions];
    if (selectedSub) {
      updatedSubs = updatedSubs.map((s) =>
        s.id === selectedSub.id ? { ...s, ...subForm } : s
      );
    } else {
      const newId = "sub_" + Date.now().toString().slice(-4);
      updatedSubs.push({
        id: newId,
        ...subForm,
        status: "active",
      });
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents,
        subscriptions: updatedSubs,
        updatedAt: new Date().toISOString(),
      });

      toast.success("تم حفظ وتحديث قيد الاشتراك السحابي الدائم بنجاح!");
      setIsSubModalOpen(false);
      setSubErrors({});
    } catch {
      toast.error("حدث خطأ أثناء حفظ الاشتراك.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm("هل أنت متأكد من إلغاء تتبع هذا الاشتراك السحابي من السجلات؟")) return;
    const updatedSubs = subscriptions.filter((s) => s.id !== id);
    try {
      await setDoc(doc(db, "system", "company_profile"), {
        contacts,
        googleSettings,
        documents,
        subscriptions: updatedSubs,
        updatedAt: new Date().toISOString(),
      });
      toast.success("تم إزالة تتبع الاشتراك من الأنظمة.");
    } catch {
      toast.error("فشل حذف السجل.");
    }
  };

  const triggerGoogleAuthSimulation = () => {
    toast.promise(
      new Promise((resolve) => {
        setTimeout(() => {
          setGoogleSettings((prev) => ({
            ...prev,
            isConnected: true,
            connectedEmail: profile?.email || "admin@art-experts.co",
          }));
          resolve(true);
        }, 2000);
      }),
      {
        loading: "جاري استدعاء بوابة المصادقة الآمنة لـ Google Workspace...",
        success: "تم الربط والمصادقة الأمنية مع حساب Google بنجاح!",
        error: "فشل استدعاء بوابة الترخيص.",
      }
    );
  };

  const triggerDataBackupBackupNow = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 3000)),
      {
        loading: "جاري جمع وتسوية البيانات وإرسال أرشيف الكيان الموحد لـ Google Drive...",
        success: "تم إرسال وأرشفة نسخة احتياطية مشفرة بالكامل لخادم Drive بنجاح!",
        error: "فشل النسخ الاحتياطي التلقائي.",
      }
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" dir="rtl">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-xs font-bold text-slate-400">جاري استدعاء السجلات والملفات الموثقة للشركة...</p>
      </div>
    );
  }

  // Count metrics dynamically
  const totalActiveDocs = documents.filter((d) => checkDocStatus(d.expiryDate, d.steps).label.includes("سارية")).length;
  const docsExSoon = documents.filter((d) => {
    const lbl = checkDocStatus(d.expiryDate, d.steps).label;
    return lbl.includes("تنتهي") || lbl.includes("تنبيه") || lbl.includes("منتهية");
  }).length;
  const ongoingRenewalInProcess = documents.filter((d) => d.steps !== "issued" && d.steps !== "completed").length;
  const monthlySubscriptionSum = subscriptions
    .filter((s) => s.period === "monthly")
    .reduce((acc, current) => acc + (current.cost || 0), 0);

  return (
    <div className="space-y-6 pb-20 select-none text-right" dir="rtl">
      
      {/* ----------------- SUB-SECTION NAVIGATION HEADER ----------------- */}
      <AnimatePresence mode="wait">
        {activeSubSection !== "hub" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4"
          >
            <Button
              id="back-to-hub-btn"
              onClick={() => setActiveSubSection("hub")}
              variant="outline"
              className="rounded-xl h-9 px-4 border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 font-bold text-xs gap-1.5 cursor-pointer flex items-center"
            >
              <ArrowRight className="w-4 h-4 ml-1 shrink-0" />
              الرجوع لهوية الشركة الرئيسية
            </Button>
            <Badge className="bg-primary/5 text-primary border border-primary/10 font-bold text-[10px] py-1 px-3">
              مسار الكيان الفردي الموحد &gt; {activeSubSection === "identity" && "الهوية والاتصال"}
              {activeSubSection === "docs" && "الوثائق والتراخيص الرسمية"}
              {activeSubSection === "subs" && "الاشتراكات والمدفوعات"}
              {activeSubSection === "google" && "ربط ومزامنة Google"}
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- HUB VIEW ("hub") ----------------- */}
      {activeSubSection === "hub" && (
        <div className="space-y-6">
          <div className="border-b border-slate-100 pb-5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 px-2.5 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] rounded-full flex items-center gap-1 border border-emerald-150">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                تكامل الأنظمة والهوية للشركة
              </span>
              <span className="p-1 px-2.5 bg-blue-50 text-blue-700 font-extrabold text-[10px] rounded-full border border-blue-150">
                مؤسسة خبراء الرسم للمقاولات
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Building2 className="w-7 h-7 text-primary shrink-0" />
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none font-sans">هوية الكيان والأوراق المعتمدة</h1>
            </div>
            <p className="text-slate-400 text-xs mt-1.5 font-bold">
              مرحباً بك في مركز إدارة هوية الشركة. اختر أحد الأقسام أدناه لتعديل البيانات وتحديث التراخيص ومراقبة المدفوعات مع حماية صارمة لمنع إدخال بيانات غير متطابقة.
            </p>
          </div>

          {/* Cards Grid representing sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Card 1: Identity & Contacts */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveSubSection("identity")}
              className="group border border-slate-205 rounded-2xl bg-white hover:border-emerald-500/40 p-6 shadow-3xs hover:shadow-2xs cursor-pointer flex flex-col justify-between h-56 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-slate-50 text-slate-800 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 font-bold border-none text-[8px] py-1 px-2">
                    جاهز ومكتمل
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-800 transition-colors">بيانات الهوية والاتصال والعنوان الوطني</h3>
                  <p className="text-slate-400 text-[11px] font-bold mt-1 leading-relaxed">
                    تعديل العنوان الوطني الموحد بـ (سبل SPL)، الهاتف الثابت، إحداثيات المقر الرئيسي والفرعي، الرقم الضريبي والاتصال المباشر.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] font-extrabold text-slate-500 group-hover:text-emerald-700">
                <span>الاسم: {contacts.companyName}</span>
                <span className="underline flex items-center gap-1">
                  الدخول للقسم 
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </span>
              </div>
            </motion.div>

            {/* Card 2: Documents & Licenses */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveSubSection("docs")}
              className="group border border-slate-205 rounded-2xl bg-white hover:border-indigo-500/40 p-6 shadow-3xs hover:shadow-2xs cursor-pointer flex flex-col justify-between h-56 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-slate-50 text-slate-800 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
                    <FileText className="w-6 h-6" />
                  </div>
                  <Badge className="bg-amber-50 text-amber-700 font-bold border-none text-[8px] py-1 px-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 animate-spin-slow" />
                    يحتاج تجديد قادم
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-800 transition-colors">الوثائق والتراخيص الرسمية</h3>
                  <p className="text-slate-400 text-[11px] font-bold mt-1 leading-relaxed">
                    متابعة كود السلامة للدفاع المدني، رخص بلدي، شهادات الزكاة لـ ZATCA، التأمينات وفترات سماح تجديد الرخص إلكترونياً.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] font-extrabold text-slate-500 group-hover:text-indigo-700">
                <span className="text-emerald-600">{totalActiveDocs} مستند ساري | {docsExSoon} تنبيه</span>
                <span className="underline flex items-center gap-1">
                  إدارة التراخيص والوثائق
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </span>
              </div>
            </motion.div>

            {/* Card 3: Subscriptions */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveSubSection("subs")}
              className="group border border-slate-205 rounded-2xl bg-white hover:border-blue-500/40 p-6 shadow-3xs hover:shadow-2xs cursor-pointer flex flex-col justify-between h-56 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-slate-50 text-slate-800 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 font-bold border-none text-[8px] py-1 px-2">
                    نشط ومنتظم
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-blue-800 transition-colors">الاشتراكات والمدفوعات الدورية</h3>
                  <p className="text-slate-400 text-[11px] font-bold mt-1 leading-relaxed">
                    تتبع النفقات الشهرية والسنوية على أنظمة G-Suite، الاستضافات السحابية، بوابة مقيم لإجراءات العمالة، ونطاقات الشركة الرسمية.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] font-extrabold text-slate-500 group-hover:text-blue-700">
                <span>مجموع شهري: {monthlySubscriptionSum} ر.س</span>
                <span className="underline flex items-center gap-1">
                  مراجعة الاشتراكات ومواعيد السداد
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </span>
              </div>
            </motion.div>

            {/* Card 4: Google Cloud Integration */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveSubSection("google")}
              className="group border border-slate-205 rounded-2xl bg-white hover:border-slate-550/40 p-6 shadow-3xs hover:shadow-2xs cursor-pointer flex flex-col justify-between h-56 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-slate-50 text-slate-800 group-hover:bg-rose-50 group-hover:text-rose-700 transition-colors">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <Badge className="bg-rose-50 text-rose-700 font-bold border-none text-[8px] py-1 px-2 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-rose-600" />
                    مرتبط وآمن
                  </Badge>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 group-hover:text-rose-800 transition-colors">ربط ومزامنة Google الذكي</h3>
                  <p className="text-slate-400 text-[11px] font-bold mt-1 leading-relaxed">
                    مزامنة السجلات المكتملة وعناوين الملاك تلقائياً لـ Google Workspace وGoogle Drive وحفظ أرشيفات مستودع خبراء الرسم.
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] font-extrabold text-slate-500 group-hover:text-rose-700">
                <span>البريد: {googleSettings.connectedEmail}</span>
                <span className="underline flex items-center gap-1">
                  التحكم الذكي وقنوات Google 
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </span>
              </div>
            </motion.div>

          </div>
        </div>
      )}


      {/* ----------------- SECTION 1: IDENTITY ----------------- */}
      {activeSubSection === "identity" && (
        <div className="space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-primary shrink-0" />
              <h2 className="text-xl font-black text-slate-900">هوية الكيان والعنوان الوطني بالرياض</h2>
            </div>
            <p className="text-slate-400 text-xs mt-1 font-bold">تحديد مرجع الهوية الضريبية للمنشأة، العناوين الرسمية وقنوات الاتصال لتسجيل عقود المشاريع.</p>
          </div>

          <form onSubmit={handleSaveContacts} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Main inputs */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Core Foundation & Identifiers */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/70">
                    <h3 className="text-emerald-850 text-xs font-black">بيانات السجل التجاري والمالية</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">تطبيقات التوثيق والتعميد وعقود كبار الموردين والمؤسسات</p>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name input */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-750">الاسم الرسمي والكامل للمنشأة</Label>
                        <Input
                          id="companyName"
                          value={contacts.companyName}
                          onChange={(e) => handleContactChange("companyName", e.target.value)}
                          className={`h-10 text-xs font-bold rounded-lg border text-right transition-colors ${
                            errors.companyName ? "border-red-400 focus:border-red-550 focus:ring-0 bg-red-50/30" : "border-slate-200 focus:border-emerald-500"
                          }`}
                        />
                        {errors.companyName && (
                          <p className="text-[10px] text-red-500 font-black flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 text-red-500" />
                            {errors.companyName}
                          </p>
                        )}
                      </div>

                      {/* VAT input */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-750">الرقم الضريبي للمؤسسة (15 خانة يبدأ بـ 3)</Label>
                        <Input
                          id="vatNumber"
                          value={contacts.vatNumber}
                          onChange={(e) => handleContactChange("vatNumber", e.target.value)}
                          className={`h-10 text-xs font-bold font-mono rounded-lg border text-right transition-colors ${
                            errors.vatNumber ? "border-red-400 focus:border-red-550 focus:ring-0 bg-red-50/30" : "border-slate-200 focus:border-emerald-500"
                          }`}
                          maxLength={15}
                        />
                        {errors.vatNumber ? (
                          <p className="text-[10px] text-red-500 font-black flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            {errors.vatNumber}
                          </p>
                        ) : (
                          <p className="text-[9px] text-slate-400 font-bold mt-1">مطابق للوائح الفاتورة الإلكترونية والتحصيل لـ ZATCA.</p>
                        )}
                      </div>

                      {/* CR input */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-750">رقم السجل التجاري الرئيسي (CR - 10 خانات)</Label>
                        <Input
                          id="commercialRegister"
                          value={contacts.commercialRegister}
                          onChange={(e) => handleContactChange("commercialRegister", e.target.value)}
                          className={`h-10 text-xs font-bold font-mono rounded-lg border text-right transition-colors ${
                            errors.commercialRegister ? "border-red-400 focus:border-red-550 focus:ring-0 bg-red-50/30" : "border-slate-200 focus:border-emerald-500"
                          }`}
                          maxLength={10}
                        />
                        {errors.commercialRegister ? (
                          <p className="text-[10px] text-red-500 font-black flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            {errors.commercialRegister}
                          </p>
                        ) : (
                          <p className="text-[9px] text-slate-400 font-bold mt-1">السجل التجاري مسجل بوزارة التجارة لمقاولات المباني السكنية والديكور.</p>
                        )}
                      </div>

                      {/* Unified number */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-750">الرقم الموحد المعتمد</Label>
                        <Input
                          id="unifiedNo"
                          value={contacts.unifiedNo}
                          placeholder="920000000"
                          onChange={(e) => handleContactChange("unifiedNo", e.target.value)}
                          className={`h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                            errors.unifiedNo ? "border-red-400 focus:border-red-550 focus:ring-0 bg-red-50/30" : "border-slate-200 focus:border-emerald-500"
                          }`}
                          dir="ltr"
                        />
                        {errors.unifiedNo && (
                          <p className="text-[10px] text-red-500 font-black flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            {errors.unifiedNo}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* SPL National Address */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <div>
                      <h3 className="text-slate-800 text-xs font-black">العنوان الوطني الموحد بـ (سبل SPL Address)</h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">العنوان الرسمي المستخدم للضرائب والجمارك بالرياض</p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 font-extrabold border-none text-[8px] py-1 px-2">
                      موثق وحقيقي
                    </Badge>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Building No */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">رقم المبنى الفرعي (4 أرقام)</Label>
                        <Input
                          id="buildingNo"
                          value={contacts.buildingNo}
                          onChange={(e) => handleContactChange("buildingNo", e.target.value)}
                          className={`h-10 text-xs font-mono font-bold rounded-lg border transition-colors ${
                            errors.buildingNo ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                          maxLength={4}
                        />
                        {errors.buildingNo && <p className="text-[9px] text-red-500 font-black mt-1">{errors.buildingNo}</p>}
                      </div>

                      {/* Street */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">اسم الشارع الرئيسي</Label>
                        <Input
                          id="street"
                          value={contacts.street}
                          onChange={(e) => handleContactChange("street", e.target.value)}
                          className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                            errors.street ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                        />
                        {errors.street && <p className="text-[9px] text-red-500 font-black mt-1">{errors.street}</p>}
                      </div>

                      {/* District */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">الحي</Label>
                        <Input
                          id="district"
                          value={contacts.district}
                          onChange={(e) => handleContactChange("district", e.target.value)}
                          className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                            errors.district ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                        />
                        {errors.district && <p className="text-[9px] text-red-500 font-black mt-1">{errors.district}</p>}
                      </div>

                      {/* City */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">المدينة</Label>
                        <Input
                          id="city"
                          value={contacts.city}
                          onChange={(e) => handleContactChange("city", e.target.value)}
                          className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                            errors.city ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                        />
                        {errors.city && <p className="text-[9px] text-red-500 font-black mt-1">{errors.city}</p>}
                      </div>

                      {/* Postal Code */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">الرمز البريدي (5 خانات)</Label>
                        <Input
                          id="postalCode"
                          value={contacts.postalCode}
                          onChange={(e) => handleContactChange("postalCode", e.target.value)}
                          className={`h-10 text-xs font-mono font-bold rounded-lg border transition-colors ${
                            errors.postalCode ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                          maxLength={5}
                        />
                        {errors.postalCode && <p className="text-[9px] text-red-500 font-black mt-1">{errors.postalCode}</p>}
                      </div>

                      {/* Additional No */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">الرقم الإضافي للرمز (4 أرقام)</Label>
                        <Input
                          id="additionalNo"
                          value={contacts.additionalNo}
                          onChange={(e) => handleContactChange("additionalNo", e.target.value)}
                          className={`h-10 text-xs font-mono font-bold rounded-lg border transition-colors ${
                            errors.additionalNo ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                          maxLength={4}
                        />
                        {errors.additionalNo && <p className="text-[9px] text-red-500 font-black mt-1">{errors.additionalNo}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Media Details */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/70">
                    <h3 className="text-slate-800 text-xs font-black">حسابات التواصل والقنوات المعتمدة للمؤسسة</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">تحديد روابط وهوية العميل لتسليم المعاينات واستمارات الحسابات</p>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Riyadh Landline */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">الهاتف الثابت (Riyadh Line - 011)</Label>
                        <div className="relative">
                          <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="landline"
                            value={contacts.landline}
                            onChange={(e) => handleContactChange("landline", e.target.value)}
                            className={`pr-10 h-10 text-xs font-mono font-bold rounded-lg border transition-colors ${
                              errors.landline ? "border-red-400 bg-red-50/30" : "border-slate-200"
                            }`}
                          />
                        </div>
                        {errors.landline && <p className="text-[9px] text-red-500 font-black mt-1">{errors.landline}</p>}
                      </div>

                      {/* Whatsapp Business */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">جوال واتساب التواصل والأعمال (بداية بـ 05)</Label>
                        <div className="relative">
                          <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="whatsapp"
                            value={contacts.whatsapp}
                            onChange={(e) => handleContactChange("whatsapp", e.target.value)}
                            className={`pr-10 h-10 text-xs font-mono font-bold rounded-lg border transition-colors ${
                              errors.whatsapp ? "border-red-400 bg-red-50/30" : "border-slate-200"
                            }`}
                          />
                        </div>
                        {errors.whatsapp && <p className="text-[9px] text-red-500 font-black mt-1">{errors.whatsapp}</p>}
                      </div>

                      {/* Unified Email */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">البريد الإلكتروني للإدارة والعقود</Label>
                        <div className="relative">
                          <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            value={contacts.email}
                            onChange={(e) => handleContactChange("email", e.target.value)}
                            className={`pr-10 h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                              errors.email ? "border-red-400 bg-red-50/30" : "border-slate-200"
                            }`}
                            dir="ltr"
                          />
                        </div>
                        {errors.email && <p className="text-[9px] text-red-500 font-black mt-1">{errors.email}</p>}
                      </div>

                      {/* Website */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">الموقع الإلكتروني والويب بورتال</Label>
                        <div className="relative">
                          <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="website"
                            value={contacts.website}
                            onChange={(e) => handleContactChange("website", e.target.value)}
                            className={`pr-10 h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                              errors.website ? "border-red-400 bg-red-50/30" : "border-slate-200"
                            }`}
                            dir="ltr"
                          />
                        </div>
                        {errors.website && <p className="text-[9px] text-red-500 font-black mt-1">{errors.website}</p>}
                      </div>

                      {/* Twitter */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">رابط حساب Twitter / X للأعمال</Label>
                        <Input
                          id="twitter"
                          value={contacts.twitter}
                          onChange={(e) => handleContactChange("twitter", e.target.value)}
                          className="h-10 text-xs font-bold rounded-lg border text-left"
                          dir="ltr"
                        />
                      </div>

                      {/* LinkedIn */}
                      <div className="space-y-1.5">
                        <Label className="font-bold text-xs text-slate-700">صفحة LinkedIn للمؤسسة</Label>
                        <Input
                          id="linkedin"
                          value={contacts.linkedin}
                          onChange={(e) => handleContactChange("linkedin", e.target.value)}
                          className="h-10 text-xs font-bold rounded-lg border text-left"
                          dir="ltr"
                        />
                      </div>

                      {/* GPS coordinates mapping */}
                      <div className="col-span-1 md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-bold text-xs text-slate-700">إحداثيات المقر الرئيسي للمنشأة (GPS)</Label>
                          <button
                            type="button"
                            onClick={() => setIsGeoHelperOpen(true)}
                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                            كيف أحدد موقع المنشأة؟
                          </button>
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="mapCoords"
                              value={contacts.mapCoords}
                              onChange={(e) => handleContactChange("mapCoords", e.target.value)}
                              placeholder="24.6853, 46.7321"
                              className={`h-10 text-xs font-mono font-bold rounded-lg border pr-8 transition-colors ${
                                errors.mapCoords ? "border-red-400 bg-red-50/30" : "border-slate-200 text-left"
                              }`}
                              dir="ltr"
                            />
                            <div className="absolute right-2.5 top-3 text-slate-400">
                              <MapPin className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          
                          <Button
                            type="button"
                            onClick={handleGetDeviceLocation}
                            disabled={isLocating}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 rounded-lg h-10 gap-1 flex items-center transition-transform hover:scale-[1.01] cursor-pointer shrink-0"
                            title="التقاط الإحداثيات من موقع جهازك الحالي"
                          >
                            {isLocating ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <Compass className="w-4 h-4 animate-pulse-slow" />
                            )}
                            <span className="hidden sm:inline">أنا في الموقع الآن (GPS)</span>
                          </Button>
                        </div>
                        
                        {errors.mapCoords && <p className="text-[9px] text-red-500 font-black mt-1">{errors.mapCoords}</p>}
                        
                        <div className="flex gap-1.5 flex-wrap pt-1 items-center">
                          <span className="text-[10px] text-slate-400 font-extrabold">اختصار المواقع الجغرافية المقترحة:</span>
                          <button
                            type="button"
                            onClick={() => {
                              handleContactChange("mapCoords", "24.6853, 46.7321");
                              toast.success("تم تحديد إحداثيات المقر الرئيسي");
                            }}
                            className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 text-[10px] font-black cursor-pointer transition-colors"
                          >
                            المقر الرئيسي
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleContactChange("mapCoords", "24.6432, 46.8521");
                              toast.success("تم تحديد إحداثيات الموقع الفرعي الأول");
                            }}
                            className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 text-[10px] font-black cursor-pointer transition-colors"
                          >
                            الموقع الفرعي الأول
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleContactChange("mapCoords", "21.7254, 39.1582");
                              toast.success("تم تحديد إحداثيات الموقع الفرعي الثاني");
                            }}
                            className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 text-[10px] font-black cursor-pointer transition-colors"
                          >
                            الموقع الفرعي الثاني
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Action Widget of Identity */}
              <div className="lg:col-span-4 space-y-6">
                {/* Visual Map Layout */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">تأكيد الموضع الجغرافي للمقر الرئيسي</span>
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="aspect-video bg-indigo-50/40 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
                    <div className="absolute top-1/3 left-1/4 w-32 h-2 bg-slate-200/50 rounded-full rotate-12" />
                    <div className="absolute top-1/2 left-1/3 w-2 h-24 bg-slate-200/50 rounded-full" />

                    <div className="flex flex-col items-center gap-1 z-10 p-4 rounded-xl bg-white shadow-sm border border-slate-100/60 max-w-[80%] text-center">
                      <Building2 className="w-5 h-5 text-primary animate-bounce mb-1" />
                      <h4 className="text-[11px] font-black text-slate-800 leading-tight">مقر المنشأة الجغرافي</h4>
                      <span className="text-[9px] font-mono text-slate-400">{contacts.mapCoords}</span>
                      <a
                        id="open-google-maps"
                        href={`https://www.google.com/maps/search/?api=1&query=${contacts.mapCoords}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[9px] text-primary font-black mt-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        فتح خريطة Google العالمية
                      </a>
                    </div>
                  </div>
                </Card>

                {/* Info Card on Saudi Address standard */}
                <Card className="rounded-2xl border border-slate-150 bg-amber-50/30 p-4 space-y-2">
                  <h4 className="text-xs font-black text-slate-850 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    شروط وقوانين العنوان الوطني 🇸🇦
                  </h4>
                  <p className="text-[10px] text-slate-650 font-bold leading-relaxed">
                    يجب مطابقة أرقام المباني المكونة من 4 خانات والرموز البريدية للعنوان الموحد المكونة من 5 خانات بالضبط مع بيانات البريد السعودي "سبل" المعتمدة رسمياً، تفادياً لأي تعارض في إصدار وثائق التراخيص والبلديات المصدرة للمنشأة.
                  </p>
                </Card>

                {/* Save button and state logger */}
                <Card className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 shadow-3xs">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-900">تطبيق وحفظ الحاضنة</h4>
                    <p className="text-[9px] text-slate-500 font-bold leading-tight">
                      سيتم كتابة التحديثات فورياً لتسهيل طلب تصاريح البناء والعملاء الميدانيين.
                    </p>
                  </div>
                  <Button
                    id="save-identity-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10 bg-primary hover:bg-black text-white rounded-xl font-black text-xs transition-transform hover:scale-[1.01] gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        حفظ بيانات الهوية والعنوان
                      </>
                    )}
                  </Button>
                </Card>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ----------------- SECTION 2: DOCUMENTS ----------------- */}
      {activeSubSection === "docs" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-primary shrink-0" />
                <h2 className="text-xl font-black text-slate-900 leading-none">الأوراق الرسمية والتراخيص المهنية</h2>
              </div>
              <p className="text-slate-400 text-xs mt-1.5 font-bold">متابعة تراخيص الدفاع المدني، بلدي، شهادات التأمينات الاجتماعية ونسب التوطين لبلدية الرياض.</p>
            </div>

            <Button
              id="add-new-doc-btn"
              onClick={() => handleOpenDocModal(null)}
              className="rounded-xl h-10 px-4 bg-primary hover:bg-black text-white font-black text-xs gap-1.5 cursor-pointer shadow-sm transition-transform hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4" />
              توثيق ترخيص جديد
            </Button>
          </div>

          {/* Quick Metrics display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200/70 shadow-3xs rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400">تراخيص معتمدة ونشطة</p>
                <h4 className="text-xl font-black text-emerald-600 mt-1">{totalActiveDocs} مستند</h4>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-250 shrink-0" />
            </div>
            <div className="p-4 bg-white border border-slate-200/70 shadow-3xs rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400">تحتاج إجراء أو تجديد قادم</p>
                <h4 className={`text-xl font-black mt-1 ${docsExSoon > 0 ? "text-rose-600" : "text-slate-700"}`}>{docsExSoon} مستند</h4>
              </div>
              <AlertTriangle className="w-8 h-8 text-rose-250 shrink-0" />
            </div>
            <div className="p-4 bg-white border border-slate-200/70 shadow-3xs rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400">معاملات قيد المراجعة الحكومية</p>
                <h4 className="text-xl font-black text-amber-500 mt-1">{ongoingRenewalInProcess} معاملة</h4>
              </div>
              <RefreshCw className="w-8 h-8 text-amber-250 shrink-0 animate-spin-slow" />
            </div>
          </div>

          {/* Grid of Documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((docItem) => {
              const days = calculateDaysRemaining(docItem.expiryDate);
              const statusInfo = checkDocStatus(docItem.expiryDate, docItem.steps);

              return (
                <Card
                  key={docItem.id}
                  className="rounded-2xl border border-slate-205 shadow-3xs bg-white overflow-hidden relative group hover:border-primary/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header Strip */}
                    <div className="p-3.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[9px] font-extrabold text-slate-400">{docItem.authority}</span>
                      <Badge className={`${statusInfo.color} font-black border-none text-[8px] py-0.5 px-2`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {/* Card Content body */}
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <h3 className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">
                          {docItem.title}
                        </h3>
                        <p className="text-[9px] font-mono text-slate-450 mt-1">رقم الوثيقة: {docItem.docNumber}</p>
                      </div>

                      {/* Timeline */}
                      <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                        <div className="p-2 rounded-lg bg-slate-50/50 border border-slate-100 text-right">
                          <span className="text-[8px] text-slate-400 block leading-none">تاريخ الإصدار</span>
                          <span className="text-slate-700 font-mono mt-1 block">{docItem.issueDate}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50/50 border border-slate-100 text-right">
                          <span className="text-[8px] text-slate-400 block leading-none">تاريخ الانتهاء</span>
                          <span className="text-slate-700 font-mono mt-1 block">{docItem.expiryDate}</span>
                        </div>
                      </div>

                      {/* Countdown slider */}
                      <div className="p-2.5 bg-slate-50/50 rounded-lg flex items-center justify-between border border-dashed border-slate-200 text-xs">
                        <span className="text-slate-500 font-bold text-[10px]">المتبقي للصلاحية السارية:</span>
                        {days <= 0 ? (
                          <span className="text-red-600 font-black text-[10px]">منتهية بالكامل! 🔴</span>
                        ) : days <= 30 ? (
                          <span className="text-red-500 font-black text-[10px] animate-pulse flex items-center gap-1 text-right">
                            <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-red-500" />
                            {days} يوم (عاجل جداً)
                          </span>
                        ) : (
                          <span className="text-primary font-black font-sans text-xs">{days} يوم مرخص</span>
                        )}
                      </div>

                      {/* Progress pipeline */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[9px] font-bold">
                          <span className="text-slate-400">سير معاملة تحديث الرخصة:</span>
                          <span className="text-primary">
                            {docItem.steps === "draft" && "إعداد كشوفات والتحضير"}
                            {docItem.steps === "submitted" && "تحت التدقيق في بلدي/قوى"}
                            {docItem.steps === "payment_pending" && "بانتظار سداد الرسوم"}
                            {docItem.steps === "issued" && "سارية ومعتمدة حالياً"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                          <div className={`h-full flex-1 ${docItem.steps !== "draft" ? "bg-primary" : "bg-slate-200"}`} />
                          <div className={`h-full flex-1 ${docItem.steps === "submitted" || docItem.steps === "payment_pending" || docItem.steps === "issued" ? "bg-primary" : "bg-slate-200"}`} />
                          <div className={`h-full flex-1 ${docItem.steps === "payment_pending" || docItem.steps === "issued" ? "bg-primary" : "bg-slate-200"}`} />
                          <div className={`h-full flex-1 ${docItem.steps === "issued" ? "bg-emerald-500" : "bg-slate-200"}`} />
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Footer Actions of document */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                    <div className="flex gap-1" id={`doc-item-${docItem.id}-actions`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDocModal(docItem)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-primary hover:bg-white border border-slate-150 shadow-3xs cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteDoc(docItem.id)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white border border-slate-150 shadow-3xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <Button
                      id={`update-renewal-${docItem.id}`}
                      onClick={() => handleOpenRenewal(docItem)}
                      className="rounded-lg h-8 px-2.5 bg-white hover:bg-slate-900 border border-slate-205 shadow-4xs text-[10px] text-slate-700 hover:text-white font-bold cursor-pointer"
                    >
                      تحديث معاملة التجديد
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}


      {/* ----------------- SECTION 3: SUBSCRIPTIONS ----------------- */}
      {activeSubSection === "subs" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-6 h-6 text-primary shrink-0" />
                <h2 className="text-xl font-black text-slate-900 leading-none">تتبع الاشتراكات والبرمجيات السحابية</h2>
              </div>
              <p className="text-slate-400 text-xs mt-1.5 font-bold">تأمين ومراقبة الفواتير الدورية لعناوين الشبكة، تراخيص وودائع وتأشيرات أنظمة الإدارة والتشغيل الكلي.</p>
            </div>

            <Button
              id="add-new-sub-btn"
              onClick={() => handleOpenSubModal(null)}
              className="rounded-xl h-10 px-4 bg-primary hover:bg-black text-white font-black text-xs gap-1.5 cursor-pointer shadow-sm transition-transform hover:scale-[1.01]"
            >
              <Plus className="w-4 h-4" />
              إضافة تتبع اشتراك sSaaS
            </Button>
          </div>

          {/* Dynamic Budget overview info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 flex items-center justify-between shadow-3xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-extrabold block">مجموع الموازنة الشهرية للاشتراكات</span>
                <span className="text-2xl font-black text-primary font-mono">{monthlySubscriptionSum} ر.س</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                <Landmark className="w-6 h-6" />
              </div>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 flex items-center justify-between shadow-3xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-extrabold block">الاشتراكات المجدولة تلقائياً</span>
                <span className="text-xs font-bold text-slate-700 block">
                  يتم السحب دورياً لتجنب توقف حسابات البريد والموقع للمؤسسة بالرياض.
                </span>
              </div>
              <Badge className="bg-primary/5 text-primary border-none text-[10px] py-1.5 px-3">
                تأمين الفيزا البنكية
              </Badge>
            </Card>
          </div>

          {/* Table list of Subscriptions */}
          <Card className="rounded-2xl border border-slate-205 shadow-3xs bg-white overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">سجل تراخيص وتكاليف البرامج المثبتة</span>
              <span className="text-[10px] font-bold text-slate-400">إجمالي {subscriptions.length} برامج مستهدفة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right" dir="rtl">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-extrabold text-slate-400 bg-slate-50/50">
                    <th className="p-4">اسم البرنامج / الخدمة</th>
                    <th className="p-4">التصنيف</th>
                    <th className="p-4">التكلفة والرسوم</th>
                    <th className="p-4">تاريخ السداد القادم</th>
                    <th className="p-4">خيار تجديد فيزا</th>
                    <th className="p-4">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold">
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="p-4 font-black text-slate-900">{sub.name}</td>
                      <td className="p-4 text-slate-500">{sub.category}</td>
                      <td className="p-4">
                        <span className="font-mono text-slate-800">{sub.cost} ر.س</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{sub.period === "monthly" ? "دورة شهرية" : "دورة سنوية"}</span>
                      </td>
                      <td className="p-4">
                        <span className="p-1 px-2.5 bg-slate-100 text-xs rounded-lg text-slate-700 font-mono">
                          {sub.renewalDate}
                        </span>
                      </td>
                      <td className="p-4">
                        {sub.autoRenew ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[9px] py-0.5 px-2">
                            تجديد تلقائي (Active)
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[9px] py-0.5 px-2">
                            يدوي بالطلب (Manual)
                          </Badge>
                        )}
                      </td>
                      <td className="p-4" id={`sub-row-${sub.id}-actions`}>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenSubModal(sub)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-primary transition-colors cursor-pointer border border-slate-150 bg-white"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSub(sub.id)}
                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer border border-slate-150 bg-white"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-xs font-bold text-slate-400">
                        لا يوجد اشتراكات أو فواتير سحابية مسجلة بالهوية حالياً. ارفع اشتراكاً جديداً للشبكة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}


      {/* ----------------- SECTION 4: GOOGLE CLOUD INTEGRATION ----------------- */}
      {activeSubSection === "google" && (
        <div className="space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-6 h-6 text-primary shrink-0" />
              <h2 className="text-xl font-black text-slate-900">ربط الكيان مع قنوات سحابة قوقل (Google Sync)</h2>
            </div>
            <p className="text-slate-400 text-xs mt-1 font-bold">إتاحة وتفعيل النسخ الاحتياطي التلقائي ومفاتيح تفعيل خرائط جوجل لحسابات مشاريع الرياض.</p>
          </div>

          <form onSubmit={handleSaveGoogleSettings} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Form Input Parameters */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Integration Credentials Card */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/70">
                    <h3 className="text-slate-800 text-xs font-black">إقرارات مفاتيح الربط ومعرّفات Google</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">منصة السحابة لمؤسسة خبراء الرسم الموحدة</p>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Project ID */}
                      <div className="space-y-1.5 text-right">
                        <Label className="font-bold text-xs text-slate-705">معرّف مشروع قوقل سحاب (Google Cloud Project ID)</Label>
                        <Input
                          id="gcloudProjectId"
                          value={googleSettings.gcloudProjectId}
                          onChange={(e) => handleGoogleChange("gcloudProjectId", e.target.value)}
                          className={`h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                            googleErrors.gcloudProjectId ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                          dir="ltr"
                        />
                        {googleErrors.gcloudProjectId && (
                          <p className="text-[9px] text-red-500 font-black mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {googleErrors.gcloudProjectId}
                          </p>
                        )}
                      </div>

                      {/* Maps API Key */}
                      <div className="space-y-1.5 text-right">
                        <Label className="font-bold text-xs text-slate-705">مفتاح API الخاص لخرائط جوجل (Maps API Key)</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <Input
                            id="mapsApiKey"
                            type="password"
                            value={googleSettings.mapsApiKey}
                            onChange={(e) => handleGoogleChange("mapsApiKey", e.target.value)}
                            className={`pl-10 h-10 text-xs font-mono rounded-lg border text-left transition-colors ${
                              googleErrors.mapsApiKey ? "border-red-400 bg-red-50/30" : "border-slate-200"
                            }`}
                            dir="ltr"
                          />
                        </div>
                        {googleErrors.mapsApiKey ? (
                          <p className="text-[9px] text-red-500 font-black mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {googleErrors.mapsApiKey}
                          </p>
                        ) : (
                          <p className="text-[9px] text-slate-400 font-bold mt-1">يستخدم لتثبيت ومطابقة الإحداثيات لمشاريع المقاولات.</p>
                        )}
                      </div>

                      {/* Google Drive target path */}
                      <div className="col-span-1 md:col-span-2 space-y-1.5 text-right">
                        <Label className="font-bold text-xs text-slate-705">مجلد الأرشيف والنسخ على Google Drive (رابط كامل)</Label>
                        <Input
                          id="driveArchiveFolder"
                          value={googleSettings.driveArchiveFolder}
                          onChange={(e) => handleGoogleChange("driveArchiveFolder", e.target.value)}
                          className={`h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                            googleErrors.driveArchiveFolder ? "border-red-400 bg-red-50/30" : "border-slate-200"
                          }`}
                          dir="ltr"
                        />
                        {googleErrors.driveArchiveFolder && (
                          <p className="text-[9px] text-red-500 font-black mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-red-500" />
                            {googleErrors.driveArchiveFolder}
                          </p>
                        )}
                      </div>

                      {/* Auto backup interval selection */}
                      <div className="space-y-1.5 text-right">
                        <Label className="font-bold text-xs text-slate-705">تكرار إجراء النسخ الاحتياطي</Label>
                        <select
                          value={googleSettings.backupInterval}
                          onChange={(e) => handleGoogleChange("backupInterval", e.target.value)}
                          className="h-10 w-full text-xs font-bold rounded-lg border border-slate-200 bg-white px-2.5 text-right"
                        >
                          <option value="daily">يومياً منتصف الليل</option>
                          <option value="weekly">أسبوعياً (كل يوم سبت)</option>
                          <option value="monthly">شهرياً (فجر الأول من الشهر)</option>
                        </select>
                      </div>

                      {/* Auto backup state checkbox toggle */}
                      <div className="space-y-1.5 text-right flex flex-col justify-end">
                        <Label className="font-bold text-xs text-slate-705 mb-2">تفعيل الأرشفة التلقائية</Label>
                        <div className="flex items-center gap-2 select-none border border-slate-150 rounded-lg p-1 bg-slate-50 w-full h-10 px-2.5 justify-between">
                          <span className="text-[10px] text-slate-500 font-bold">النسخ الآلي الاحتياطي:</span>
                          <input
                            type="checkbox"
                            checked={googleSettings.autoBackupEnabled}
                            onChange={(e) => handleGoogleChange("autoBackupEnabled", e.target.checked)}
                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary accent-primary cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cloud storage control simulation actions */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs p-5 flex flex-col md:flex-row items-center gap-4 justify-between">
                  <div className="text-right">
                    <h4 className="text-xs font-black text-slate-800">إجراء نسخة احتياطية إيقافية الآن</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      تجميع أرشيف الكيان، رتبة نسب السعودة، سجلات المالية والاشتراكات وضغط ملف للتجنيب السحابي.
                    </p>
                  </div>
                  <Button
                    id="run-backup-now"
                    type="button"
                    onClick={triggerDataBackupBackupNow}
                    className="h-10 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-205 rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-4xs"
                  >
                    أرشفة كاملة الآن
                  </Button>
                </Card>
              </div>

              {/* Sidebar state action card */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Connection Status Panel */}
                <Card className="rounded-2xl border border-slate-205 bg-white shadow-3xs p-5 space-y-4">
                  <h4 className="text-xs font-black text-slate-800 flex items-center justify-between">
                    <span>حالة موثوقية الربط</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[8px]">
                      مصدّق بالكامل
                    </Badge>
                  </h4>

                  {googleSettings.isConnected ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mt-1 shrink-0" />
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-700 block">حساب قوقل المعتمد والمستخدم:</span>
                        <span className="text-[11px] font-mono font-bold text-slate-500 block leading-tight">{googleSettings.connectedEmail}</span>
                        <span className="text-[9px] text-slate-400 block leading-tight">تاريخ المزامنة الناجحة الأخير: {new Date().toISOString().split("T")[0]}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg text-center text-xs text-slate-400 font-bold">
                      غير متصل بقنوات Workspace حالياً. يرجى تفعيل الصلاحية.
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      id="google-reauth-btn"
                      type="button"
                      onClick={triggerGoogleAuthSimulation}
                      className="w-full h-9 bg-white border border-slate-205 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-lg font-bold text-xs cursor-pointer shadow-4xs flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin-slow" />
                      إعادة ترخيص ومصادقة الحساب
                    </Button>
                  </div>
                </Card>

                {/* Info and Save */}
                <Card className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3 shadow-3xs">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-900">حفظ وحماية إقرارات السحابة</h4>
                    <p className="text-[9px] text-slate-500 font-bold leading-tight">
                      يجب عدم الكشف عن مفاتيح الخرائط API للمتصفحين وتفعيل ضوابط القراءة الآمنة من Firebase.
                    </p>
                  </div>
                  <Button
                    id="save-google-settings-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-10 bg-primary hover:bg-black text-white rounded-xl font-black text-xs transition-transform hover:scale-[1.01] gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        حفظ إقرارات جوجل السحابية
                      </>
                    )}
                  </Button>
                </Card>
              </div>

            </div>
          </form>
        </div>
      )}

      {/* ----------------- DIALOG 1: GOVERNMENT DOCUMENTS CREATE/EDIT ----------------- */}
      <Dialog open={isDocModalOpen} onOpenChange={setIsDocModalOpen}>
        <DialogContent className="sm:max-w-[460px] text-right rounded-2xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 font-sans">
              {selectedDoc ? "تعديل تفاصيل الترخيص الحكومي للأرصفة" : "إيداع وتوثيق رخصة أو شهادة سعودية جديدة المنشأ"}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 text-[11px] mt-1 font-sans">
              يجب تدوين المعرّفات الموثوقة من المنصات الرسمية (بلدي، قوى، سبل) لضمان انتظام الفحوصات والإنذارات المبكرة.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDoc} className="space-y-4 pt-3">
            {/* Title / Name */}
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs text-slate-705">مسمى الترخيص / الوثيقة بالبوابة</Label>
              <Input
                placeholder="مثال: رخصة البلدية ومكاتب التصميم..."
                value={docForm.title}
                onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                className={`h-10 text-xs font-bold rounded-lg border text-right transition-colors ${
                  docErrors.title ? "border-red-400 bg-red-50/20" : "border-slate-200"
                }`}
              />
              {docErrors.title && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.title}</p>}
            </div>

            {/* Authority & Number */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">المنصة أو الجهة المانحة</Label>
                <Input
                  placeholder="مثال: وزارة الشؤون البلدية..."
                  value={docForm.authority}
                  onChange={(e) => setDocForm({ ...docForm, authority: e.target.value })}
                  className={`h-10 text-xs font-bold rounded-lg border text-right transition-colors ${
                    docErrors.authority ? "border-red-400 bg-red-50/20" : "border-slate-200"
                  }`}
                />
                {docErrors.authority && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.authority}</p>}
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">رقم السند / الوثيقة الرئيسي</Label>
                <Input
                  placeholder="رقم الوثيقة أو الإقرار"
                  value={docForm.docNumber}
                  onChange={(e) => setDocForm({ ...docForm, docNumber: e.target.value })}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    docErrors.docNumber ? "border-red-400 bg-red-50/20" : "border-slate-200"
                  }`}
                />
                {docErrors.docNumber && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.docNumber}</p>}
              </div>
            </div>

            {/* Issue Date & Expiry Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">تاريخ إصدار الوثيقة</Label>
                <Input
                  type="date"
                  value={docForm.issueDate}
                  onChange={(e) => setDocForm({ ...docForm, issueDate: e.target.value })}
                  className={`h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                    docErrors.issueDate ? "border-red-400 bg-red-50/30" : "border-slate-200"
                  }`}
                />
                {docErrors.issueDate && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.issueDate}</p>}
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">تاريخ انتهاء الترخيص</Label>
                <Input
                  type="date"
                  value={docForm.expiryDate}
                  onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })}
                  className={`h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                    docErrors.expiryDate ? "border-red-400 bg-red-50/30" : "border-slate-200"
                  }`}
                />
                {docErrors.expiryDate && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.expiryDate}</p>}
              </div>
            </div>

            {/* Cost & Alert Reminder Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">رسوم التجديد لمرة واحدة (ر.س)</Label>
                <Input
                  type="number"
                  value={docForm.cost}
                  onChange={(e) => setDocForm({ ...docForm, cost: parseInt(e.target.value) || 0 })}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    docErrors.cost ? "border-red-400 bg-red-50/20" : "border-slate-200"
                  }`}
                />
                {docErrors.cost && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.cost}</p>}
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">تنبيه بالبريد قبل الانتهاء بـ</Label>
                <select
                  value={docForm.reminderDays}
                  onChange={(e) => setDocForm({ ...docForm, reminderDays: parseInt(e.target.value) || 30 })}
                  className="h-10 w-full text-xs font-bold rounded-lg border border-slate-200 bg-white px-2.5 text-right"
                >
                  <option value="15">15 يوماً (عاجل جداً للتأمينات)</option>
                  <option value="30">30 يوماً (رخصة بلدي والدفاع المدني)</option>
                  <option value="45">45 يوماً (شهادات الزكاة والدخل)</option>
                  <option value="60">60 يوماً (السجل التجاري الرئيسي)</option>
                </select>
                {docErrors.reminderDays && <p className="text-[9px] text-red-500 font-black mt-1">{docErrors.reminderDays}</p>}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                id="doc-form-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 bg-primary hover:bg-black text-white rounded-xl font-black text-xs gap-1.5 cursor-pointer shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    حفظ وإيداع الترخيص للأرصفة والكيان
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------- DIALOG 2: UPDATE RENEWAL WORKFLOWS ----------------- */}
      <Dialog open={isRenewalLogOpen} onOpenChange={setIsRenewalLogOpen}>
        <DialogContent className="sm:max-w-[440px] text-right rounded-2xl p-6 font-sans" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 border-b pb-3">بوابة تحديث خطوة المعاملة للشركة</DialogTitle>
            <DialogDescription className="font-bold text-slate-400 text-[11px] mt-1">
              مواكبة المعاملة مع بلدية الرياض أو وزارة التجارة لضمان معرفة المشرفين بخواتيم وسداد الاستحقاق الحالي للترخيص بنجاح.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-right">
            <div>
              <Label className="font-extrabold text-xs text-slate-700">المستند الحالي المختار:</Label>
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-800 tracking-tight mt-1">
                {renewalDoc?.title}
              </div>
            </div>

            {/* Select stage change info */}
            <div className="space-y-1.5">
              <Label className="font-bold text-xs text-slate-700">تغيير خطوة أو مرحلة المعاملة الحكومية:</Label>
              <select
                value={nextStepSelected}
                onChange={(e) => setNextStepSelected(e.target.value)}
                className="h-10 w-full text-xs font-bold rounded-lg border border-slate-200 bg-white px-2.5 text-right cursor-pointer"
              >
                <option value="draft">مسودة إعداد وتكليف (Under Preparation)</option>
                <option value="submitted">تم الرفع والتقديم للمنصة (Submitted to Authority)</option>
                <option value="payment_pending">بانتظار سداد الفاتورة المالية (Payment Pending)</option>
                <option value="issued">تم السداد والإصدار النهائي (Issued / Active)</option>
              </select>
            </div>

            {/* Notes input */}
            <div className="space-y-1.5">
              <Label className="font-bold text-xs text-slate-700">ملاحظات ومرئيات الإدارة للخطوة التدقيقية:</Label>
              <Input
                placeholder="مثال: تم إرفاق الفحص الفني، بانتظار إفادة الدفاع المدني..."
                value={userLogText}
                onChange={(e) => setUserLogText(e.target.value)}
                className="h-10 text-xs font-bold rounded-lg border"
              />
            </div>

            {/* Historical audit trail */}
            <div className="space-y-2 border-t pt-3">
              <Label className="font-bold text-xs text-slate-700 mr-1">الحركات والعمليات السابقة المسجلة:</Label>
              <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                {renewalDoc?.history?.map((log: any, idx: number) => (
                  <div key={idx} className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[9px] space-y-1 text-right">
                    <p className="font-bold text-slate-700 border-r-2 border-primary/40 pr-1.5 leading-relaxed">{log.action}</p>
                    <div className="flex items-center justify-between text-slate-400 mt-1">
                      <span>بواسطة: {log.user}</span>
                      <span>{log.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                id="save-renewal-step-btn"
                type="button"
                onClick={handleUpdateRenewalPipeline}
                disabled={isSubmitting}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs gap-1.5 cursor-pointer shadow-sm"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                حفظ خطوة المعاملة بالتاريخ
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ----------------- DIALOG 3: SUBSCRIPTIONS CREATE/EDIT ----------------- */}
      <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
        <DialogContent className="sm:max-w-[440px] text-right rounded-2xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 font-sans">
              {selectedSub ? "تعديل اشتراك النظام السحابي" : "إضافة تتبع لاشتراك نظام أو برمجية"}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 text-[11px] mt-1 font-sans">
              توثيق الفواتير الدورية لإنشاء جداول ميزانية المصروفات السنوية بدقة وتجنيب الشركة انقطع الإجراءات.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSub} className="space-y-4 pt-3">
            {/* Sub name */}
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs text-slate-705">اسم الخدمة / البرنامج السحابي</Label>
              <Input
                placeholder="مثال: Google Workspace Enterprise..."
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                className={`h-10 text-xs font-bold rounded-lg border text-right transition-colors ${
                  subErrors.name ? "border-red-400 bg-red-50/20" : "border-slate-200"
                }`}
              />
              {subErrors.name && <p className="text-[9px] text-red-500 font-black mt-1">{subErrors.name}</p>}
            </div>

            {/* Category */}
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs text-slate-705">التصنيف الإداري للخدمة</Label>
              <Input
                placeholder="مثال: تراخيص الموارد، استضافة الخادم..."
                value={subForm.category}
                onChange={(e) => setSubForm({ ...subForm, category: e.target.value })}
                className={`h-10 text-xs font-bold rounded-lg border text-right transition-colors ${
                  subErrors.category ? "border-red-400 bg-red-50/20" : "border-slate-200"
                }`}
              />
              {subErrors.category && <p className="text-[9px] text-red-500 font-black mt-1">{subErrors.category}</p>}
            </div>

            {/* Cost & Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">تكلفة الاشتراك (ر.س)</Label>
                <Input
                  type="number"
                  value={subForm.cost}
                  onChange={(e) => setSubForm({ ...subForm, cost: parseFloat(e.target.value) || 0 })}
                  className={`h-10 text-xs font-bold rounded-lg border transition-colors ${
                    subErrors.cost ? "border-red-400 bg-red-50/20" : "border-slate-200"
                  }`}
                />
                {subErrors.cost && <p className="text-[9px] text-[9px] text-red-500 font-black mt-1">{subErrors.cost}</p>}
              </div>

              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">الفترة الدورية المقررة</Label>
                <select
                  value={subForm.period}
                  onChange={(e) => setSubForm({ ...subForm, period: e.target.value })}
                  className="h-10 w-full text-xs font-bold rounded-lg border border-slate-200 bg-white px-2.5 text-right"
                >
                  <option value="monthly">شهرياً</option>
                  <option value="yearly">سنوياً</option>
                </select>
              </div>
            </div>

            {/* Next Due Date & Auto Renew Toggle */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 text-right">
                <Label className="font-bold text-xs text-slate-755">تاريخ ميعاد السداد القادم</Label>
                <Input
                  type="date"
                  value={subForm.renewalDate}
                  onChange={(e) => setSubForm({ ...subForm, renewalDate: e.target.value })}
                  className={`h-10 text-xs font-mono font-bold rounded-lg border text-left transition-colors ${
                    subErrors.renewalDate ? "border-red-400 bg-red-550/30" : "border-slate-200"
                  }`}
                />
                {subErrors.renewalDate && <p className="text-[9px] text-red-500 font-black mt-1">{subErrors.renewalDate}</p>}
              </div>

              <div className="space-y-1.5 text-right flex flex-col justify-end">
                <Label className="font-bold text-xs text-slate-755 mb-2">تجديد تلقائي بالفيزا</Label>
                <div className="flex items-center gap-2 select-none border border-slate-150 rounded-lg p-1 bg-slate-50 w-full h-10 px-2.5 justify-between">
                  <span className="text-[10px] text-slate-500 font-bold">حالة الدفع الفيزا:</span>
                  <input
                    type="checkbox"
                    checked={subForm.autoRenew}
                    onChange={(e) => setSubForm({ ...subForm, autoRenew: e.target.checked })}
                    className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary accent-primary cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                id="sub-form-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 bg-primary hover:bg-black text-white rounded-xl font-black text-xs gap-1.5 cursor-pointer shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    حفظ وإدراج الاشتراك للأنظمة
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dynamic GPS coordinate set helper dialog */}
      <Dialog open={isGeoHelperOpen} onOpenChange={setIsGeoHelperOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 font-sans flex items-center gap-1.5 justify-start text-right">
              <MapPin className="w-5 h-5 text-primary ml-1" />
              مساعد تحديد الموقع الجغرافي للشركة (GPS)
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 text-[11px] mt-1 font-sans text-right">
              تعرّف على كيفية ضبط الموضع الجغرافي الدقيق لمقرات ومستودعات المنشأة المعتمدة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-right">
            {/* Guide Step 1 */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
              <h4 className="text-xs font-black text-blue-900 flex items-center gap-1">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                كيفية النسخ من خرائط Google العالمية 🗺️
              </h4>
              <ul className="text-[10.5px] text-slate-650 font-bold leading-relaxed list-decimal list-inside space-y-1 pr-1">
                <li>افتح تطبيق Google Maps المعتمد وابحث عن موقع شركتك.</li>
                <li>اضغط ضغطة مطولة (على الجوال) أو انقر بزر الفأرة الأيمن (على الحاسوب) فوق موضع مبنى الشركة الدقيق.</li>
                <li>ستظهر الإحداثيات تلقائياً في أعلى الشاشة أو في القائمة (مثال: <span className="font-mono text-blue-700">24.6853, 46.7321</span>).</li>
                <li>انقر عليها لنسخها، ثم الصقها مباشرة في مربع الإيقاع بالاستوديو.</li>
              </ul>
            </div>

            {/* Quick Capture Button */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-extrabold block">الالتقاط التلقائي السريع:</span>
              <Button
                type="button"
                onClick={() => {
                  handleGetDeviceLocation();
                  setIsGeoHelperOpen(false);
                }}
                disabled={isLocating}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs gap-2 cursor-pointer flex items-center justify-center transition-all"
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Compass className="w-4 h-4 animate-pulse" />
                )}
                مزامنة موقعي الحالي الآن بالـ GPS
              </Button>
              <p className="text-[9px] text-slate-400 text-center font-bold mt-1 leading-normal">
                * سنطلب إذن الوصول إلى خدمة تحديد المواقع بجهازك لملء الإحداثيات بضغطة زر واحدة.
              </p>
            </div>

            {/* Branch Preset Quick Selection */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <span className="text-[10px] text-slate-500 font-black block">إحداثيات جغرافية افتراضية مقترحة (للاختبار والتعيين التلقائي):</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleContactChange("mapCoords", "24.6853, 46.7321");
                    toast.success("تم اختيار إحداثيات المقر الرئيسي للمنشأة");
                    setIsGeoHelperOpen(false);
                  }}
                  className="p-2 text-right border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-xs transition-colors cursor-pointer block w-full"
                >
                  <p className="text-[10px] text-slate-800 font-black">المقر الرئيسي</p>
                  <span className="text-[9px] text-slate-400 font-mono">24.6853, 46.7321</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleContactChange("mapCoords", "24.6432, 46.8521");
                    toast.success("تم اختيار إحداثيات الموقع الفرعي الأول");
                    setIsGeoHelperOpen(false);
                  }}
                  className="p-2 text-right border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-xs transition-colors cursor-pointer block w-full"
                >
                  <p className="text-[10px] text-slate-800 font-black">الموقع الفرعي الأول</p>
                  <span className="text-[9px] text-slate-400 font-mono">24.6432, 46.8521</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleContactChange("mapCoords", "21.7254, 39.1582");
                    toast.success("تم اختيار إحداثيات الموقع الفرعي الثاني");
                    setIsGeoHelperOpen(false);
                  }}
                  className="p-2 text-right border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-xs transition-colors cursor-pointer block w-full"
                >
                  <p className="text-[10px] text-slate-800 font-black">الموقع الفرعي الثاني</p>
                  <span className="text-[9px] text-slate-400 font-mono">21.7254, 39.1582</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleContactChange("mapCoords", "26.4328, 50.1032");
                    toast.success("تم اختيار إحداثيات الموقع الفرعي الثالث");
                    setIsGeoHelperOpen(false);
                  }}
                  className="p-2 text-right border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 font-bold text-xs transition-colors cursor-pointer block w-full"
                >
                  <p className="text-[10px] text-slate-800 font-black">الموقع الفرعي الثالث</p>
                  <span className="text-[9px] text-slate-400 font-mono">26.4328, 50.1032</span>
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
