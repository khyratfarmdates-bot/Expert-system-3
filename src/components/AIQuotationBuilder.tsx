import React, { useState } from 'react';
import {
  Camera, Upload, Zap, Loader2, Plus, Trash2,
  FileText, Send, CheckCircle2, UserPlus, Share2,
  ExternalLink, Receipt, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import AliphiaClientSelector, { AliphiaClient } from './AliphiaClientSelector';
import AliphiaStatusCard from './AliphiaStatusCard';
import { createAliphiaDocument } from '../lib/aliphia';

interface Item {
  id: string;
  name: string;
  qty: number;
  price: number;
  desc: string;
}

interface Props {
  type?: 'quotation' | 'invoice';
}

const emptyItem = (): Item => ({
  id: Math.random().toString(36).slice(2),
  name: '', qty: 1, price: 0, desc: ''
});

export default function AIQuotationBuilder({ type = 'quotation' }: Props) {
  const { user } = useAuth();
  const isQuote = type === 'quotation';
  const label   = isQuote ? 'عرض السعر' : 'الفاتورة';

  // ── State ──────────────────────────────────────────────
  const [client,      setClient]      = useState<AliphiaClient | null>(null);
  const [items,       setItems]       = useState<Item[]>([emptyItem()]);
  const [issueDate,   setIssueDate]   = useState(new Date().toISOString().split('T')[0]);
  const [dueDate,     setDueDate]     = useState('');
  const [notes,       setNotes]       = useState('');
  const [photoURL,    setPhotoURL]    = useState('');
  const [isScanning,  setIsScanning]  = useState(false);
  const [isSending,   setIsSending]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // نتيجة الإرسال
  const [result, setResult] = useState<{
    docNumber?: string;
    pdfUrl?: string;
    clientName?: string;
    total: number;
  } | null>(null);

  // ── Calculations ───────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat      = subtotal * 0.15;
  const total    = subtotal + vat;

  // ── Helpers ────────────────────────────────────────────
  const updateItem = (id: string, field: keyof Item, val: any) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: val } : i));

  const removeItem = (id: string) =>
    setItems(p => p.length > 1 ? p.filter(i => i.id !== id) : p);

  // ── AI Scan ────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) { toast.error('الملف أكبر من 3 ميجابايت'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoURL(reader.result as string);
    reader.readAsDataURL(file);
  };

  const scanDocument = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!photoURL) { toast.error('ارفع الصورة أولاً'); return; }
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') { toast.error('مفتاح الذكاء الاصطناعي غير متوفر'); return; }

    setIsScanning(true);
    const tid = toast.loading('جاري قراءة الوثيقة...');
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: { parts: [
          { inlineData: { mimeType: 'image/jpeg', data: photoURL.split(',')[1] } },
          { text: `Extract line items from this document. Return ONLY a JSON array like:
[{"name":"item name","qty":1,"price":0,"desc":"optional details"}]
Rules: qty and price must be numbers. If price unknown set to 0.` }
        ]},
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(res.text || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        setItems(parsed.map((x: any) => ({
          id: Math.random().toString(36).slice(2),
          name: x.name || '', qty: Number(x.qty) || 1,
          price: Number(x.price) || 0, desc: x.desc || ''
        })));
        toast.success(`✅ تم استخراج ${parsed.length} بند`);
        setPhotoURL('');
      } else {
        toast.error('لم يتم العثور على بنود');
      }
    } catch (e) {
      toast.error('فشل التحليل');
    } finally {
      setIsScanning(false);
      toast.dismiss(tid);
    }
  };

  // ── Send to Aliphia ────────────────────────────────────
  const handleSendTrigger = () => {
    if (!client) { toast.error('اختر العميل أولاً'); return; }
    if (items.every(i => !i.name)) { toast.error('أضف بنداً واحداً على الأقل'); return; }
    setShowConfirm(true);
  };

  const handleSend = async () => {
    setShowConfirm(false);
    setIsSending(true);
    const tid = toast.loading(`جاري إنشاء ${label} في ألف ياء...`);
    try {
      const docData = {
        client_id: client.id,
        date: issueDate,
        date_due: dueDate || undefined,
        notes,
        items: items.filter(i => i.name).map(i => ({
          name: i.name, quantity: i.qty, price: i.price, description: i.desc
        }))
      };

      // حفظ في Firebase
      await addDoc(collection(db, isQuote ? 'quotations' : 'invoices'), {
        type,
        clientName: client.name,
        clientId: client.id,
        items: items.filter(i => i.name).map(i => i.name).join(', '),
        totalAmount: total,
        issueDate, dueDate, notes,
        createdBy: user?.uid,
        createdAt: new Date().toISOString()
      });

      // إرسال لألف ياء
      const res = await createAliphiaDocument(type, docData);

      // استخراج البيانات من استجابة ألف ياء بمرونة
      const docNum = res?.response?.quote_number || res?.response?.invoice_number ||
                     res?.quote_number || res?.invoice_number ||
                     res?.response?.id || res?.id || '—';
      const pdfUrl = res?.response?.pdf_url || res?.pdf_url || '';

      setResult({ docNumber: String(docNum), pdfUrl, clientName: client.name, total });
      toast.success(`🎉 تم إنشاء ${label} بنجاح!`, { id: tid });
    } catch (err: any) {
      console.error(err);
      toast.error(`فشل: ${err.message || 'خطأ غير معروف'}`, { id: tid });
    } finally {
      setIsSending(false);
    }
  };

  const shareWhatsApp = () => {
    if (!result) return;
    const text = `السلام عليكم ورحمة الله وبركاته،\n\nأهلاً بك أخي ${result.clientName}.\n\nمرفق ${label} رقم *${result.docNumber}* بقيمة *${result.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س* شاملاً ضريبة القيمة المضافة.${result.pdfUrl ? `\n\nيمكنك الاطلاع عليها من الرابط:\n${result.pdfUrl}` : ''}\n\nشكراً لتعاملكم معنا.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const reset = () => {
    setClient(null); setItems([emptyItem()]);
    setIssueDate(new Date().toISOString().split('T')[0]);
    setDueDate(''); setNotes(''); setPhotoURL(''); setResult(null);
  };

  // ── Success Screen ─────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-2xl mx-auto" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black">تم الإنشاء بنجاح! 🎉</h2>
            <p className="text-emerald-100 mt-1 font-medium">
              {isQuote ? 'عرض السعر' : 'الفاتورة'} جاهز في ألف ياء
            </p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-slate-400 mb-1">رقم المستند</p>
                <p className="text-xl font-black text-slate-800 font-mono">{result.docNumber}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                <p className="text-xs font-bold text-slate-400 mb-1">الإجمالي</p>
                <p className="text-xl font-black text-emerald-700 font-mono">
                  {result.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span className="text-sm font-normal">ر.س</span>
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">👤 {result.clientName}</span>
              <span className="text-xs text-slate-400">العميل</span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                onClick={shareWhatsApp}
                className="h-12 rounded-2xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold gap-2"
              >
                <Share2 className="w-4 h-4" /> واتساب
              </Button>
              {result.pdfUrl ? (
                <Button
                  onClick={() => window.open(result.pdfUrl, '_blank')}
                  className="h-12 rounded-2xl bg-slate-800 hover:bg-black text-white font-bold gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> فتح PDF
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl font-bold"
                  onClick={reset}
                >
                  إنشاء جديد
                </Button>
              )}
            </div>
            {result.pdfUrl && (
              <Button variant="ghost" onClick={reset} className="w-full text-slate-400 hover:text-slate-600 font-bold text-sm">
                + إنشاء {isQuote ? 'عرض سعر' : 'فاتورة'} جديد
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ──────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4" dir="rtl">

      {/* حالة الاتصال */}
      <AliphiaStatusCard />

      {/* ── الصف الأول: العميل + التواريخ ── */}
      <Card className="rounded-2xl border-slate-100 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-primary" /> العميل
              </Label>
              <AliphiaClientSelector onSelect={setClient} selectedClientId={client?.id} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">تاريخ الإصدار</Label>
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">تاريخ الانتهاء</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── الصف الثاني: البنود + مسح الذكاء الاصطناعي ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* البنود (2/3 عرض) */}
        <Card className="md:col-span-2 rounded-2xl border-slate-100 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              البنود والتسعير
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setItems(p => [...p, emptyItem()])} className="h-7 px-2 rounded-lg text-xs font-bold gap-1">
              <Plus className="w-3 h-3" /> إضافة بند
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {/* رأس الجدول */}
            <div className="grid grid-cols-[1fr_64px_96px_32px] gap-2 text-[10px] font-black text-slate-400 uppercase px-1">
              <span>البند</span><span className="text-center">الكمية</span><span className="text-center">السعر</span><span />
            </div>

            {items.map(item => (
              <div key={item.id} className="grid grid-cols-[1fr_64px_96px_32px] gap-2 items-start">
                <div className="space-y-1">
                  <Input
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                    placeholder="اسم المنتج أو الخدمة"
                    className="h-9 rounded-xl text-sm font-bold"
                  />
                  <Input
                    value={item.desc}
                    onChange={e => updateItem(item.id, 'desc', e.target.value)}
                    placeholder="مواصفات إضافية (اختياري)"
                    className="h-7 rounded-lg text-xs bg-slate-50"
                  />
                </div>
                <Input
                  type="number" value={item.qty || ''}
                  onChange={e => updateItem(item.id, 'qty', Number(e.target.value))}
                  className="h-9 rounded-xl text-center font-mono text-sm"
                  placeholder="1"
                />
                <Input
                  type="number" value={item.price || ''}
                  onChange={e => updateItem(item.id, 'price', Number(e.target.value))}
                  className="h-9 rounded-xl text-center font-mono text-sm"
                  placeholder="0.00"
                />
                <Button
                  variant="ghost" size="icon"
                  onClick={() => removeItem(item.id)}
                  className="h-9 w-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {/* الإجمالي */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span className="font-mono">{subtotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                <span>المجموع الفرعي</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span className="font-mono">{vat.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                <span>ضريبة القيمة المضافة 15%</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-800 bg-slate-50 px-4 py-2.5 rounded-xl">
                <span className="font-mono text-primary">{total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
                <span>الإجمالي النهائي</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* الذكاء الاصطناعي (1/3 عرض) */}
        <div className="space-y-3">
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" /> مسح ذكي بـ AI
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {photoURL ? (
                <div className="relative rounded-xl overflow-hidden aspect-square">
                  <img src={photoURL} alt="scan" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotoURL('')}
                    className="absolute top-2 left-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <Label
                  htmlFor="ai-scan-upload"
                  className="flex flex-col items-center justify-center gap-2 aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all text-center p-4"
                >
                  <Upload className="w-8 h-8 text-slate-300" />
                  <span className="text-xs font-bold text-slate-400">ارفع صورة كراسة الشروط أو طلب التوريد</span>
                </Label>
              )}
              <input id="ai-scan-upload" type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <Button
                onClick={scanDocument}
                disabled={!photoURL || isScanning}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white font-bold text-xs gap-2 shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isScanning ? 'جاري التحليل...' : 'استخراج البنود تلقائياً'}
              </Button>
            </CardContent>
          </Card>

          {/* ملاحظات */}
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <Label className="text-xs font-bold text-slate-500">ملاحظات (تظهر للعميل)</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="شروط الدفع، صلاحية العرض..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 font-medium"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── زر الإرسال ── */}
      <Button
        onClick={handleSendTrigger}
        disabled={isSending || !client || items.every(i => !i.name) || total === 0}
        className="w-full h-14 rounded-2xl font-black text-base gap-3 shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all active:scale-[0.99]"
      >
        {isSending ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإنشاء في ألف ياء...</>
        ) : isQuote ? (
          <><Send className="w-5 h-5" /> إنشاء عرض السعر وإرساله لألف ياء</>
        ) : (
          <><Receipt className="w-5 h-5" /> إصدار الفاتورة وإرسالها لألف ياء</>
        )}
      </Button>

      {/* CONFIRMATION DIALOG */}
      {showConfirm && (
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right border border-slate-100 dark:border-slate-800 shadow-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                {isQuote ? <Send className="w-5 h-5 text-indigo-600" /> : <Receipt className="w-5 h-5 text-emerald-600" />}
                تأكيد إنشاء {label} في ألف ياء
              </DialogTitle>
              <DialogDescription className="font-bold text-slate-500 dark:text-slate-400">
                يرجى التأكد من رغبتك في إرسال وإنشاء هذا المستند في حساب المؤسسة المحاسبي.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 text-xs font-bold text-slate-650 dark:text-slate-400 space-y-2 mt-3">
              <p><span className="text-slate-450 dark:text-slate-500">نوع المستند:</span> {label}</p>
              <p><span className="text-slate-450 dark:text-slate-500">العميل المستهدف:</span> {client?.name}</p>
              <p><span className="text-slate-450 dark:text-slate-500">المبلغ الإجمالي (شامل الضريبة):</span> {total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</p>
              <p><span className="text-slate-450 dark:text-slate-500">عدد البنود:</span> {items.filter(i => i.name).length}</p>
            </div>

            <div className="flex gap-2.5 pt-4">
              <Button
                onClick={handleSend}
                className={`flex-1 h-12 text-white font-black rounded-xl text-xs gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  isQuote ? 'bg-indigo-600 hover:bg-indigo-750 shadow-indigo-600/10' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                }`}
              >
                تأكيد وإرسال
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-850 dark:hover:bg-slate-800"
                onClick={() => setShowConfirm(false)}
              >
                إلغاء
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
