import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Briefcase, 
  ShoppingBag, 
  Users, 
  ArrowRight,
  Sparkles,
  BarChart3,
  Mic,
  Volume2,
  Settings2,
  Play,
  Square,
  Loader2
} from 'lucide-react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface BriefingItem {
  id: string;
  type: 'action' | 'insight' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon: any;
  category: string;
  done?: boolean;
}

export default function ExecutiveBriefingSystem() {
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [briefingItems, setBriefingItems] = useState<BriefingItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'pending'>('all');
  const [voiceConfig, setVoiceConfig] = useState({
    focus: 'financial',
    tone: 'professional',
    length: 'short'
  });

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const generateVoiceBrief = async () => {
    setIsGeneratingBrief(true);
    try {
      // Simulate processing with Gemini or current state
      const text = `مرحباً بك يا مدير. إليك ملخص الحالة الحالية للشركة. 
      هناك ${briefingItems.filter(i => i.priority === 'high').length} تنبيهات عالية الأولوية تتعلق بالمشتريات. 
      بالنسبة للمشاريع، العمل يسير بشكل جيد في المواقع الإنشائية. 
      التدفق النقدي للشهر القادم في وضع آمن بنسبة مائة وخمسة عشر بالمائة. 
      ننصح بالتركيز اليوم على اعتمادات المشتريات المعلقة لضمان استمرارية التوريد.`;
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      toast.error('حدث خطأ أثناء توليد التقرير الصوتي');
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  useEffect(() => {
    const fetchBriefing = async () => {
      const items: BriefingItem[] = [];

      try {
        // 1. Check Pending Purchases
        const purSnap = await getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending')));
        if (purSnap.size > 0) {
          items.push({
            id: 'pur-1',
            type: 'warning',
            title: 'اعتمادات مشتريات معلقة',
            description: `هناك ${purSnap.size} طلبات شراء تتطلب مراجعتك الفورية لضمان استمرارية التوريد.`,
            priority: 'high',
            icon: ShoppingBag,
            category: 'المشتريات'
          });
        }

        // 2. Check Active Projects
        const projSnap = await getDocs(query(collection(db, 'projects'), where('status', '==', 'in-progress')));
        if (projSnap.size > 0) {
          items.push({
            id: 'proj-1',
            type: 'action',
            title: 'متابعة المشاريع التنفيذية',
            description: `لديك ${projSnap.size} مشاريع قيد التنفيذ حالياً. تأكد من مطابقة الجداول الزمنية.`,
            priority: 'medium',
            icon: Briefcase,
            category: 'المشاريع'
          });
        }

        // 3. Financial Insight
        items.push({
          id: 'fin-1',
          type: 'insight',
          title: 'تحليل التدفق النقدي',
          description: 'السيولة الحالية تغطي التزامات الرواتب والمشتريات للشهر القادم بنسبة 115%.',
          priority: 'low',
          icon: BarChart3,
          category: 'المالية'
        });

        // 4. Team Evaluation Notice
        items.push({
          id: 'team-1',
          type: 'action',
          title: 'تحديث تقييمات الموظفين',
          description: 'يحين موعد التقييم الربع سنوي لبعض أعضاء الفريق الفني الأسبوع القادم.',
          priority: 'medium',
          icon: Users,
          category: 'الموارد البشرية'
        });

        setBriefingItems(items);
      } catch (err) {
        console.error("Briefing System Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();
  }, []);

  const filteredItems = briefingItems.filter(item => {
    if (activeFilter === 'high') return item.priority === 'high';
    if (activeFilter === 'pending') return !item.done;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      {/* Header Section with Voice Briefing Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative overflow-hidden rounded-[3rem] bg-zinc-900 border border-white/5 text-white p-8 md:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full -mr-48 -mt-48 blur-[100px] animate-pulse" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-primary/20 rounded-2xl border border-white/10 backdrop-blur-xl">
                  <Zap className="w-8 h-8 text-primary" />
               </div>
               <div>
                  <h1 className="text-3xl md:text-5xl font-black tracking-tighter">مساعد القيادة التنفيذي</h1>
                  <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-xs">Executive Strategic Briefing</p>
               </div>
            </div>
            <p className="text-zinc-400 max-w-2xl text-sm md:text-lg font-medium leading-relaxed">
               مرحباً بك في نظام الإرشاد المتكامل. تم تصميم هذه الصفحة لتمنحك رؤية استباقية وتوجيهات دقيقة لإدارة العمليات اليومية بكفاءة عالية.
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[3rem] bg-white border border-slate-200 p-8 shadow-xl flex flex-col justify-between">
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-primary" /> التقرير الصوتي الذكي
                 </h3>
                 <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-primary">
                    <Settings2 className="w-4 h-4" />
                 </Button>
              </div>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                 احصل على ملخص صوتي مخصص لحالة العمل الآن بناءً على تفضيلاتك الحالية.
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-1">التركيز</span>
                    <select 
                      value={voiceConfig.focus}
                      onChange={(e) => setVoiceConfig({...voiceConfig, focus: e.target.value})}
                      className="w-full text-[10px] font-black p-2 rounded-xl bg-slate-50 border-none outline-none appearance-none"
                    >
                       <option value="financial">المالية والسيولة</option>
                       <option value="operations">العمليات والمشاريع</option>
                       <option value="hr">الموارد والإنتاج</option>
                       <option value="all">ملخص عام شامل</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-1">نبرة الصوت</span>
                    <select 
                      value={voiceConfig.tone}
                      onChange={(e) => setVoiceConfig({...voiceConfig, tone: e.target.value})}
                      className="w-full text-[10px] font-black p-2 rounded-xl bg-slate-50 border-none outline-none appearance-none"
                    >
                       <option value="professional">رسمي واحترافي</option>
                       <option value="energetic">حماسي ومحفز</option>
                       <option value="concise">مختصر جداً</option>
                    </select>
                 </div>
              </div>
           </div>

           <div className="pt-6">
              {isSpeaking ? (
                <Button 
                  onClick={stopSpeaking}
                  className="w-full rounded-2xl bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 h-14 gap-4 animate-pulse"
                >
                   <Square className="w-6 h-6 fill-white" />
                   <span className="text-sm font-black italic">جاري التحدث... اضغط للإيقاف</span>
                </Button>
              ) : (
                <Button 
                  onClick={generateVoiceBrief}
                  disabled={isGeneratingBrief}
                  className="w-full rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-14 gap-4"
                >
                   {isGeneratingBrief ? (
                     <Loader2 className="w-6 h-6 animate-spin" />
                   ) : (
                     <Play className="w-6 h-6 fill-white" />
                   )}
                   <span className="text-sm font-black">تشغيل الملخص الصوتي الذكي</span>
                </Button>
              )}
           </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-4">
         <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <button 
              onClick={() => setActiveFilter('all')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-primary'}`}
            >
               الكل
            </button>
            <button 
              onClick={() => setActiveFilter('high')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeFilter === 'high' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}
            >
               عالي الأولوية
            </button>
            <button 
              onClick={() => setActiveFilter('pending')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeFilter === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-amber-600'}`}
            >
               قيد الانتظار
            </button>
         </div>
         <Badge variant="outline" className="border-emerald-100 text-emerald-600 bg-emerald-50 px-4 py-1 rounded-full font-black text-[10px]">
            تحديث مباشر: {new Date().toLocaleTimeString('ar-SA')}
         </Badge>
      </div>

      {/* Grid of Briefs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
               <motion.div
                 key={item.id}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 transition={{ delay: idx * 0.1 }}
               >
                  <Card className={`rounded-[2.5rem] border-none shadow-xl h-full transition-all hover:scale-[1.02] border-t-4 ${
                     item.priority === 'high' ? 'bg-rose-50/30' : 
                     item.priority === 'medium' ? 'bg-slate-50' : 'bg-zinc-50'
                  }`}>
                     <CardHeader className="p-8 pb-4">
                        <div className="flex items-start justify-between">
                           <div className={`p-4 rounded-3xl ${
                              item.priority === 'high' ? 'bg-rose-500 text-white' : 
                              item.priority === 'medium' ? 'bg-slate-900 text-white' : 'bg-white border text-primary'
                           }`}>
                              <item.icon className="w-6 h-6" />
                           </div>
                           <Badge className={`border-none px-3 py-1 font-black ${
                              item.priority === 'high' ? 'bg-rose-100 text-rose-700' :
                              item.priority === 'medium' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                           }`}>
                              {item.category}
                           </Badge>
                        </div>
                        <CardTitle className="text-xl font-black mt-6 tracking-tight">{item.title}</CardTitle>
                        <CardDescription className="text-sm font-bold text-slate-500 mt-2 leading-relaxed">{item.description}</CardDescription>
                     </CardHeader>
                     <CardContent className="p-8 pt-6 border-t border-slate-100">
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-slate-400">الإجراء المقترح</span>
                              <Button variant="ghost" size="sm" className="text-primary font-black text-xs hover:bg-primary/5 gap-2">
                                 فتح التفاصيل <ArrowRight className="w-3 h-3" />
                              </Button>
                           </div>
                           <div className="bg-white/50 p-4 rounded-2xl border border-slate-200">
                              <p className="text-[11px] font-bold text-slate-700 italic">
                                 "يُنصح بمراجعة هذا البند قبل نهاية اليوم لضمان عدم تأثر السير العام."
                              </p>
                           </div>
                        </div>
                     </CardContent>
                  </Card>
               </motion.div>
            ))}
         </AnimatePresence>
      </div>

      {/* Strategic Vision Footer */}
      <Card className="rounded-[3rem] bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-none shadow-2xl overflow-hidden relative p-8 md:p-12">
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full -ml-32 -mb-32 blur-3xl" />
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="bg-white/10 p-6 rounded-full backdrop-blur-xl">
               <Sparkles className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="flex-1 space-y-4 text-center md:text-right">
               <h3 className="text-2xl font-black tracking-tight">الرؤية الاستراتيجية الأسبوعية</h3>
               <p className="text-indigo-200 text-sm md:text-base font-medium leading-relaxed">
                  تذكر أن هدفنا لهذا الشهر هو رفع نسبة كفاءة التسليم الميداني بنسبة 15%. التركيز الحالي يجب أن ينصب على تقليل الفواصل الزمنية بين اعتماد المشتريات وبدء التنفيذ.
               </p>
               <div className="flex flex-wrap justify-center md:justify-end gap-3 pt-4">
                  <Badge className="bg-white/10 text-white border-none py-1.5 px-4 font-black">تحسين العمليات</Badge>
                  <Badge className="bg-white/10 text-white border-none py-1.5 px-4 font-black">رضا العملاء</Badge>
                  <Badge className="bg-white/10 text-white border-none py-1.5 px-4 font-black">الجودة الفنية</Badge>
               </div>
            </div>
         </div>
      </Card>
    </div>
  );
}
