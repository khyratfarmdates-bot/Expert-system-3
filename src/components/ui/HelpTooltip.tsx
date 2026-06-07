import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { HelpCircle, X, BookOpen, ChevronDown, ChevronUp, Lightbulb, Info } from 'lucide-react';

/* ══════════════════════════════════════════════════════
   HelpTooltip — Simple inline contextual tooltip
   Usage: <HelpTooltip content="شرح الحقل هنا" />
   ══════════════════════════════════════════════════════ */
export function HelpTooltip({ content, size = 'md' }: {
  content: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <div className="relative inline-flex items-center mx-1.5 select-none z-30">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="text-amber-500 hover:text-amber-600 hover:scale-110 transition-all cursor-help outline-none p-0.5 rounded-full hover:bg-amber-50/50"
        aria-label="مساعدة"
      >
        <HelpCircle className={`${iconSize} drop-shadow-sm`} />
      </button>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 right-1/2 translate-x-1/2 w-60 p-3 bg-slate-900 text-white rounded-2xl text-[10px] font-bold leading-relaxed shadow-xl border border-slate-800 text-right z-50 pointer-events-none"
          >
            <div className="absolute top-full right-1/2 translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-800" />
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   HelpBadge — Inline info badge for section labels
   Usage: <HelpBadge text="ما هذا القسم؟" />
   ══════════════════════════════════════════════════════ */
export function HelpBadge({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[9px] font-black text-blue-500 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-full px-2 py-0.5 transition-all"
      >
        <Info className="w-2.5 h-2.5" />
        ما هذا؟
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 w-64 bg-white border border-blue-100 rounded-2xl shadow-xl p-4 z-50 text-right"
          >
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">{text}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 left-2 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
            >
              <X className="w-3 h-3 text-slate-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ModuleHelp — Full help panel for a module/page
   Shows a floating button that expands to a rich help panel
   Usage:
   <ModuleHelp
     title="دليل الوحدة المالية"
     description="وصف عام للوحدة"
     steps={[{ icon: ..., title: '...', desc: '...' }]}
     tips={['نصيحة 1', 'نصيحة 2']}
   />
   ══════════════════════════════════════════════════════ */
interface HelpStep {
  icon: React.ElementType;
  title: string;
  desc: string;
  color?: string;
}

interface ModuleHelpProps {
  title: string;
  description: string;
  steps: HelpStep[];
  tips?: string[];
  shortcut?: string;
}

export function ModuleHelp({ title, description, steps, tips, shortcut }: ModuleHelpProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedStep, setExpandedStep] = React.useState<number | null>(null);

  return (
    <>
      {/* Floating Help Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-4 py-2.5 shadow-lg shadow-amber-500/30 transition-colors font-bold text-xs"
        title="فتح دليل المساعدة"
      >
        <BookOpen className="w-4 h-4" />
        <span className="hidden sm:inline">دليل الاستخدام</span>
      </motion.button>

      {/* Help Panel Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: -60, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -60, scale: 0.97 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
              dir="rtl"
            >
              {/* Header */}
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black opacity-80 uppercase tracking-widest">دليل الاستخدام</span>
                  </div>
                </div>
                <h2 className="text-xl font-black text-right">{title}</h2>
                <p className="text-xs text-white/80 mt-1 text-right leading-relaxed">{description}</p>
                {shortcut && (
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5 text-[10px] font-bold">
                    <span>⌨️</span>
                    <span>{shortcut}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* Steps */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-right">خطوات الاستخدام</p>
                  <div className="space-y-2">
                    {steps.map((step, i) => {
                      const Icon = step.icon;
                      const isExpanded = expandedStep === i;
                      const color = step.color || 'bg-slate-100 text-slate-600';
                      return (
                        <motion.div
                          key={i}
                          layout
                          className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedStep(isExpanded ? null : i)}
                            className="w-full flex items-center gap-3 p-3 text-right hover:bg-slate-100 transition"
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-slate-400 bg-slate-200 rounded-full w-4 h-4 flex items-center justify-center shrink-0">{i + 1}</span>
                                <p className="text-xs font-black text-slate-800 truncate">{step.title}</p>
                              </div>
                            </div>
                            {isExpanded
                              ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            }
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <p className="px-4 pb-3 text-[11px] text-slate-600 leading-relaxed text-right border-t border-slate-100 pt-2">
                                  {step.desc}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Tips */}
                {tips && tips.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-right">💡 نصائح مهمة</p>
                    <div className="space-y-2">
                      {tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-amber-900 font-semibold leading-relaxed text-right">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
                <p className="text-[10px] text-slate-400 text-center font-bold">
                  نظام Expert — دليل المستخدم الذكي
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* Default export for backward compatibility */
export default HelpTooltip;
