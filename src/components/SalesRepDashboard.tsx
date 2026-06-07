import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Quotation, Transaction, BankAccount } from '../types';
import SmartOfferBot from './SmartOfferBot';
import { 
  Sparkles, 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Share2,
  FileDown,
  Eye,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Wallet,
  Briefcase,
  ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface SalesRepDashboardProps {
  subPage?: 'dashboard' | 'bot' | 'documents' | 'statement';
  onNavigate?: (tab: string) => void;
}

export default function SalesRepDashboard({ subPage = 'dashboard', onNavigate }: SalesRepDashboardProps) {
  const { profile } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [activePrivateJobsCount, setActivePrivateJobsCount] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState<Quotation | null>(null);
  const [docFilter, setDocFilter] = useState<'all' | 'quotation' | 'invoice'>('all');

  useEffect(() => {
    if (!profile) return;

    // Fetch quotations (unsorted query to avoid index requirements, sorted in memory)
    const unsubQuotes = onSnapshot(
      query(collection(db, 'quotations'), where('salesRepId', '==', profile.uid)),
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'quotation' } as Quotation));
        setQuotations(prev => {
          const rest = prev.filter(q => q.docType !== 'quotation');
          return [...items, ...rest].sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });
        });
      }
    );

    // Fetch invoices (unsorted query, sorted in memory)
    const unsubInvoices = onSnapshot(
      query(collection(db, 'invoices'), where('salesRepId', '==', profile.uid)),
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data(), docType: 'invoice' } as Quotation));
        setQuotations(prev => {
          const rest = prev.filter(q => q.docType !== 'invoice');
          return [...items, ...rest].sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });
        });
      }
    );

    // Fetch representative transactions/payouts (unsorted query, sorted in memory)
    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('salesRepId', '==', profile.uid)),
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        items.sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });
        setTransactions(items);
      }
    );

    // Fetch bank accounts for display name translation
    const unsubAccounts = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
    });

    // Fetch active private jobs count
    const unsubJobs = onSnapshot(
      query(collection(db, 'rep_private_jobs'), where('salesRepId', '==', profile.uid), where('status', '==', 'active')),
      (snap) => {
        setActivePrivateJobsCount(snap.docs.length);
      }
    );

    return () => { 
      unsubQuotes(); 
      unsubInvoices();
      unsubTx(); 
      unsubAccounts();
      unsubJobs();
    };
  }, [profile]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500 animate-pulse" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'معتمد';
      case 'rejected': return 'مرفوض';
      default: return 'جاري إنشاء (بانتظار الموافقة) ⏳';
    }
  };

  const handleShareWhatsApp = (q: Quotation) => {
    const label = q.docType === 'quotation' ? 'عرض السعر' : 'الفاتورة';
    const text = `السلام عليكم ورحمة الله وبركاته،\n\nأهلاً بك أخي الكريم.\n\nمرفق ${label} رقم *${q.docNumber || '—'}* بقيمة *${q.totalAmount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س* شاملاً ضريبة القيمة المضافة.${q.pdfUrl ? `\n\nيمكنك الاطلاع عليه من الرابط:\n${q.pdfUrl}` : ''}\n\nشكراً لتعاملكم معنا.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Filtered list
  const filteredDocs = quotations.filter(q => {
    if (docFilter === 'all') return true;
    return q.docType === docFilter;
  });

  // Financial calculations
  const approvedDocs = quotations.filter(q => q.status === 'approved');
  const totalSales = approvedDocs.reduce((s, q) => s + (q.totalAmount || 0), 0);
  
  const repShare = totalSales * 0.85; // 85% of sales
  const companyShare = totalSales * 0.15; // 15% of sales
  
  const approvedPayouts = transactions.filter(t => t.type === 'expense' && t.status === 'approved');
  const totalPaid = approvedPayouts.reduce((sum, t) => sum + (t.amount || 0), 0);

  const remainingBalance = repShare - totalPaid;

  const getAccountName = (accountId?: string) => {
    if (!accountId) return '—';
    const acc = bankAccounts.find(b => b.id === accountId);
    return acc ? acc.name : '—';
  };

  return (
    <div className="p-4 md:p-6 w-full space-y-6" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* Top Navigation / Breadcrumb for Sub-pages */}
      {subPage !== 'dashboard' && (
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate?.('rep_dashboard')}
            className="gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold hover:bg-slate-100 rounded-xl px-3 h-9"
          >
            <ArrowRight className="w-4 h-4" /> العودة للوحة التحكم
          </Button>
          <span className="text-xs text-slate-400 font-bold">
            بوابة المندوب / {
              subPage === 'bot' ? 'المساعد الذكي (ألف ياء)' :
              subPage === 'documents' ? 'وثائقي الصادرة' : 'كشف حسابي الرسمي'
            }
          </span>
        </div>
      )}

      {/* === DASHBOARD HOME VIEW === */}
      {subPage === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-primary/80 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,255,255,0.1),rgba(255,255,255,0))] pointer-events-none" />
            <div className="relative z-10 space-y-1">
              <h1 className="text-xl md:text-2xl font-black">أهلاً بك، المندوب {profile?.name} 👋</h1>
              <p className="text-slate-300 text-xs max-w-xl">
                مرحباً بك في بوابتك الذكية لإصدار الفواتير وعروض الأسعار التلقائية، ومتابعة كشوف حساباتك التشغيلية والمستقلة.
              </p>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Approved Sales Card */}
            <Card 
              onClick={() => onNavigate?.('rep_documents')}
              className="border-none shadow-md rounded-[1.5rem] bg-slate-900 text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
            >
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400">إجمالي المبيعات المعتمدة</p>
                  <h3 className="text-xl font-black">{totalSales.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></h3>
                  <p className="text-[9px] text-slate-400">اضغط لعرض الوثائق الصادرة</p>
                </div>
                <div className="bg-white/10 p-2.5 rounded-2xl group-hover:scale-110 transition-all">
                  <FileSpreadsheet className="w-5 h-5 text-slate-300" />
                </div>
              </CardContent>
            </Card>

            {/* Net Balance Card */}
            <Card 
              onClick={() => onNavigate?.('rep_statement')}
              className="border-none shadow-md rounded-[1.5rem] bg-gradient-to-br from-primary to-blue-700 text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
            >
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-blue-100">رصيدي المتبقي (المستحق)</p>
                  <h3 className="text-xl font-black">{remainingBalance.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></h3>
                  <p className="text-[9px] text-blue-200">اضغط لمشاهدة كشف الحساب</p>
                </div>
                <div className="bg-white/15 p-2.5 rounded-2xl group-hover:scale-110 transition-all">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
              </CardContent>
            </Card>

            {/* Active Private Jobs Card */}
            <Card 
              onClick={() => onNavigate?.('private_jobs_page')}
              className="border-none shadow-md rounded-[1.5rem] bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group"
            >
              <CardContent className="p-5 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-amber-950">المقاولات الخاصة النشطة</p>
                  <h3 className="text-xl font-black">{activePrivateJobsCount} <span className="text-xs font-normal">مشاريع</span></h3>
                  <p className="text-[9px] text-amber-950/70">اضغط لإدارة العقود المستقلة</p>
                </div>
                <div className="bg-slate-950/10 p-2.5 rounded-2xl group-hover:scale-110 transition-all">
                  <Briefcase className="w-5 h-5 text-slate-950" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Organized Quick Actions Hub */}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-800">إجراءات الوصول السريع</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              <Card className="border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-shadow bg-white flex flex-col justify-between p-4">
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-2">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-slate-800">المساعد الذكي (ألف ياء)</h3>
                  <p className="text-[10px] text-slate-400 leading-normal">أنشئ عروض أسعار وفواتير ذكية لعملائك عبر الحوار المباشر وبثوانٍ معدودة.</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onNavigate?.('rep_smart_bot')}
                  className="w-full mt-3 h-8 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-[10px] shadow-none"
                >
                  فتح المساعد
                </Button>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-shadow bg-white flex flex-col justify-between p-4">
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-2">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-slate-800">سجل وثائقي الصادرة</h3>
                  <p className="text-[10px] text-slate-400 leading-normal">تصفح الفواتير والعروض التي أنشأتها، وتابع حالة اعتمادها من الإدارة.</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onNavigate?.('rep_documents')}
                  className="w-full mt-3 h-8 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-xl text-[10px] shadow-none"
                >
                  استعراض الوثائق
                </Button>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-shadow bg-white flex flex-col justify-between p-4">
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-slate-800">كشف حسابي الرسمي</h3>
                  <p className="text-[10px] text-slate-400 leading-normal">تابع حركات الدفعات المستلمة من المؤسسة ومستحقاتك وتفاصيل عمولاتك.</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onNavigate?.('rep_statement')}
                  className="w-full mt-3 h-8 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-[10px] shadow-none"
                >
                  عرض كشف الحساب
                </Button>
              </Card>

              <Card className="border border-slate-100 shadow-sm rounded-2xl hover:shadow-md transition-shadow bg-white flex flex-col justify-between p-4">
                <div className="space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-slate-800">المقاولات الخاصة</h3>
                  <p className="text-[10px] text-slate-400 leading-normal">إدارة العقود المستقلة، مقبوضات العملاء، المصاريف وعمال اليومية للمشاريع.</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onNavigate?.('private_jobs_page')}
                  className="w-full mt-3 h-8 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-xl text-[10px] shadow-none"
                >
                  فتح مساحة العمل
                </Button>
              </Card>

            </div>
          </div>

          {/* Recent Activity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Recent Documents Column */}
            <Card className="border-none shadow-md rounded-[1.5rem] bg-white">
              <CardHeader className="pb-2 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" /> أحدث الوثائق الصادرة
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onNavigate?.('rep_documents')}
                  className="text-[10px] text-primary font-bold h-7 hover:bg-slate-50 rounded-lg"
                >
                  عرض الكل
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {quotations.length === 0 ? (
                  <p className="text-center py-6 text-[11px] text-slate-400">لا توجد وثائق صادرة حالياً</p>
                ) : (
                  <div className="space-y-2.5">
                    {quotations.slice(0, 3).map(q => (
                      <div key={q.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-[11px] font-bold border border-slate-100">
                        <div>
                          <span className="text-slate-800 block">{q.clientName}</span>
                          <span className="text-[9px] text-slate-400 font-normal">{q.docType === 'invoice' ? 'فاتورة' : 'عرض سعر'} {q.docNumber ? `#${q.docNumber}` : ''}</span>
                        </div>
                        <div className="text-left">
                          <span className="text-primary block">{q.totalAmount?.toLocaleString('ar-SA')} ر.س</span>
                          <span className={`text-[8px] ${q.status === 'approved' ? 'text-green-600' : q.status === 'rejected' ? 'text-red-500' : 'text-amber-500 animate-pulse'}`}>{getStatusText(q.status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Transactions Column */}
            <Card className="border-none shadow-md rounded-[1.5rem] bg-white">
              <CardHeader className="pb-2 border-b border-slate-50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-blue-600" /> أحدث الحركات المالية
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onNavigate?.('rep_statement')}
                  className="text-[10px] text-primary font-bold h-7 hover:bg-slate-50 rounded-lg"
                >
                  عرض الكل
                </Button>
              </CardHeader>
              <CardContent className="p-4">
                {transactions.length === 0 ? (
                  <p className="text-center py-6 text-[11px] text-slate-400">لا توجد حركات مالية مسجلة</p>
                ) : (
                  <div className="space-y-2.5">
                    {transactions.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-[11px] font-bold border border-slate-100">
                        <div>
                          <span className="text-slate-800 block">{t.category || 'دفعة مالية'}</span>
                          <span className="text-[9px] text-slate-400 font-normal">{t.description}</span>
                        </div>
                        <div className="text-left">
                          <span className={`block ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {t.type === 'income' ? '+' : '-'}{t.amount?.toLocaleString('ar-SA')} ر.س
                          </span>
                          <span className="text-[8px] text-slate-400 font-normal">{t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleDateString('ar-SA') : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

        </div>
      )}

      {/* Financial Summary Cards (Show ONLY on Statement and Documents Pages) */}
      {(subPage === 'statement' || subPage === 'documents') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
          {/* Total Sales Card */}
          <Card className="relative overflow-hidden border-none shadow-md rounded-3xl bg-slate-900 text-white">
            <CardContent className="p-5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400">إجمالي المبيعات المعتمدة</p>
                <h3 className="text-xl font-black">{totalSales.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></h3>
                <p className="text-[9px] text-slate-400">الفواتير والعروض المعتمدة</p>
              </div>
              <div className="bg-white/10 p-2.5 rounded-2xl">
                <FileSpreadsheet className="w-5 h-5 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          {/* Rep Share Card (له) */}
          <Card className="relative overflow-hidden border-none shadow-md rounded-3xl bg-emerald-600 text-white">
            <CardContent className="p-5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-100">مستحقاتي له (85%)</p>
                <h3 className="text-xl font-black">{repShare.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></h3>
                <p className="text-[9px] text-emerald-200">خصم 15% عمولة تشغيلية للمؤسسة</p>
              </div>
              <div className="bg-white/15 p-2.5 rounded-2xl">
                <ArrowUpRight className="w-5 h-5 text-white" />
              </div>
            </CardContent>
          </Card>

          {/* Paid Card (عليه) */}
          <Card className="relative overflow-hidden border-none shadow-md rounded-3xl bg-amber-500 text-white">
            <CardContent className="p-5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-100">المدفوع لي عليه</p>
                <h3 className="text-xl font-black">{totalPaid.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></h3>
                <p className="text-[9px] text-amber-200">إجمالي الدفعات المستلمة</p>
              </div>
              <div className="bg-white/15 p-2.5 rounded-2xl">
                <ArrowDownLeft className="w-5 h-5 text-white" />
              </div>
            </CardContent>
          </Card>

          {/* Net Remaining Balance Card */}
          <Card className="relative overflow-hidden border-none shadow-md rounded-3xl bg-gradient-to-br from-primary to-blue-700 text-white">
            <CardContent className="p-5 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-blue-100">الرصيد المتبقي (صافي المستحق)</p>
                <h3 className="text-xl font-black">{remainingBalance.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span></h3>
                <p className="text-[9px] text-blue-200">مستحق للمندوب للدفع الفوري</p>
              </div>
              <div className="bg-white/15 p-2.5 rounded-2xl">
                <Wallet className="w-5 h-5 text-white" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pages Content Switcher */}
      <div className="w-full">
        {/* === AI Smart Bot Tab === */}
        {subPage === 'bot' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <SmartOfferBot />
          </div>
        )}

        {/* === Past Documents Tab === */}
        {subPage === 'documents' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Card className="border-none shadow-md rounded-[2rem] bg-white">
              <CardHeader className="pb-3 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                  سجل الوثائق الصادرة من خلالي
                </CardTitle>
                <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDocFilter('all')}
                    className={`rounded-lg px-3 py-1 text-xs font-bold ${docFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    الكل ({quotations.length})
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDocFilter('quotation')}
                    className={`rounded-lg px-3 py-1 text-xs font-bold ${docFilter === 'quotation' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    عروض أسعار ({quotations.filter(q => q.docType === 'quotation').length})
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setDocFilter('invoice')}
                    className={`rounded-lg px-3 py-1 text-xs font-bold ${docFilter === 'invoice' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    فواتير ({quotations.filter(q => q.docType === 'invoice').length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {filteredDocs.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="font-bold text-sm">لا توجد وثائق مطابقة للفلاتر الحالية</p>
                    <p className="text-xs mt-1 text-slate-400">استخدم المساعد الذكي لإنشاء وثائقك في ألف ياء</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDocs.map(q => (
                      <div key={q.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition-all gap-4">
                        
                        {/* Doc Details Column */}
                        <div className="flex-1 min-w-0 flex items-start gap-3">
                          <div className="mt-1">
                            {q.docType === 'invoice' ? (
                              <Badge className="bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-50 shadow-none font-bold text-[10px]">فاتورة</Badge>
                            ) : (
                              <Badge className="bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-50 shadow-none font-bold text-[10px]">عرض سعر</Badge>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-800 text-sm truncate">{q.clientName}</h4>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {q.docNumber ? `#${q.docNumber}` : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate max-w-xs md:max-w-md mt-0.5">{q.items}</p>
                          </div>
                        </div>

                        {/* Financial info */}
                        <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                          <div className="text-right md:text-left shrink-0">
                            <p className="font-black text-primary text-sm">{q.totalAmount?.toLocaleString('ar-SA')} ر.س</p>
                            <div className="flex items-center gap-1 mt-0.5 justify-end">
                              {getStatusIcon(q.status)}
                              <span className="text-[10px] font-bold text-slate-500">{getStatusText(q.status)}</span>
                            </div>
                          </div>

                          {/* Interactive Buttons */}
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => setSelectedDoc(q)}
                              className="w-8 h-8 rounded-lg hover:text-primary hover:border-primary/30"
                              title="تفاصيل البنود"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {q.pdfUrl && (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => window.open(q.pdfUrl, '_blank')}
                                  className="w-8 h-8 rounded-lg hover:text-teal-600 hover:border-teal-300"
                                  title="تحميل PDF"
                                >
                                  <FileDown className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  onClick={() => handleShareWhatsApp(q)}
                                  className="w-8 h-8 rounded-lg hover:text-green-600 hover:border-green-300"
                                  title="مشاركة عبر واتساب"
                                >
                                  <Share2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* === Account Statement Tab === */}
        {subPage === 'statement' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <Card className="border-none shadow-md rounded-[2rem] bg-white">
              <CardHeader>
                <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  كشف الحساب المالي (الحركات المدفوعة له وعليه)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {transactions.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="font-bold text-sm">لا توجد حركات مالية مسجلة في كشف حسابك بعد</p>
                    <p className="text-xs mt-1 text-slate-400">عند قيام الإدارة بتحويل دفعات مالية لك، ستظهر تفاصيلها هنا فوراً</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                          <th className="p-3.5">البيان والتفاصيل</th>
                          <th className="p-3.5">طريقة الدفع</th>
                          <th className="p-3.5">الحساب الصادر</th>
                          <th className="p-3.5 text-center">التاريخ</th>
                          <th className="p-3.5 text-left">المبلغ</th>
                          <th className="p-3.5 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3.5">
                              <p className="font-black text-slate-800">{tx.category || 'دفعة مالية'}</p>
                              <p className="text-[10px] text-slate-400 font-normal mt-0.5">{tx.description}</p>
                            </td>
                            <td className="p-3.5 text-slate-600">
                              {tx.paymentMethod === 'transfer' ? 'تحويل بنكي' : 'نقداً'}
                            </td>
                            <td className="p-3.5 text-slate-600">
                              {getAccountName(tx.bankAccountId)}
                            </td>
                            <td className="p-3.5 text-center text-slate-500">
                              {tx.date?.seconds 
                                ? new Date(tx.date.seconds * 1000).toLocaleDateString('ar-SA')
                                : '—'
                              }
                            </td>
                            <td className={`p-3.5 text-left font-black ${tx.type === 'income' ? 'text-green-600' : 'text-rose-600'}`}>
                              {tx.type === 'income' ? '+' : '-'}{(tx.amount || 0).toLocaleString('ar-SA')} ر.س
                            </td>
                            <td className="p-3.5 text-center">
                              <Badge className={`border-none shadow-none font-bold text-[9px] ${
                                tx.status === 'approved' 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : tx.status === 'rejected' 
                                  ? 'bg-rose-50 text-rose-700' 
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {getStatusText(tx.status || 'approved')}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Document Details Modal */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="sm:max-w-3xl w-full rounded-[2rem] p-6 text-right" dir="rtl">
          <DialogHeader className="border-b pb-3 mb-4">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تفاصيل {selectedDoc?.docType === 'invoice' ? 'الفاتورة' : 'عرض السعر'}
            </DialogTitle>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4 font-bold text-xs" style={{ fontFamily: "'Cairo', sans-serif" }}>
              
              {/* Document Meta info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">العميل</span>
                  <span className="text-slate-800 font-black">{selectedDoc.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">رقم المستند في ألف ياء</span>
                  <span className="text-slate-800 font-black">{selectedDoc.docNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">المبلغ الإجمالي</span>
                  <span className="text-primary font-black text-sm">{selectedDoc.totalAmount?.toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block mb-0.5">الحالة</span>
                  <span className="inline-flex items-center gap-1 mt-0.5">
                    {getStatusIcon(selectedDoc.status)}
                    <span className="text-[10px] text-slate-600">{getStatusText(selectedDoc.status)}</span>
                  </span>
                </div>
              </div>

              {/* Items details */}
              <div className="space-y-2">
                <span className="text-slate-800 font-black block">تفاصيل البنود</span>
                {selectedDoc.itemsDetail && selectedDoc.itemsDetail.length > 0 ? (
                  <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-[10px]">
                          <th className="p-3">البند</th>
                          <th className="p-3 text-center">الكمية</th>
                          <th className="p-3 text-left">السعر</th>
                          <th className="p-3 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoc.itemsDetail.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-3">
                              <p className="font-black text-slate-800">{item.name}</p>
                              {item.desc && <p className="text-[10px] text-slate-400 font-normal mt-0.5">{item.desc}</p>}
                            </td>
                            <td className="p-3 text-center text-slate-600">{item.qty}</td>
                            <td className="p-3 text-left text-slate-600">{(item.price || 0).toLocaleString('ar-SA')} ر.س</td>
                            <td className="p-3 text-left text-primary font-black">{((item.qty || 1) * (item.price || 0)).toLocaleString('ar-SA')} ر.س</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-slate-600 text-xs font-normal mb-1">تم إنشاء هذا المستند بنص إجمالي:</p>
                    <p className="text-slate-800 font-bold">{selectedDoc.items}</p>
                  </div>
                )}
              </div>

              {/* Dialog Actions */}
              <div className="flex gap-2 pt-2">
                {selectedDoc.pdfUrl && (
                  <>
                    <Button 
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-11 font-black gap-2"
                      onClick={() => window.open(selectedDoc.pdfUrl, '_blank')}
                    >
                      <FileDown className="w-4 h-4" /> تحميل نسخة PDF
                    </Button>
                    <Button 
                      variant="outline"
                      className="rounded-xl h-11 border-green-200 text-green-700 hover:bg-green-50 font-black gap-2 px-4"
                      onClick={() => handleShareWhatsApp(selectedDoc)}
                    >
                      <Share2 className="w-4 h-4" /> مشاركة واتساب
                    </Button>
                  </>
                )}
                <Button 
                  variant="ghost" 
                  className="rounded-xl h-11 px-4 text-slate-500 font-bold"
                  onClick={() => setSelectedDoc(null)}
                >
                  إغلاق
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
