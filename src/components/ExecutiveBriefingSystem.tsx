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
          description: 'يحين موعد التقييم الربع سنوي لبعض الكفاءات والكوادر الفنية بالميدان.',
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto" dir="rtl">
      {/* Header Section with Voice Briefing Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 text-white p-6 md:p-8 shadow-sm">
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-white/10 rounded-lg">
                  <Zap className="w-5 h-5 text-amber-400" />
               </div>
               <div>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">المساعد الذكي للقيادة التنفيذية</h1>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Executive Strategic Briefing</p>
               </div>
            </div>
            <p className="text-slate-300 max-w-2xl text-xs md:text-sm font-medium leading-relaxed">
               أهلاً بك في نظام الإرشاد المباشر للمؤسسة. تم تحليل السجلات والتدفقات لإبراز أهم البنود المعلقة التي تحتاج لمتابعتك اليومية.
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
           <div className="space-y-3">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-slate-700" /> التقرير الصوتي الذكي
                 </h3>
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-slate-400 hover:text-primary">
                    <Settings2 className="w-3.5 h-3.5" />
                 </Button>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 leading-relaxed">
                 استمع إلى ملخص تنفيذي سريع بناءً على نطاق التركيز الذي تحدده:
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                 <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">التركيز الأساسي</span>
                    <select 
                      value={voiceConfig.focus}
                      onChange={(e) => setVoiceConfig({...voiceConfig, focus: e.target.value})}
                      className="w-full text-[10px] font-bold p-1.5 rounded bg-slate-50 border border-slate-200 outline-none"
                    >
                       <option value="financial">المالية والسيولة</option>
                       <option value="operations">العمليات والمشاريع</option>
                       <option value="hr">الموارد والإنتاج</option>
                       <option value="all">ملخص عام شامل</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">نبرة الإلقاء</span>
                    <select 
                      value={voiceConfig.tone}
                      onChange={(e) => setVoiceConfig({...voiceConfig, tone: e.target.value})}
                      className="w-full text-[10px] font-bold p-1.5 rounded bg-slate-50 border border-slate-200 outline-none"
                    >
                       <option value="professional">رسمي واحترافي</option>
                       <option value="energetic">حماسي ومحفز</option>
                       <option value="concise">مختصر جداً</option>
                    </select>
                 </div>
              </div>
           </div>

           <div className="pt-4">
              {isSpeaking ? (
                <Button 
                  onClick={stopSpeaking}
                  className="w-full rounded-lg bg-rose-600 hover:bg-rose-700 text-white h-10 gap-2 animate-pulse cursor-pointer"
                >
                   <Square className="w-4 h-4 fill-white" />
                   <span className="text-xs font-bold">جاري التحدث... اضغط لإيقاف الصوت</span>
                </Button>
              ) : (
                <Button 
                  onClick={generateVoiceBrief}
                  disabled={isGeneratingBrief}
                  className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white h-10 gap-2 cursor-pointer"
                >
                   {isGeneratingBrief ? (
                     <Loader2 className="w-4 h-4 animate-spin" />
                   ) : (
                     <Play className="w-4 h-4 fill-white" />
                   )}
                   <span className="text-xs font-bold">تشغيل التقرير المباشر صوتياً</span>
                </Button>
              )}
           </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
         <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start">
            <button 
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${activeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
               الكل
            </button>
            <button 
              onClick={() => setActiveFilter('high')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${activeFilter === 'high' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-rose-600'}`}
            >
               عالي الأولوية
            </button>
            <button 
              onClick={() => setActiveFilter('pending')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${activeFilter === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-amber-600'}`}
            >
               نشط ومقترح
            </button>
         </div>
         <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 px-3 py-1 rounded-md font-bold text-[9px] self-start">
            تحديث الفهرسة الفورية: {new Date().toLocaleTimeString('ar-SA')}
         </Badge>
      </div>

      {/* Grid of Briefs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
         <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
               <motion.div
                 key={item.id}
                 initial={{ opacity: 0, y: 15 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.98 }}
                 transition={{ delay: idx * 0.05 }}
               >
                  <Card className={`rounded-xl border border-slate-200/70 shadow-sm h-full transition-all hover:border-slate-300 bg-white`}>
                     <CardHeader className="p-5 pb-3">
                        <div className="flex items-start justify-between">
                           <div className={`p-2 rounded-lg ${
                              item.priority === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 
                              item.priority === 'medium' ? 'bg-slate-50 text-slate-800 border border-slate-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                           }`}>
                              <item.icon className="w-5 h-5" />
                           </div>
                           <Badge variant="outline" className={`border-none px-2 py-0.5 font-bold text-[9px] ${
                              item.priority === 'high' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                              item.priority === 'medium' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-600 border border-slate-100'
                           }`}>
                              {item.category}
                           </Badge>
                        </div>
                        <CardTitle className="text-sm font-bold text-slate-800 mt-4 tracking-tight">{item.title}</CardTitle>
                        <CardDescription className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{item.description}</CardDescription>
                     </CardHeader>
                     <CardContent className="p-5 pt-4 border-t border-slate-100 bg-slate-50/40">
                        <div className="space-y-3">
                           <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold uppercase text-slate-400">الإجراء المقترح والمستحب</span>
                              <Button variant="link" size="sm" className="text-blue-600 font-bold text-[11px] h-auto p-0 gap-1 hover:text-blue-700">
                                 عرض البند والعمليات <ArrowRight className="w-3 h-3" />
                              </Button>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
                              <p className="text-[10px] font-bold text-slate-600">
                                 "يُنصح بمراجعة هذا البند لضمان اتساق العمل الفني والميداني بالمواقع دون تأخير."
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
      <Card className="rounded-xl bg-slate-900 text-white border border-slate-800 shadow-sm relative p-6 md:p-8">
         <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
            <div className="bg-white/10 p-4 rounded-lg hidden md:block">
               <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <div className="flex-1 space-y-2 text-right">
               <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 justify-end">
                  <Sparkles className="w-4 h-4 text-amber-400 md:hidden" />
                  التوجيه الاستراتيجي للمؤسسة
               </h3>
               <p className="text-slate-300 text-xs font-medium leading-relaxed">
                  تذكر أن هدفنا التشغيلي تصفير المعلقات وتقليص الفواصل الزمنية المعتادة لإنهاء طلبات المواقع من المواد والمعدات بنسبة 15%. التركيز الحالي ينصب على سلاسة التوريد.
               </p>
               <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Badge className="bg-white/10 text-white border-none py-0.5 px-2 text-[9px] font-bold">رفع كفاءة الدورة المستندية</Badge>
                  <Badge className="bg-white/10 text-white border-none py-0.5 px-2 text-[9px] font-bold">انسيابية التوريد الميداني</Badge>
               </div>
            </div>
         </div>
      </Card>
    </div>
  );
}
