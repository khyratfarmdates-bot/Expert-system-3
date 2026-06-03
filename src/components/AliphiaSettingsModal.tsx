import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAliphiaCredentials, saveAliphiaCredentials, checkAliphiaConnection } from '../lib/aliphia';
import { toast } from 'sonner';
import { Server, KeyRound, Mail, Lock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AliphiaSettingsModal({ open, onOpenChange, onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (open) {
      getAliphiaCredentials().then((creds) => {
        if (creds) {
          setUsername(creds.username || '');
          setPassword(creds.password || '');
          setApiKey(creds.apiKey || '');
        }
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!username || !password || !apiKey) {
      toast.error('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }

    setIsVerifying(true);
    const toastId = toast.loading('جاري التحقق من صحة بيانات الربط...');
    
    try {
      // حفظ مبدئي للفحص
      await saveAliphiaCredentials({ username, password, apiKey });
      
      const checkResult = await checkAliphiaConnection();
      
      if (checkResult.status === 'connected') {
        toast.success('تم ربط حساب ألف ياء بنجاح!', { id: toastId });
        if (onSuccess) onSuccess();
        onOpenChange(false);
      } else {
        toast.error('البيانات غير صحيحة أو يوجد خلل في الاتصال', { id: toastId });
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء الاتصال', { id: toastId });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            إعدادات ربط خوادم ألف ياء
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500 mb-4">
            أدخل بيانات حسابك في منصة ألف ياء لتفعيل الربط المباشر مع العروض والفواتير. ستُحفظ هذه البيانات بشكل آمن في قاعدة بياناتك الخاصة.
          </p>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400"/> البريد الإلكتروني</Label>
            <Input 
              dir="ltr"
              value={username} 
              onChange={e => setUsername(e.target.value)}
              placeholder="example@gmail.com" 
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400"/> كلمة المرور</Label>
            <Input 
              type="password"
              dir="ltr"
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="********" 
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-slate-400"/> مفتاح الربط (API Key)</Label>
            <Input 
              type="password"
              dir="ltr"
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)}
              placeholder="ali_xxxxxxxxxxxxx" 
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700 text-white" 
            onClick={handleSave} 
            disabled={isVerifying}
          >
            {isVerifying ? 'جاري التحقق...' : 'تحقق وحفظ البيانات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
