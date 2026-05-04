import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Target, ShieldCheck, Heart } from 'lucide-react';

interface WelcomeOverlayProps {
  user: any;
  profile: any;
  sysSettings: any;
  onComplete: () => void;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ user, profile, sysSettings, onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 1000); // Wait for exit animation
    }, 4500); // Show for 4.5 seconds

    return () => clearTimeout(timer);
  }, [onComplete]);

  const getRoleContent = () => {
    const role = profile?.role || 'employee';
    const messages = sysSettings.roleWelcomeMessages || {};
    let roleData = messages[role];

    // Safety fallback for legacy string data
    if (typeof roleData === 'string') {
      roleData = { title: roleData, tips: [] };
    }

    if (!roleData || typeof roleData !== 'object') {
      const defaults: any = {
        manager: {
          title: "مرحباً أيها القائد",
          tips: ["راجع لوحة التقارير لمتابعة الأداء", "تأكد من الموافقات المعلقة", "رؤيتك اليوم تصنع نجاح الغد"]
        },
        supervisor: {
          title: "أهلاً بك يا مشرفنا",
          tips: ["تابع حضور وانصراف فريقك", "تأكد من سير العمل في المواقع", "دعمك للفريق هو سر الجودة"]
        },
        employee: {
          title: "يسعدنا وجودك معنا",
          tips: ["سجل حضورك الآن لتبدأ يومك", "راجع مهامك اليومية بدقة", "إنجازك الصغير اليوم يكمل نجاحنا"]
        }
      };
      roleData = defaults[role] || defaults.employee;
    }

    return roleData;
  };

  const content = getRoleContent();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"
          style={{ background: `radial-gradient(circle at center, white 0%, ${sysSettings.primaryColor}05 100%)` }}
        >
          <div className="max-w-md w-full px-8 text-center space-y-8">
            {/* Logo Animation */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative inline-block"
            >
              <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
              <img 
                src={sysSettings.logoUrl} 
                alt="Logo" 
                className="w-32 h-32 object-contain relative rounded-3xl shadow-2xl bg-white p-2 border-4 border-primary/10"
              />
            </motion.div>

            {/* Greeting */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <h1 className="text-3xl font-black text-slate-900 flex items-center justify-center gap-2">
                {content.title}
                <Sparkles className="w-6 h-6 text-amber-400" />
              </h1>
              <p className="text-xl font-bold text-primary italic">
                {profile?.name || user?.displayName}
              </p>
            </motion.div>

            {/* Tips/Advice Section */}
            <div className="space-y-3 pt-4">
              {content.tips.map((tip: string, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 + (idx * 0.2) }}
                  className="flex items-center gap-3 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {idx === 0 ? <ShieldCheck className="w-4 h-4 text-primary" /> : 
                     idx === 1 ? <Target className="w-4 h-4 text-primary" /> : 
                     <Heart className="w-4 h-4 text-primary" />}
                  </div>
                  <span className="text-sm font-black text-slate-600 text-right w-full">{tip}</span>
                </motion.div>
              ))}
            </div>

            {/* Progress/Loading */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="pt-8 flex flex-col items-center gap-2"
            >
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3.5, ease: "linear" }}
                  className="h-full bg-primary"
                />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">جاري مواءمة بيئة العمل...</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
