import React, { useEffect, useRef, useState } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit, 
  where,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import { Button } from './ui/button';
import { BellRing, ShieldAlert, CheckCircle2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GlobalNotificationListener() {
  const { profile } = useAuth();
  const lastCheckedId = useRef<string | null>(null);
  
  // State for the "Loud/Critical" overlay
  const [criticalNotif, setCriticalNotif] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const playNotificationSound = (priority: string = 'high') => {
    try {
      // Different sounds based on priority
      const soundUrl = priority === 'critical' 
        ? 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3' // Siren/Alarm
        : 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'; // Standard bell
        
      const audio = new Audio(soundUrl);
      audio.volume = priority === 'critical' ? 0.8 : 0.6;
      audio.play().catch(e => {
        console.log("Sound play blocked. Prompting user interaction.");
        toast.info("تم استقبال إشعار جديد - يرجى الضغط للسماح بالتنبيهات الصوتية", {
          action: {
            label: "تفعيل الصوت",
            onClick: () => audio.play()
          }
        });
      });
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  useEffect(() => {
    if (!profile) return;

    // Request Browser Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const handleLocalHighPriority = (e: any) => {
      playNotificationSound();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(e.detail.title, { body: e.detail.message });
      }
    };

    window.addEventListener('newHighPriorityNotification', handleLocalHighPriority);

    // Listen for all notifications to play sound for new ones
    const q = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    let isInitialSnapshot = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        // Check for unresolved critical notifications on load though
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const id = docSnap.id;
          const isTargeted = data.targetRole === 'all' || data.targetRole === profile.role || data.workerId === profile.uid || data.userId === profile.uid;
          if (isTargeted && ['high', 'critical'].includes(data.priority) && data.requiresAcknowledge && (!data.acknowledgedBy || !data.acknowledgedBy.includes(profile.uid))) {
             setCriticalNotif({ id, ...data });
             setIsModalOpen(true);
          }
        });
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const id = change.doc.id;
          
          // Check if it targets this user
          const isTargeted = data.targetRole === 'all' || data.targetRole === profile.role || data.workerId === profile.uid || data.userId === profile.uid;
          
          if (isTargeted) {
             if (id !== lastCheckedId.current) {
                lastCheckedId.current = id;
                
                // Play sound for all new targeted notifications
                playNotificationSound(data.priority || 'normal');

                // Show Modal if requires acknowledgment
                if (data.requiresAcknowledge && (!data.acknowledgedBy || !data.acknowledgedBy.includes(profile.uid))) {
                  setCriticalNotif({ id, ...data });
                  setIsModalOpen(true);
                }

                // Show browser notification
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification(data.title || 'إشعار جديد', { body: data.message });
                }
             }
          }
        }
      });
    });

    return () => {
      unsubscribe();
      window.removeEventListener('newHighPriorityNotification', handleLocalHighPriority);
    };
  }, [profile]);

  const handleAcknowledge = async () => {
    if (!criticalNotif || !profile) return;
    try {
      await updateDoc(doc(db, 'notifications', criticalNotif.id), {
        acknowledgedBy: arrayUnion(profile.uid),
        acknowledgedAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setCriticalNotif(null);
      toast.success('تم تأكيد استلام الإشعار');
    } catch (e) {
      toast.error('فشل في تأكيد الاستلام');
    }
  };

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl border-4 border-red-500 shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-500 p-8 text-white text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black mb-2">تنبيه إداري هام</DialogTitle>
              <DialogDescription className="text-white/80 font-bold">
                يتطلب هذا الإشعار تأكيد استلامك الفوري
              </DialogDescription>
            </div>
          </div>
          
          <div className="p-8 text-right space-y-6">
            <div className="space-y-2">
              <h4 className="font-black text-xl text-slate-800">{criticalNotif?.title}</h4>
              <p className="text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {criticalNotif?.message}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
               <BellRing className="w-3 h-3" />
               بمجرد الضغط على زر التأكيد أدناه، سيتم تسجيل استلامك للرسالة في النظام لدى الإدارة.
            </div>

            <DialogFooter className="sm:justify-start">
              <Button 
                type="button" 
                onClick={handleAcknowledge}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-lg gap-2 shadow-xl shadow-red-900/20"
              >
                <CheckCircle2 className="w-6 h-6" />
                أقر باستلامي لهذا الإشعار
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
