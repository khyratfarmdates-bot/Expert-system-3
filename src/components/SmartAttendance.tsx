import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  CheckCircle2, 
  Loader2, 
  MapPinned, 
  Zap, 
  AlertCircle, 
  LogOut,
  Clock
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  serverTimestamp, 
  limit, 
  orderBy,
  updateDoc,
  doc
} from 'firebase/firestore';
import { sendNotification } from '@/lib/notifications';
import { useAuth } from '../lib/AuthContext';
import { toast } from 'sonner';

export default function SmartAttendance() {
  const { profile, user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [attendanceDocId, setAttendanceDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizedLocations, setAuthorizedLocations] = useState<any[]>([]);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [sysSettings, setSysSettings] = useState<any>({ 
    attendanceRadius: 100,
    workingHoursStart: '08:00',
    allowManualAttendance: false
  });

  useEffect(() => {
    if (!user || !profile) return;
    
    // 0. Reactive System Settings
    const unsubSettings = onSnapshot(doc(db, 'system', 'settings'), (snap) => {
      if (snap.exists()) {
        setSysSettings(snap.data());
      }
    }, (err) => console.error("SmartAttendance Settings Listen Error:", err));

    const today = new Date().toISOString().split('T')[0];
    
    // 1. Reactive current attendance
    const attQ = query(
      collection(db, 'attendance'), 
      where('userId', '==', user.uid), 
      where('date', '==', today),
      limit(1)
    );
    const unsubAtt = onSnapshot(attQ, (snap) => {
      if (!snap.empty) {
        setTodayStatus(snap.docs[0].data());
        setAttendanceDocId(snap.docs[0].id);
      } else {
        setTodayStatus(null);
        setAttendanceDocId(null);
      }
    }, (err) => console.error("SmartAttendance Stats Listen Error:", err));

    // 2. Fetch authorized locations based on profile
    const initLocations = async () => {
      const locations: any[] = [];
      const types = (profile as any).allowedLocationTypes || ['office'];

      // Fetch official offices/galleries
      const officeQ = query(collection(db, 'offices'));
      const officeSnap = await getDocs(officeQ);
      officeSnap.docs.forEach(d => {
        const data = d.data();
        if (types.includes(data.type)) {
          locations.push({
            name: data.name,
            lat: data.latitude,
            lng: data.longitude,
            type: data.type
          });
        }
      });

      // Fetch projects if authorized
      if (types.includes('project')) {
        const projQ = query(collection(db, 'projects'), where('status', '==', 'active'));
        const projSnap = await getDocs(projQ);
        projSnap.docs.forEach(d => {
          const data = d.data();
          if (data.latitude && data.longitude) {
            locations.push({
              name: `مشروع: ${data.title}`,
              lat: parseFloat(data.latitude),
              lng: parseFloat(data.longitude),
              type: 'project'
            });
          }
        });
      }

      setAuthorizedLocations(locations);
      setLoading(false);
      
      // Attempt Auto-Check-In if in range and not checked in yet
      if (!todayStatus?.checkIn && locations.length > 0) {
        attemptAutoCheckIn(locations);
      }
    };
    initLocations();

    return () => {
      unsubSettings();
      unsubAtt();
    };
  }, [user, profile]);

  const attemptAutoCheckIn = (locations: any[]) => {
    if (!navigator.geolocation) return;
    
    setIsAutoChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let closest = null;
        let minD = Infinity;

        locations.forEach(loc => {
          const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);
          if (dist < minD) {
            minD = dist;
            closest = loc;
          }
        });

        const radius = sysSettings.attendanceRadius || 100;
        if (closest && minD <= radius && !todayStatus?.checkIn) {
          // Automatic Check-In triggered by location proximity
          handleAction('checkIn', false, { latitude, longitude, closest, distance: minD });
        }
        setIsAutoChecking(false);
      },
      () => setIsAutoChecking(false),
      { enableHighAccuracy: true }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkIsLate = () => {
    if (!sysSettings.workingHoursStart) return false;
    const now = new Date();
    const [h, m] = (sysSettings.workingHoursStart || '08:00').split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    // 15 mins grace period
    start.setMinutes(start.getMinutes() + 15);
    return now > start;
  };

  const handleAction = (type: 'checkIn' | 'checkOut', isManual = false, autoData?: any) => {
    if (!navigator.geolocation && !autoData) {
      toast.error('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    if (autoData) {
      performAttendance(type, isManual, autoData.latitude, autoData.longitude, autoData.closest, autoData.distance);
      return;
    }

    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        let closestLocation = null;
        let minDistance = Infinity;

        authorizedLocations.forEach(loc => {
          const dist = calculateDistance(latitude, longitude, loc.lat, loc.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closestLocation = loc;
          }
        });

        const maxRadius = sysSettings.attendanceRadius || 100;
        const isFar = !closestLocation || minDistance > maxRadius;

        if (isFar && !isManual) {
          toast.error(`أنت بعيد عن جميع مواقع العمل المصرح لك بها (${Math.round(minDistance)} متر). المسموح: ${maxRadius}م`);
          setChecking(false);
          return;
        }

        if (isFar && isManual && !sysSettings.allowManualAttendance) {
          toast.error('الحضور اليدوي معطل حالياً من إعدادات النظام');
          setChecking(false);
          return;
        }

        await performAttendance(type, isManual, latitude, longitude, closestLocation, minDistance);
      },
      (error) => {
        toast.error('فشل الحصول على الموقع. يرجى تفعيل GPS.');
        setChecking(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const performAttendance = async (type: 'checkIn' | 'checkOut', isManual: boolean, lat: number, lng: number, loc: any, dist: number) => {
    try {
      const timestamp = new Date().toISOString();
      const locationLabel = loc?.name || 'موقع غير معروف (يدوي)';
      
      if (type === 'checkIn') {
        const status = checkIsLate() ? 'late' : 'present';
        await addDoc(collection(db, 'attendance'), {
          userId: user?.uid,
          userName: profile?.name,
          date: new Date().toISOString().split('T')[0],
          checkIn: timestamp,
          status: status,
          isManual: isManual,
          department: profile?.department,
          locationName: locationLabel,
          location: { lat, lng },
          distanceFromTarget: loc ? Math.round(dist) : -1
        });

        await sendNotification({
          title: status === 'late' ? 'حضور متأخر' : 'تسجيل حضور',
          message: `${profile?.name} سجل حضور في ${locationLabel} ${status === 'late' ? '(متأخر)' : ''}`,
          type: status === 'late' ? 'warning' : 'success',
          category: 'employee',
          targetRole: 'manager',
          tab: 'attendance_manager',
          priority: status === 'late' ? 'high' : 'medium'
        });

        toast.success(`تم تسجيل ${isManual ? 'الحضور اليدوي' : 'الحضور تلقائياً'} في: ${locationLabel}`);
      } else {
        if (!attendanceDocId) throw new Error('No doc id');
        await updateDoc(doc(db, 'attendance', attendanceDocId), {
          checkOut: timestamp,
          checkOutLocationName: locationLabel,
          checkOutLocation: { lat, lng },
          checkOutManual: isManual
        });
        toast.success('تم تسجيل الانصراف من: ' + locationLabel);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setChecking(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="rounded-2xl border-none bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mt-16 blur-2xl" />
      <CardContent className="p-4 md:p-6 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-xl">
               <Zap className="w-5 h-5 text-indigo-200" />
             </div>
             <div>
               <h3 className="font-black text-sm md:text-base">بوابة الحضور والانصراف</h3>
               <p className="text-[10px] md:text-xs opacity-70">التحقق الجغرافي (GPS) النشط • لا حاجة للتصوير</p>
             </div>
          </div>
          <div className="flex gap-2">
            {isAutoChecking && (
              <Badge className="bg-white/20 text-white border-none px-2 py-0.5 text-[8px] md:text-[10px] flex items-center gap-1 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                جاري التحقق التلقائي...
              </Badge>
            )}
            {todayStatus?.checkIn && (
              <Badge className="bg-emerald-400/20 text-emerald-200 border-none px-2 py-0.5 text-[8px] md:text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                حضور
              </Badge>
            )}
            {todayStatus?.checkOut && (
              <Badge className="bg-amber-400/20 text-amber-200 border-none px-2 py-0.5 text-[8px] md:text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                انصراف
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {!todayStatus?.checkIn ? (
              <Button 
                onClick={() => handleAction('checkIn')} 
                disabled={checking}
                className="w-full bg-white text-indigo-700 hover:bg-slate-50 font-black h-11 md:h-12 rounded-xl shadow-lg transition-all active:scale-95"
              >
                {checking ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <MapPin className="w-5 h-5 ml-2" />}
                تسجيل الحضور
              </Button>
            ) : (
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                   <p className="text-[10px] opacity-70 uppercase font-black">الحضور</p>
                   <div className="flex items-center gap-2">
                     <p className="font-black text-lg">{new Date(todayStatus.checkIn).toLocaleTimeString('ar-SA')}</p>
                     {todayStatus.status === 'late' && (
                       <Badge className="bg-rose-500 text-white border-none text-[8px] px-1">متأخر</Badge>
                     )}
                   </div>
                </div>
                <Clock className="w-5 h-5 opacity-30" />
              </div>
            )}

            {!todayStatus?.checkIn && sysSettings.allowManualAttendance && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleAction('checkIn', true)}
                className="text-[10px] opacity-60 hover:opacity-100 p-0 h-auto"
              >
                الموقع بعيد؟ تسجيل حضور يدوي (بإذن الإدارة)
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {todayStatus?.checkIn && !todayStatus?.checkOut ? (
              <Button 
                onClick={() => handleAction('checkOut')} 
                disabled={checking}
                variant="outline"
                className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 font-black h-11 md:h-12 rounded-xl transition-all active:scale-95"
              >
                {checking ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <LogOut className="w-5 h-5 ml-2" />}
                تسجيل الانصراف
              </Button>
            ) : todayStatus?.checkOut ? (
              <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                <div>
                   <p className="text-[10px] opacity-70 uppercase font-black">الانصراف</p>
                   <p className="font-black text-lg">{new Date(todayStatus.checkOut).toLocaleTimeString('ar-SA')}</p>
                </div>
                <LogOut className="w-5 h-5 opacity-30" />
              </div>
            ) : (
              <div className="h-11 md:h-12 flex items-center justify-center border border-dashed border-white/20 rounded-xl opacity-40 text-[10px] font-bold">
                 انتظر تسجيل الحضور أولاً
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
