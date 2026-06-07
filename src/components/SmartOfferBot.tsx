import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, Upload, Camera, Loader2, Plus, Trash2, 
  CheckCircle2, Share2, ExternalLink,
  FileText, Receipt, ShieldCheck, Clock,
  Coins, UserCheck, ChevronDown, Search, X, Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';
import { useAuth } from '../lib/AuthContext';
import { fetchAliphiaClients, fetchAliphiaQuotations, fetchAliphiaInvoices, createAliphiaDocument } from '../lib/aliphia';
import { db } from '../lib/firebase';
import { sendNotification } from '../lib/notifications';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';

interface Item {
  name: string;
  qty: number;
  price: number;
  desc: string;
}

export default function SmartOfferBot() {
  const { profile } = useAuth();
  const [dbProfile, setDbProfile] = useState<any>(null);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(collection(db, 'users'), where('uid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setDbProfile(snap.docs[0].data());
      }
    });
    return () => unsubscribe();
  }, [profile?.uid]);

  const isManager = profile?.role === 'manager';
  const isSalesRep = profile?.role === 'sales_rep';
  const blockQuotations = dbProfile?.blockQuotations === true;
  const blockInvoices = dbProfile?.blockInvoices === true;
  const canCreateQuote = isManager || isSalesRep;
  const canCreateInvoice = isManager || isSalesRep;

  const [promptInput, setPromptInput] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Client dropdown
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Loaded context
  const [clients, setClients] = useState<any[]>([]);
  const [quotesHistory, setQuotesHistory] = useState<any[]>([]);
  const [invoicesHistory, setInvoicesHistory] = useState<any[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  // Bot Output States
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [extractedItems, setExtractedItems] = useState<Item[]>([]);
  const [offerNotes, setOfferNotes] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [aiExplanation, setAiExplanation] = useState('');
  
  // Document target
  const [docType, setDocType] = useState<'quotation' | 'invoice'>('quotation');

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Result screen
  const [result, setResult] = useState<{
    type: 'quotation' | 'invoice';
    docNumber?: string;
    pdfUrl?: string;
    clientName?: string;
    total: number;
  } | null>(null);

  // Load context from Aliphia on mount
  useEffect(() => {
    const loadContext = async () => {
      try {
        const [c, q, inv] = await Promise.all([
          fetchAliphiaClients().catch(() => []),
          fetchAliphiaQuotations().catch(() => []),
          fetchAliphiaInvoices().catch(() => [])
        ]);
        setClients(c || []);
        setQuotesHistory(q || []);
        setInvoicesHistory(inv || []);
      } catch (err) {
        console.error('Error loading AI context:', err);
      } finally {
        setLoadingContext(false);
      }
    };
    loadContext();
  }, []);

  // Helper to get Gemini API Client
  const getGeminiClient = () => {
    const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || 
                   (typeof localStorage !== 'undefined' ? localStorage.getItem('VITE_GEMINI_API_KEY') : '') || 
                   (typeof window !== 'undefined' ? (window as any).VITE_GEMINI_API_KEY : '') ||
                   '';
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      return null;
    }
    return new GoogleGenAI({ apiKey });
  };

  // Image scanning
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_000_000) {
      toast.error('الملف أكبر من 3 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoURL(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Call Gemini model
  const runAiCommand = async (commandText: string, imageBase64?: string) => {
    const ai = getGeminiClient();
    if (!ai) {
      toast.error('مفتاح الذكاء الاصطناعي غير متوفر. يرجى إضافته في إعدادات النظام أولاً.');
      return;
    }

    setIsProcessing(true);
    const tid = toast.loading('جاري معالجة طلبك بواسطة الموظف الذكي...');
    
    try {
      // 1. Prepare structured context about client names and pricing rules
      const clientsContext = clients.map(c => ({ id: c.id, name: c.name })).slice(0, 30);
      const recentQuotes = quotesHistory.map(q => ({
        client: q.client_name || q.client_id,
        items: Array.isArray(q.items) ? q.items.map((i: any) => i.name) : q.items,
        total: q.total
      })).slice(0, 10);

      const prompt = `
        You are a Smart Sales Agent assistant inside an ERP platform.
        Your job is to analyze the user's request (and/or scanned document image) and output a JSON representing a suggested offer or quotation.

        Here is the background system context:
        - List of active clients in the system: ${JSON.stringify(clientsContext)}
        - Recent quotation history: ${JSON.stringify(recentQuotes)}

        Instructions:
        1. Identify the matching client from the active clients list. If a direct match isn't found, find the closest client name or create a placeholder. Return the matched client's ID and name.
        2. Extract line items, their quantities (qty), and recommend a suitable unit price. Recommend the price based on past quotes or standard expectations.
        3. Formulate professional sales notes/payment terms (in Arabic) inside "notes".
        4. Give a one-sentence Arabic explanation explaining why you recommended this pricing or match in "explanation".

        JSON schema to return:
        {
          "client": { "id": "matched_client_id_or_null", "name": "matched_client_name" },
          "items": [
            { "name": "item name in Arabic", "qty": 1, "price": 100, "desc": "specification or details" }
          ],
          "notes": "payment terms and conditions in Arabic",
          "explanation": "Arabic explanation of the recommendations"
        }

        User Command/Prompt: "${commandText}"
        Only return the raw JSON object inside the text. No markdown blocks like \`\`\`json.
      `;

      let contents: any[] = [];
      if (imageBase64) {
        contents = [
          {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: prompt + '\n[Read details from this uploaded image/RFQ/Tender]' }
            ]
          }
        ];
      } else {
        contents = [{ parts: [{ text: prompt }] }];
      }

      const res = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents
      });

      const text = res.text || '';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed) {
        // Map back to inputs
        if (parsed.client) {
          const matched = clients.find(c => c.id === parsed.client.id || c.name.includes(parsed.client.name));
          setSelectedClient(matched || { id: parsed.client.id || 'new', name: parsed.client.name });
        }
        if (Array.isArray(parsed.items)) {
          setExtractedItems(parsed.items.map((i: any) => ({
            name: i.name || '',
            qty: Number(i.qty) || 1,
            price: Number(i.price) || 0,
            desc: i.desc || ''
          })));
        }
        setOfferNotes(parsed.notes || '');
        setAiExplanation(parsed.explanation || '');
        setDiscountPercent(0); // Reset discount
        toast.success('تمت المعالجة بنجاح!', { id: tid });
      } else {
        throw new Error('فشل تفسير رد الذكاء الاصطناعي');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('حدث خطأ أثناء معالجة الطلب: ' + (e.message || ''), { id: tid });
    } finally {
      setIsProcessing(false);
      setPhotoURL('');
    }
  };

  const handleSendPrompt = () => {
    if (!promptInput.trim() && !photoURL) {
      toast.error('الرجاء إدخال أمر نصي أو رفع صورة أولاً.');
      return;
    }
    const base64 = photoURL ? photoURL.split(',')[1] : undefined;
    runAiCommand(promptInput, base64);
  };

  // Calculations
  const subtotal = extractedItems.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmount;
  const vat = afterDiscount * 0.15;
  const total = afterDiscount + vat;

  // Manage Items
  const updateItem = (index: number, field: keyof Item, val: any) => {
    setExtractedItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: val } : item));
  };

  const deleteItem = (index: number) => {
    setExtractedItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const addItem = () => {
    setExtractedItems(prev => [...prev, { name: '', qty: 1, price: 0, desc: '' }]);
  };

  // Send to Aliphia
  const handleCreateDocument = async () => {
    if (!selectedClient) {
      toast.error('الرجاء اختيار العميل أولاً');
      return;
    }
    if (extractedItems.length === 0 || extractedItems.every(i => !i.name)) {
      toast.error('الرجاء إضافة بند واحد على الأقل للعرض');
      return;
    }

    if (docType === 'invoice' && !canCreateInvoice) {
      toast.error('عذراً، فقط المدير أو المندوب يملكون صلاحية إنشاء الفواتير.');
      return;
    }
    if (docType === 'quotation' && !canCreateQuote) {
      toast.error('عذراً، لا تملك الصلاحية الكافية لإنشاء العروض.');
      return;
    }

    const needsApproval = !isManager && (docType === 'quotation' ? blockQuotations : blockInvoices);

    setShowConfirm(false);
    setIsSending(true);

    const filteredItems = extractedItems.filter(i => i.name).map(i => ({
      name: i.name,
      qty: i.qty,
      price: i.price * (1 - discountPercent / 100),
      desc: i.desc || ''
    }));

    if (needsApproval) {
      const label = docType === 'quotation' ? 'عرض السعر' : 'الفاتورة';
      const tid = toast.loading(`جاري إرسال طلب اعتماد ${label} للمدير...`);
      try {
        // Save to Firebase as pending, no Aliphia call
        await addDoc(collection(db, docType === 'quotation' ? 'quotations' : 'invoices'), {
          clientName: selectedClient.name,
          clientId: selectedClient.id,
          totalAmount: total,
          items: extractedItems.filter(i => i.name).map(i => i.name).join(', '),
          status: 'pending',
          salesRepId: profile?.uid || '',
          salesRepName: profile?.name || '',
          createdAt: serverTimestamp(),
          docNumber: '',
          pdfUrl: '',
          aliphiaId: '',
          docType: docType,
          itemsDetail: filteredItems,
          notes: offerNotes + (discountPercent > 0 ? `\n(تم تطبيق خصم بقيمة ${discountPercent}%)` : '')
        });

        // Send manager notification
        await sendNotification({
          title: `طلب اعتماد ${label} جديد`,
          message: `المندوب ${profile?.name || 'غير معروف'} يطلب اعتماد ${label} للعميل ${selectedClient.name} بقيمة ${total.toLocaleString()} ر.س. البنود: ${filteredItems.map(i => `${i.name} (x${i.qty})`).join('، ')}`,
          type: 'approval',
          category: 'financial',
          targetRole: 'manager',
          priority: 'high',
          requiresAcknowledge: true
        });

        setResult({
          type: docType,
          clientName: selectedClient.name,
          total,
          pendingApproval: true
        } as any);

        toast.success('تم إرسال الطلب بنجاح بانتظار موافقة المدير!', { id: tid });
      } catch (err: any) {
        console.error(err);
        toast.error(`فشل إرسال الطلب: ${err.message || 'خطأ غير معروف'}`, { id: tid });
      } finally {
        setIsSending(false);
      }
    } else {
      const tid = toast.loading(`جاري إنشاء ${docType === 'quotation' ? 'عرض السعر' : 'الفاتورة'} في ألف ياء...`);
      try {
        const docData = {
          client_id: selectedClient.id,
          date: new Date().toISOString().split('T')[0],
          notes: offerNotes + (discountPercent > 0 ? `\n(تم تطبيق خصم بقيمة ${discountPercent}%)` : ''),
          items: extractedItems.filter(i => i.name).map(i => ({
            name: i.name,
            quantity: i.qty,
            price: i.price * (1 - discountPercent / 100),
            description: i.desc
          }))
        };

        // Create Aliphia record
        const res = await createAliphiaDocument(docType, docData);

        const docNum = res?.response?.quote_number || res?.response?.invoice_number ||
                       res?.quote_number || res?.invoice_number ||
                       res?.response?.id || res?.id || '—';
        const pdfUrl = res?.response?.pdf_url || res?.pdf_url || '';
        const aliphiaId = res?.response?.id || res?.id || '';

        // Save Quotation/Invoice local status in Firebase
        await addDoc(collection(db, docType === 'quotation' ? 'quotations' : 'invoices'), {
          clientName: selectedClient.name,
          clientId: selectedClient.id,
          totalAmount: total,
          items: extractedItems.filter(i => i.name).map(i => i.name).join(', '),
          status: 'approved',
          salesRepId: profile?.uid || '',
          salesRepName: profile?.name || '',
          createdAt: serverTimestamp(),
          docNumber: String(docNum),
          pdfUrl: pdfUrl,
          aliphiaId: aliphiaId,
          docType: docType,
          itemsDetail: filteredItems,
          notes: offerNotes + (discountPercent > 0 ? `\n(تم تطبيق خصم بقيمة ${discountPercent}%)` : '')
        });

        setResult({
          type: docType,
          docNumber: String(docNum),
          pdfUrl,
          clientName: selectedClient.name,
          total,
          pendingApproval: false
        });

        toast.success('تمت العملية وحفظ المستند بنجاح!', { id: tid });
      } catch (err: any) {
        console.error(err);
        toast.error(`فشل إنشاء المستند: ${err.message || 'خطأ غير معروف'}`, { id: tid });
      } finally {
        setIsSending(false);
      }
    }
  };

  const shareWhatsApp = () => {
    if (!result) return;
    const label = result.type === 'quotation' ? 'عرض السعر' : 'الفاتورة';
    const text = `السلام عليكم ورحمة الله وبركاته،\n\nأهلاً بك أخي ${result.clientName}.\n\nمرفق ${label} رقم *${result.docNumber}* بقيمة *${result.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س* شاملاً ضريبة القيمة المضافة.${result.pdfUrl ? `\n\nيمكنك الاطلاع عليها من الرابط:\n${result.pdfUrl}` : ''}\n\nشكراً لتعاملكم معنا.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const reset = () => {
    setSelectedClient(null);
    setExtractedItems([]);
    setOfferNotes('');
    setDiscountPercent(0);
    setAiExplanation('');
    setResult(null);
    setPromptInput('');
  };

  if (result) {
    const isPendingApproval = (result as any).pendingApproval;
    return (
      <div className="w-full text-right" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
          {isPendingApproval ? (
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 text-center text-white relative">
              <div className="absolute top-4 right-4 bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">بانتظار الموافقة</div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 animate-pulse">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black">طلب قيد المراجعة والإنشاء ⏳</h2>
              <p className="text-amber-100 mt-1 font-medium">تم إرسال الطلب للمدير وسيتلقى إشعاراً للموافقة</p>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-primary to-teal-700 p-8 text-center text-white relative">
              <div className="absolute top-4 right-4 bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">المنقّح الذكي</div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 animate-pulse">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black">تم تصدير المستند بنجاح!</h2>
              <p className="text-teal-100 mt-1 font-medium">تم إنشاء المستند وحفظ السجل المحاسبي في ألف ياء</p>
            </div>
          )}
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">حالة الطلب</span>
                <span className={`text-lg font-black block ${isPendingApproval ? 'text-amber-600' : 'text-slate-800'}`}>
                  {isPendingApproval ? 'بانتظار الاعتماد' : 'تم الإصدار'}
                </span>
              </div>
              <div className="bg-teal-50/50 rounded-2xl p-4 text-center border border-teal-100">
                <span className="text-[10px] font-black text-teal-600 uppercase block mb-1">القيمة الإجمالية</span>
                <span className="text-xl font-black text-teal-700 font-mono">
                  {result.total.toLocaleString()} <span className="text-xs font-bold">ر.س</span>
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
              <span className="text-sm font-black text-slate-800">👤 {result.clientName}</span>
              <span className="text-xs font-bold text-slate-400">العميل المستهدف</span>
            </div>

            {isPendingApproval ? (
              <div className="pt-2">
                <Button onClick={reset} className="w-full h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-black">
                  إنشاء مستند جديد
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Button
                  onClick={shareWhatsApp}
                  className="h-12 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-black gap-2 shadow-lg shadow-green-100"
                >
                  <Share2 className="w-4 h-4" /> مشاركة واتساب
                </Button>
                {result.pdfUrl ? (
                  <Button
                    onClick={() => window.open(result.pdfUrl, '_blank')}
                    className="h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-black gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> فتح ملف PDF
                  </Button>
                ) : (
                  <Button variant="outline" className="h-12 rounded-xl font-black" onClick={reset}>
                    مستند جديد
                  </Button>
                )}
              </div>
            )}
            
            {!isPendingApproval && result.pdfUrl && (
              <Button variant="ghost" onClick={reset} className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs pt-2">
                + العودة لإنشاء عرض جديد
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-right" dir="rtl">
      
      {/* Bot Chat Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-l from-primary/10 to-transparent p-6 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              مساعد المبيعات والعروض الذكي
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-0.5">البوت الذكي لتعبئة، تسعير، وتجهيز العروض تلقائياً بناءً على العمليات السابقة.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isSalesRep && (
            <span className="text-[10px] bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full font-black border border-amber-100 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> بوابة المندوب: صلاحية العروض فقط
            </span>
          )}
          {isManager && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-black border border-emerald-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> صلاحية كاملة (مدير عام)
            </span>
          )}
        </div>
      </div>

      {/* Input Prompt Box & Document Scan Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Chat prompt input (2/3 width) */}
        <Card className="md:col-span-2 rounded-3xl border-slate-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> أمر نصي تفاعلي للبوت
            </CardTitle>
            <CardDescription className="text-xs font-bold text-slate-400">تحدث مع البوت كأنه موظف مبيعات لتوليد العروض مباشرة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              placeholder="مثال: ولد عرض سعر لشركة التقنية الحديثة لـ 3 لابتوبات ديل XPS مع ترخيص ويندوز مجاني..."
              rows={4}
              className="w-full text-sm rounded-2xl border border-slate-200 p-4 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 font-medium"
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black text-slate-400 self-center">اقتراحات سريعة:</span>
              {[
                'عرض توريد 50 كشاف لبلدية الرياض',
                'خصم 10% لشركة التقنية للخدمات الاستشارية',
                'عرض سعر جديد لمواد البناء لشركة الإعمار'
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromptInput(s)}
                  className="text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-all"
                >
                  {s}
                </button>
              ))}
            </div>

            <Button
              onClick={handleSendPrompt}
              disabled={isProcessing || (!promptInput.trim() && !photoURL)}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-violet-600 text-white font-black text-sm gap-2 shadow-lg shadow-primary/10 active:scale-[0.99] transition-all"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isProcessing ? 'جاري التحليل والتجهيز...' : 'معالجة الأمر وتوليد البنود'}
            </Button>
          </CardContent>
        </Card>

        {/* Scan Document input (1/3 width) */}
        <Card className="rounded-3xl border-slate-100 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> قراءة كراسات وشروط التوريد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            {photoURL ? (
              <div className="relative rounded-2xl overflow-hidden aspect-video border border-slate-100 mb-2">
                <img src={photoURL} alt="scan" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotoURL('')}
                  className="absolute top-2 left-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Label
                htmlFor="bot-document-scan"
                className="flex flex-col items-center justify-center gap-2 aspect-video rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all text-center p-4 mb-2"
              >
                <Upload className="w-7 h-7 text-slate-300" />
                <span className="text-[10px] font-black text-slate-400">ارفع صورة كراسة شروط أو عرض مناقصة</span>
              </Label>
            )}
            <input id="bot-document-scan" type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <p className="text-[9px] text-slate-400 leading-normal font-bold">يمكنك دمج الصورة مع الأمر النصي في اليمين ليقوم الذكاء الاصطناعي بقراءة الوثيقة وإصدار التسعير المناسب.</p>
          </CardContent>
        </Card>
      </div>

      {/* Generated Offer Details Section */}
      {extractedItems.length > 0 && (
        <Card className="rounded-3xl border-slate-100 shadow-lg border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="pb-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <CardTitle className="text-base font-black text-slate-800">العرض المقترح من الموظف الذكي</CardTitle>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-1">يمكنك التعديل، الحذف، وتحديد تفاصيل العميل والمبالغ قبل التأكيد النهائي.</p>
            </div>
            
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addItem} className="h-9 px-3 rounded-lg text-xs font-black gap-1.5 border-slate-200">
                <Plus className="w-3.5 h-3.5" /> إضافة بند جديد
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setDiscountPercent(10)} 
                className="h-9 px-3 rounded-lg text-xs font-black gap-1.5 text-amber-600 bg-amber-50 border-amber-200"
              >
                <Coins className="w-3.5 h-3.5" /> تطبيق خصم المندوب (10%)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* AI Explanation Box */}
            {aiExplanation && (
              <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 text-xs font-bold text-teal-850 flex gap-2.5 items-start">
                <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-black text-teal-900 block mb-0.5">تحليل وتفسير الذكاء الاصطناعي:</span>
                  {aiExplanation}
                </div>
              </div>
            )}

            {/* Client Selector - Manual + AI */}
            <div className="space-y-2" ref={clientDropdownRef}>
              <Label className="font-bold text-xs text-slate-500 uppercase tracking-wide">العميل المستهدف</Label>
              <div className="relative">
                <button
                  onClick={() => setShowClientDropdown(v => !v)}
                  className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 hover:border-primary/50 transition-all text-right"
                >
                  <span className="text-sm font-black text-primary flex items-center gap-2">
                    <span className="text-base">👤</span>
                    {selectedClient?.name || <span className="text-slate-400 font-bold">اختر عميلاً...</span>}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {selectedClient && (
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedClient(null); setClientSearch(''); }}
                        className="text-slate-300 hover:text-red-400 transition-colors p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-[10px] font-black text-slate-400 bg-white border px-2 py-1 rounded-lg">
                      {selectedClient?.id ? `#${selectedClient.id}` : `${clients.length} عميل`}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {showClientDropdown && (
                  <div className="absolute top-full mt-1 w-full bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          autoFocus
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                          placeholder="ابحث عن عميل..."
                          className="flex-1 bg-transparent text-xs font-bold outline-none text-slate-800 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {loadingContext ? (
                        <div className="p-4 text-center text-xs text-slate-400 font-bold">جاري تحميل العملاء...</div>
                      ) : clients
                        .filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()))
                        .slice(0, 20)
                        .map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedClient(c); setClientSearch(''); setShowClientDropdown(false); }}
                            className={`w-full text-right px-4 py-2.5 text-xs font-bold hover:bg-primary/5 transition-all flex items-center justify-between ${
                              selectedClient?.id === c.id ? 'bg-primary/5 text-primary' : 'text-slate-700'
                            }`}
                          >
                            <span>👤 {c.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">#{c.id}</span>
                          </button>
                        ))
                      }
                      {!loadingContext && clients.filter(c => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 font-bold">لا يوجد عملاء مطابقون</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table / Form */}
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_72px_110px_40px] gap-3 text-[10px] font-black text-slate-400 uppercase px-1">
                <span>اسم البند / الوصف والمواصفات</span>
                <span className="text-center">الكمية</span>
                <span className="text-center">سعر الوحدة</span>
                <span />
              </div>

              <div className="space-y-3">
                {extractedItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_72px_110px_40px] gap-3 items-start p-3 bg-slate-50/50 rounded-2xl border border-slate-100 group">
                    <div className="space-y-1.5">
                      <Input
                        value={item.name}
                        onChange={e => updateItem(index, 'name', e.target.value)}
                        placeholder="اسم البند..."
                        className="h-9 rounded-xl text-xs font-black bg-white"
                      />
                      <Input
                        value={item.desc}
                        onChange={e => updateItem(index, 'desc', e.target.value)}
                        placeholder="مواصفات إضافية..."
                        className="h-8 rounded-lg text-[10px] font-bold bg-white/70"
                      />
                    </div>
                    <Input
                      type="number"
                      value={item.qty || ''}
                      onChange={e => updateItem(index, 'qty', Number(e.target.value))}
                      className="h-9 rounded-xl text-center font-mono text-xs bg-white"
                      placeholder="1"
                    />
                    <Input
                      type="number"
                      value={item.price || ''}
                      onChange={e => updateItem(index, 'price', Number(e.target.value))}
                      className="h-9 rounded-xl text-center font-mono text-xs bg-white text-emerald-600"
                      placeholder="0.00"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem(index)}
                      className="h-9 w-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Calculations */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span className="font-mono">{subtotal.toLocaleString()} ر.س</span>
                <span>المجموع الإجمالي للبنود</span>
              </div>
              
              {/* Discount Control */}
              <div className="flex items-center gap-3 bg-amber-50/60 px-3 py-2.5 rounded-xl border border-amber-100">
                <span className="text-xs font-black text-amber-700 shrink-0">الخصم %</span>
                <input
                  type="number"
                  min="0" max="100" step="1"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-16 h-7 text-center text-xs font-mono bg-white rounded-lg border border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-300 text-amber-700 font-black"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {[5, 10, 15, 20].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setDiscountPercent(pct)}
                      className={`text-[10px] font-black px-2 py-1 rounded-lg transition-all ${
                        discountPercent === pct
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                  {discountPercent > 0 && (
                    <button onClick={() => setDiscountPercent(0)} className="text-[10px] font-black px-2 py-1 rounded-lg bg-white text-slate-400 border border-slate-200 hover:bg-slate-50">
                      إلغاء
                    </button>
                  )}
                </div>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between text-xs font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                  <span className="font-mono">-{discountAmount.toLocaleString()} ر.س ({discountPercent}%)</span>
                  <span>الخصم المطبق</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span className="font-mono">{vat.toLocaleString()} ر.س</span>
                <span>ضريبة القيمة المضافة 15%</span>
              </div>
              
              <div className="flex justify-between text-base font-black text-slate-800 bg-white px-4 py-3 rounded-xl border border-slate-100">
                <span className="font-mono text-primary text-lg">{total.toLocaleString()} ر.س</span>
                <span>المجموع النهائي المستحق</span>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500">ملاحظات وشروط الدفع المرفقة</Label>
              <textarea
                value={offerNotes}
                onChange={e => setOfferNotes(e.target.value)}
                placeholder="صلاحية العرض، شروط التوريد..."
                rows={3}
                className="w-full text-xs rounded-2xl border border-slate-200 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 font-medium"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              
              {/* Quote Submit (Manager & Rep) */}
              <Button
                onClick={() => {
                  if (!selectedClient) { toast.error('يرجى اختيار العميل أولاً'); return; }
                  setDocType('quotation');
                  setShowConfirm(true);
                }}
                disabled={!canCreateQuote}
                className="h-14 rounded-2xl bg-gradient-to-r from-primary to-teal-600 hover:from-primary/95 hover:to-teal-700 text-white font-black text-sm gap-2.5 shadow-lg shadow-primary/10 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <FileText className="w-5 h-5" />
                تصدير كعرض سعر (ألف ياء)
              </Button>

              {/* Invoice Submit (Manager Only) */}
              <Button
                onClick={() => {
                  if (!selectedClient) { toast.error('يرجى اختيار العميل أولاً'); return; }
                  setDocType('invoice');
                  setShowConfirm(true);
                }}
                disabled={!canCreateInvoice}
                className="h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm gap-2.5 shadow-lg shadow-emerald-500/10 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                <Receipt className="w-5 h-5" />
                إصدار كفاتورة مبيعات (ألف ياء)
              </Button>

            </div>

            {!isManager && (
              <div className="text-xs font-bold text-center leading-relaxed space-y-2">
                {blockQuotations && blockInvoices ? (
                  <span className="text-rose-600 font-black block bg-rose-50/70 p-3 rounded-xl border border-rose-100">
                    ℹ️ حسابك يتطلب موافقة المدير العام قبل اعتماد عروض الأسعار أو إصدار الفواتير.
                  </span>
                ) : blockQuotations ? (
                  <span className="text-rose-600 font-black block bg-rose-50/70 p-3 rounded-xl border border-rose-100">
                    ℹ️ حسابك يتطلب موافقة المدير العام لاعتماد عروض الأسعار. (الفواتير مباشرة)
                  </span>
                ) : blockInvoices ? (
                  <span className="text-rose-600 font-black block bg-rose-50/70 p-3 rounded-xl border border-rose-100">
                    ℹ️ حسابك يتطلب موافقة المدير العام لإصدار الفواتير. (عروض الأسعار مباشرة)
                  </span>
                ) : (
                  <span className="text-emerald-600 font-black block bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                    ✅ حسابك مصرح له بتصدير عروض الأسعار وإصدار الفواتير مباشرة دون موافقة مسبقة.
                  </span>
                )}
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right border border-slate-100 shadow-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                {docType === 'quotation' ? <FileText className="w-5 h-5 text-primary" /> : <Receipt className="w-5 h-5 text-emerald-600" />}
                تأكيد تصدير المستند
              </DialogTitle>
              <DialogDescription className="font-bold text-slate-400 py-1.5">
                هل أنت متأكد من رغبتك في تصدير هذا المستند إلى منصة ألف ياء المحاسبية؟
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-bold text-slate-600 space-y-2 mt-3">
              <p><span className="text-slate-400">نوع المستند:</span> {docType === 'quotation' ? 'عرض سعر' : 'فاتورة مبيعات'}</p>
              <p><span className="text-slate-450">العميل:</span> {selectedClient?.name}</p>
              <p><span className="text-slate-450">المجموع النهائي:</span> {total.toLocaleString()} ر.س</p>
              <p><span className="text-slate-450">عدد البنود:</span> {extractedItems.filter(i => i.name).length}</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCreateDocument}
                disabled={isSending}
                className={`flex-1 h-12 text-white font-black rounded-xl text-xs gap-1.5 shadow-md transition-all active:scale-[0.98] ${
                  docType === 'quotation' ? 'bg-primary hover:bg-primary/95' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد وإرسال'}
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl font-bold text-xs border-slate-200"
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
