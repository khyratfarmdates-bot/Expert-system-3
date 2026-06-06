import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye, EyeOff, Zap, CheckCircle2, XCircle,
  AlertTriangle, Loader2, RefreshCw, ExternalLink,
  ShieldCheck, Gift, CreditCard
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GoogleGenAI } from '@google/genai';

interface Props {
  value: string;
  onChange: (v: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
}

type KeyStatus = 'idle' | 'checking' | 'valid_free' | 'valid_paid' | 'invalid' | 'quota_exceeded' | 'no_key';

interface KeyInfo {
  status: KeyStatus;
  availableModels: string[];
  usedModel?: string;
  tier?: string;
  errorMsg?: string;
  checkedAt?: string;
  prefix?: string;
}

const CANDIDATE_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-pro',
];

export default function GeminiKeyCard({ value, onChange, showKey, onToggleShow }: Props) {
  const [info, setInfo] = useState<KeyInfo>({ status: 'idle', availableModels: [] });

  const checkKey = useCallback(async (key: string) => {
    if (!key || key.trim().length < 10) {
      setInfo({ status: 'no_key', availableModels: [] });
      return;
    }

    setInfo({ status: 'checking', availableModels: [] });

    const trimmed = key.trim();
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const prefix = trimmed.slice(0, 8) + '••••••' + trimmed.slice(-4);
    const looksLikeFreeKey = trimmed.startsWith('AIzaSy');

    const ai = new GoogleGenAI({ apiKey: trimmed });

    /* ── Step 1: List available models ── */
    let availableModels: string[] = [];
    try {
      const listed = await ai.models.list();
      // Filter to text generation models only
      for await (const m of listed) {
        const name = (m as any).name || '';
        const baseId = name.replace('models/', '');
        if (
          baseId.startsWith('gemini') &&
          !(baseId.includes('embedding') || baseId.includes('vision') || baseId.includes('imagen'))
        ) {
          availableModels.push(baseId);
        }
      }
    } catch {
      // listing might fail for some keys — fall back to candidates
      availableModels = [...CANDIDATE_MODELS];
    }

    if (availableModels.length === 0) {
      availableModels = [...CANDIDATE_MODELS];
    }

    /* ── Step 2: Try each model until one works ── */
    let workingModel: string | null = null;
    let lastError = '';

    // Prefer candidates in our priority order if they appear in the list
    const ordered = [
      ...CANDIDATE_MODELS.filter(c => availableModels.includes(c)),
      ...availableModels.filter(m => !CANDIDATE_MODELS.includes(m)),
    ];

    for (const model of ordered.slice(0, 5)) {
      try {
        await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: 'hi' }] }],
        });
        workingModel = model;
        break;
      } catch (err: any) {
        const msg: string = err?.message || '';
        // Quota / rate limit = key is valid but exhausted
        if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          setInfo({
            status: 'quota_exceeded',
            availableModels: ordered,
            usedModel: model,
            tier: looksLikeFreeKey ? 'مجاني (Free Tier)' : 'مدفوع (Paid)',
            errorMsg: 'انتهت حصة الطلبات (Quota). انتظر أو ترقّ للمدفوع.',
            checkedAt: now,
            prefix,
          });
          return;
        }
        // Auth error = bad key
        if (
          msg.includes('API_KEY_INVALID') ||
          msg.includes('401') || msg.includes('403') ||
          msg.includes('invalid') || msg.includes('UNAUTHENTICATED')
        ) {
          lastError = 'المفتاح غير صحيح أو محظور.';
          break;
        }
        // Model not found → try next
        lastError = msg;
      }
    }

    if (workingModel) {
      setInfo({
        status: looksLikeFreeKey ? 'valid_free' : 'valid_paid',
        availableModels: ordered,
        usedModel: workingModel,
        tier: looksLikeFreeKey ? 'مجاني (Free Tier)' : 'مدفوع (Paid)',
        checkedAt: now,
        prefix,
      });
    } else {
      setInfo({
        status: 'invalid',
        availableModels: ordered,
        errorMsg: lastError || 'لم يُستجب أي نموذج. تحقق من المفتاح.',
        checkedAt: now,
        prefix,
      });
    }
  }, []);

  /* Auto-check on key change (debounced 1.5s) */
  useEffect(() => {
    if (!value || value.trim().length < 10) {
      setInfo({ status: 'no_key', availableModels: [] });
      return;
    }
    const t = setTimeout(() => checkKey(value), 1500);
    return () => clearTimeout(t);
  }, [value, checkKey]);

  const isValid = info.status === 'valid_free' || info.status === 'valid_paid';

  /* ─── Status pill ─── */
  const Pill = () => {
    const base = 'flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border';
    if (info.status === 'checking')
      return <span className={`${base} text-slate-500 bg-slate-50 border-slate-200`}><Loader2 className="w-3 h-3 animate-spin" /> جاري الفحص...</span>;
    if (info.status === 'valid_free')
      return <span className={`${base} text-emerald-700 bg-emerald-50 border-emerald-200`}><Gift className="w-3 h-3" /> مجاني ✓</span>;
    if (info.status === 'valid_paid')
      return <span className={`${base} text-emerald-700 bg-emerald-50 border-emerald-200`}><CreditCard className="w-3 h-3" /> مدفوع ✓</span>;
    if (info.status === 'quota_exceeded')
      return <span className={`${base} text-amber-700 bg-amber-50 border-amber-200`}><AlertTriangle className="w-3 h-3" /> انتهت الحصة</span>;
    if (info.status === 'invalid')
      return <span className={`${base} text-red-700 bg-red-50 border-red-200`}><XCircle className="w-3 h-3" /> مفتاح خاطئ</span>;
    return <span className={`${base} text-slate-400 bg-slate-50 border-slate-200`}><ShieldCheck className="w-3 h-3" /> لا يوجد مفتاح</span>;
  };

  const borderCls = isValid
    ? 'border-emerald-200 bg-emerald-50/20'
    : info.status === 'quota_exceeded'
    ? 'border-amber-200 bg-amber-50/20'
    : info.status === 'invalid'
    ? 'border-red-200 bg-red-50/20'
    : 'border-slate-200 bg-slate-50/50';

  return (
    <div className={`rounded-2xl border-2 p-5 space-y-4 transition-all ${borderCls}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isValid ? 'bg-emerald-100' : info.status === 'invalid' ? 'bg-red-100' : 'bg-slate-100'}`}>
            <Zap className={`w-4 h-4 ${isValid ? 'text-emerald-600' : info.status === 'invalid' ? 'text-red-500' : 'text-slate-500'}`} />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">مفتاح Gemini AI</p>
            <p className="text-[10px] text-slate-400 font-semibold">الفواتير · العروض · الموجز · المستندات</p>
          </div>
        </div>
        <Pill />
      </div>

      {/* Input */}
      <div className="relative">
        <Input
          type={showKey ? 'text' : 'password'}
          placeholder="AIzaSy••••••••••••••••••••••••••••••••••"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`h-12 rounded-xl text-left font-mono pr-10 pl-12 bg-white transition-all ${
            isValid ? 'border-emerald-300 focus:ring-emerald-100'
            : info.status === 'invalid' ? 'border-red-300 focus:ring-red-100'
            : 'border-slate-200'}`}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
        />
        {/* Left: show/hide */}
        <button type="button" onClick={onToggleShow}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        {/* Right: live indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {info.status === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {isValid && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {info.status === 'invalid' && <XCircle className="w-4 h-4 text-red-500" />}
          {info.status === 'quota_exceeded' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        </div>
      </div>

      {/* Details — shown when we have results */}
      {value && !['idle', 'checking', 'no_key'].includes(info.status) && (
        <div className={`rounded-xl p-3.5 space-y-2 border text-[11px] ${
          isValid ? 'bg-white border-emerald-100'
          : info.status === 'quota_exceeded' ? 'bg-amber-50 border-amber-100'
          : 'bg-red-50 border-red-100'}`}>

          {info.prefix && (
            <Row label="المفتاح" value={<span className="font-mono">{info.prefix}</span>} />
          )}
          {info.tier && (
            <Row label="النوع" value={<span className={isValid ? 'text-emerald-700' : ''}>{info.tier}</span>} />
          )}
          {info.usedModel && (
            <Row label="النموذج المُستخدم" value={<span className="font-mono text-indigo-600">{info.usedModel}</span>} />
          )}
          {info.availableModels.length > 0 && isValid && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">النماذج المتاحة</p>
              <div className="flex flex-wrap gap-1">
                {info.availableModels.slice(0, 8).map(m => (
                  <span key={m} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    m === info.usedModel
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>{m}</span>
                ))}
              </div>
            </div>
          )}
          {info.checkedAt && (
            <Row label="آخر فحص" value={<span className="text-slate-500">{info.checkedAt}</span>} />
          )}
          {info.errorMsg && (
            <p className={`rounded-lg px-2.5 py-1.5 font-bold ${
              info.status === 'quota_exceeded' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
              {info.errorMsg}
            </p>
          )}
          {info.status === 'valid_free' && (
            <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 font-semibold">
              ⓘ المجاني محدود بـ 1,500 طلب/يوم. للاستخدام المكثف يُنصح بالترقية.
            </p>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => checkKey(value)}
          disabled={!value || info.status === 'checking'}
          className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 hover:text-slate-800 disabled:opacity-40 transition">
          <RefreshCw className={`w-3 h-3 ${info.status === 'checking' ? 'animate-spin' : ''}`} />
          فحص يدوي
        </button>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:opacity-70 transition">
          احصل على مفتاح <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">{label}</span>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  );
}
