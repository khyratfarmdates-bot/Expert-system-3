import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, X, Send, Loader2, MessageSquare, Sparkles, FileText, AlertTriangle, Headset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export default function SmartButler() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'bot' | 'system', text: string}[]>([
    { role: 'bot', text: 'مرحباً بك في نظام خبراء الرسم! أنا مساعدك الذكي المتكامل. كيف يمكنني خدمتك اليوم؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const QUICK_ACTIONS = [
    { label: 'تحدث مع مساعد خبراء', id: 'expert', icon: <Sparkles className="w-4 h-4" />, prompt: 'أريد التحدث مع مساعد الخبراء للحصول على استشارة فنية أو إدارية.' },
    { label: 'شرح ودليل النظام', id: 'guide', icon: <FileText className="w-4 h-4 text-emerald-500" />, prompt: 'أريد قراءة دليل استخدام النظام والتعرف على مميزاته وخصائصه.' },
    { label: 'تقديم طلب', id: 'request', icon: <FileText className="w-4 h-4" />, prompt: 'أرغب في تقديم طلب جديد (إجازة، عهدة، أو طلب شراء).' },
    { label: 'تقديم شكوى', id: 'complaint', icon: <AlertTriangle className="w-4 h-4" />, prompt: 'أرغب في تسجيل شكوى أو ملاحظة بخصوص العمل.' },
    { label: 'محادثة مع الإدارة', id: 'management', icon: <Headset className="w-4 h-4" />, prompt: 'أرغب في إرسال رسالة مباشرة للإدارة العليا.' }
  ];

  const [companyName, setCompanyName] = useState('مؤسسة خبراء الرسم');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const getSettings = async () => {
      try {
        const settingsSnap = await getDocs(query(collection(db, 'systemSettings'), limit(1)));
        if (!settingsSnap.empty) {
          const data = settingsSnap.docs[0].data();
          if (data.companyName) setCompanyName(data.companyName);
          if (data.logoUrl) setLogoUrl(data.logoUrl);
        }
      } catch (e) {
        console.warn("Could not fetch company settings for bot header", e);
      }
    };
    getSettings();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleActionClick = (action: typeof QUICK_ACTIONS[0]) => {
    setShowOptions(false);
    setInput(action.prompt);
    setTimeout(() => handleSend(action.prompt), 100);
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = typeof overrideInput === 'string' ? overrideInput : input;
    if (!textToSend.trim()) return;

    const userMsg = textToSend.trim();
    if (typeof overrideInput !== 'string') setInput('');
    setShowOptions(false);
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      let projectsCtx: Array<{name: string, status: string}> = [];
      let empCount = 0;
      try {
        const projectsSnap = await getDocs(query(collection(db, 'projects'), limit(10)));
        projectsCtx = projectsSnap.docs.map(d => ({ name: d.data().title || d.data().name || 'بدون اسم', status: d.data().status }));
        const empSnap = await getDocs(query(collection(db, 'employees'), limit(10)));
        empCount = empSnap.size;
      } catch (e) {
        console.warn("Could not fetch full context for bot due to permissions:", e);
      }

      setTimeout(() => {
         let responseText = 'عذراً، لم أفهم طلبك بوضوح. هل يمكنك توضيح سؤالك؟ (مثال: طلب إجازة، الرصيد، المشاريع الحالية...)';
         
         const textLower = userMsg.toLowerCase();
         
         if (userMsg === 'أريد قراءة دليل استخدام النظام والتعرف على مميزاته وخصائصه.') {
            responseText = 'حسناً! سيتم الآن عرض دليل استخدام النظام الشامل.';
            window.dispatchEvent(new CustomEvent('showOnboarding'));
         } else if (textLower.includes('تقديم') || textLower.includes('طلب') || textLower.includes('اجازة') || textLower.includes('إجازة') || textLower.includes('سلفة') || textLower.includes('شراء')) {
            responseText = 'تقديم الطلبات يتم بسهولة عبر قسم "الطلبات والموافقات" من القائمة الجانبية، ثم الضغط على "إنشاء طلب جديد". سيتم توجيه طلبك للإدارة مباشرة.';
         } else if (textLower.includes('شكوى') || textLower.includes('مشكلة') || textLower.includes('اعتراض') || textLower.includes('خصم')) {
            responseText = 'للاعتراضات والشكاوى، يمكنك استخدام قسم "موجز الإدارة العليا" إذا كانت لديك صلاحية، أو فتح ملفك والنقر على زر "التواصل والإشعارات" لمراسلة الإدارة.';
         } else if (textLower.includes('محادثة') || textLower.includes('الإدارة') || textLower.includes('الادارة') || textLower.includes('رسالة') || textLower.includes('تواصل')) {
            responseText = 'لإرسال رسالة رسمية، توجّه إلى "التواصل والإشعارات" في القائمة الرئيسية للنظام. يمكنك إرسال تنبيه فوري للإدارة هناك.';
         } else if (textLower.includes('مشروع') || textLower.includes('مشاريع')) {
            if (projectsCtx.length > 0) {
              const projectNames = projectsCtx.map(p => p.name).join('، ');
              responseText = `بناءً على صلاحياتك، لدينا المشاريع التالية: ${projectNames}. للمزيد، افتح "تتبع المشاريع".`;
            } else {
              responseText = 'لا يوجد مشاريع يمكنك رؤيتها حالياً، راجع قسم المشاريع للمزيد من التفاصيل.';
            }
         } else if (textLower.includes('موظف') || textLower.includes('الموظفين') || textLower.includes('فريق') || textLower.includes('الحضور')) {
            responseText = `يحتوي النظام على ${empCount} موظفين في نطاق رؤيتك. لإدارة ساعات العمل، اذهب إلى "إدارة الموظفين" أو "الحضور الذكي".`;
         } else if (textLower.includes('مرحبا') || textLower.includes('السلام عليك') || textLower.includes('اهلا')) {
            responseText = `أهلاً ومرحباً بك! أنا نظام التوجيه المعرفي لمنصة خبراء الرسم. ماذا تحتاج اليوم؟`;
         } else if (textLower.includes('من انت') || textLower.includes('مساعد') || textLower.includes('بوت')) {
            responseText = 'أنا خبير الأنظمة وتمت برمجتي لتسهيل تنقلك داخل المنصة ومساعدتك في العثور على الأقسام المناسبة لطلباتك.';
         } else if (textLower.includes('المالية') || textLower.includes('رواتب') || textLower.includes('محاسبة') || textLower.includes('مستحق')) {
            responseText = 'لقسم المالية والرواتب، يجب امتلاك صلاحيات مدير أو مشرف، ويمكنك إيجادها في قسم "المالية والمصروفات". والمستحقات الشخصية في ملفك المهني.';
         }

         setMessages(prev => [...prev, { role: 'bot', text: responseText }]);
         setIsLoading(false);
      }, 1000);

    } catch (error) {
      toast.error('حدث خطأ فني أثناء العمل');
      console.error(error);
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed ${isOpen ? 'inset-0 md:inset-auto md:bottom-6 md:left-6' : 'bottom-24 md:bottom-6 left-6'} z-[999] flex flex-col items-end`} dir="rtl">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full md:w-[400px] h-full md:h-auto md:mb-4"
          >
            <Card className="rounded-none md:rounded-3xl border-none shadow-2xl overflow-hidden bg-white/98 backdrop-blur-md h-full md:h-auto flex flex-col">
              <CardHeader className="bg-primary p-4 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-4 flex flex-row items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-1 rounded-lg">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <Bot className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black">{companyName}</CardTitle>
                    <p className="text-[9px] opacity-70">المساعد الذكي للمؤسسة</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex flex-col flex-1 h-full md:max-h-[500px]">
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200"
                >
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-[13px] font-medium leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-slate-100 text-slate-800' 
                        : 'bg-primary/10 text-primary border border-primary/20 shadow-sm'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  
                  {showOptions && messages.length === 1 && (
                    <div className="grid grid-cols-1 gap-2 pt-2 animate-in fade-in slide-in-from-bottom-2">
                       {QUICK_ACTIONS.map(action => (
                         <Button 
                           key={action.id}
                           variant="outline"
                           onClick={() => handleActionClick(action)}
                           className="justify-start gap-3 h-auto py-3 px-4 rounded-2xl border-slate-100 hover:border-primary hover:bg-primary/5 text-slate-600 font-bold group"
                         >
                           <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                             {action.icon}
                           </div>
                           <span className="text-[13px]">{action.label}</span>
                         </Button>
                       ))}
                    </div>
                  )}

                  {isLoading && (
                    <div className="flex justify-end">
                      <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-[10px] text-muted-foreground font-bold">جاري التفكير...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t bg-slate-50 flex gap-2 pb-[env(safe-area-inset-bottom)] md:pb-4">
                  <Input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="اسألني عن المالية أو الموظفين..."
                    className="rounded-xl border-slate-200 h-11 text-right"
                  />
                  <Button onClick={() => handleSend()} disabled={isLoading} className="rounded-xl w-11 h-11 p-0 shrink-0 shadow-lg">
                    <Send className="w-5 h-5 rotate-180" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="bg-primary text-white w-10.5 h-10.5 md:w-11 md:h-11 rounded-full shadow-2xl flex items-center justify-center relative group"
        >
          {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
          
          <div className="absolute -top-0.5 -right-0.5 bg-accent w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold border-2 border-white shadow-sm">
             <Sparkles className="w-2 h-2 fill-current" />
          </div>
          <span className="absolute bottom-full mb-3 left-0 bg-white text-primary px-3 py-1.5 rounded-xl shadow-xl text-[10px] font-black whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 origin-bottom-left pointer-events-none border border-slate-100">
             هل تحتاج مساعدة؟
          </span>
        </motion.button>
      )}
    </div>
  );
}
