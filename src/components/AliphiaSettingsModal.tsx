import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAliphiaCredentials, saveAliphiaCredentials, checkAliphiaConnection } from '../lib/aliphia';
import { toast } from 'sonner';
import { Server, KeyRound, Mail, Lock, User, Hash, Percent, ExternalLink, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AliphiaSettingsModal({ open, onOpenChange, onSuccess }: Props) {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [apiKey, setApiKey]             = useState('');
  const [userId, setUserId]             = useState('');
  const [invoiceGroupId, setInvoiceGroupId] = useState('1');
  const [taxRateId, setTaxRateId]       = useState('');
  const [isVerifying, setIsVerifying]   = useState(false);
  const [hasLocalCreds, setHasLocalCreds] = useState(false);

  useEffect(() => {
    if (open) {
      setHasLocalCreds(!!localStorage.getItem('aliphia_credentials'));
      getAliphiaCredentials().then((creds) => {
        if (creds) {
          setUsername(creds.username || '');
          setPassword(creds.password || '');
          setApiKey(creds.apiKey || '');
          setUserId(creds.userId || '');
          setInvoiceGroupId(creds.invoiceGroupId || '1');
          setTaxRateId(creds.taxRateId || '');
        }
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!username || !password || !apiKey) {
      toast.error('الرجاء تعبئة: البريد، كلمة المرور، ومفتاح API');
      return;
    }

    setIsVerifying(true);
    const toastId = toast.loading('جاري التحقق من الاتصال...');
    
    try {
      await saveAliphiaCredentials({ username, password, apiKey, userId, invoiceGroupId, taxRateId });
      const checkResult = await checkAliphiaConnection();
      
      if (checkResult.status === 'connected') {
        toast.success('✅ تم الربط بنجاح!', { id: toastId });
        if (onSuccess) onSuccess();
        onOpenChange(false);
      } else {
        toast.error(checkResult.message || 'بيانات غير صحيحة أو يوجد خلل في الاتصال', { id: toastId });
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء الاتصال', { id: toastId });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Server className="w-5 h-5 text-emerald-600" />
            إعدادات ربط منصة ألف ياء
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-5">

          {/* ── بيانات تسجيل الدخول ── */}
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">بيانات تسجيل الدخول</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs font-bold flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> البريد الإلكتروني</Label>
                <Input dir="ltr" value={username} onChange={e => setUsername(e.target.value)} placeholder="example@gmail.com" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> كلمة المرور</Label>
                <Input type="password" dir="ltr" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> مفتاح API</Label>
                <Input type="password" dir="ltr" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="ali_xxxxx" className="h-10 rounded-xl" />
              </div>
            </div>
          </div>

          {/* ── إعدادات المستندات ── */}
          <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">إعدادات إنشاء المستندات</p>
              <a
                href="https://aliphia.com/en/api-docs/"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> وثائق API
              </a>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold flex items-center gap-1"><User className="w-3 h-3" /> User ID</Label>
                <Input
                  dir="ltr"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="1"
                  className="h-9 rounded-xl text-center font-mono text-sm"
                />
                <p className="text-[9px] text-slate-400">رقمك في ألف ياء</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold flex items-center gap-1"><Hash className="w-3 h-3" /> Group ID</Label>
                <Input
                  dir="ltr"
                  value={invoiceGroupId}
                  onChange={e => setInvoiceGroupId(e.target.value)}
                  placeholder="1"
                  className="h-9 rounded-xl text-center font-mono text-sm"
                />
                <p className="text-[9px] text-slate-400">مجموعة الترقيم</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold flex items-center gap-1"><Percent className="w-3 h-3" /> Tax ID</Label>
                <Input
                  dir="ltr"
                  value={taxRateId}
                  onChange={e => setTaxRateId(e.target.value)}
                  placeholder="4"
                  className="h-9 rounded-xl text-center font-mono text-sm"
                />
                <p className="text-[9px] text-slate-400">معرّف ضريبة 15%</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-sm">💡</span>
              <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                لمعرفة User ID: سجل دخول لألف ياء ← الإعدادات ← إدارة المستخدمين. لمعرفة Tax ID: اذهب لإعدادات الضرائب وانسخ رقم ضريبة 15%.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          {hasLocalCreds && (
            <Button
              type="button"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 text-xs h-9 rounded-xl px-3"
              onClick={() => {
                localStorage.removeItem('aliphia_credentials');
                setUsername(''); setPassword(''); setApiKey('');
                setUserId(''); setInvoiceGroupId('1'); setTaxRateId('');
                setHasLocalCreds(false);
                toast.success('تم مسح البيانات');
                if (onSuccess) onSuccess();
                onOpenChange(false);
              }}
            >
              حذف البيانات
            </Button>
          )}
          <div className="flex gap-2 mr-auto">
            <Button variant="outline" className="rounded-xl h-9 text-sm" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 text-sm gap-2"
              onClick={handleSave}
              disabled={isVerifying}
            >
              {isVerifying ? 'جاري التحقق...' : <><CheckCircle2 className="w-4 h-4" /> تحقق وحفظ</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
