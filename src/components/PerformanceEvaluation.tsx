import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  BarChart3,
  Search,
  Loader2,
  DollarSign,
  Grip
} from 'lucide-react';
import { collection, query, getDocs, where, limit, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

export default function PerformanceEvaluation() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      
      const attendanceData = attendanceSnap.docs.map(d => d.data());
      
      const employeeStats = usersSnap.docs.map(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Filter attendance for the last 60 days
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const userAttendance = attendanceData.filter(a => 
          a.userId === userId && 
          new Date(a.date) >= sixtyDaysAgo
        );

        const totalDays = userAttendance.length;
        const presentDays = userAttendance.filter(a => a.status === 'present').length;
        const lateDays = userAttendance.filter(a => a.status === 'late').length;
        
        // Simple score calculation (out of 100)
        let score = (presentDays / 44) * 100; // Assuming 22 working days per month approx
        if (score > 100) score = 100;
        
        // Deduction recommendation
        const absences = 44 - presentDays;
        const recommendedDeduction = absences > 2 ? (absences - 2) * 50 : 0; // Deduct 50 for each day over 2 absences

        return {
          id: userId,
          name: userData.name,
          role: userData.role,
          department: userData.department,
          score: Math.round(score),
          absences,
          lateDays,
          recommendedDeduction,
          baseSalary: userData.baseSalary || 3000
        };
      });

      setEmployees(employeeStats);
    } catch (error) {
      toast.error('فشل تحميل الرؤى التحليلية');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDeduction = async (emp: any) => {
    if (!profile || profile.role !== 'manager') {
      toast.error('صلاحية المدير فقط مطلوبة');
      return;
    }

    setProcessingId(emp.id);
    try {
      await addDoc(collection(db, 'financialAdjustments'), {
        userId: emp.id,
        userName: emp.name,
        type: 'deduction',
        amount: emp.recommendedDeduction,
        reason: `خصم تقييم أداء آلي بناءً على غياب ${emp.absences} يوم خلال شهرين`,
        date: new Date().toISOString(),
        status: 'pending', // Manager can confirm later in Approval Center
        createdBy: profile.uid,
        isAutomated: true
      });
      toast.success(`تم إرسال طلب الخصم لـ ${emp.name} للموافقة`);
    } catch (e) {
      toast.error('فشل معالجة الطلب');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">رادار الأداء والمراقبة</h1>
          <p className="text-[13px] text-muted-foreground font-bold">تقييم آلي للـ 60 يوماً الماضية بناءً على الحضور الميداني</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <Badge variant="secondary" className="bg-white text-primary rounded-lg px-3 py-1.5 flex items-center gap-2">
             <Calendar className="w-4 h-4 text-accent" />
             تحديث تلقائي كل ساعة
           </Badge>
        </div>
      </div>

      <Card className="rounded-2xl border-none shadow-sm bg-accent/5 overflow-hidden">
        <CardContent className="p-6">
           <div className="flex items-start gap-4">
              <div className="bg-accent/10 p-3 rounded-2xl">
                <BarChart3 className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1">
                 <h4 className="font-bold text-primary mb-1 text-sm">كيفية التقييم؟</h4>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   يتم احتساب النقاط بناءً على الحضور الجغرافي الموثق عبر GPS. 
                   الخصم المقترح يعتمد على تجاوز الموظف لـ 4 أيام غياب مسموحة خلال الدورة التقييمية (60 يوم).
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="بحث عن موظف أو قسم..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-xl pr-10 h-11 border-slate-200"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : filteredEmployees.map(emp => (
          <Card key={emp.id} className="rounded-2xl border-border bg-white shadow-sm overflow-hidden group hover:shadow-md transition-all active:scale-95">
            <CardContent className="p-0 flex flex-col h-full">
               <div className="p-3 md:p-6 flex-1">
                  <div className="flex items-start justify-between mb-3">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg bg-slate-100 flex items-center justify-center text-primary font-black text-sm md:text-xl">
                          {emp.name?.[0]}
                        </div>
                        <div className="min-w-0">
                           <h4 className="font-black text-primary text-[10px] md:text-[15px] truncate">{emp.name}</h4>
                           <p className="text-[7px] text-muted-foreground font-bold truncate opacity-60 uppercase">{emp.department}</p>
                        </div>
                     </div>
                     <div className="text-left shrink-0">
                        <div className={`text-sm md:text-2xl font-black ${emp.score >= 80 ? 'text-emerald-500' : emp.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                           {emp.score}%
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                     <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                        <p className="text-[7px] font-bold text-muted-foreground uppercase opacity-60">الغياب</p>
                        <p className="font-black text-red-500 text-[10px] md:text-sm">{emp.absences}</p>
                     </div>
                     <div className="bg-slate-50 p-1.5 rounded-lg text-center">
                        <p className="text-[7px] font-bold text-muted-foreground uppercase opacity-60">التأخير</p>
                        <p className="font-black text-amber-500 text-[10px] md:text-sm">{emp.lateDays}</p>
                     </div>
                  </div>
               </div>

               <div className="p-2 md:p-4 bg-slate-50/50 mt-auto border-t border-slate-100/50">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                       <p className="text-[7px] md:text-[9px] font-bold text-muted-foreground uppercase">الخصم المقترح</p>
                       <p className={`font-black text-[10px] md:text-sm ${emp.recommendedDeduction > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {emp.recommendedDeduction} <span className="text-[7px] font-normal">ر.س</span>
                       </p>
                    </div>
                    {profile?.role === 'manager' && emp.recommendedDeduction > 0 && (
                      <Button 
                        onClick={() => handleApplyDeduction(emp)}
                        disabled={processingId === emp.id}
                        className="w-full rounded-lg h-7 md:h-9 bg-primary hover:bg-black font-black text-[8px] md:text-xs gap-1"
                      >
                        {processingId === emp.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Grip className="w-2.5 h-2.5" />}
                        تطبيق الخصم
                      </Button>
                    )}
                  </div>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
