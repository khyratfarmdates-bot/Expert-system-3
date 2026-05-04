import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  User, 
  Loader2, 
  Activity, 
  TrendingUp,
  Download,
  Plus, 
  Zap
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserProfile } from '../types';
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
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { exportToCSV } from '../lib/export';
import { exportToPDF } from '../lib/pdfExport';
import { softDelete } from '../lib/softDelete';
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
import { motion, AnimatePresence } from 'motion/react';

export default function Employees({ onSelectEmployee, filterRole }: { onSelectEmployee?: (id: string) => void; filterRole?: string }) {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: filterRole || 'employee',
    dept: filterRole === 'worker' ? 'الإنتاج' : 'الرئيسي',
    email: '',
    photoURL: '',
    salary: 0,
    isSponsored: false,
    iqamaNumber: '',
    iqamaExpiry: '',
    iqamaPhotoURL: '',
    drivingLicenseNumber: '',
    drivingLicenseExpiry: '',
    drivingLicensePhotoURL: '',
    passportNumber: '',
    passportExpiry: '',
    passportPhotoURL: '',
    contractURL: ''
  });

  const handleAIScan = async (imageType: 'iqama' | 'license' | 'passport') => {
    const imageData = imageType === 'iqama' ? formData.iqamaPhotoURL :
                     imageType === 'license' ? formData.drivingLicensePhotoURL :
                     formData.passportPhotoURL;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!imageData || !apiKey || apiKey === 'undefined' || apiKey === 'MY_GEMINI_API_KEY') {
      if (!imageData) toast.error('يرجى رفع الصورة أولاً لمسحها');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('جاري تحليل الوثيقة باستخدام الذكاء الاصطناعي...');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Extract the official ID number and expiry date from this ${imageType} document photo. 
      Return ONLY a JSON object with keys: "number" (string), "expiry" (YYYY-MM-DD string). 
      If a value is not found or unreadable, return null for it.
      IMPORTANT: If the date is Hijri, convert it to Gregorian if possible.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageData?.split(',')?.[1] || '' } },
            { text: prompt }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      
      const updates: Record<string, string> = {};
      if (imageType === 'iqama') {
        if (result.number) updates.iqamaNumber = result.number;
        if (result.expiry) updates.iqamaExpiry = result.expiry;
      } else if (imageType === 'license') {
        if (result.number) updates.drivingLicenseNumber = result.number;
        if (result.expiry) updates.drivingLicenseExpiry = result.expiry;
      } else {
        if (result.number) updates.passportNumber = result.number;
        if (result.expiry) updates.passportExpiry = result.expiry;
      }

      setFormData(prev => ({ ...prev, ...updates }));
      toast.dismiss(loadingToast);
      toast.success('تم استخراج البيانات تلقائياً بنجاح');
    } catch (_err) {
      toast.dismiss(loadingToast);
      toast.error('فشل في تحليل الوثيقة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Limit to 800KB roughly
      toast.error('حجم الملف كبير جداً (الحد الأقصى 800 كيلوبايت)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, [field]: reader.result as string }));
      toast.success('تم رفع الملف بنجاح');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setEmployees(docs);
      setLoading(false);
    }, (error) => console.error("Employees List Listen Error:", error));

    return () => unsubscribe();
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = 
        emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.role?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterRole) {
        return matchesSearch && emp.role === filterRole;
      }
      return matchesSearch;
    });
  }, [searchTerm, employees, filterRole]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('يرجى ملء كافة الحقول');
      return;
    }

    setIsSubmitting(true);
    try {
      const emailLower = formData.email.toLowerCase().trim();
      
      // Check for duplicate email
      const qDup = query(collection(db, 'users'), where('email', '==', emailLower));
      const snapDup = await getDocs(qDup);
      if (!snapDup.empty) {
        toast.error('هذا البريد الإلكتروني مسجل لموظف آخر بالفعل');
        setIsSubmitting(false);
        return;
      }

      // Determine allowed location types based on department
      const locationTypes = [];
      if (formData.dept === 'الإدارة' || formData.dept === 'المالية') {
        locationTypes.push('office', 'gallery');
      } else if (formData.dept === 'الإنتاج' || formData.dept === 'التصميم' || formData.role === 'supervisor') {
        locationTypes.push('office', 'gallery', 'project');
      } else {
        locationTypes.push('office');
      }

      await addDoc(collection(db, 'users'), {
        ...formData,
        email: emailLower,
        department: formData.dept,
        allowedLocationTypes: locationTypes,
        joinedAt: new Date().toISOString()
      });
      await logActivity(
        'إضافة موظف',
        `تمت إضافة موظف جديد: ${formData.name} في قسم ${formData.dept}`,
        'success',
        'employee',
        profile?.uid || 'system'
      );
      toast.success('تمت إضافة الموظف بنجاح');
      setIsDialogOpen(false);
      setFormData({ 
        name: '', role: 'employee', dept: 'الإنتاج', email: '', 
        photoURL: '', salary: 0, isSponsored: false, 
        iqamaNumber: '', iqamaExpiry: '', iqamaPhotoURL: '', 
        drivingLicenseNumber: '', drivingLicenseExpiry: '', drivingLicensePhotoURL: '', 
        passportNumber: '', passportExpiry: '', passportPhotoURL: '', 
        contractURL: '' 
      });
    } catch (error) {
      toast.error('فشل في إضافة الموظف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedEmployee) return;
    if (!formData.name || !formData.email) {
      toast.error('يرجى ملء كافة الحقول');
      return;
    }

    setIsSubmitting(true);
    try {
      const emailLower = formData.email.toLowerCase().trim();
      
      // Check if email is being changed and if it's already taken by another user
      if (emailLower !== selectedEmployee.email.toLowerCase()) {
        const qDup = query(collection(db, 'users'), where('email', '==', emailLower));
        const snapDup = await getDocs(qDup);
        if (!snapDup.empty) {
          toast.error('هذا البريد الإلكتروني مسجل لموظف آخر بالفعل');
          setIsSubmitting(false);
          return;
        }
      }

      // Determine allowed location types based on department
      const locationTypes = [];
      if (formData.dept === 'الإدارة' || formData.dept === 'المالية') {
        locationTypes.push('office', 'gallery');
      } else if (formData.dept === 'الإنتاج' || formData.dept === 'التصميم' || formData.role === 'supervisor') {
        locationTypes.push('office', 'gallery', 'project');
      } else {
        locationTypes.push('office');
      }

      await updateDoc(doc(db, 'users', selectedEmployee.id), {
        ...formData,
        email: emailLower,
        department: formData.dept,
        allowedLocationTypes: locationTypes,
        updatedAt: new Date().toISOString()
      });

      await logActivity(
        'تعديل موظف',
        `تم تحديث بيانات الموظف: ${formData.name}`,
        'info',
        'employee',
        profile.uid
      );

      toast.success('تم تحديث البيانات بنجاح');
      setIsEditDialogOpen(false);
    } catch (error) {
      toast.error('فشل في تحديث البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!profile || !selectedEmployee) return;

    setIsSubmitting(true);
    try {
      const empName = selectedEmployee.name;
      const success = await softDelete(
        'users', 
        selectedEmployee.id, 
        selectedEmployee, 
        profile.uid, 
        `موظف: ${empName}`
      );

      if (success) {
        await logActivity(
          'أرشفة موظف',
          `تم نقل الموظف: ${empName} إلى سلة المهملات`,
          'warning',
          'employee',
          profile.uid
        );
        setIsDeleteConfirmOpen(false);
      }
    } catch (error) {
      toast.error('فشل في حذف الموظف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    if (filteredEmployees.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const exportData = filteredEmployees.map(emp => ({
      'المعرف': emp.id,
      'الاسم': emp.name,
      'البريد الإلكتروني': emp.email,
      'الراتب الأساسي': emp.salary || 0,
      'الدور الوظيفي': emp.role === 'manager' ? 'مدير' : emp.role === 'supervisor' ? 'مشرف' : 'موظف',
      'القسم': emp.department || 'الإنتاج',
      'تاريخ الانضمام': emp.joinedAt ? new Date(emp.joinedAt).toLocaleDateString('ar-SA') : '-'
    }));

    exportToCSV('تقرير_الموظفين', exportData);
    toast.success('تم تصدير التقرير بنجاح');
  };

  const handleStartPDFExport = () => {
    if (employees.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }
    setIsDateRangeDialogOpen(true);
  };

  const handleConfirmDateRange = (start: string, end: string) => {
    setDateRange({ start, end });
    setIsExportingPDF(true);
    toast.loading('جاري تجهيز تقرير الموارد البشرية...');
    
    setTimeout(async () => {
      try {
        await exportToPDF('employees-report-pdf', `تقرير_الموظفين_${start}_إلى_${end}`);
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

  const reportEmployees = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return employees.filter(emp => {
      if (!emp.joinedAt) return false;
      const joinedDate = new Date(emp.joinedAt);
      return joinedDate >= start && joinedDate <= end;
    });
  }, [employees, dateRange]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-primary tracking-tight">إدارة الكوادر البشرية</h1>
          <p className="text-[10px] md:text-[13px] text-muted-foreground">فريق عمل مؤسسة خبراء الرسم - الرياض</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={handleStartPDFExport}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none rounded-lg gap-1.5 font-bold px-2 sm:px-4 h-9 sm:h-10 bg-white border-border shadow-sm hover:bg-slate-50 transition-all active:scale-95 text-[11px] sm:text-sm"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">تصدير تقرير الموظفين </span>(PDF)
          </Button>
          
          <Button 
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="rounded-lg gap-2 font-bold px-3 h-9 sm:h-10 bg-white border-border shadow-sm hover:bg-slate-50 text-slate-500 transition-all active:scale-95 text-[11px] sm:text-sm"
          >
            CSV
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger
              render={
                <Button 
                  size="sm"
                  className="w-full sm:w-auto flex-1 sm:flex-none rounded-lg bg-primary hover:bg-black gap-1.5 font-bold px-3 sm:px-6 h-9 sm:h-10 shadow-sm transition-all active:scale-95 text-[11px] sm:text-sm"
                >
                  <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">إضافة موظف جديد</span>
                  <span className="sm:hidden">إضافة موظف</span>
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-primary">إضافة موظف جديد</DialogTitle>
                <DialogDescription className="text-muted-foreground">أدخل بيانات الموظف الجديد في النظام.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddEmployee} className="space-y-4 py-4 text-right overflow-y-auto max-h-[70vh] px-1">
                {/* Photo Upload Section */}
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="relative group">
                    <Avatar className="w-24 h-24 rounded-3xl border-4 border-slate-100 shadow-lg">
                      {formData.photoURL ? (
                        <AvatarImage src={formData.photoURL} />
                      ) : (
                        <AvatarFallback className="bg-slate-100 text-slate-400">
                          <User className="w-10 h-10" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <Label htmlFor="photo-upload" className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4 text-white" />
                      <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'photoURL')} />
                    </Label>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">صورة الموظف الرسمية</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold text-gray-700">الاسم الكامل</Label>
                  <Input 
                    id="name" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="محمد أحمد..." 
                    className="h-11 rounded-lg text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-gray-700">البريد الإلكتروني</Label>
                  <Input 
                    id="email" 
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="user@example.com" 
                    className="h-11 rounded-lg text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salary" className="font-bold text-gray-700">الراتب الشهري (ر.س)</Label>
                  <Input 
                    id="salary" 
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                    placeholder="0.00" 
                    className="h-11 rounded-lg text-right font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-gray-700">القسم</Label>
                    <Select 
                      value={formData.dept} 
                      onValueChange={(v) => setFormData({...formData, dept: v})}
                    >
                      <SelectTrigger className="w-full text-right h-11 rounded-lg">
                        <SelectValue placeholder="اختر القسم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="الإنتاج">الإنتاج</SelectItem>
                        <SelectItem value="التصميم">التصميم</SelectItem>
                        <SelectItem value="المالية">المالية</SelectItem>
                        <SelectItem value="الإدارة">الإدارة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-gray-700">الدور</Label>
                    <Select 
                      value={formData.role} 
                      onValueChange={(v) => setFormData({...formData, role: v as any})}
                    >
                      <SelectTrigger className="w-full text-right h-11 rounded-lg">
                        <SelectValue placeholder="اختر الدور" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">موظف</SelectItem>
                        <SelectItem value="supervisor">مشرف</SelectItem>
                        <SelectItem value="manager">مدير</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="font-black text-primary">هل الموظف على الكفالة؟</Label>
                    <div 
                      onClick={() => setFormData(prev => ({ ...prev, isSponsored: !prev.isSponsored }))}
                      className={`w-12 h-6 rounded-full cursor-pointer transition-colors relative ${formData.isSponsored ? 'bg-primary' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isSponsored ? 'right-7' : 'right-1'}`} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {formData.isSponsored && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-6 overflow-hidden"
                      >
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">وثائق الإقامة</p>
                            {formData.iqamaPhotoURL && (
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                                onClick={() => handleAIScan('iqama')}
                              >
                                <Zap className="w-3 h-3" />
                                مسح ذكي
                              </Button>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[11px] font-bold">رقم الإقامة</Label>
                              <Input 
                                placeholder="XXXXXXXXXX" 
                                value={formData.iqamaNumber} 
                                onChange={(e) => setFormData({...formData, iqamaNumber: e.target.value})} 
                                className="h-10 text-xs text-right" 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold">تاريخ انتهاء الإقامة</Label>
                                <Input type="date" value={formData.iqamaExpiry} onChange={(e) => setFormData({...formData, iqamaExpiry: e.target.value})} className="h-10 text-xs text-right" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold">صورة الإقامة</Label>
                                <div className="flex gap-2">
                                  <Button type="button" variant="outline" className="h-10 text-[10px] flex-1 border-dashed" onClick={() => document.getElementById('iqama-up')?.click()}>
                                    {formData.iqamaPhotoURL ? 'تم الرفع' : 'ارفع الصورة'}
                                  </Button>
                                  <input id="iqama-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'iqamaPhotoURL')} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* License Section */}
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">رخصة القيادة</p>
                            {formData.drivingLicensePhotoURL && (
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                                onClick={() => handleAIScan('license')}
                              >
                                <Zap className="w-3 h-3" />
                                مسح ذكي
                              </Button>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[11px] font-bold">رقم الرخصة</Label>
                              <Input 
                                placeholder="XXXXXXXXXX" 
                                value={formData.drivingLicenseNumber} 
                                onChange={(e) => setFormData({...formData, drivingLicenseNumber: e.target.value})} 
                                className="h-10 text-xs text-right" 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold">تاريخ انتهاء الرخصة</Label>
                                <Input type="date" value={formData.drivingLicenseExpiry} onChange={(e) => setFormData({...formData, drivingLicenseExpiry: e.target.value})} className="h-10 text-xs text-right" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold">صورة الرخصة</Label>
                                <div className="flex gap-2">
                                  <Button type="button" variant="outline" className="h-10 text-[10px] flex-1 border-dashed" onClick={() => document.getElementById('license-up')?.click()}>
                                    {formData.drivingLicensePhotoURL ? 'تم الرفع' : 'ارفع الصورة'}
                                  </Button>
                                  <input id="license-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'drivingLicensePhotoURL')} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Passport Section */}
                        <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">جواز السفر</p>
                            {formData.passportPhotoURL && (
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                                onClick={() => handleAIScan('passport')}
                              >
                                <Zap className="w-3 h-3" />
                                مسح ذكي
                              </Button>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-[11px] font-bold">رقم الجواز</Label>
                              <Input 
                                placeholder="XXXXXXXXXX" 
                                value={formData.passportNumber} 
                                onChange={(e) => setFormData({...formData, passportNumber: e.target.value})} 
                                className="h-10 text-xs text-right" 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold">تاريخ انتهاء الجواز</Label>
                                <Input type="date" value={formData.passportExpiry} onChange={(e) => setFormData({...formData, passportExpiry: e.target.value})} className="h-10 text-xs text-right" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[11px] font-bold">صورة الجواز</Label>
                                <div className="flex gap-2">
                                  <Button type="button" variant="outline" className="h-10 text-[10px] flex-1 border-dashed" onClick={() => document.getElementById('passport-up')?.click()}>
                                    {formData.passportPhotoURL ? 'تم الرفع' : 'ارفع الصورة'}
                                  </Button>
                                  <input id="passport-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'passportPhotoURL')} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Contract Section */}
                        <div className="p-4 bg-emerald-50 rounded-2xl space-y-4 border border-emerald-100">
                          <p className="text-xs font-black text-emerald-600 uppercase tracking-wider">عقد العمل</p>
                          <Button type="button" variant="outline" className="w-full h-11 text-xs border-dashed border-emerald-300 text-emerald-700 bg-white" onClick={() => document.getElementById('contract-up')?.click()}>
                            {formData.contractURL ? 'تم رفع العقد الموثق' : 'ارفع نسخة رقمية من العقد'}
                          </Button>
                          <input id="contract-up" type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, 'contractURL')} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <DialogFooter className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-primary hover:bg-black font-bold text-lg"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إضافة الموظف'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="البحث عن موظف بالاسم أو القسم..." 
          className="pr-10 rounded-lg border-slate-200 h-11 text-sm focus-visible:ring-accent" 
        />
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => (
            <Card 
              key={emp.id} 
              className="group relative rounded-[2rem] border-none bg-white shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer"
              onClick={() => onSelectEmployee?.(emp.id)}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-primary/10 group-hover:scale-150" />
              
              <CardContent className="p-2 sm:p-6 relative z-10">
                <div className="flex items-start justify-between mb-2 sm:mb-6">
                  <div className="relative">
                    <Avatar className="w-10 h-10 sm:w-20 sm:h-20 rounded-lg sm:rounded-[1.5rem] border-2 sm:border-4 border-white shadow-md sm:shadow-xl group-hover:scale-110 transition-transform duration-500">
                      <AvatarImage src={emp.photoURL} />
                      <AvatarFallback className="bg-slate-900 text-white font-black text-[10px] sm:text-xl">{emp.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-6 sm:h-6 bg-emerald-500 border-2 sm:border-4 border-white rounded-full shadow-lg" />
                  </div>
                  
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400 rounded-full hover:bg-slate-100">
                            <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="text-right">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setFormData({ 
                              name: emp.name, 
                              email: emp.email, 
                              role: emp.role, 
                              dept: emp.department || 'الإنتاج',
                              photoURL: emp.photoURL || '',
                              salary: emp.salary || 0,
                              isSponsored: emp.isSponsored || false,
                              iqamaNumber: emp.iqamaNumber || '',
                              iqamaExpiry: emp.iqamaExpiry || '',
                              iqamaPhotoURL: emp.iqamaPhotoURL || '',
                              drivingLicenseNumber: emp.drivingLicenseNumber || '',
                              drivingLicenseExpiry: emp.drivingLicenseExpiry || '',
                              drivingLicensePhotoURL: emp.drivingLicensePhotoURL || '',
                              passportNumber: emp.passportNumber || '',
                              passportExpiry: emp.passportExpiry || '',
                              passportPhotoURL: emp.passportPhotoURL || '',
                              contractURL: emp.contractURL || ''
                            });
                            setIsEditDialogOpen(true);
                          }} 
                          className="flex items-center justify-end gap-2 text-xs"
                        >
                          <span>تعديل البيانات</span>
                          <Edit2 className="w-3.5 h-3.5" />
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setIsDeleteConfirmOpen(true);
                          }} 
                          className="flex items-center justify-end gap-2 text-xs text-red-600"
                        >
                          <span>حذف الموظف</span>
                          <Trash2 className="w-3.5 h-3.5" />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-0.5 sm:space-y-1">
                  <h3 className="text-[10px] sm:text-xl font-black text-primary tracking-tight group-hover:text-accent transition-colors truncate leading-tight">{emp.name}</h3>
                  <div className="flex sm:items-center flex-col sm:flex-row gap-0.5 sm:gap-2">
                    <Badge variant="outline" className="text-[6px] sm:text-[10px] px-1 py-0 font-black border-slate-200 text-slate-500 uppercase tracking-widest w-fit">
                      {emp.role === 'manager' ? 'مدير' : emp.role === 'supervisor' ? 'مشرف' : 'الفريق'}
                    </Badge>
                    <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-200" />
                    <span className="text-[7px] sm:text-[11px] font-bold text-slate-400 truncate leading-none">{emp.department || 'الإنتاج'}</span>
                  </div>
                </div>

                <div className="mt-3 sm:mt-8 pt-2 sm:pt-6 border-t border-slate-50 grid grid-cols-2 gap-1 sm:gap-4">
                  <div className="flex flex-col gap-0.5 sm:gap-1">
                    <span className="text-[6px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter">المهنية</span>
                    <div className="flex items-center gap-0.5 sm:gap-1.5 text-[8px] sm:text-[11px] font-bold text-emerald-600">
                      <Activity className="w-2 h-2 sm:w-3 sm:h-3" />
                      نشط
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:gap-1 items-end">
                    <span className="text-[6px] sm:text-[9px] font-black text-slate-400 uppercase tracking-tighter">الأداء</span>
                    <div className="flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[11px] font-black text-primary">
                      <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3 text-emerald-500" />
                      94%
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEmployee?.(emp.id);
                  }}
                  className="w-full mt-3 sm:mt-6 bg-slate-900 group-hover:bg-primary text-white rounded-lg sm:rounded-2xl font-black text-[8px] sm:text-xs h-6 sm:h-12 transition-all duration-300 px-0"
                >
                  <span className="hidden sm:inline">استعراض الملف المهني</span>
                  <span className="sm:hidden">الملف</span>
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground font-medium">
            لم يتم العثور على موظفين في النظام
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-primary">تعديل بيانات الموظف</DialogTitle>
            <DialogDescription className="text-muted-foreground">تحديث بيانات {selectedEmployee?.name} في النظام.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEmployee} className="space-y-4 py-4 text-right overflow-y-auto max-h-[70vh] px-1">
            {/* Photo Upload Section */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="relative group">
                <Avatar className="w-24 h-24 rounded-3xl border-4 border-slate-100 shadow-lg">
                  {formData.photoURL ? (
                    <AvatarImage src={formData.photoURL} />
                  ) : (
                    <AvatarFallback className="bg-slate-100 text-slate-400">
                      <User className="w-10 h-10" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <Label htmlFor="edit-photo-upload" className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                  <Plus className="w-4 h-4 text-white" />
                  <input id="edit-photo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'photoURL')} />
                </Label>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">صورة الموظف الرسمية</span>
            </div>

            <div className="space-y-2 text-right">
              <Label htmlFor="edit_name" className="font-bold text-gray-700">الاسم الكامل</Label>
              <Input 
                id="edit_name" 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="h-11 rounded-lg text-right"
              />
            </div>
            <div className="space-y-2 text-right">
              <Label htmlFor="edit_email" className="font-bold text-gray-700">البريد الإلكتروني</Label>
              <Input 
                id="edit_email" 
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="h-11 rounded-lg text-right"
              />
            </div>

            <div className="space-y-2 text-right">
              <Label htmlFor="edit_salary" className="font-bold text-gray-700">الراتب الشهري (ر.س)</Label>
              <Input 
                id="edit_salary" 
                type="number"
                value={formData.salary}
                onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                placeholder="0.00" 
                className="h-11 rounded-lg text-right font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-right">
                <Label className="font-bold text-gray-700">القسم</Label>
                <Select value={formData.dept} onValueChange={(v) => setFormData({...formData, dept: v})}>
                  <SelectTrigger className="w-full text-right h-11 rounded-lg">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="الإنتاج">الإنتاج</SelectItem>
                    <SelectItem value="التصميم">التصميم</SelectItem>
                    <SelectItem value="المالية">المالية</SelectItem>
                    <SelectItem value="الإدارة">الإدارة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-right">
                <Label className="font-bold text-gray-700">الدور</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v as any})}>
                  <SelectTrigger className="w-full text-right h-11 rounded-lg">
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">موظف</SelectItem>
                    <SelectItem value="supervisor">مشرف</SelectItem>
                    <SelectItem value="manager">مدير</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <Label className="font-black text-primary">هل الموظف على الكفالة؟</Label>
                <div 
                  onClick={() => setFormData(prev => ({ ...prev, isSponsored: !prev.isSponsored }))}
                  className={`w-12 h-6 rounded-full cursor-pointer transition-colors relative ${formData.isSponsored ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isSponsored ? 'right-7' : 'right-1'}`} />
                </div>
              </div>

              <AnimatePresence>
                {formData.isSponsored && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-6 overflow-hidden"
                  >
                    <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">وثائق الإقامة</p>
                        {formData.iqamaPhotoURL && (
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-[10px] gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                            onClick={() => handleAIScan('iqama')}
                          >
                            <Zap className="w-3 h-3" />
                            مسح ذكي
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold">رقم الإقامة</Label>
                          <Input 
                            placeholder="XXXXXXXXXX" 
                            value={formData.iqamaNumber} 
                            onChange={(e) => setFormData({...formData, iqamaNumber: e.target.value})} 
                            className="h-10 text-xs text-right" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold">تاريخ انتهاء الإقامة</Label>
                            <Input type="date" value={formData.iqamaExpiry} onChange={(e) => setFormData({...formData, iqamaExpiry: e.target.value})} className="h-10 text-xs text-right" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold">صورة الإقامة</Label>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" className="h-10 text-[10px] flex-1 border-dashed" onClick={() => document.getElementById('edit-iqama-up')?.click()}>
                                {formData.iqamaPhotoURL ? 'تم الرفع' : 'ارفع الصورة'}
                              </Button>
                              <input id="edit-iqama-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'iqamaPhotoURL')} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">رخصة القيادة</p>
                        {formData.drivingLicensePhotoURL && (
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-[10px] gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                            onClick={() => handleAIScan('license')}
                          >
                            <Zap className="w-3 h-3" />
                            مسح ذكي
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold">رقم الرخصة</Label>
                          <Input 
                            placeholder="XXXXXXXXXX" 
                            value={formData.drivingLicenseNumber} 
                            onChange={(e) => setFormData({...formData, drivingLicenseNumber: e.target.value})} 
                            className="h-10 text-xs text-right" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold">تاريخ انتهاء الرخصة</Label>
                            <Input type="date" value={formData.drivingLicenseExpiry} onChange={(e) => setFormData({...formData, drivingLicenseExpiry: e.target.value})} className="h-10 text-xs text-right" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold">صورة الرخصة</Label>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" className="h-10 text-[10px] flex-1 border-dashed" onClick={() => document.getElementById('edit-license-up')?.click()}>
                                {formData.drivingLicensePhotoURL ? 'تم الرفع' : 'ارفع الصورة'}
                              </Button>
                              <input id="edit-license-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'drivingLicensePhotoURL')} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">جواز السفر</p>
                        {formData.passportPhotoURL && (
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-[10px] gap-1.5 text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                            onClick={() => handleAIScan('passport')}
                          >
                            <Zap className="w-3 h-3" />
                            مسح ذكي
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold">رقم الجواز</Label>
                          <Input 
                            placeholder="XXXXXXXXXX" 
                            value={formData.passportNumber} 
                            onChange={(e) => setFormData({...formData, passportNumber: e.target.value})} 
                            className="h-10 text-xs text-right" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold">تاريخ انتهاء الجواز</Label>
                            <Input type="date" value={formData.passportExpiry} onChange={(e) => setFormData({...formData, passportExpiry: e.target.value})} className="h-10 text-xs text-right" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] font-bold">صورة الجواز</Label>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" className="h-10 text-[10px] flex-1 border-dashed" onClick={() => document.getElementById('edit-passport-up')?.click()}>
                                {formData.passportPhotoURL ? 'تم الرفع' : 'ارفع الصورة'}
                              </Button>
                              <input id="edit-passport-up" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'passportPhotoURL')} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl space-y-4 border border-emerald-100">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-wider">عقد العمل</p>
                      <Button type="button" variant="outline" className="w-full h-11 text-xs border-dashed border-emerald-300 text-emerald-700 bg-white" onClick={() => document.getElementById('edit-contract-up')?.click()}>
                        {formData.contractURL ? 'تم رفع العقد الموثق' : 'ارفع نسخة رقمية من العقد'}
                      </Button>
                      <input id="edit-contract-up" type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, 'contractURL')} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl bg-primary hover:bg-black font-bold">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تحديث البيانات'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">تأكيد الحذف</DialogTitle>
            <DialogDescription className="text-gray-600 py-3">
              هل أنت متأكد تماماً من حذف الموظف <span className="font-bold text-primary">{selectedEmployee?.name}</span>؟ هذا الإجراء لا يمكن التراجع عنه وسيؤدي لإزالة كافة بياناته من النظام.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row-reverse gap-3 pt-4">
            <Button 
              variant="destructive" 
              onClick={handleDeleteEmployee}
              disabled={isSubmitting}
              className="flex-1 font-bold h-11 rounded-lg"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، حذف الموظف'}
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
          id="employees-report-pdf"
          title="تقرير الموارد البشرية"
          subtitle={`قائمة الموظفين المنضمين - فترة من ${dateRange.start} إلى ${dateRange.end}`}
          headers={['الاسم', 'الدور الوظيفي', 'القسم', 'تاريخ الانضمام', 'البريد الإلكتروني']}
          data={reportEmployees.map(emp => [
            emp.name,
            emp.role === 'manager' ? 'مدير' : emp.role === 'supervisor' ? 'مشرف' : 'موظف',
            emp.department || 'الإنتاج',
            emp.joinedAt ? new Date(emp.joinedAt).toLocaleString('ar-SA') : '-',
            emp.email || '-'
          ])}
          summary={[
            { label: 'إجمالي الموظفين للفترة', value: reportEmployees.length.toString() },
            { 
              label: 'أقسام نشطة', 
              value: Array.from(new Set(reportEmployees.map(e => e.department))).filter(Boolean).length.toString() 
            },
            { label: 'حالة التقرير', value: 'موثق' }
          ]}
        />
      )}

      <ExportDateRangeDialog 
        isOpen={isDateRangeDialogOpen}
        onOpenChange={setIsDateRangeDialogOpen}
        onConfirm={handleConfirmDateRange}
        title="تصدير تقرير الموظفين"
      />

      {/* Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-24 left-6 z-40">
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="w-14 h-14 rounded-full bg-primary hover:bg-black shadow-xl flex items-center justify-center p-0"
        >
          <UserPlus className="w-7 h-7 text-white" />
        </Button>
      </div>
    </div>
  );
}
