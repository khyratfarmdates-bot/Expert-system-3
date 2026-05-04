import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal, 
  Trash2, 
  ArrowUpRight, 
  Package, 
  Clock, 
  AlertCircle,
  Loader2,
  ShoppingCart,
  ShieldCheck,
  Scan,
  X,
  FileText,
  Eye,
  MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '../lib/export';
import { exportToPDF } from '../lib/pdfExport';
import SmartExport from './ui/SmartExport';
import { sendNotification } from '../lib/notifications';
import { analyzeInvoice } from '../lib/gemini';
import { softDelete } from '../lib/softDelete';
import { normalizeArabic, calculateSimilarity } from '../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  doc,
  where,
  getDoc,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import PrintableReport from './PrintableReport';
import ExportDateRangeDialog from './ExportDateRangeDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Purchases() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';
  const isSupervisor = profile?.role === 'supervisor';
  const isElevated = isManager || isSupervisor;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  
  // Custom Approve State
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [purchaseToApprove, setPurchaseToApprove] = useState<any>(null);
  const [approveBankAccountId, setApproveBankAccountId] = useState('');

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'amount'>('desc');
  const [systemSettings, setSystemSettings] = useState<any>(null);

  // AI Scanner State
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: 'مواد وإنتاج',
    projectId: '',
    paymentMethod: 'cash' as 'cash' | 'transfer',
    bankAccountId: '',
    attachmentBase64: ''
  });

  const processAIScan = async () => {
    if (!capturedImage) return;
    setIsAnalyzing(true);
    const toastId = toast.loading('جاري تحليل الفاتورة بالذكاء الاصطناعي...');
    try {
      const result = await analyzeInvoice(capturedImage);
      if (result) {
        setFormData({
          ...formData,
          amount: result.amount.toString(),
          description: result.vendor,
          category: 'مواد وإنتاج',
          attachmentBase64: capturedImage
        });
        toast.success('تم استخراج البيانات بنجاح', { id: toastId });
        setCapturedImage(null);
        setIsDialogOpen(true); // Open the normal form with pre-filled data
      }
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ في النظام أثناء التحليل', { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'), 
      where('type', '==', 'purchase'),
      orderBy(sortOrder === 'amount' ? 'amount' : 'date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateOriginal: doc.data().date?.toDate?.() || new Date(),
        date: doc.data().date?.toDate?.()?.toLocaleString('ar-SA') || doc.data().date
      }));
      setPurchases(docs);
      setLoading(false);
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemSettings(snapshot.data());
      }
    });

    return () => {
      unsubscribe();
      unsubProjects();
      unsubBanks();
      unsubSettings();
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyTotal = purchases
      .filter(p => (p.dateOriginal instanceof Date ? p.dateOriginal : new Date(p.dateOriginal)) >= startOfMonth)
      .reduce((acc, p) => acc + (p.amount || 0), 0);
      
    const average = purchases.length > 0 ? (purchases.reduce((acc, p) => acc + (p.amount || 0), 0) / purchases.length) : 0;
    const max = purchases.length > 0 ? Math.max(...purchases.map(p => p.amount || 0)) : 0;

    return {
      total: purchases.reduce((acc, p) => acc + (p.amount || 0), 0),
      count: purchases.length,
      pending: purchases.filter(p => p.status === 'pending').length,
      monthlyTotal,
      average,
      max
    };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchesSearch = p.description?.includes(searchTerm) || p.id?.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter, purchases]);

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!formData.amount || !formData.description) {
      toast.error('يرجى ملء كافة الحقول');
      return;
    }

    setIsSubmitting(true);
    try {
      const isManager = profile.role === 'manager';
      let finalDescription = formData.description.trim();
      let finalCategory = formData.category;

      const shouldMatchSupplier = systemSettings?.enableSmartSupplierMatching !== false;
      const shouldAutoCategorize = systemSettings?.enableAutoCategorization !== false;

      // Smart Matching Logic for Suppliers
      if (shouldMatchSupplier && (formData.category === 'موردين' || formData.category === 'مواد خام' || formData.description)) {
        try {
          const normalizedInput = normalizeArabic(finalDescription);
          
          // Fetch all suppliers to find the best match
          const suppliersSnap = await getDocs(collection(db, "suppliers"));
          const suppliers = suppliersSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          
          let bestMatch = null;
          let highestScore = 0;

          for (const supplier of suppliers) {
            const normalizedExisting = normalizeArabic(supplier.name);
            const score = calculateSimilarity(normalizedInput, normalizedExisting);
            
            if (score > highestScore) {
              highestScore = score;
              bestMatch = supplier;
            }
          }

          // If match is > 90%, we refer to the existing supplier
          if (bestMatch && highestScore >= 0.9) {
            console.log(`Matched existing supplier: ${bestMatch.name} (Score: ${highestScore})`);
            finalDescription = bestMatch.name; // Use the canonical name

            // Suggest category based on supplier history (Auto-Categorization)
            if (shouldAutoCategorize) {
              const historyQuery = query(
                collection(db, 'transactions'),
                where('description', '==', bestMatch.name),
                where('type', '==', 'purchase')
              );
              const historySnap = await getDocs(historyQuery);
              if (!historySnap.empty) {
                // Find most frequent category
                const counts: Record<string, number> = {};
                historySnap.docs.forEach(d => {
                  const cat = d.data().category;
                  counts[cat] = (counts[cat] || 0) + 1;
                });
                const sortedCats = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                if (sortedCats.length > 0) {
                  finalCategory = sortedCats[0][0];
                  console.log(`Auto-categorized as: ${finalCategory}`);
                }
              }
            }
          } else {
            // Create new supplier if no good match
            await addDoc(collection(db, "suppliers"), {
              name: finalDescription,
              createdAt: serverTimestamp()
            });
            console.log(`Created new supplier: ${finalDescription}`);
          }
        } catch (error) {
          console.error("Error auto-adding supplier:", error);
        }
      }

      await addDoc(collection(db, 'transactions'), {
        type: 'purchase',
        amount: parseFloat(formData.amount),
        description: finalDescription,
        category: finalCategory,
        date: serverTimestamp(),
        createdBy: profile.uid,
        status: isManager ? 'approved' : 'pending',
        projectId: formData.projectId || null,
        paymentMethod: isManager ? formData.paymentMethod : 'cash',
        bankAccountId: isManager ? formData.bankAccountId : null,
        supervisorId: !isManager ? profile.uid : null,
        attachmentUrl: formData.attachmentBase64 || null
      });

      const projectTitle = projects.find(p => p.id === formData.projectId)?.title;
      await logActivity(
        'طلب شراء جديد',
        `تم تسجيل طلب شراء للمورد: ${finalDescription} بمبلغ ${formData.amount} ر.س ${projectTitle ? `للمشروع: ${projectTitle}` : ''}`,
        'info',
        'purchase',
        profile.uid
      );

      // System Notification
      await sendNotification({
        title: 'طلب شراء جديد',
        message: `قام ${profile.name} بتسجيل طلب شراء لـ ${finalDescription} بمبلغ ${formData.amount} ر.س`,
        type: isManager ? 'success' : 'info',
        category: 'financial',
        targetRole: 'manager',
        tab: 'purchases',
        priority: 'high'
      });

      // WhatsApp Logic
      const isSupervisor = profile.role === 'supervisor';
      const managerPhone = "966500000000"; // Can be dynamic from settings later
      const message = `طلب شراء جديد بانتظار الاعتماد:\nالبيان: ${formData.description}\nالمبلغ: ${formData.amount} ر.س\nبواسطة: ${profile.name}`;
      const waLink = `https://wa.me/${managerPhone}?text=${encodeURIComponent(message)}`;

      toast.success(isSupervisor ? 'تم إرسال الطلب للاعتماد' : 'تم تسجيل طلب الشراء بنجاح', {
        action: isSupervisor ? {
          label: 'إخطار المدير (واتساب)',
          onClick: () => window.open(waLink, '_blank')
        } : undefined
      });
      setIsDialogOpen(false);
      setFormData({ amount: '', description: '', category: 'مواد وإنتاج', projectId: '', paymentMethod: 'cash', bankAccountId: '', attachmentBase64: '' });
    } catch (error) {
      toast.error('فشل في تسجيل طلب الشراء');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approvePurchase = async (purchase: any, targetAccountId: string) => {
    if (profile?.role !== 'manager') {
      toast.error('غير مصرح لك باعتماد الطلبات');
      return;
    }

    if (!targetAccountId) {
      toast.error('يرجى تحديد الحساب البنكي أو الخزينة للصرف');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const bankRef = doc(db, 'bankAccounts', targetAccountId);
      const bankSnap = await getDoc(bankRef);
      
      if (!bankSnap.exists()) {
        throw new Error('الحساب البنكي غير موجود');
      }

      await updateDoc(doc(db, 'transactions', purchase.id), {
        status: 'approved',
        bankAccountId: targetAccountId,
        approvedAt: serverTimestamp(),
        approvedBy: profile.uid
      });
      
      const currentBalance = bankSnap.data().initialBalance || 0;
      await updateDoc(bankRef, {
        initialBalance: currentBalance - (purchase.amount || 0)
      });

      await logActivity(
        'اعتماد طلب شراء / مصروف',
        `تم اعتماد طلب: ${purchase.description} بمبلغ ${purchase.amount} ر.س وتم السداد من ${bankSnap.data().name}`,
        'success',
        'purchase',
        profile.uid
      );

      toast.success('تم إعتماد الطلب والمصروف بنجاح');
      setIsApproveDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'فشل في اعتماد الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!profile || !selectedPurchase) return;

    setIsSubmitting(true);
    try {
      const success = await softDelete(
        'transactions', 
        selectedPurchase.id, 
        selectedPurchase, 
        profile.uid, 
        `فاتورة مشتريات: ${selectedPurchase.description}`
      );
      
      if (success) {
        await logActivity(
          'أرشفة طلب شراء',
          `تم نقل طلب شراء للمورد: ${selectedPurchase.description} إلى سلة المهملات`,
          'warning',
          'purchase',
          profile.uid
        );
        setIsDeleteConfirmOpen(false);
      }
    } catch (error) {
      toast.error('فشل في حذف الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (filteredPurchases.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const exportData = filteredPurchases.map(p => ({
      'المعرف': p.id,
      'الوصف': p.description,
      'التصنيف': p.category,
      'المبلغ': p.amount,
      'التاريخ': p.date,
      'الحالة': p.status === 'approved' ? 'مكتمل' : p.status === 'pending' ? 'انتظار' : 'ملغي'
    }));

    exportToCSV('سجل_المشتريات', exportData);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const goToTab = (tabId: string) => {
    window.dispatchEvent(new CustomEvent('changeTab', { detail: tabId }));
  };

  const handleStartPDFExport = () => {
    if (purchases.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }
    setIsDateRangeDialogOpen(true);
  };

  const handleConfirmDateRange = (start: string, end: string) => {
    setDateRange({ start, end });
    setIsExportingPDF(true);
    toast.loading('جاري تجهيز تقرير المشتريات المخصص...');
    
    setTimeout(async () => {
      try {
        await exportToPDF('purchases-report-pdf', `سجل_المشتريات_${start}_إلى_${end}`);
        toast.dismiss();
        toast.success('تم تحميل التقرير بنجاح');
      } catch (error) {
        toast.dismiss();
        toast.error('فشل في تصدير التقرير');
      } finally {
        setIsExportingPDF(false);
      }
    }, 800);
  };

  const reportPurchases = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    
    return purchases.filter(p => {
      const pDate = p.dateOriginal instanceof Date ? p.dateOriginal : new Date(p.dateOriginal);
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      return pDate >= start && pDate <= end;
    }).sort((a, b) => {
      const dateA = a.dateOriginal instanceof Date ? a.dateOriginal.getTime() : new Date(a.dateOriginal).getTime();
      const dateB = b.dateOriginal instanceof Date ? b.dateOriginal.getTime() : new Date(b.dateOriginal).getTime();
      return dateB - dateA;
    });
  }, [purchases, dateRange]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">إدارة الفاتورة والمشتريات</h1>
          <p className="text-[13px] text-muted-foreground">تتبع طلبات الشراء، فواتير الموردين، والذكاء الاصطناعي لتفريغ البيانات.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            id="camera-input"
            className="hidden"
            onChange={handleFileUpload}
          />
          <label
            htmlFor="camera-input"
            className="flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 gap-2 font-bold px-4 h-10 shadow-sm transition-all active:scale-95 hover:bg-blue-100 cursor-pointer"
          >
            <Scan className="w-4 h-4" />
            مسح فاتورة ذكي
          </label>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger
              render={
                <Button 
                  className="rounded-lg bg-primary hover:bg-black gap-2 font-bold px-6 h-10 shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  إضافة فاتورة يدوية
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-primary">تسجيل فاتورة مشتريات</DialogTitle>
                <DialogDescription className="text-muted-foreground">أدخل تفاصيل المواد والمبالغ المطلوبة أو استخدم المسح الذكي.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPurchase} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="desc_p" className="font-bold text-gray-700">المورد / المواد</Label>
                  <Input 
                    id="desc_p" 
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="مثال: شركة المواد الأساسية..." 
                    className="h-11 rounded-lg text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount_p" className="font-bold text-gray-700">المبلغ الإجمالي (ر.س)</Label>
                  <Input 
                    id="amount_p" 
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00" 
                    className="h-11 rounded-lg text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-gray-700">التصنيف</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger className="h-11 rounded-lg text-right">
                      <SelectValue placeholder="اختر التصنيف..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="مواد">مواد وإنتاج</SelectItem>
                      <SelectItem value="عمالة">أجور وعمالة</SelectItem>
                      <SelectItem value="مواصلات">مواصلات وبنزين</SelectItem>
                      <SelectItem value="أكل">إعاشة وأكل</SelectItem>
                      <SelectItem value="مصروفات جانبية">مصروفات جانبية</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-gray-700">ربط بمشروع (اختياري)</Label>
                  <Select value={formData.projectId} onValueChange={(v) => setFormData({...formData, projectId: v})}>
                    <SelectTrigger className="h-11 rounded-lg text-right">
                      <SelectValue placeholder="اختر المشروع..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مشروع</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {profile?.role === 'manager' && (
                  <>
                    <div className="space-y-2">
                      <Label className="font-bold text-gray-700">طريقة الدفع</Label>
                      <Select 
                        value={formData.paymentMethod} 
                        onValueChange={(v) => setFormData({...formData, paymentMethod: v as any})}
                      >
                        <SelectTrigger className="h-11 rounded-lg text-right">
                          <SelectValue placeholder="اختر الطريقة..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">كاش (الخزينة)</SelectItem>
                          <SelectItem value="transfer">تحويل من الحساب</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.paymentMethod === 'transfer' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label className="font-bold text-gray-700">الحساب البنكي</Label>
                        <Select 
                          value={formData.bankAccountId} 
                          onValueChange={(v: string) => setFormData({...formData, bankAccountId: v})}
                        >
                          <SelectTrigger className="h-11 rounded-lg text-right">
                            <SelectValue placeholder="اختر الحساب المصدر..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.filter((b: any) => b.type === 'bank').map((acc: any) => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.paymentMethod === 'cash' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Label className="font-bold text-gray-700">الخزينة</Label>
                        <Select 
                          value={formData.bankAccountId} 
                          onValueChange={(v: string) => setFormData({...formData, bankAccountId: v})}
                        >
                          <SelectTrigger className="h-11 rounded-lg text-right">
                            <SelectValue placeholder="اختر الخزينة..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.filter((b: any) => b.type === 'cash').map((acc: any) => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                <DialogFooter className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-primary hover:bg-black font-bold text-lg"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تسجيل الطلب'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          {isElevated && (
            <SmartExport 
              title="تقرير المشتريات والمواد"
              data={purchases}
              columns={[
                { header: 'المورد / المواد', key: 'description' },
                { header: 'التصنيف', key: 'category' },
                { header: 'المبلغ (ر.س)', key: 'amount' },
                { header: 'التاريخ', key: 'date' },
                { header: 'الحالة', key: 'status' },
                { header: 'المشروع', key: 'projectName' }
              ]}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        <PurchaseStat 
          title="إجمالي المشتريات" 
          value={stats.total} 
          icon={ShoppingCart} 
          color="text-emerald-600" 
          onClick={() => goToTab('financials')}
        />
        <PurchaseStat 
          title="قيد الانتظار" 
          value={stats.pending} 
          icon={Clock} 
          color="text-amber-600" 
          onClick={() => setStatusFilter('pending')}
        />
        <PurchaseStat 
          title="عدد العمليات" 
          value={stats.count} 
          icon={ArrowUpRight} 
          color="text-primary" 
          onClick={() => { setStatusFilter('all'); setSearchTerm(''); setSortOrder('desc'); }}
        />
        <PurchaseStat 
          title="مشتريات الشهر" 
          value={stats.monthlyTotal} 
          icon={Package} 
          color="text-blue-600" 
          onClick={() => goToTab('analytics')}
        />
        <PurchaseStat 
          title="متوسط الطلب" 
          value={stats.average} 
          icon={Filter} 
          color="text-indigo-600" 
          onClick={() => goToTab('analytics')}
        />
        <PurchaseStat 
          title="أعلى طلب" 
          value={stats.max} 
          icon={AlertCircle} 
          color="text-red-600" 
          onClick={() => setSortOrder('amount')}
        />
      </div>

      <Card className="rounded-xl border-border bg-white shadow-sm overflow-hidden">
        <div className="bg-white border-b px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث برقم الطلب أو المورد..." 
              className="pr-10 rounded-lg border-slate-200 h-10 text-sm focus-visible:ring-accent" 
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 text-[12px] bg-white border-slate-200 min-w-[140px] shadow-none rounded-lg text-right">
                <SelectValue placeholder="تصفية حسب الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="approved">مكتمل</SelectItem>
                <SelectItem value="pending">قيد الانتظار</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="hidden md:block overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent border-b-border/60">
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase">رقم الطلب</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase">المورد / المادة</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase">القيمة</TableHead>
                  <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase">التاريخ</TableHead>
                  <TableHead className="py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase text-center">الحالة</TableHead>
                  <TableHead className="py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase text-center">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredPurchases.length > 0 ? (
                  filteredPurchases.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-border/40 last:border-0">
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-primary">#{p.id.slice(0, 6)}</TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col min-w-[200px] max-w-[400px]">
                          <span className="text-[13px] font-bold text-primary" title={p.description}>{p.description}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">{p.category}</span>
                            {p.projectId && projects.find(proj => proj.id === p.projectId) && (
                              <span className="text-[10px] text-accent font-bold">
                                • مشروع: {projects.find(proj => proj.id === p.projectId)?.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-[13px] font-bold text-primary">{p.amount.toLocaleString()} ر.س</TableCell>
                      <TableCell className="px-6 py-4 text-[12px] text-muted-foreground font-medium">{p.date}</TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex justify-center">
                          <Badge className={`rounded px-2 py-0.5 text-[10px] font-bold border-none shadow-none ${
                            p.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                            p.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {p.status === 'approved' ? 'مكتمل' : p.status === 'pending' ? 'قيد الانتظار' : 'ملغي'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-full focus:outline-none">
                              <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-right font-sans">
                              {profile?.role === 'manager' && p.status === 'pending' && (
                                <DropdownMenuItem 
                                  onClick={() => {
                                     setPurchaseToApprove(p);
                                     setApproveBankAccountId(p.bankAccountId || '');
                                     setIsApproveDialogOpen(true);
                                  }} 
                                  className="flex items-center justify-end gap-2 text-[13px] text-emerald-600 font-bold cursor-pointer hover:bg-emerald-50 transition-colors"
                                >
                                  <span>اعتماد الطلب والصرف</span>
                                  <ShieldCheck className="w-4 h-4" />
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedPurchase(p);
                                  setIsViewDetailsOpen(true);
                                }} 
                                className="flex items-center justify-end gap-2 text-[13px] cursor-pointer"
                              >
                                <span>عرض التفاصيل مع الفاتورة</span>
                                <Eye className="w-4 h-4" />
                              </DropdownMenuItem>
                              {isManager && (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedPurchase(p);
                                    setIsDeleteConfirmOpen(true);
                                  }} 
                                  className="flex items-center justify-end gap-2 text-[13px] text-red-600 cursor-pointer"
                                >
                                  <span>حذف الطلب</span>
                                  <Trash2 className="w-4 h-4" />
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm font-medium">
                      لا يوجد طلبات شراء مطابقة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden divide-y divide-slate-100">
             {loading ? (
                <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
             ) : filteredPurchases.length > 0 ? (
               filteredPurchases.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between active:bg-slate-50 transition-all">
                     <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[11px] font-black text-primary truncate max-w-[150px]">{p.description}</span>
                           <Badge variant="outline" className="text-[7px] px-1 py-0 h-3.5 border-slate-100 text-muted-foreground font-bold">{p.id.slice(0, 4)}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[8px] text-muted-foreground font-bold">{p.date?.split(',')?.[0] || '...'}</span>
                           <span className={`text-[7px] font-bold px-1 py-0 rounded-sm uppercase ${
                            p.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {p.status === 'approved' ? 'مكتمل' : 'معلق'}
                          </span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 shrink-0">
                        <div className="text-left">
                           <p className="text-[12px] font-black text-primary">
                              {(p.amount || 0).toLocaleString()} <span className="text-[8px] font-normal">ر.س</span>
                           </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 hover:bg-slate-100 text-slate-400 rounded-lg focus:outline-none">
                            <span className="sr-only">فتح القائمة</span>
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-right font-sans">
                            {profile?.role === 'manager' && p.status === 'pending' && (
                              <DropdownMenuItem 
                                onClick={() => {
                                   setPurchaseToApprove(p);
                                   setApproveBankAccountId(p.bankAccountId || '');
                                   setIsApproveDialogOpen(true);
                                }} 
                                className="flex items-center justify-end gap-2 text-[13px] text-emerald-600 font-bold cursor-pointer hover:bg-emerald-50 transition-colors"
                              >
                                <span>اعتماد الطلب والصرف</span>
                                <ShieldCheck className="w-4 h-4" />
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedPurchase(p);
                                setIsViewDetailsOpen(true);
                              }} 
                              className="flex items-center justify-end gap-2 text-[13px] cursor-pointer"
                            >
                              <span>عرض التفاصيل مع الفاتورة</span>
                              <Eye className="w-4 h-4" />
                            </DropdownMenuItem>
                            {isManager && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedPurchase(p);
                                  setIsDeleteConfirmOpen(true);
                                }} 
                                className="flex items-center justify-end gap-2 text-[13px] text-red-600 cursor-pointer"
                              >
                                <span>حذف الطلب</span>
                                <Trash2 className="w-4 h-4" />
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                     </div>
                  </div>
               ))
             ) : (
                <div className="p-12 text-center text-xs text-muted-foreground">لا يوجد طلبات</div>
             )}
          </div>
        </CardContent>
      </Card>

      {/* AI Scanner Dialogs */}
      <Dialog open={!!capturedImage} onOpenChange={() => setCapturedImage(null)}>
        <DialogContent className="sm:max-w-[450px] text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">معاينة الفاتورة قبل التحليل</DialogTitle>
            <DialogDescription>سيقوم الذكاء الاصطناعي باستخراج القيمة والمورد تلقائياً.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 aspect-[3/4]">
              {capturedImage && <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2">
            <Button 
              onClick={processAIScan} 
              disabled={isAnalyzing}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black gap-2 shadow-lg shadow-blue-100"
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
              تحليل البيانات الآن
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setCapturedImage(null); document.getElementById('camera-input')?.click(); }}
              className="w-full h-11 border-slate-200 text-slate-500 font-bold rounded-xl"
            >
              إعادة التصوير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">تأكيد حذف طلب شراء</DialogTitle>
            <DialogDescription className="text-gray-600 py-3">
              هل أنت متأكد من حذف طلب الشراء للمورد <span className="font-bold text-primary">{selectedPurchase?.description}</span>؟ سيتم حذف هذه العملية من سجلات المشتريات والمالية.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row-reverse gap-3 pt-4">
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 font-bold h-11 rounded-lg"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، حذف الطلب'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 font-bold h-11 rounded-lg"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isExportingPDF && (
        <PrintableReport 
          id="purchases-report-pdf"
          title="تقرير المشتريات والمواد"
          subtitle={`سجل طلبات الشراء - فترة من ${dateRange.start} إلى ${dateRange.end}`}
          headers={['ID', 'المورد / المواد', 'التصنيف', 'المبلغ (ر.س)', 'التاريخ', 'الحالة']}
          data={reportPurchases.map(p => [
            p.id.substring(0, 6),
            p.description,
            p.category,
            p.amount.toLocaleString(),
            p.date,
            p.status === 'approved' ? 'مكتمل' : 'انتظار'
          ])}
          summary={[
            { label: 'إجمالي الطلبات', value: reportPurchases.length.toString() },
            { 
              label: 'إجمالي الإنفاق', 
              value: reportPurchases.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString() + ' ر.س' 
            },
            { label: 'طلبات مكتملة', value: reportPurchases.filter(p => p.status === 'approved').length.toString() }
          ]}
        />
      )}

      <ExportDateRangeDialog 
        isOpen={isDateRangeDialogOpen}
        onOpenChange={setIsDateRangeDialogOpen}
        onConfirm={handleConfirmDateRange}
        title="تصدير سجل المشتريات"
      />

      {/* Approve Purchase Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">اعتماد الطلب والصرف</DialogTitle>
            <DialogDescription>
              يرجى تحديد حساب الخزينة أو البنك الذي سيتم خصم مبلغ {purchaseToApprove?.amount?.toLocaleString()} ر.س منه.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-gray-700">الحساب البنكي / الخزينة</Label>
              <Select 
                value={approveBankAccountId} 
                onValueChange={(v: string) => setApproveBankAccountId(v)}
              >
                <SelectTrigger className="h-11 rounded-lg text-right">
                  <SelectValue placeholder="اختر الحساب..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name} - ({acc.type === 'cash' ? 'خزينة' : 'بنك'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-row-reverse gap-3 pt-4">
            <Button 
              onClick={() => approvePurchase(purchaseToApprove, approveBankAccountId)}
              disabled={isSubmitting || !approveBankAccountId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد واعتماد'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تفاصيل طلب الشراء</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold block">المورد / البيان</span>
                  <p className="font-medium">{selectedPurchase.description}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold block">المبلغ</span>
                  <p className="font-bold text-primary">{selectedPurchase.amount?.toLocaleString()} ر.س</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold block">التاريخ</span>
                  <p className="font-medium text-slate-700">{selectedPurchase.date}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold block">الحالة</span>
                  <Badge variant="outline" className={selectedPurchase.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}>
                    {selectedPurchase.status === 'approved' ? 'معتمد ومكتمل' : 'بانتظار الاعتماد'}
                  </Badge>
                </div>
              </div>

              {selectedPurchase.attachmentUrl && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-700 mb-3 block">مرفق الفاتورة (الأرشيف)</h4>
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 flex items-center justify-center p-2">
                    {selectedPurchase.attachmentUrl.startsWith('data:image') || selectedPurchase.attachmentUrl.startsWith('http') ? (
                      <img src={selectedPurchase.attachmentUrl} alt="Invoice" className="w-full max-h-[400px] object-contain rounded-xl" />
                    ) : (
                      <div className="p-8 text-center text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="font-bold">مرفق غير مدعوم أو غير متوفر كصورة</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDetailsOpen(false)} className="w-full">إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseStat({ title, value, icon: Icon, color, onClick }: any) {
  return (
    <Card 
      onClick={onClick}
      className="rounded-xl border-border bg-white shadow-sm p-3 md:p-4 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all active:scale-95 group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-10">
        <ArrowUpRight className="w-4 h-4" />
      </div>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1">
          <p className="text-[9px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-tight mb-1 opacity-70 truncate" title={title}>{title}</p>
          <h3 className="text-sm md:text-xl font-black text-primary truncate">
            {typeof value === 'number' ? Math.round(value).toLocaleString() : value} 
            {typeof value === 'number' && (title.includes('إجمالي') || title.includes('مشتريات') || title.includes('متوسط') || title.includes('أعلى')) && (
               <span className="text-[8px] md:text-xs font-normal text-muted-foreground mr-1">ر.س</span>
            )}
          </h3>
        </div>
        <div className={`p-1.5 md:p-2 rounded-lg bg-slate-50 shrink-0 ${color} group-hover:bg-primary/5 transition-colors`}>
          <Icon className="w-3.5 h-3.5 md:w-4 h-4" />
        </div>
      </div>
    </Card>
  );
}

