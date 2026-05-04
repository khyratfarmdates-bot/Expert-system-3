import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Search, 
  ChevronLeft, 
  Clock, 
  Filter, 
  Download,
  AlertTriangle,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  where,
  limit,
  getDocs
} from 'firebase/firestore';
import { exportToCSV } from '../lib/export';
import { toast } from 'sonner';

export default function AttendanceManager() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'attendance'),
      where('date', '==', filterDate),
      orderBy('checkIn', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [filterDate]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const abnormal = filteredLogs.filter(log => (log.distanceFromTarget || 0) > 100).length;
    return { total, abnormal };
  }, [filteredLogs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary">رقابة الحضور والانصراف</h1>
          <p className="text-sm text-muted-foreground font-bold">متابعة دقيقة لمواقع وتواقيت تواجد الموظفين</p>
        </div>
        <div className="flex gap-2">
          <Input 
            type="date" 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="h-10 rounded-lg w-40 text-right font-bold"
          />
          <Button 
            variant="outline" 
            onClick={() => {
              const data = filteredLogs.map(l => ({
                'الموظف': l.userName,
                'التاريخ': l.date,
                'وقت الحضور': new Date(l.checkIn).toLocaleTimeString('ar-SA'),
                'وقت الانصراف': l.checkOut ? new Date(l.checkOut).toLocaleTimeString('ar-SA') : '-',
                'موقع الحضور': l.locationName,
                'المسافة عن الهدف (متر)': l.distanceFromTarget || 0
              }));
              exportToCSV(`سجل_الحضور_${filterDate}`, data);
              toast.success('تم تصدير التقرير بنجاح');
            }}
            className="rounded-lg gap-2 font-black h-10 shadow-sm border-slate-200"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-none shadow-sm bg-primary text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Users className="w-5 h-5 opacity-50" />
              <Badge className="bg-white/20 text-white border-none">اليوم</Badge>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest">إجمالي الحضور</p>
              <h3 className="text-3xl font-black">{stats.total} موظف</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-amber-50 text-amber-900 border border-amber-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <TrendingDown className="w-5 h-5 text-amber-500" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest text-amber-700">تجاوزات النطاق الجغرافي</p>
              <h3 className="text-3xl font-black">{stats.abnormal} حالة</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm bg-emerald-50 text-emerald-900 border border-emerald-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest text-emerald-700">الانضباط في المواقع</p>
              <h3 className="text-3xl font-black">
                {stats.total > 0 ? Math.round(((stats.total - stats.abnormal) / stats.total) * 100) : 0}%
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="ابحث عن موظف..." 
          className="pr-10 h-12 rounded-2xl bg-white border-none shadow-sm text-right"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">الموظف</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">الحضور</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">الانصراف</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">الموقع</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">الحالة الجغرافية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold">جاري تحميل البيانات...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold">لا توجد سجلات لهذا التاريخ</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-primary">
                           {log.userName?.[0]}
                         </div>
                         <div>
                           <p className="text-sm font-black text-primary">{log.userName}</p>
                           <p className="text-[10px] text-muted-foreground font-bold">{log.department || 'موظف'}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-sm font-black text-primary">{new Date(log.checkIn).toLocaleTimeString('ar-SA')}</p>
                    </td>
                    <td className="px-6 py-4">
                       {log.checkOut ? (
                         <p className="text-sm font-black text-primary">{new Date(log.checkOut).toLocaleTimeString('ar-SA')}</p>
                       ) : (
                         <Badge variant="outline" className="text-[10px] font-bold text-slate-300">لم ينصرف</Badge>
                       )}
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                         <MapPin className="w-3 h-3 text-slate-400" />
                         <span className="text-xs font-black text-slate-600">{log.locationName || 'موقع غير محدد'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       {log.distanceFromTarget > 100 ? (
                         <Badge variant="destructive" className="bg-red-50 text-red-600 border-none gap-1 font-black text-[10px]">
                           <AlertTriangle className="w-3 h-3" />
                           بعيد ({log.distanceFromTarget}م)
                         </Badge>
                       ) : (
                         <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none gap-1 font-black text-[10px]">
                           <CheckCircle2 className="w-3 h-3" />
                           داخل النطاق
                         </Badge>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
