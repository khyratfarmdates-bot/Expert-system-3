import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Target, ShieldCheck, Heart, User } from 'lucide-react';

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
          title: "مرحباً أيها القائد والمدير",
          tips: ["راجع لوحة التقارير لمتابعة الأداء اليومي", "تأكد من طلبات الموافقات والاعتمادات المعلقة", "رؤيتك وقيادتك اليوم تصنع نجاح الغد"]
        },
        supervisor: {
          title: "أهلاً بك يا مشرفنا الفني",
          tips: ["تابع حضور وانصراف فريقك بدقة", "تأكد من سير وسلامة العمل في مواقع المشاريع", "دعمك الفني والمهني هو سر الجودة المستدامة"]
        },
        employee: {
          title: "يسعدنا وجودك ومشاركتنا العمل اليوم",
          tips: ["سجل حضورك اليومي الآن لتبدأ مهامك", "راجع جدول أعمالك ومهامك اليومية بدقة", "إنجازك الصغير والمستمر اليوم يكمل قصة نجاحنا"]
        },
        sales_rep: {
          title: "أهلاً بك يا شريك النجاح والمبيعات",
          tips: ["استخدم المساعد الذكي لتوليد أفضل عروضك", "تابع سجل فواتيرك الصادرة ومستحقاتك أولاً بأول", "تواصلك الاحترافي مع العملاء يصنع الفرق"]
        }
      };
      roleData = defaults[role] || defaults.employee;
    }

    return roleData;
  };

  const content = getRoleContent();

  const getTipIcon = (idx: number) => {
    switch (idx) {
      case 0: return <ShieldCheck className="w-4 h-4 text-teal-400" />;
      case 1: return <Target className="w-4 h-4 text-emerald-400" />;
      default: return <Heart className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950"
          style={{ 
            background: 'radial-gradient(circle at center, #0b1a1c 0%, #030809 100%)',
            fontFamily: "'Cairo', sans-serif"
          }}
        >
          {/* Subtle Glowing Background Elements */}
          <div className="absolute top-[20%] right-[10%] w-[30rem] h-[30rem] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-[20%] left-[10%] w-[30rem] h-[30rem] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-md w-full px-6 text-center space-y-8 relative z-10">
            {/* Logo Animation */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
              className="relative inline-block"
            >
              <div className="absolute -inset-6 bg-teal-500/10 rounded-full blur-2xl animate-pulse" />
              <div className="relative p-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] shadow-2xl">
                <img 
                  src={sysSettings.logoUrl} 
                  alt="Logo" 
                  className="w-28 h-28 object-contain rounded-2xl border border-slate-700 bg-white p-1"
                />
              </div>
            </motion.div>

            {/* Greeting Header */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="space-y-3"
            >
              <h1 className="text-2xl md:text-3xl font-black text-white flex items-center justify-center gap-2">
                {content.title}
                <Sparkles className="w-5 h-5 text-amber-400 animate-spin-slow" />
              </h1>
              
              <div className="flex items-center justify-center gap-2 text-teal-400 font-bold bg-teal-500/10 px-4 py-2 rounded-full w-fit mx-auto border border-teal-500/20 shadow-inner">
                <User className="w-4 h-4" />
                <span className="text-sm tracking-wide">{profile?.name || user?.displayName}</span>
              </div>
            </motion.div>

            {/* Tips Card List */}
            <div className="space-y-3 pt-3">
              {content.tips.map((tip: string, idx: number) => (
                <motion.div
                  key={idx}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + (idx * 0.15) }}
                  className="flex items-center gap-3.5 bg-slate-900/40 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80 shadow-lg transition-all hover:bg-slate-900/60 hover:border-slate-700/50 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getTipIcon(idx)}
                  </div>
                  <span className="text-xs font-black text-slate-300 text-right w-full leading-relaxed">{tip}</span>
                </motion.div>
              ))}
            </div>

            {/* Progress & Loading Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="pt-6 flex flex-col items-center gap-2.5"
            >
              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3.5, ease: "linear" }}
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                />
              </div>
              <p className="text-[9px] font-black tracking-widest text-slate-500 uppercase">جاري مزامنة وتهيئة لوحة التحكم...</p>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
