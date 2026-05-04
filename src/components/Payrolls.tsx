import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Download, FileText, CheckCircle2, Eye, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { exportToCSV } from '../lib/export';
import { exportToPDF } from '../lib/pdfExport';
import PrintableReport from './PrintableReport';
import { toast } from 'sonner';

export default function Payrolls() {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalBase: 0,
    totalBonus: 0,
    totalDeductions: 0,
    totalNet: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch all users
        const usersSnap = await getDocs(collection(db, 'users'));
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Fetch all financial adjustments for active month
        // (Only include approved or applied)
        const adjSnap = await getDocs(query(collection(db, 'financialAdjustments'), where('status', 'in', ['approved', 'applied', 'applied_manually'])));
        const adjustments = adjSnap.docs.map(doc => doc.data());

        const consolidatedPayrolls = users.map((user: any) => {
          const userAdj = adjustments.filter(a => a.workerId === (user.uid || user.id));
          const base = user.salary || 5000; // default if not set
          const bonus = userAdj.filter(a => a.type === 'bonus').reduce((acc, curr) => acc + curr.amount, 0);
          const deductions = userAdj.filter(a => ['deduction', 'advance'].includes(a.type)).reduce((acc, curr) => acc + curr.amount, 0);
          const net = base + bonus - deductions;

          return {
            id: user.id || user.uid, // Ensure unique ID
            name: user.name,
            base,
            bonus,
            deductions,
            total: net,
            status: 'pending',
            month: 'أبريل 2024'
          };
        });

        setPayrolls(consolidatedPayrolls);
        
        setStats({
          totalBase: consolidatedPayrolls.reduce((a, b) => a + b.base, 0),
          totalBonus: consolidatedPayrolls.reduce((a, b) => a + b.bonus, 0),
          totalDeductions: consolidatedPayrolls.reduce((a, b) => a + b.deductions, 0),
          totalNet: consolidatedPayrolls.reduce((a, b) => a + b.total, 0)
        });

      } catch (error) {
        console.error("Payroll Data Fetch Error:", error);
        toast.error("فشل في تحميل بيانات الرواتب");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleApproveAll = () => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 2000)), {
      loading: 'جاري اعتماد جميع الرواتب للشهر الحالي...',
      success: 'تم اعتماد كشف الرواتب بنجاح وجاري التحويل',
      error: 'حدث خطأ أثناء الاعتماد',
    });
  };

  const handleDownloadDraft = () => {
    const exportData = payrolls.map(p => ({
      'الموظف': p.name,
      'الشهر': p.month,
      'الراتب الأساسي': p.base,
      'الحوافز': p.bonus,
      'الخصومات': p.tax,
      'الصافي': p.total,
      'الحالة': p.status === 'paid' ? 'تم الدفع' : 'بانتظار الصرف'
    }));

    exportToCSV('كشف_رواتب_أبريل_2024', exportData);
    toast.success('تم تصدير كشف الرواتب بنجاح');
  };

  const handlePDFExport = async () => {
    setIsExportingPDF(true);
    toast.loading('جاري تجهيز مسودة الرواتب (PDF)...');
    
    setTimeout(async () => {
      try {
        await exportToPDF('payroll-report-pdf', 'كشف_رواتب_أبريل_2024');
        toast.dismiss();
        toast.success('تم تحميل الكشف بنجاح');
      } catch (error) {
        toast.dismiss();
        toast.error('فشل في تصدير التقرير');
      } finally {
        setIsExportingPDF(false);
      }
    }, 500);
  };

  const handleViewPayslip = (name: string) => {
    toast.info(`تحميل مفردات مرتب الموظف: ${name}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">إدارة الرواتب</h1>
          <p className="text-[13px] text-muted-foreground">متابعة المستحقات الشهرية والمدفوعات</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleApproveAll}
            className="rounded-lg bg-primary hover:bg-black gap-2 font-bold px-6 h-10 shadow-sm transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            اعتماد الكل
          </Button>

          <Button 
            variant="outline"
            onClick={handlePDFExport}
            className="rounded-lg gap-2 font-bold px-4 h-10 border-slate-200 bg-white shadow-sm transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            تحميل الكشف (PDF)
          </Button>

          <Button 
            variant="ghost"
            onClick={handleDownloadDraft}
            className="rounded-lg gap-2 font-bold px-4 h-10 text-slate-400 hover:text-slate-600 transition-all active:scale-95"
          >
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <PayrollStat title="إجمالي الرواتب الأساسية" value={stats.totalBase} />
        <PayrollStat title="الحوافز (هذا الشهر)" value={stats.totalBonus} />
        <PayrollStat title="صافي المستحقات" value={stats.totalNet} />
      </div>

      <Card className="rounded-xl border-border bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-[15px] font-bold text-primary">كشف الرواتب الذكي - شهر أبريل 2024</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-100 font-bold">حسابات تلقائية</Badge>
            <Button 
              onClick={handleDownloadDraft}
              size="sm" 
              variant="outline" 
              className="rounded-lg border-slate-200 text-muted-foreground hover:bg-slate-50 shadow-none h-9"
            >
              <Download className="w-4 h-4 ml-2" />
              تحميل الكشف
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {loading ? (
             <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground">جاري تجميع البيانات المالية للموظفين...</p>
             </div>
          ) : (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b-0">
                <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">اسم الموظف</TableHead>
                <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الراتب الأساسي</TableHead>
                <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الحوافز</TableHead>
                <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الخصومات</TableHead>
                <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الصافي</TableHead>
                <TableHead className="text-right py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الحالة</TableHead>
                <TableHead className="text-center py-3 px-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrolls.map((p) => (
                <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 text-right">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 shadow-inner">
                        {p.name[0]}
                      </div>
                      <span className="text-[13px] font-bold text-primary">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-[13px] font-medium text-slate-600">{p.base.toLocaleString()} ر.س</TableCell>
                  <TableCell className="px-6 py-4 text-[13px] font-bold text-emerald-600">+{p.bonus}</TableCell>
                  <TableCell className="px-6 py-4 text-[13px] font-bold text-red-500">-{p.deductions}</TableCell>
                  <TableCell className="px-6 py-4 text-[13px] font-black text-primary">{p.total.toLocaleString()} ر.س</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge className={`rounded px-2.5 py-0.5 text-[10px] font-bold border-none shadow-none ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.status === 'paid' ? 'تم التحويل' : 'بانتظار التحويل'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <Button 
                      onClick={() => handleViewPayslip(p.name)}
                      variant="ghost" 
                      size="icon" 
                      className="text-accent hover:bg-accent/10 rounded-lg h-8 w-8 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {isExportingPDF && (
        <PrintableReport 
          id="payroll-report-pdf"
          title="كشف مسودة الرواتب"
          subtitle={`رواتب الموظفين لشهر أبريل 2024 - مؤسسة خبراء الرسم`}
          headers={['الموظف', 'الراتب الأساسي', 'الحوافز', 'الخصومات', 'الصافي', 'الحالة']}
          data={payrolls.map(p => [
            p.name,
            p.base.toLocaleString(),
            p.bonus.toLocaleString(),
            p.deductions.toLocaleString(),
            p.total.toLocaleString(),
            p.status === 'paid' ? 'تم الدفع' : 'بانتظار الصرف'
          ])}
          summary={[
            { label: 'عدد الموظفين', value: payrolls.length.toString() },
            { 
              label: 'إجمالي الرواتب', 
              value: payrolls.reduce((acc, curr) => acc + curr.total, 0).toLocaleString() + ' ر.س' 
            },
            { label: 'الحالة العامة', value: 'بانتظار التحويل' }
          ]}
        />
      )}
    </div>
  );
}

function PayrollStat({ title, value }: { title: string; value: number }) {
  return (
    <Card className="rounded-xl border-border bg-white shadow-sm p-5">
      <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-1 opacity-70">{title}</p>
      <h3 className="text-2xl font-black text-primary">
        {value.toLocaleString()} <span className="text-sm font-normal text-muted-foreground mr-1">ر.س</span>
      </h3>
    </Card>
  );
}

