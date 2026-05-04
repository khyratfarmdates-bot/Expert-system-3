import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Archive as ArchiveIcon, 
  Download, 
  FileText, 
  Calendar,
  Users,
  Briefcase,
  History,
  ArrowRightLeft,
  Printer,
  Image as ImageIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  deleteDoc,
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { restoreDocument } from '../lib/softDelete';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ArchiveType = 'all' | 'transactions' | 'projects' | 'employees' | 'workers' | 'trash' | 'this_week' | 'this_month';
type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

import { exportToCSV } from '../lib/export';

const formatDateString = (firebaseTimestamp: any, fallbackStr: string, cType: 'gregorian' | 'hijri'): string => {
  if (firebaseTimestamp && firebaseTimestamp.toDate) {
    const d = firebaseTimestamp.toDate();
    if (cType === 'hijri') {
      return d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  return fallbackStr;
};

export default function Archive({ initialType }: { initialType?: ArchiveType }) {
  const [activeType, setActiveType] = useState<ArchiveType>(initialType || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [bankAccountsMap, setBankAccountsMap] = useState<Record<string, string>>({});
  const [calendarType, setCalendarType] = useState<'gregorian' | 'hijri'>('gregorian');

  useEffect(() => {
    setLoading(true);

    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        setCalendarType(snapshot.data().calendarType || 'gregorian');
      }
    });

    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      const banks: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        banks[doc.id] = doc.data().name + (doc.data().type === 'cash' ? ' (خزينة)' : '');
      });
      setBankAccountsMap(banks);
    });

    // Listen to employees
    const qE = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubEmployees = onSnapshot(qE, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Employee',
        typeLabel: 'موظف',
        title: doc.data().name,
        subtitle: `${doc.data().role} • ${doc.data().email}`,
        date: doc.data().joinedAt || 'تاريخ الانضمام',
        status: 'active',
        icon: Users,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        rawData: doc.data()
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Employee');
        return [...filtered, ...docs];
      });
    });

    // Listen to workers
    const qW = query(collection(db, 'workers'), orderBy('name', 'asc'));
    const unsubWorkers = onSnapshot(qW, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Worker',
        typeLabel: 'عامل',
        title: doc.data().name,
        subtitle: `${doc.data().role} • ${doc.data().dailyRate} ر.س`,
        date: doc.data().joinedAt || 'تاريخ التسجيل',
        status: doc.data().status || 'active',
        icon: Users,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        rawData: doc.data()
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Worker');
        return [...filtered, ...docs];
      });
    });

    // Listen to transactions
    const qT = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTransactions = onSnapshot(qT, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Finance',
        typeLabel: 'حركة مالية',
        title: doc.data().description,
        subtitle: `${doc.data().amount} ر.س • ${doc.data().category}`,
        date: doc.data().date?.toDate?.()?.toLocaleDateString('ar-SA') || doc.data().date || 'تاريخ غير معروف',
        status: doc.data().status,
        icon: ArrowRightLeft,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        rawData: doc.data()
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Finance');
        return [...filtered, ...docs];
      });
    });

    // Listen to Projects
    const qP = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsubProjects = onSnapshot(qP, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Project',
        typeLabel: 'مشروع',
        title: doc.data().title,
        subtitle: `${doc.data().budget?.toLocaleString()} ر.س • ${doc.data().clientName || 'عميل'}`,
        date: doc.data().createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'تاريخ البدء',
        status: doc.data().status,
        icon: Briefcase,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        rawData: doc.data()
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Project');
        return [...filtered, ...docs];
      });
    });

    // Listen to Subcontractors
    const qS = query(collection(db, 'subcontractors'), orderBy('createdAt', 'desc'));
    const unsubSubcontractors = onSnapshot(qS, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Subcontractor',
        typeLabel: 'مقاول باطن',
        title: doc.data().name,
        subtitle: `${doc.data().contractAmount?.toLocaleString()} ر.س • ${doc.data().serviceType}`,
        date: doc.data().createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'تاريخ التعاقد',
        status: doc.data().status,
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        rawData: doc.data()
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Subcontractor');
        return [...filtered, ...docs];
      });
    });

    // Listen to Recycle Bin
    const qTrash = query(collection(db, 'recycle_bin'), orderBy('deletedAt', 'desc'));
    const unsubTrash = onSnapshot(qTrash, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Trash',
        typeLabel: 'سلة المحذوفات',
        title: doc.data().entityDisplayName || doc.data().title || doc.data().name,
        subtitle: `حُذف في: ${doc.data().deletedAt?.toDate?.()?.toLocaleDateString('ar-SA')}`,
        date: doc.data().expiresAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'تاريخ مجهول',
        status: 'deleted',
        icon: History,
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Trash');
        return [...filtered, ...docs];
      });
      setLoading(false);
    });

    // Listen to Gallery/Field Archive
    const qArchive = query(collection(db, 'archive'), orderBy('createdAt', 'desc'));
    const unsubFieldArchive = onSnapshot(qArchive, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        archiveType: 'Field',
        typeLabel: 'مرفق ميداني',
        title: doc.data().title,
        subtitle: `مشروع: ${doc.data().projectId ? 'مرتبط' : 'عام'} • ${doc.data().type === 'image' ? 'صورة' : 'فيديو'}`,
        date: doc.data().createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'تاريخ الرفع',
        status: 'approved',
        icon: ImageIcon,
        color: 'text-violet-600',
        bgColor: 'bg-violet-50',
        rawData: doc.data()
      }));
      setItems(prev => {
        const filtered = prev.filter(i => i.archiveType !== 'Field');
        return [...filtered, ...docs];
      });
    });

    return () => {
      unsubTransactions?.();
      unsubProjects?.();
      unsubSubcontractors?.();
      unsubTrash?.();
      unsubEmployees?.();
      unsubWorkers?.();
      unsubBanks?.();
      unsubSettings?.();
      unsubFieldArchive?.();
    };
  }, []);

  const handleRestore = async (id: string) => {
    const success = await restoreDocument(id);
    if (success) toast.success('تمت استعادة البيانات');
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف النهائي؟ لا يمكن التراجع عن هذه الخطوة.')) return;
    try {
      await deleteDoc(doc(db, 'recycle_bin', id));
      toast.success('تم الحذف النهائي');
    } catch {
      toast.error('فشل الحذف النهائي');
    }
  };

  const handleCopy = async (url: string) => {
    try {
      if (url.startsWith('data:image/')) {
        const response = await fetch(url);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        toast.success('تم نسخ الصورة للحافظة');
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('تم نسخ رابط البيانات للحافظة');
      }
    } catch {
      toast.error('فشل النسخ للمحافظة');
    }
  };

  const handleShare = async (item: any) => {
    try {
      const url = item.rawData?.attachmentUrl || item.rawData?.attachmentBase64;
      if (!url) return;
      if (navigator.share) {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `${item.title}.png`, { type: blob.type });
        await navigator.share({
          files: [file],
          title: item.title,
          text: `مشاركة ${item.title} من أرشيف نظام أمان`
        });
      } else {
        handleCopy(url);
      }
    } catch {
      toast.error('مشاركة الملف غير مدعومة في هذا المتصفح');
    }
  };

  const filteredItems = useMemo(() => {
    let result = items;
    const now = new Date();
    
    if (activeType === 'transactions') result = items.filter(i => i.archiveType === 'Finance');
    else if (activeType === 'projects') result = items.filter(i => i.archiveType === 'Project' || i.archiveType === 'Field');
    else if (activeType === 'employees') result = items.filter(i => i.archiveType === 'Employee');
    else if (activeType === 'workers') result = items.filter(i => i.archiveType === 'Worker');
    else if (activeType === 'trash') result = items.filter(i => i.archiveType === 'Trash');
    else if (activeType === 'this_week') result = items.filter(i => {
      const d = i.rawData?.createdAt?.toDate ? i.rawData.createdAt.toDate() : (i.rawData?.date?.toDate ? i.rawData.date.toDate() : new Date(0));
      return (now.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    });
    else if (activeType === 'this_month') result = items.filter(i => {
      const d = i.rawData?.createdAt?.toDate ? i.rawData.createdAt.toDate() : (i.rawData?.date?.toDate ? i.rawData.date.toDate() : new Date(0));
      return (now.getTime() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    });

    result = result.filter(item => 
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subtitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id?.includes(searchTerm)
    );

    return result.sort((a, b) => {
      // sort by dates
      if (sortOption.startsWith('date_')) {
        const dateA = a.rawData?.createdAt?.seconds || a.rawData?.date?.seconds || a.id;
        const dateB = b.rawData?.createdAt?.seconds || b.rawData?.date?.seconds || b.id;
        if (sortOption === 'date_desc') return dateB > dateA ? 1 : -1;
        return dateA > dateB ? 1 : -1;
      } else {
        const amountA = Number(a.rawData?.amount) || 0;
        const amountB = Number(b.rawData?.amount) || 0;
        if (sortOption === 'amount_desc') return amountB - amountA;
        return amountA - amountB;
      }
    });
  }, [items, searchTerm, activeType, sortOption]);


  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: items.length,
      recentWeek: items.filter(i => {
        const d = i.rawData?.createdAt?.toDate ? i.rawData.createdAt.toDate() : (i.rawData?.date?.toDate ? i.rawData.date.toDate() : new Date(0));
        return (now.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      }).length,
      recentMonth: items.filter(i => {
        const d = i.rawData?.createdAt?.toDate ? i.rawData.createdAt.toDate() : (i.rawData?.date?.toDate ? i.rawData.date.toDate() : new Date(0));
        return (now.getTime() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      }).length
    };
  }, [items]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">أرشيف المؤسسة الذكي</h1>
          <p className="text-sm font-bold text-slate-500 tracking-tight">السجل التاريخي الشامل للفواتير، المشاريع، والعمليات الإدارية.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl gap-2 font-bold border-slate-200"
            onClick={() => {
              if (filteredItems.length === 0) {
                toast.error('لا توجد بيانات لتصديرها');
                return;
              }
              const exportData = filteredItems.map(item => ({
                'الرقم المرجعي': item.id,
                'النوع': item.typeLabel,
                'العنوان': item.title,
                'التفاصيل': item.subtitle,
                'التاريخ': formatDateString(item.rawData?.createdAt || item.rawData?.date || item.rawData?.deletedAt || item.rawData?.joinedAt || item.rawData?.expiresAt, item.date, calendarType),
                'الحالة': item.status || 'N/A'
              }));
              exportToCSV(`archive_export_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}`, exportData);
              toast.success('تم تصدير التقرير بنجاح');
            }}
          >
            <Download className="w-4 h-4" />
            تصدير الأرشيف الكامل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card onClick={() => setActiveType('all')} className={`rounded-2xl border-none shadow-sm p-6 cursor-pointer transition-all ${activeType === 'all' ? 'ring-2 ring-primary bg-primary/5' : 'bg-white hover:bg-slate-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeType === 'all' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
              <ArchiveIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي المؤرشفات</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.total}</h3>
            </div>
          </div>
        </Card>
        <Card onClick={() => setActiveType('this_week')} className={`rounded-2xl border-none shadow-sm p-6 cursor-pointer transition-all ${activeType === 'this_week' ? 'ring-2 ring-orange-400 bg-orange-50/50' : 'bg-white hover:bg-slate-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeType === 'this_week' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600'}`}>
              <History className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">عمليات هذا الأسبوع</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.recentWeek}</h3>
            </div>
          </div>
        </Card>
        <Card onClick={() => setActiveType('this_month')} className={`rounded-2xl border-none shadow-sm p-6 cursor-pointer transition-all ${activeType === 'this_month' ? 'ring-2 ring-blue-400 bg-blue-50/50' : 'bg-white hover:bg-slate-50'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeType === 'this_month' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">عمليات هذا الشهر</p>
              <h3 className="text-2xl font-black text-slate-800">{stats.recentMonth}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border-none overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex overflow-x-auto no-scrollbar gap-2 w-full md:w-auto">
            <FilterButton 
              active={activeType === 'all'} 
              onClick={() => setActiveType('all')} 
              label="السجل العام" 
              icon={ArchiveIcon} 
            />
            <FilterButton 
              active={activeType === 'transactions'} 
              onClick={() => setActiveType('transactions')} 
              label="الفواتير والمالية" 
              icon={FileText} 
            />
            <FilterButton 
              active={activeType === 'projects'} 
              onClick={() => setActiveType('projects')} 
              label="المشاريع" 
              icon={Briefcase} 
            />
            <FilterButton 
              active={activeType === 'employees'} 
              onClick={() => setActiveType('employees')} 
              label="الموظفين" 
              icon={Users} 
            />
            <FilterButton 
              active={activeType === 'workers'} 
              onClick={() => setActiveType('workers')} 
              label="العمالة" 
              icon={Users} 
            />
            <FilterButton 
              active={activeType === 'trash'} 
              onClick={() => setActiveType('trash')} 
              label="سلة المحذوفات" 
              icon={History} 
            />
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <Select value={sortOption} onValueChange={(v: SortOption) => setSortOption(v)}>
              <SelectTrigger className="w-full md:w-[180px] h-11 bg-slate-50/50 border-none rounded-xl text-right">
                <SelectValue placeholder="ترتيب حسب..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">الأحدث أولاً</SelectItem>
                <SelectItem value="date_asc">الأقدم أولاً</SelectItem>
                <SelectItem value="amount_desc">الأعلى مبلغاً</SelectItem>
                <SelectItem value="amount_asc">الأقل مبلغاً</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-full md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="بحث..." 
                className="pr-10 rounded-xl bg-slate-50/50 border-none h-11"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, idx) => (
                <motion.div
                  key={item.id + idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    setSelectedItem(item);
                    setIsDetailsOpen(true);
                  }}
                  className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-200 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bgColor} ${item.color} shadow-sm shrink-0`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-40">{item.typeLabel}</span>
                        <Badge variant="outline" className="text-[8px] h-4 border-slate-200 bg-white">#{item.id.slice(-6).toUpperCase()}</Badge>
                        {item.archiveType === 'Finance' && item.rawData?.bankAccountId && bankAccountsMap[item.rawData.bankAccountId] && (
                           <Badge variant="outline" className="text-[8px] h-4 bg-blue-50 text-blue-600 border-none px-2 rounded-full font-black">
                              دُفع من: {bankAccountsMap[item.rawData.bankAccountId]}
                           </Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.title}</h4>
                      <p className="text-[11px] font-bold text-slate-400">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-left flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[11px] font-bold">
                        {item.archiveType === 'Trash' ? `تنتهي في: ${formatDateString(item.rawData?.expiresAt || item.rawData?.deletedAt, item.date, calendarType)}` : formatDateString(item.rawData?.createdAt || item.rawData?.date || item.rawData?.deletedAt || item.rawData?.joinedAt || item.rawData?.expiresAt, item.date, calendarType)}
                      </span>
                    </div>
                    {item.archiveType === 'Trash' ? (
                      <div className="flex gap-1">
                        <Button 
                          onClick={() => handleRestore(item.id)}
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] font-black rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        >
                          استعادة
                        </Button>
                        <Button 
                          onClick={() => handlePermanentDelete(item.id)}
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-black rounded-lg text-red-600 hover:bg-red-50"
                        >
                          حذف نهائي
                        </Button>
                      </div>
                    ) : item.status && (
                       <Badge variant="secondary" className="text-[9px] py-0 h-4 font-black">
                         {item.status === 'completed' || item.status === 'approved' ? 'مكتمل' : 'نشط'}
                       </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filteredItems.length === 0 && !loading && (
              <div className="text-center py-20">
                <ArchiveIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400">لا توجد سجلات مطابقة في الأرشيف</p>
              </div>
            )}
           </div>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] text-right rounded-3xl" dir="rtl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ArchiveIcon className="w-5 h-5 text-primary" />
                أرشيف - تفاصيل {selectedItem?.typeLabel}
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium mt-1">
                مرجع كامل للبيانات المؤرشفة
              </DialogDescription>
            </div>
          </DialogHeader>

          {selectedItem && (
            <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">الرقم المرجعي (ID)</span>
                  <p className="font-mono text-sm font-bold text-slate-700">{selectedItem.id}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">التاريخ والوقت</span>
                  <p className="font-bold text-sm text-slate-700">{formatDateString(selectedItem.rawData?.createdAt || selectedItem.rawData?.date || selectedItem.rawData?.deletedAt || selectedItem.rawData?.joinedAt || selectedItem.rawData?.expiresAt, selectedItem.date, calendarType)}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">العنوان الأساسي</span>
                  <p className="font-bold text-base text-primary">{selectedItem.title}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">تفاصيل فرعية</span>
                  <p className="font-medium text-sm text-slate-600">{selectedItem.subtitle}</p>
                </div>
              </div>

              {selectedItem.rawData?.attachmentUrl || selectedItem.rawData?.attachmentBase64 ? (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    المرفقات وصورة المستند
                  </h4>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-50 flex items-center justify-center p-2 min-h-[300px]">
                      {(selectedItem.rawData?.attachmentUrl || selectedItem.rawData?.attachmentBase64).startsWith('data:image') || 
                       (selectedItem.rawData?.attachmentUrl || selectedItem.rawData?.attachmentBase64).startsWith('http') ? (
                        <img 
                          src={selectedItem.rawData?.attachmentUrl || selectedItem.rawData?.attachmentBase64} 
                          alt="مرفق الأرشيف" 
                          className="w-full max-h-[400px] object-contain rounded-xl" 
                        />
                      ) : (
                        <div className="p-8 text-center text-slate-500">
                          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="font-bold">مرفق غير مدعوم كصورة</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Vertical Actions Column */}
                    <div className="flex md:flex-col items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shrink-0">
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                              printWindow.document.write(`
                                <html dir="rtl">
                                  <head>
                                    <title>طباعة وثيقة الأرشيف</title>
                                    <style>
                                      body { font-family: system-ui, sans-serif; padding: 20px; line-height: 1.5; }
                                      h1 { color: #0f172a; margin-bottom: 5px; font-size: 24px; }
                                      .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
                                      .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                                      .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 12px; text-align: right; }
                                      .data-table th { background-color: #f8fafc; color: #475569; width: 30%; }
                                      .img-container { margin-top: 20px; text-align: center; }
                                      .img-container img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
                                    </style>
                                  </head>
                                  <body>
                                    <h1>وثيقة الأرشيف: ${selectedItem?.title || ''}</h1>
                                    <div class="meta">الرقم المرجعي: ${selectedItem?.id || ''} | التاريخ: ${formatDateString(selectedItem?.rawData?.createdAt || selectedItem?.rawData?.date || selectedItem?.rawData?.deletedAt || selectedItem?.rawData?.joinedAt || selectedItem?.rawData?.expiresAt, selectedItem?.date, calendarType)}</div>
                                    <table class="data-table">
                                      <tbody>
                                        ${selectedItem?.rawData ? Object.entries(selectedItem.rawData).map(([k, v]) => `
                                          <tr>
                                            <th>${k}</th>
                                            <td><pre style="margin:0; font-family:inherit; white-space:pre-wrap;">${typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)}</pre></td>
                                          </tr>
                                        `).join('') : ''}
                                      </tbody>
                                    </table>
                                    ${selectedItem?.rawData?.attachmentUrl || selectedItem?.rawData?.attachmentBase64 ? `
                                      <div class="img-container">
                                        <h3>المرفقات:</h3>
                                        <img src="${selectedItem.rawData.attachmentUrl || selectedItem.rawData.attachmentBase64}" />
                                      </div>
                                    ` : ''}
                                    <script>
                                      window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };
                                    </script>
                                  </body>
                                </html>
                              `);
                              printWindow.document.close();
                            }
                         }} 
                         className="w-10 h-10 rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm" 
                         title="طباعة"
                       >
                         <Printer className="w-5 h-5" />
                       </Button>
                       <div className="hidden md:block w-6 h-px bg-slate-200 mx-auto" />
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => handleCopy(selectedItem.rawData?.attachmentUrl || selectedItem.rawData?.attachmentBase64)} 
                         className="w-10 h-10 rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm" 
                         title="نسخ"
                       >
                         <Copy className="w-5 h-5" />
                       </Button>
                       <div className="hidden md:block w-6 h-px bg-slate-200 mx-auto" />
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         onClick={() => handleShare(selectedItem)} 
                         className="w-10 h-10 rounded-xl text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm" 
                         title="مشاركة"
                       >
                         <Share2 className="w-5 h-5" />
                       </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <ArchiveIcon className="w-4 h-4 text-primary" />
                  كل البيانات المسجلة بالنظام (Raw Data)
                </h4>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden text-sm">
                  <table className="w-full text-right w-full">
                    <tbody className="divide-y divide-slate-100">
                      {selectedItem.rawData && Object.entries(selectedItem.rawData).map(([key, value]) => (
                        <tr key={key} className="hover:bg-slate-50/50 transition-colors">
                          <th className="py-3 px-4 font-bold text-slate-600 bg-slate-50 w-1/3 border-l border-slate-100 align-top">
                            {key}
                          </th>
                          <td className="py-3 px-4 font-mono text-slate-700 break-all text-[13px]">
                            {typeof value === 'object' ? (
                               <pre className="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
                            ) : (
                               String(value)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button onClick={() => setIsDetailsOpen(false)} variant="default" className="w-full sm:w-auto h-11 rounded-xl">
              إغلاق الأرشيف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterButton({ active, onClick, label, icon: Icon }: any) {
  return (
    <Button
      onClick={onClick}
      variant={active ? "default" : "ghost"}
      className={`rounded-xl h-11 px-6 font-black gap-2 transition-all ${active ? 'bg-primary shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  );
}
