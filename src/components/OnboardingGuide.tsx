import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { 
  LayoutDashboard, Users, Zap, Briefcase, ShoppingCart, 
  Target, ShieldCheck, CheckCircle2, ChevronLeft, ChevronRight, 
  Sparkles, Volume2, Play, Shield, Award, Activity, HardHat, 
  Coins, MessageSquare, AlertCircle, Eye, EyeOff, CheckCircle, 
  TrendingUp, RefreshCw, Smartphone, Check, FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingGuideProps {
  role: string;
  onComplete: () => void;
}

export default function OnboardingGuide({ role, onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Sound play helper for the onboarding (with protection against autoplay blocking)
  const playSoundEffect = () => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(err => console.log("Audio play blocked in onboarding", err));
    } catch (e) {
      console.log("Audio setup failed", e);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     ROLES & CONTENT SPECIFICATIONS (Highly customized list of steps with local interactive states)
     ───────────────────────────────────────────────────────────────────────── */

  // State managers for interactive mockups in Step Slides
  // -- Manager states
  const [managerKpi, setManagerKpi] = useState<'projects' | 'expenses' | 'revenue'>('projects');
  const [managerAiLoading, setManagerAiLoading] = useState(false);
  const [managerAiResult, setManagerAiResult] = useState('');
  const [managerApprovalStatus, setManagerApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  // -- Supervisor states
  const [superProgress, setSuperProgress] = useState(65);
  const [workerAttendance, setWorkerAttendance] = useState({ worker1: true, worker2: false });
  const [superOrderSent, setSuperOrderSent] = useState(false);
  // -- Worker states
  const [workerDetailsVisible, setWorkerDetailsVisible] = useState(false);
  const [workerDeviceAlert, setWorkerDeviceAlert] = useState(false);
  const [workerReportStatus, setWorkerReportStatus] = useState(false);
  // -- Employee states
  const [empAttendanceLocal, setEmpAttendanceLocal] = useState<'off' | 'on'>('off');
  const [empRequestType, setEmpRequestType] = useState('vacation');

  // Load the respective steps depending on the role
  const getRoleSteps = () => {
    switch (role) {
      case 'manager':
        return [
          {
            title: 'مركز السيطرة ومراقبة الأداء المالي',
            badge: 'المدير العام',
            desc: 'لوحة القيادة تمنحك تحليلاً سريعاً ودقيقاً لكل المعاملات المالية، والمشاريع الجارية، ومستحقات العمال مع تحديث لحظي.',
            tip: 'تفاعل بالضغط على الكروت بالجهة اليسرى لمعاينة تفاصيل كل مؤشر مالي.',
            playground: (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => { setManagerKpi('projects'); playSoundEffect(); }}
                    className={`p-3 rounded-2xl text-right transition border text-xs font-bold leading-tight flex flex-col justify-between h-24 cursor-pointer ${
                      managerKpi === 'projects' ? 'bg-teal-50 border-teal-500 text-teal-950 shadow-md shadow-teal-500/5' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="opacity-75">المشروعات النشطة</span>
                    <span className="text-xl font-black block mt-2">14 موقع</span>
                  </button>

                  <button 
                    onClick={() => { setManagerKpi('expenses'); playSoundEffect(); }}
                    className={`p-3 rounded-2xl text-right transition border text-xs font-bold leading-tight flex flex-col justify-between h-24 cursor-pointer ${
                      managerKpi === 'expenses' ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-md shadow-indigo-500/5' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="opacity-75">المشتريات والصرف</span>
                    <span className="text-sm font-black block mt-2">314,200 ر.س</span>
                  </button>

                  <button 
                    onClick={() => { setManagerKpi('revenue'); playSoundEffect(); }}
                    className={`p-3 rounded-2xl text-right transition border text-xs font-bold leading-tight flex flex-col justify-between h-24 cursor-pointer ${
                      managerKpi === 'revenue' ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md shadow-emerald-500/5' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="opacity-75">العوائد / المبيعات</span>
                    <span className="text-sm font-black block mt-2">845,900 ر.س</span>
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {managerKpi === 'projects' && (
                    <motion.div 
                      key="proj" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="bg-teal-50/50 border border-teal-100/80 rounded-2xl p-4 text-xs font-semibold leading-relaxed text-slate-700"
                    >
                      <div className="flex items-center gap-1.5 font-black text-teal-800 mb-1">
                        <Briefcase className="w-4 h-4 text-teal-600" />
                        <span>تحليل تدفق مشروعات خبراء الرسم:</span>
                      </div>
                      <p>المشروعات تعمل بكفاءة. 4 مشاريع في الفئة أ (كلادينج وحروف بارزة) و 10 في بند تسوير المواقع واللوحات الإعلانية المطبوعة للشركاء الإستراتيجيين.</p>
                    </motion.div>
                  )}
                  {managerKpi === 'expenses' && (
                    <motion.div 
                      key="exp" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="bg-indigo-50/50 border border-indigo-100/80 rounded-2xl p-4 text-xs font-semibold leading-relaxed text-slate-700"
                    >
                      <div className="flex items-center gap-1.5 font-black text-indigo-800 mb-1">
                        <ShoppingCart className="w-4 h-4 text-indigo-600" />
                        <span>تقييم النفقات ومصروفات المواد:</span>
                      </div>
                      <p>إدارة النفقات تتلقى طلبات المشرفين آلياً عبر نظام السُلف، وتم تفعيل الرقابة المشددة لضمان بقائها داخل سقف الميزانية المرصودة.</p>
                    </motion.div>
                  )}
                  {managerKpi === 'revenue' && (
                    <motion.div 
                      key="rev" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      className="bg-emerald-50/50 border border-emerald-100/80 rounded-2xl p-4 text-xs font-semibold leading-relaxed text-slate-700"
                    >
                      <div className="flex items-center gap-1.5 font-black text-emerald-800 mb-1">
                        <TrendingUp className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>تحليل العوائد والأرباح التقديرية:</span>
                      </div>
                      <p>ارتفاع صافي الربح بنسبة 12.4% نتيجة خفض تكلفة الهدر الميداني من خلال تسجيل حضور وساعات عمال المقاولة بدقة متناهية.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          },
          {
            title: 'موجز الإدارة والرأي الائتماني الذكي (EBS)',
            badge: 'توقع العجز بالذكاء الاصطناعي',
            desc: 'النظام مزود بنواة ذكاء اصطناعي تفحص ميزانيات مشاريع الشركة بالكامل، وتعمل على إنذارك وقائياً قبل وقوع عجز مالي بشكل مؤتمت بالكامل.',
            tip: 'انقر على زر الفحص الائتماني بالأسفل لمشاهدة تحليل فوري من Gemini AI.',
            playground: (
              <div className="space-y-4">
                <Button 
                  onClick={() => {
                    setManagerAiLoading(true);
                    playSoundEffect();
                    setTimeout(() => {
                      setManagerAiResult('⚠️ تنبيه وقائي ائتماني عاجل (نموذجي):\n- مشروع مجمع اليرموك قد يستنزف سيولته التشغيلية خلال 24 يوماً.\n- يرجى توجيه المشرف لترشيد الصرف المباشر ومراجعة طلبيات الحديد.\n- ينصح بتفعيل كفالة المالك لضمان التدفقات النقدية.');
                      setManagerAiLoading(false);
                      toast.info('اكتمل التقييم الائتماني العيني من Gemini');
                    }, 1200);
                  }}
                  disabled={managerAiLoading}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-2 rounded-xl border-none shadow-md"
                >
                  {managerAiLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      جاري صياغة تقرير عاجل للمحفظة...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 animate-bounce text-yellow-300" />
                      رصد التدفقات - تشغيل المحلل الذكي التلقائي
                    </>
                  )}
                </Button>

                {managerAiResult ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900 text-slate-100 text-[11px] leading-relaxed font-semibold rounded-2xl p-4 border border-indigo-500/30 whitespace-pre-line text-right"
                  >
                    <div className="flex items-center gap-1.5 font-bold text-yellow-500 border-b border-white/10 pb-1.5 mb-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>تقرير الذكاء الاصطناعي الوقائي:</span>
                    </div>
                    {managerAiResult}
                  </motion.div>
                ) : (
                  <div className="border border-dashed border-slate-250 rounded-2xl p-6 text-center text-[11px] text-slate-400 font-bold bg-slate-50">
                    انقر الزر بالأعلى لمحاكاة فحص الموازنة
                  </div>
                )}
              </div>
            )
          },
          {
            title: 'إقرار الصرف والاعتماد بلمسة واحدة',
            badge: 'المكتب والسيولة المباشرة',
            desc: 'طلبات عمال الميدان، فواتير الإسفلت، السُلف، ويوميات الإضافي تصل لهاتفك مباشرة. يمكنك تقييمها وقبولها بنقرة واحدة لتحديث الخزنة المخصصة.',
            tip: 'جرب الآن! إما باعتماد كرت الشراء لتوثيق الصرف أو رفضه مع إشعار فوري لمقدم الطلب.',
            playground: (
              <div className="space-y-4">
                <Card className="border border-slate-150 rounded-2xl bg-white shadow-sm overflow-hidden text-right">
                  <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg font-black">انتظار المدير</span>
                      <h4 className="font-bold text-xs text-slate-700 mt-1">طلب شراء مستعجل للموقع</h4>
                    </div>
                    <span className="text-xs font-black text-rose-600">8,500 ر.س</span>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                      الطلب: <span className="text-slate-700">تأمين كابلات كهربائية نحاس للمدرج رقم 2 بموقع الهيئة</span>
                      <br />
                      المشرف: <span className="text-slate-700">المهندس سليمان الحربي</span>
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>الخزنة المستهدفة: بنك الراجحي للشركة</span>
                      <span>تاريخ الطلب: اليوم</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                      <Button
                        onClick={() => {
                          setManagerApprovalStatus('approved');
                          playSoundEffect();
                          toast.success('تم اعتماد وصرف الطلب بنجاح وتحديث حساب الخزينة!');
                        }}
                        disabled={managerApprovalStatus !== 'pending'}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 rounded-xl border-none"
                      >
                        {managerApprovalStatus === 'approved' ? '✓ تم الاعتماد والصرف' : 'اعتماد وصرف فوري'}
                      </Button>

                      <Button
                        onClick={() => {
                          setManagerApprovalStatus('rejected');
                          playSoundEffect();
                          toast.error('تم رفض الطلب وإعادته للمشرف لإعادة التعديل');
                        }}
                        disabled={managerApprovalStatus !== 'pending'}
                        variant="outline"
                        className="border-slate-250 hover:bg-slate-50 text-slate-600 font-bold text-xs h-9 rounded-xl"
                      >
                        {managerApprovalStatus === 'rejected' ? '✕ تم الرفض' : 'رفض مع إشعار'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {managerApprovalStatus === 'approved' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-center text-[11px] font-black"
                  >
                    🎉 محاكاة ناجحة: تم خصم المبلغ من الخزينة وإرسال إشعار صوتي فوري للمشرف فهد بالموقع!
                  </motion.div>
                )}
                {managerApprovalStatus === 'rejected' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-center text-[11px] font-black"
                  >
                    ❌ محاكاة ناجحة: تم إرجاع الطلب واهتز هاتف المشرف لتنبيهه إلى مراجعة أسعار المواد.
                  </motion.div>
                )}
              </div>
            )
          }
        ];

      case 'supervisor':
        return [
          {
            title: 'إدارة المواقع ومتابعة نسب الإنجاز الميداني',
            badge: 'المشرف الميداني',
            desc: 'بثانية واحدة، يمكنك تحديث مدى تقدم المشروع في غضون ثوانٍ وتخزينه في قواعد البيانات لتقرأه الإدارة مباشرة.',
            tip: 'قم بضبط مؤشر التقدم باليسار بزيادته أو إنقاصه لمشاهدة الانعكاس الرسومي.',
            playground: (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="font-black text-xs text-slate-800">مشروع أسوار مدينة الرياض</h4>
                      <p className="text-[10px] text-slate-400 font-bold">العميل: البلدية العامة</p>
                    </div>
                    <span className="text-xl font-black text-indigo-600 font-mono">{superProgress}%</span>
                  </div>

                  {/* Slider simulation */}
                  <div className="space-y-3">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={superProgress} 
                      onChange={(e) => {
                        setSuperProgress(Number(e.target.value));
                        if(Number(e.target.value) === 100) {
                          playSoundEffect();
                          toast.success('مبروك! اكتملت موازين المشروع الافتراضي 🎉');
                        }
                      }}
                      className="w-full accent-indigo-650 h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    
                    {/* Simulated circular/linear refilled meter */}
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          superProgress > 80 ? 'bg-emerald-500' : superProgress > 45 ? 'bg-indigo-500' : 'bg-amber-500'
                        }`} 
                        style={{ width: `${superProgress}%` }} 
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-bold text-center mt-3">
                    💡 سيلاحظ المدير العام تقدمك وتغير الألوان الذكية في شاشته فوراً!
                  </p>
                </div>
              </div>
            )
          },
          {
            title: 'اليوميات وسجلات عمال المواقع ومحاسبتهم',
            badge: 'المقاولين والعمالة المباشرة',
            desc: 'لا حاجة للدفاتر القديمة! سجل حضور العامل اليومي، وساعات الإضافي بلمسة من الموقع لحفظ الحقوق وصرف السلف التلقائي.',
            tip: 'انقر على كرات التبديل لتجربة تحضير أو غياب العمال الميدانيين حالاً.',
            playground: (
              <div className="space-y-4">
                <div className="border border-slate-150 rounded-2xl bg-white overflow-hidden shadow-sm text-right text-xs">
                  <div className="bg-slate-50 p-3 font-black text-slate-700 border-b border-slate-100 flex justify-between items-center">
                    <span>قائمة طاقم الحفر والأسوار الميدانية</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg">يومية نشطة</span>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                      <div>
                        <p className="font-bold text-slate-800">شبير الحسين (فني حداد)</p>
                        <p className="text-[10px] text-slate-400 font-bold">اليومية: 150 ر.س | إضافي: 2 ساعة</p>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setWorkerAttendance(p => ({ ...p, worker1: !p.worker1 }));
                          playSoundEffect();
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[10px] border transition cursor-pointer ${
                          workerAttendance.worker1 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'
                        }`}
                      >
                        {workerAttendance.worker1 ? '✓ حاضر بالموقع' : ' غائب / إجازة'}
                      </button>
                    </div>

                    <div className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                      <div>
                        <p className="font-bold text-slate-800">سامي السعيد (عامل مساعد)</p>
                        <p className="text-[10px] text-slate-400 font-bold">اليومية: 110 ر.س | إضافي: 0 ساعة</p>
                      </div>

                      <button 
                        onClick={() => {
                          setWorkerAttendance(p => ({ ...p, worker2: !p.worker2 }));
                          playSoundEffect();
                          if(!workerAttendance.worker2) toast.success('تم إثبات دوام سامي وإضافته لرواتب الشهر!');
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[10px] border transition cursor-pointer ${
                          workerAttendance.worker2 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-100 border-slate-300 text-slate-500'
                        }`}
                      >
                        {workerAttendance.worker2 ? '✓ حاضر بالموقع' : ' غائب / إجازة'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-bold text-center">
                  * يقوم النظام بتجميع هذه البيانات شهرياً لإنشاء كشوف مرتبات متكاملة بنقرة واحدة.
                </div>
              </div>
            )
          },
          {
            title: 'خط سير مشتريات وطلبات المواد العاجلة',
            badge: 'المشتريات والعهد',
            desc: 'نفدت رمال البطحاء أو الإسمنت؟ ارفع طلباً من هاتفك وصوّر الفاتورة بكاميرا الجوال، وسيدرسه نظام الذكاء الاصطناعي ثم يرفعه للمدير فوراً للاعتماد والصرف لبنكك.',
            tip: 'انقر على زر "إرسال طلب عينة" لتشاهد كيف تتدفق دورتك المستندية ورقابتنا الذكية.',
            playground: (
              <div className="space-y-4">
                {superOrderSent ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-emerald-55 bg-white border border-emerald-200 rounded-2xl p-4 text-center space-y-3"
                  >
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-5 h-5" />
                    </div>
                    <h5 className="font-black text-xs text-slate-800">تم إرسال الطلب وإخطار الإدارة!</h5>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                      الطلب مسجل حالياً برقم فريد: <span className="text-indigo-600">REQ-765</span>. تتوجه الآن شحنة الإشعار المباشر لجهاز المدير مهتزاً برنين الرصيد لاعتماده فوراً.
                    </p>
                    <button 
                      onClick={() => setSuperOrderSent(false)}
                      className="text-[10px] text-indigo-600 font-black hover:underline cursor-pointer"
                    >
                      تعديل الطلب وإعادة التجربة
                    </button>
                  </motion.div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="space-y-2">
                      <label className="font-black text-slate-650 block">مادة الشراء المطلوبة</label>
                      <input 
                        type="text" 
                        value="تأمين 4 شاحنات رمل أبيض ناعم" 
                        disabled 
                        className="w-full h-9 bg-white border border-slate-200 px-3 rounded-lg text-slate-600 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="font-black text-slate-650 block">القيمة التقديرية (ر.س)</label>
                      <input 
                        type="text" 
                        value="3,200 ر.س" 
                        disabled 
                        className="w-full h-9 bg-white border border-slate-200 px-3 rounded-lg text-slate-600 text-xs font-mono font-bold"
                      />
                    </div>

                    <Button 
                      onClick={() => {
                        setSuperOrderSent(true);
                        playSoundEffect();
                        toast.success('تم إرسال طلب الشراء إلى الإدارة بنجاح');
                      }}
                      className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl border-none shadow-sm"
                    >
                      تأكيد إرسال الطلب للإدارة ✓
                    </Button>
                  </div>
                )}
              </div>
            )
          }
        ];

      case 'worker':
        return [
          {
            title: 'كشف حسابك ويومياتك في جيبك بشكل شفاف',
            badge: 'بوابة موظفي الميدان',
            desc: 'يرتكز ميثاق خبراء الرسم على توفير الأمان التام والحقوق الواضحة. يمكنك الدخول للموقع من هاتفك في أي وقت لتطلع على رصيدك ويومياتك المعتمدة وحوافز المشرف.',
            tip: 'انقر على كرات التبديل باليسار لإظهار أو إخفاء التفاصيل المالية الحساسة لجيبك.',
            playground: (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-3xl bg-slate-950 text-white p-5 text-right relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-lg font-black">الحساب الشخصي</span>
                      <h4 className="font-extrabold text-xs text-slate-100 mt-1">كشف العمالة اليومي</h4>
                    </div>
                    <HardHat className="w-6 h-6 text-teal-400" />
                  </div>

                  <p className="text-[10px] text-slate-400 font-bold mb-1">صافي المستحقات المعتمدة والمكافآت:</p>
                  <p className="text-2xl font-black text-emerald-400 font-mono tracking-wider">
                    {workerDetailsVisible ? '4,350 ر.س' : '••••• ر.س'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-bold">
                    <button 
                      onClick={() => {
                        setWorkerDetailsVisible(!workerDetailsVisible);
                        playSoundEffect();
                      }}
                      className="text-teal-400 flex items-center gap-1.5 focus:outline-none border-none cursor-pointer"
                    >
                      {workerDetailsVisible ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          <span>إخفاء الرصيد المالي</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 animate-pulse" />
                          <span>عرض كشف اليوميات الحالي</span>
                        </>
                      )}
                    </button>

                    <span className="text-slate-400 text-[10px]">موقع: مستودعات الهيئة</span>
                  </div>

                  {workerDetailsVisible && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 pt-3 border-t border-white/5 space-y-1 text-[10px] text-slate-300 font-semibold"
                    >
                      <div className="flex justify-between">
                        <span>قيمة يوميات الحضور الشهرية:</span>
                        <span>3,900 ر.س (26 يوم)</span>
                      </div>
                      <div className="flex justify-between text-teal-400">
                        <span>المكافآت (حافز جودة):</span>
                        <span>+ 450 ر.س</span>
                      </div>
                      <div className="flex justify-between text-rose-450 text-rose-450/90 text-red-400">
                        <span>الخصومات أو السلف المستلمة:</span>
                        <span>- 0.00 ر.س</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )
          },
          {
            title: 'رنين الإشعارات الصوتي بالدفعات والتعاميم',
            badge: 'تنبيهات فورية',
            desc: 'لا حاجة للاتصال بالمشرف أو المحاسب للسؤال عن راتبك. عندما يعتمد المدير العام السلفة أو الراتب، ستحصل فوراً على إشعار منبثق مصحوباً برنين تنبيه مميز يسمعه هاتفك بالحال.',
            tip: 'اضغط على زر اختبار النغمة للتأكد من فاعلية مكبر الصوت بهاتفك.',
            playground: (
              <div className="space-y-4 text-center">
                <Button 
                  onClick={() => {
                    playSoundEffect();
                    setWorkerDeviceAlert(true);
                    toast.success('تم إرسال تنبيه صوتي فوري لجهازك!');
                  }}
                  className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none"
                >
                  <Volume2 className="w-4 h-4 animate-bounce text-yellow-300" />
                  تشغيل واختبار نغمة التنبيه المستعجل 🔊
                </Button>

                {workerDeviceAlert && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-teal-50 border border-teal-200 text-teal-950 rounded-2xl text-right space-y-2 text-xs"
                  >
                    <div className="font-black text-teal-900 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />
                      <span>محاكاة إشعار: تم تحويل مستحقاتك</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                      تنبيه رسمي: "أهلاً بك، تم إطلاق دفعة مالية بقيمة 1,200 ر.س السلفة المطلوبة على حساب خزينتك بالشركة. شكراً لجهودكم في الميدان!"
                    </p>
                  </motion.div>
                )}
              </div>
            )
          },
          {
            title: 'الأدوات والعهدة وتوثيق المسؤولية',
            badge: 'العهدة والسلامة',
            desc: 'المركبة، الدريلات، والرافعات التي تلقتها عهدتك مسجلة الكترونياً لحفظ مسؤولية الشركة وحمايتك من أي مطالبات مغلوطة.',
            tip: 'يمكنك إخطار المسؤول بطلب صيانة أو توثيق استلام العهدة المخصصة كرتياً.',
            playground: (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                    <h5 className="font-extrabold text-slate-800">تفاصيل العهدة بمسؤوليتك الحالية</h5>
                    <Smartphone className="w-4 h-4 text-slate-500" />
                  </div>

                  <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                    <p className="font-black text-indigo-700">شاحنة نقل ايسوزو دينا (موديل 2023)</p>
                    <p className="text-[10px] text-slate-400 font-bold">الرقم: ح ر د 4310 | الحالة الموثقة: ممتازة</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setWorkerReportStatus(true);
                        playSoundEffect();
                        toast.success('تم توجيه بلاغ الصيانة للمهندس المشرف بالموقع');
                      }}
                      disabled={workerReportStatus}
                      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[10px] font-bold h-9 rounded-xl flex-1 flex items-center justify-center"
                    >
                      {workerReportStatus ? '✓ جاري متابعة الصيانة' : '⚠️ الإبلاغ عن عطل / طلب صيانة'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          }
        ];

      default: // employee / default view
        return [
          {
            title: 'الملف التعريفي وتسجيل الدوام والبطاقة الشاملة',
            badge: 'بوابة الموظف بالشركة',
            desc: 'بوابتك الذاتية تساعدك على تتبع ساعات الحضور والانصراف، مراجعة ملفك الشخصي المعتمد من الموارد البشرية، ورفع فواتير العهد الفردية.',
            tip: 'انقر على زر البصمة لتوثيق وتحضير نفسك في نظام الدوام الافتراضي التوضيحي.',
            playground: (
              <div className="space-y-4 text-center">
                <div className="bg-slate-50 border border-slate-250 p-6 rounded-3xl space-y-4 max-w-sm mx-auto text-right text-xs">
                  <div className="flex items-center justify-between border-b border-slate-150 pb-3">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">البطاقة المهنية الرقمية</h4>
                      <p className="text-[10px] text-slate-405 text-slate-500 font-bold mt-0.5">مؤسسة خبراء الرسم للمقاولات</p>
                    </div>
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">حالة حضورك لليوم:</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                      empAttendanceLocal === 'on' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {empAttendanceLocal === 'on' ? 'تم تسجيل الحضور 📍' : 'خارج الخدمة'}
                    </span>
                  </div>

                  <button 
                    onClick={() => {
                      setEmpAttendanceLocal(empAttendanceLocal === 'off' ? 'on' : 'off');
                      playSoundEffect();
                      if(empAttendanceLocal === 'off') {
                        toast.success('مرحبا بك! تم رصد موقعك وتسجيل حضورك للمركز بالشركة');
                      }
                    }}
                    className={`w-full h-11 rounded-2xl font-black text-xs gap-2 flex items-center justify-center border transition cursor-pointer ${
                      empAttendanceLocal === 'on' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-inner' : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    {empAttendanceLocal === 'on' ? 'تسجيل الانصراف والخروج ⏱️' : 'بصم إثبات الحضور والدوام'}
                  </button>
                </div>
              </div>
            )
          },
          {
            title: 'إرسال ومتابعة كشف الطلبات والسلف',
            badge: 'طلبات وعهد الموظف',
            desc: 'يمكنك اختيار صيغة الطلبات الإدارية كالإجازات السنوية أو السلف المالية، واحتساب راتبك وإرسال الفواتير للمحاسب آلياً.',
            tip: 'اختر نوع الطلب من القائمة المنسدلة وشاهد كيف يرسم النظام دورة المراجعة القانونية.',
            playground: (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 text-right text-xs shadow-sm">
                  <label className="font-black text-slate-700 block">حدد نموذج الإرسال القانوني:</label>
                  <select 
                    value={empRequestType} 
                    onChange={(e) => {
                      setEmpRequestType(e.target.value);
                      playSoundEffect();
                      toast.info(`تم تفعيل مستند طلب الموظف: ${e.target.value === 'vacation' ? 'إجازة سنوية' : 'سلفة مالية طارئة'}`);
                    }}
                    className="w-full h-10 border border-slate-200 px-3 rounded-xl bg-slate-50 text-slate-700 font-bold focus:border-indigo-500"
                  >
                    <option value="vacation">طلب إجازة اعتيادية سنوية (30 يوم برصيد)</option>
                    <option value="advance">طلب سلفة مالية مقتطعة من راتب الشهر الجاري</option>
                  </select>

                  <div className="pt-3 border-t border-slate-105 border-slate-100">
                    <h5 className="font-extrabold text-[11px] text-slate-500 mb-2">مراحل التدقيق والموافقات:</h5>
                    
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span className="text-indigo-600 font-black">1. التقديم 📝</span>
                      <span className={empRequestType === 'advance' ? 'text-indigo-600 font-black' : ''}>2. التدقيق المالي ⚙️</span>
                      <span>3. الاعتماد النهائي 🏢</span>
                    </div>

                    <div className="w-full h-1 bg-slate-100 rounded-full mt-2 relative">
                      <div className={`h-full bg-indigo-600 rounded-full transition-all duration-300 ${
                        empRequestType === 'advance' ? 'w-2/3' : 'w-1/3'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
            )
          }
        ];
    }
  };

  const steps = getRoleSteps();
  const activeStepContent = steps[currentStep];

  const handleNext = () => {
    playSoundEffect();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      toast.success('رائع! أصبحت الآن جاهزاً كلياً لبدء العمل في النظام');
      onComplete();
    }
  };

  const handleBack = () => {
    playSoundEffect();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-6 md:pt-12 px-4 pb-14 text-right" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 md:gap-8 flex-1 px-4">
        
        {/* TOP STATUS BAR & LOGO */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-inner">
              <img src="https://i.imgur.com/yYZDeHZ.jpg" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">مؤسسة خبراء الرسم للمقاولات</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-slate-550 font-black text-slate-500 uppercase tracking-widest text-[#008080]">نظام التدريب المالي التفاعلي المتميز</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold">التقدم بالتدريب:</span>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-2 rounded-full transition-all ${
                    i === currentStep ? 'w-8 bg-indigo-600' : i < currentStep ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-200'
                  }`} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* CORE INTERACTIVE WIZARD BODY (Two Column Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white border border-slate-200/80 rounded-[2.5rem] overflow-hidden shadow-2xl flex-1">
          
          {/* RIGHT COLUMN: Interactive Description & Value cards */}
          <div className="lg:col-span-5 p-8 md:p-12 flex flex-col justify-between bg-slate-50 lg:border-l border-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-150-10 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-6 relative z-10">
              {/* Badge indicating chosen role */}
              <div className="flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-700 border border-indigo-250 border-indigo-200 px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-wider">
                  🎯 دليل: {activeStepContent.badge}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">الخطوة {currentStep + 1} من {steps.length}</span>
              </div>

              {/* Animated Text Block */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-snug">{activeStepContent.title}</h1>
                  <p className="text-slate-650 text-xs md:text-sm leading-relaxed font-bold text-slate-500">{activeStepContent.desc}</p>
                </motion.div>
              </AnimatePresence>

              {/* Training Assistant Directive */}
              <div className="bg-indigo-950 text-white rounded-2xl p-4 border border-indigo-900 shadow-md space-y-2 mt-4">
                <div className="flex items-center gap-1.5 text-yellow-400 font-black text-xs">
                  <Award className="w-4 h-4 animate-spin-slow animate-bounce" />
                  <span>توجيه المدرب التفاعلي:</span>
                </div>
                <p className="text-[11px] leading-relaxed font-semibold text-slate-200">{activeStepContent.tip}</p>
              </div>
            </div>

            {/* Stepper controls bottom left */}
            <div className="flex gap-3 justify-between items-center mt-8 pt-6 border-t border-slate-200 relative z-10">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className="px-4 h-11 bg-white hover:bg-slate-100 disabled:opacity-30 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              <Button
                onClick={handleNext}
                className="px-6 h-11 bg-slate-900 hover:bg-slate-950 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 border-none shadow-md active:scale-95 transition"
              >
                <span>{currentStep === steps.length - 1 ? 'فهمت، لنبدأ التطبيق المباشر!' : 'متابعة الخطوة التالية'}</span>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* LEFT COLUMN: Visual Live Mobile/Desktop Simulator (Playground) */}
          <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white relative">
            <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="max-w-md w-full mx-auto space-y-6 relative z-10">
              
              {/* Simulator shell header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <Smartphone className="w-4 h-4 text-indigo-505 text-indigo-500" />
                  <span>لوحة المعاينة التفاعلية والمحاكاة</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                </div>
              </div>

              {/* Animated Playground content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className="min-h-[220px] flex flex-col justify-center"
                >
                  {activeStepContent.playground}
                </motion.div>
              </AnimatePresence>

              {/* Micro instructions indicating this is a safe test zone */}
              <div className="bg-slate-50 border border-slate-150-5 p-3 rounded-xl border border-slate-100 flex items-center gap-2.5 text-[10px] text-slate-400 font-bold leading-relaxed">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <p>منطقة تدريب مشفرة وآمنة تماماً. تفاعلك بالضغط أو تجربة العمليات هنا لا يؤثر على الخزائن أو السجلات الحالية للشركة.</p>
              </div>

            </div>
          </div>

        </div>

        {/* BOTTOM OPTION TO DIRECTLY LAUNCH/SKIP */}
        <div className="text-center space-y-3">
          <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
            يمكنك دائماً مراجعة هذا البرنامج التعليمي الفاخر بطلب مباشر من المساعد الذكي أو أيقونة الإعدادات العلوية.
          </p>
          <button 
            onClick={() => {
              playSoundEffect();
              onComplete();
            }}
            className="text-xs text-slate-550 border-b border-dashed border-slate-350 hover:text-indigo-600 transition font-black text-rose-500 leading-none cursor-pointer"
          >
            تخطي التدريب التفاعلي والتنقل المباشر للمنصة الرئيسية ➔
          </button>
        </div>

      </div>
    </div>
  );
}
