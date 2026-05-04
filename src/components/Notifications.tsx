import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Clock,
  Filter,
  Trash2,
  Loader2,
  Wallet,
  Briefcase,
  Users,
  Package,
  ArrowRight,
  Eye,
  Check,
  X,
  Smartphone,
  ShieldAlert
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  where,
  deleteDoc,
  doc,
  writeBatch,
  getDocs,
  updateDoc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { markNotificationAsRead, AppNotification } from '../lib/notifications';
import { motion, AnimatePresence } from 'motion/react';

export default function Notifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [onlyUnread, setOnlyUnread] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(50));
    
    if (profile.role !== 'manager') {
      q = query(
        collection(db, 'notifications'), 
        where('targetRole', 'in', ['all', profile.role]),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timeStr: doc.data().timestamp?.toDate?.()?.toLocaleString('ar-SA') || 'منذ قليل'
      } as AppNotification & { timeStr: string }));

      setNotifications(docs);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [profile]);

  const filteredNotifications = notifications.filter(n => {
    const matchesFilter = filter === 'all' || n.category === filter || n.type === filter;
    const matchesUnread = onlyUnread ? !n.read : true;
    return matchesFilter && matchesUnread;
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('تم حذف الإشعار');
    } catch (error) {
      toast.error('فشل حذف الإشعار');
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile) return;
    try {
      const batch = writeBatch(db);
      const unreadDocs = notifications.filter(n => !n.read);
      unreadDocs.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      toast.success('تم تحديد الكل كمقروء');
    } catch (error) {
      toast.error('فشل في تحديث الحالات');
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.id) return;
    
    if (!notif.read) {
      try {
        await markNotificationAsRead(notif.id);
      } catch (error) {
        console.error("Error marking read:", error);
      }
    }
    
    if (notif.tab) {
      // Dispatch both the tab change and the specific entity if exists
      window.dispatchEvent(new CustomEvent('changeTab', { 
        detail: { 
          tab: notif.tab,
          projectId: notif.projectId,
          employeeId: notif.employeeId,
          id: notif.link // Generic ID field
        } 
      }));
      
      toast.success(`جاري الانتقال إلى: ${notif.title}`, {
        icon: <ArrowRight className="w-4 h-4" />,
        duration: 2000
      });
    }
  };

  const getIcon = (type: string, category: string) => {
    if (category === 'financial') return <Wallet className="w-5 h-5" />;
    if (category === 'project') return <Briefcase className="w-5 h-5" />;
    if (category === 'employee') return <Users className="w-5 h-5" />;
    if (category === 'inventory') return <Package className="w-5 h-5" />;
    
    switch (type) {
      case 'success': return <CheckCircle2 className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      case 'error': return <X className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'warning': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'error': return 'bg-red-50 text-red-600 border-red-100';
      case 'financial': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">مركز التنبيهات الذكي</h1>
          <p className="text-[13px] text-muted-foreground font-medium">متابعة كافة التحركات والطلبات بتفصيل دقيق</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs font-bold hover:bg-slate-50 gap-2"
            onClick={handleMarkAllRead}
          >
            <Check className="w-4 h-4" />
            تحديد الكل كمقروء
          </Button>
          <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden md:block" />
          <Button 
            variant={onlyUnread ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOnlyUnread(!onlyUnread)}
            className={`rounded-xl text-[11px] font-bold h-9 ${onlyUnread ? 'bg-primary text-white' : ''}`}
          >
            غير المقروءة فقط
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        <FilterButton active={filter === 'all'} label="الكل" onClick={() => setFilter('all')} icon={<Bell className="w-4 h-4" />} />
        <FilterButton active={filter === 'financial'} label="المالية" onClick={() => setFilter('financial')} icon={<Wallet className="w-4 h-4" />} />
        <FilterButton active={filter === 'project'} label="المشاريع" onClick={() => setFilter('project')} icon={<Briefcase className="w-4 h-4" />} />
        <FilterButton active={filter === 'employee'} label="الموظفين" onClick={() => setFilter('employee')} icon={<Users className="w-4 h-4" />} />
        <FilterButton active={filter === 'inventory'} label="المخزون" onClick={() => setFilter('inventory')} icon={<Package className="w-4 h-4" />} />
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-slate-500 font-bold">جاري تحديث الإشعارات...</p>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <AnimatePresence>
            {filteredNotifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={notif.tab ? 'cursor-pointer' : ''}
                onClick={() => notif.tab && handleNotificationClick(notif)}
              >
                <Card 
                  className={`group relative hover:shadow-xl transition-all duration-300 border shadow-sm rounded-2xl overflow-hidden ${
                    !notif.read ? 'border-r-4 border-r-primary bg-blue-50/10' : 'bg-white opacity-80'
                  } ${notif.tab ? 'hover:border-primary/40' : ''}`}
                >
                  <CardContent className="p-0">
                    <div className="p-5 flex items-start gap-4">
                      <div className={`shrink-0 p-3 rounded-2xl border ${getColor(notif.type)}`}>
                        {getIcon(notif.type, notif.category)}
                      </div>
                      
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className={`text-[15px] font-bold truncate ${notif.read ? 'text-slate-500' : 'text-primary'}`}>
                              {notif.title}
                            </h3>
                            {!notif.read && (
                              <div className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0 bg-slate-50 px-2 py-1 rounded-lg">
                            <Clock className="w-3 h-3" />
                            {notif.timeStr}
                          </span>
                        </div>
                        
                        <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                          {notif.message}
                        </p>

                        {/* Acknowledgment Section */}
                        {notif.requiresAcknowledge && (
                          <div className="mt-2 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                               <ShieldAlert className="w-3 h-3 text-red-500" />
                               <span className="text-[10px] font-black text-slate-400">تأكيد الاستلام:</span>
                               <div className="flex -space-x-1.5 overflow-hidden">
                                  {notif.acknowledgedBy && notif.acknowledgedBy.length > 0 ? (
                                    notif.acknowledgedBy.map((uid: string) => (
                                      <div key={uid} className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center" title="تم التأكيد">
                                        <Check className="w-3 h-3 text-white" />
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-[10px] font-bold text-red-400 px-2 italic">لم يتم التأكيد بعد</span>
                                  )}
                               </div>
                               {notif.acknowledgedBy && notif.acknowledgedBy.length > 0 && (
                                 <span className="text-[9px] font-bold text-emerald-600">تم الاستلام من قبل ({notif.acknowledgedBy.length})</span>
                               )}
                            </div>

                            {(!notif.acknowledgedBy || !notif.acknowledgedBy.includes(profile?.uid)) && (
                              <Button 
                                size="sm" 
                                className="h-7 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1 px-3 shadow-lg shadow-emerald-900/10"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await updateDoc(doc(db, 'notifications', notif.id), {
                                      acknowledgedBy: arrayUnion(profile?.uid),
                                      acknowledgedAt: serverTimestamp()
                                    });
                                    toast.success('تم تأكيد الاستلام');
                                  } catch (error) {
                                    toast.error('فشل في التأكيد');
                                  }
                                }}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                تأكيد استلام الرسالة
                              </Button>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <div className="flex gap-2">
                             <Badge variant="outline" className="text-[9px] font-black tracking-wider uppercase border-slate-200 bg-white">
                               {notif.category === 'financial' ? 'مالي' : 
                                notif.category === 'employee' ? 'شؤون موظفين' : 
                                notif.category === 'purchase' ? 'مشتريات' : 
                                notif.category === 'project' ? 'مشاريع' : 'نظام'}
                             </Badge>
                             {notif.priority === 'high' && (
                               <Badge className="bg-red-500 text-white border-none text-[9px] font-black">عاجل</Badge>
                             )}
                          </div>

                          <div className="flex gap-2 ml-auto">
                            {notif.tab && (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-8 px-3 rounded-lg text-xs font-bold gap-1 bg-primary/5 hover:bg-primary/10 text-primary"
                                onClick={() => handleNotificationClick(notif)}
                              >
                                {notif.type === 'approval' ? 'مراجعة الآن' : 'انتقال للتفاصيل'}
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            )}
                            
                            {!notif.read && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-emerald-500"
                                onClick={() => markNotificationAsRead(notif.id)}
                                title="تحديد كمقروء"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                            )}

                            {profile?.role === 'manager' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(notif.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-400">لا توجد إشعارات جديدة</h3>
            <p className="text-slate-400 font-medium px-6 mt-2 max-w-sm mx-auto">عندما يحدث أي تحرك جديد في النظام ستجده مسجلاً هنا بكل التفاصيل.</p>
            {filter !== 'all' && (
              <Button 
                variant="link" 
                onClick={() => setFilter('all')}
                className="mt-4 text-primary font-bold"
              >
                عرض كافة الإشعارات
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, label, onClick, icon }: { active: boolean, label: string, onClick: () => void, icon: React.ReactNode }) {
  return (
    <Button 
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className={`rounded-2xl px-5 h-11 gap-2 border-slate-100 transition-all shrink-0 ${
        active ? 'bg-primary text-white shadow-lg shadow-primary/20 ring-4 ring-primary/5' : 'bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span className={active ? 'text-white' : 'text-primary'}>{icon}</span>
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </Button>
  );
}
