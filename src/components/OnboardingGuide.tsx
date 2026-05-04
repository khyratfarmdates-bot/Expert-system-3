import React from 'react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { LayoutDashboard, Users, Zap, Briefcase, ShoppingCart, Target, ShieldCheck, CheckCircle2, ChevronLeft } from 'lucide-react';

interface OnboardingGuideProps {
  role: string;
  onComplete: () => void;
}

export default function OnboardingGuide({ role, onComplete }: OnboardingGuideProps) {
  const getRoleContent = () => {
    switch (role) {
      case 'manager':
        return {
          title: 'مرحباً بك في نظام خبراء الرسم - لوحة الإدارة العليا',
          description: 'نظام متكامل يمنحك السيطرة الكاملة على كافة زوايا العمل، من الإدارة المالية وحتى متابعة أصغر تفاصيل الميدان.',
          features: [
            { icon: LayoutDashboard, title: 'لوحة تحكم إدارية شاملة', desc: 'نظرة عامة على سير العمل، والمؤشرات، والمبيعات بشكل حي.' },
            { icon: Zap, title: 'موجز الإدارة التنفيذي (EBS)', desc: 'تقارير فورية باستخدام الذكاء الاصطناعي لاكتشاف التجاوزات والأخطاء.' },
            { icon: ShieldCheck, title: 'مركز الاعتمادات المالية', desc: 'قبول أو رفض طلبات الشراء، السلف، والمصروفات، بنقرة واحدة.' },
            { icon: Users, title: 'إدارة شاملة للموارد البشرية', desc: 'متابعة الحضور، الرواتب، التقييمات الشهرية، وإرسال التنبيهات الإدارية المباشرة.' },
          ]
        };
      case 'supervisor':
        return {
          title: 'مرحباً بك المشرف/المسؤول الميداني',
          description: 'صلاحياتك مخصصة للتحكم في الميدان والموظفين التابعين لك، ورفع الطلبات للإدارة للصرف والاعتماد.',
          features: [
            { icon: Briefcase, title: 'إدارة سير المشاريع', desc: 'تسجيل التكاليف، إسناد المهام، وتحديث نسب الإنجاز يومياً.' },
            { icon: ShoppingCart, title: 'رفع طلبات الشراء والمصروفات', desc: 'طلب ما تحتاجه للمشاريع أو العهدة، ومتابعة حالة اعتمادها من الإدارة.' },
            { icon: Users, title: 'إدارة العمال اليومية', desc: 'تسجيل الحضور والانصراف، إضافة اليوميات، الخصومات والمكافآت، ومتابعة الرصيد المستحق.' },
            { icon: Target, title: 'رادار الأداء', desc: 'تقييم العمال والموظفين لديك بشكل دوري.' },
          ]
        };
      case 'worker':
        return {
          title: 'مرحباً بك، نافذتك كعامل بالنظام',
          description: 'من خلال هذا الرابط الخاص بك، يمكنك متابعة مستحقاتك، وتقييماتك بشكل شفاف ولحظي.',
          features: [
            { icon: CheckCircle2, title: 'تتبع المستحقات واليوميات', desc: 'مراجعة المبالغ المستحقة لك، المكافآت أو الخصومات اليومية فور تسجيلها.' },
            { icon: Zap, title: 'الاستلام الفوري للإشعارات', desc: 'استلام التنبيهات وإشعارات الإدارة مباشرة عبر جهازك مع تنبيهات صوتية.' },
            { icon: LayoutDashboard, title: 'متابعة الموقع والمشاريع', desc: 'معرفة المشاريع المخصصة لك، والعهدة التي بعهّدتك، لضمان حقوقك الدقيقة.' },
          ]
        };
      default: // employee
        return {
          title: 'مرحباً بك في نظام خبراء الرسم',
          description: 'بوابتك الذاتية لمتابعة ملفك، حضورك، ورفع طلباتك بشكل إلكتروني سلس.',
          features: [
            { icon: Users, title: 'بياناتك وطلباتك الذاتية', desc: 'تحديث بياناتك، متابعة رواتبك وصرفياتك وحركة حضورك وانصرافك.' },
            { icon: ShoppingCart, title: 'نظام الطلبات', desc: 'رفع طلبات إجازة، عهدة، سُلف، ومشتريات، وتلقي الإشعار بقرار الإدارة.' },
            { icon: ShieldCheck, title: 'تواصل مباشر مع الإدارة', desc: 'إرسال ملاحظات، واستلام تقييمك الشهري والرسائل الإدارية.' },
          ]
        };
    }
  };

  const content = getRoleContent();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-12 md:pt-20 px-4 pb-20" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="max-w-4xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <img src="https://i.imgur.com/yYZDeHZ.jpg" alt="Logo" className="w-24 h-24 object-contain rounded-2xl mx-auto mb-6 shadow-sm border border-slate-200 bg-white p-2" />
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">{content.title}</h1>
          <p className="text-lg text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">{content.description}</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {content.features.map((feature, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="h-full border-none shadow-sm flex items-start gap-4 p-5 md:p-6 bg-white rounded-2xl hover:shadow-md transition-shadow">
                <div className="p-3 md:p-4 bg-primary/10 text-primary rounded-xl shrink-0">
                  <feature.icon className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 mb-2">{feature.title}</h3>
                  <p className="text-sm md:text-base text-slate-600 leading-relaxed font-medium">{feature.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <Button 
            onClick={onComplete}
            className="h-14 px-8 bg-gray-900 hover:bg-black text-white text-lg font-bold rounded-2xl gap-3 transition-transform active:scale-95"
          >
            فهمت، لننطلق إلى العمل
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <p className="mt-6 text-sm text-slate-500 font-medium">يمكنك قراءة هذا الدليل لاحقاً عن طريق سؤال المساعد الذكي أو قائمة الإعدادات.</p>
        </motion.div>
      </div>
    </div>
  );
}
