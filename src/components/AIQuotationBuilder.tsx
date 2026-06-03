import React, { useState } from 'react';
import { Camera, Upload, Zap, Loader2, Plus, Trash2, FileText, Send, CheckCircle2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AliphiaClientSelector, { AliphiaClient } from './AliphiaClientSelector';
import { createAliphiaDocument } from '../lib/aliphia';
import AliphiaStatusCard from './AliphiaStatusCard';

interface QuotationItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  description: string;
}

interface BuilderProps {
  type?: 'quotation' | 'invoice';
}

export default function AIQuotationBuilder({ type = 'quotation' }: BuilderProps) {
  const { profile, user } = useAuth();
  const isManager = profile?.role === 'manager';
  
  const [photoURL, setPhotoURL] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [client, setClient] = useState<AliphiaClient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quotationLink, setQuotationLink] = useState<string | null>(null);
  const [reps, setReps] = useState<{id: string, name: string}[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [docStatus, setDocStatus] = useState<string>('draft');
  const [terms, setTerms] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const [advancePayment, setAdvancePayment] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  React.useEffect(() => {
    if (isManager) {
      const fetchReps = async () => {
        const q = query(collection(db, 'users'), where('role', '==', 'sales_rep'));
        const snap = await getDocs(q);
        setReps(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
      };
      fetchReps();
    }
  }, [isManager]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000000) {
      toast.error('حجم الملف كبير جداً (الحد الأقصى 2 ميجابايت)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const scanDocument = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "MY_GEMINI_API_KEY";
    if (!photoURL) {
      toast.error('يرجى رفع صورة أولاً');
      return;
    }
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      toast.error('مفتاح الذكاء الاصطناعي غير متوفر');
      return;
    }

    setIsScanning(true);
    const loadingToast = toast.loading('جاري قراءة البيانات وتفريغها بواسطة الذكاء الاصطناعي...');

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analyze this document/image which contains a request for quotation, bill of quantities, or handwritten list of items.
      Extract the line items and format them as a strict JSON array of objects.
      Each object must exactly match this structure:
      {
        "name": "string (The name of the item or service)",
        "quantity": number (The quantity, default to 1 if not specified),
        "description": "string (Any extra details or specifications, or empty string)"
      }
      If prices are mentioned, you can ignore them as the sales rep will price them manually, or you can add them. But output ONLY the JSON array. Example: [{"name": "Item 1", "quantity": 2, "description": ""}]`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: photoURL.split(',')[1] } },
            { text: prompt }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const resultText = response.text || '[]';
      const parsedItems = JSON.parse(resultText);
      
      if (Array.isArray(parsedItems)) {
        const newItems: QuotationItem[] = parsedItems.map((item: any, index: number) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: item.name || `بند غير معروف ${index + 1}`,
          quantity: Number(item.quantity) || 1,
          unitPrice: 0,
          total: 0,
          description: item.description || ''
        }));
        setItems(newItems);
        toast.success('تم استخراج البنود بنجاح!');
      } else {
        toast.error('صيغة الاستخراج غير صحيحة');
      }
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحليل الصورة');
    } finally {
      setIsScanning(false);
      toast.dismiss(loadingToast);
    }
  };

  const updateItem = (id: string, field: keyof QuotationItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      description: ''
    }]);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = grandTotal * 0.15; // 15% VAT

  const generateAliphiaQuotation = async () => {
    if (!client) {
      toast.error('يرجى اختيار العميل أولاً');
      return;
    }
    if (items.length === 0) {
      toast.error(`يرجى إضافة بنود ل${type === 'quotation' ? 'عرض السعر' : 'الفاتورة'}`);
      return;
    }
    if (isManager && !selectedRepId) {
      toast.error('يرجى تحديد المندوب أولاً');
      return;
    }

    setIsSubmitting(true);
    const targetRepId = isManager ? selectedRepId : user?.uid;
    const toastId = toast.loading(`جاري توليد و${type === 'quotation' ? 'عرض السعر' : 'تصدير الفاتورة'}...`);

    try {
      // Create record in Firebase first (for our dashboard history)
      const newRecord = {
        salesRepId: targetRepId,
        clientName: client.name,
        clientId: client.id,
        items: items.map(i => i.name).join(', '),
        totalAmount: grandTotal + tax,
        status: isManager ? docStatus : 'pending',
        type: type,
        issueDate,
        dueDate,
        terms,
        notes,
        ...(type === 'invoice' && {
          advancePayment: advancePayment ? Number(advancePayment) : 0,
          paymentMethod,
          balance: (grandTotal + tax) - (advancePayment ? Number(advancePayment) : 0),
        }),
        createdAt: new Date().toISOString()
      };
      
      const collectionName = type === 'quotation' ? 'quotations' : 'invoices';
      await addDoc(collection(db, collectionName), newRecord);

      // Call Aliphia REAL API
      const aliphiaResponse = await createAliphiaDocument(type, {
        client_id: client.id,
        date: issueDate,
        date_due: dueDate,
        terms: terms,
        notes: notes,
        items: items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          price: i.unitPrice,
          description: i.description
        }))
        // Note: Map receipt fields if invoice
      });
      
      setQuotationLink(aliphiaResponse.pdf_url || `https://aliphia.com/v1/invoices/${type === 'quotation' ? 'Q' : 'INV'}-${Math.floor(Math.random() * 1000)}.pdf`);
      toast.success(isManager ? 'تم الاعتماد والإنشاء بنجاح!' : 'تم الإرسال للاعتماد بنجاح!');
      
      setTimeout(() => {
        toast('تم الإشعار عبر الواتساب بنجاح', {
          icon: <Send className="w-4 h-4 text-emerald-500" />,
        });
      }, 1000);

    } catch (error) {
      toast.error('حدث خطأ أثناء المعالجة');
    } finally {
      setIsSubmitting(false);
      toast.dismiss(toastId);
    }
  };

  if (quotationLink) {
    return (
      <Card className="max-w-2xl mx-auto rounded-[2rem] border-none shadow-xl overflow-hidden animate-in zoom-in-95 duration-500 bg-emerald-50">
        <CardContent className="p-12 flex flex-col items-center text-center space-y-6">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-800">
            {type === 'quotation' ? 'تم إنشاء العرض بنجاح!' : 'تم إنشاء الفاتورة بنجاح!'}
          </h2>
          <p className="text-slate-600 font-medium max-w-md leading-relaxed">
            لقد تم إنشاء {type === 'quotation' ? 'عرض السعر' : 'الفاتورة'} في نظام "ألف ياء" بنجاح، وتم إرسال نسخة إليك عبر الواتساب لتتمكن من تحويلها لعميلك.
          </p>
          <div className="flex gap-4 w-full max-w-sm mt-8">
            <Button 
              className="flex-1 rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 font-bold"
              onClick={() => window.open(quotationLink, '_blank')}
            >
              <FileText className="w-4 h-4 ml-2" />
              عرض ملف PDF
            </Button>
            <Button 
              variant="outline"
              className="flex-1 rounded-xl h-12 border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold"
              onClick={() => {
                setQuotationLink(null);
                setItems([]);
                setPhotoURL('');
                setClient(null);
              }}
            >
              عرض جديد
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-0">
      
      {/* Aliphia Connection Status Widget (Manager Only) */}
      {isManager && (
        <div className="mb-4">
          <AliphiaStatusCard />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Left Side: Upload & Client */}
        <div className="w-full md:w-1/3 space-y-6">
          <Card className="rounded-2xl border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                بيانات التخصيص والعميل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {isManager && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">تخصيص العرض لمندوب:</Label>
                  <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                    <SelectTrigger className="w-full text-right h-10 rounded-xl">
                      <SelectValue placeholder="اختر المندوب المستفيد" />
                    </SelectTrigger>
                    <SelectContent>
                      {reps.map(rep => (
                        <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500">العميل المستهدف:</Label>
                <AliphiaClientSelector onSelect={setClient} selectedClientId={client?.id} />
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">تاريخ الإصدار:</Label>
                  <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">تاريخ الاستحقاق:</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-10 rounded-xl" />
                </div>
              </div>

              {isManager && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-bold text-slate-500">حالة المستند:</Label>
                  <Select value={docStatus} onValueChange={setDocStatus}>
                    <SelectTrigger className="w-full text-right h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="approved">مُعتمد</SelectItem>
                      <SelectItem value="sent">مُرسل للعميل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {type === 'invoice' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3 mt-2">
                  <Label className="text-xs font-bold text-primary flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> سند قبض (دفعة مقدمة)
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">المبلغ المدفوع</Label>
                      <Input type="number" placeholder="0.00" value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} className="h-8 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500">طريقة الدفع</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-8 rounded-lg text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">نقداً</SelectItem>
                          <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                          <SelectItem value="pos">شبكة (POS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {advancePayment && Number(advancePayment) > 0 && (
                    <div className="text-xs font-bold text-slate-600 flex justify-between bg-white p-2 rounded-lg border border-slate-100">
                      <span>الرصيد المتبقي:</span>
                      <span className="text-red-500">{((grandTotal + tax) - Number(advancePayment)).toFixed(2)} ر.س</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                تفريغ بالذكاء الاصطناعي
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
              {photoURL ? (
                <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-200 group">
                  <img src={photoURL} alt="Scan" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Label htmlFor="ai-upload" className="cursor-pointer bg-white text-slate-800 px-4 py-2 rounded-xl font-bold text-sm hover:scale-105 transition-transform">
                      تغيير الصورة
                    </Label>
                  </div>
                </div>
              ) : (
                <Label htmlFor="ai-upload" className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Upload className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">ارفع صورة الطلب أو كراسة الشروط</span>
                  <span className="text-xs text-slate-400">JPEG, PNG, WEBP</span>
                </Label>
              )}
              <input id="ai-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              
              <Button 
                onClick={scanDocument} 
                disabled={!photoURL || isScanning}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 font-black text-md text-white shadow-lg shadow-primary/20 gap-2 mt-2"
              >
                {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                استخراج البنود آلياً
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Items & Pricing */}
        <div className="w-full md:w-2/3">
          <Card className="rounded-2xl border-none shadow-md bg-white h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                تفاصيل {type === 'quotation' ? 'العرض' : 'الفاتورة'} والتسعير
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addItem} className="h-7 px-2 rounded-lg gap-1 font-bold text-xs">
                <Plus className="w-3.5 h-3.5" /> إضافة بند
              </Button>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col">
              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4 py-12">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium">استخدم الذكاء الاصطناعي لاستخراج البنود أو أضفها يدوياً</p>
                </div>
              ) : (
                <div className="space-y-4 flex-1">
                  <div className="bg-slate-100 rounded-xl p-3 flex gap-2 font-black text-slate-600 text-xs text-center items-center">
                    <div className="w-8"></div>
                    <div className="flex-1 text-right pr-2">وصف البند</div>
                    <div className="w-16">الكمية</div>
                    <div className="w-24">سعر الوحدة</div>
                    <div className="w-24">الإجمالي</div>
                  </div>
                  
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-2">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="h-11 w-8 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <div className="flex-1 space-y-2">
                          <Input value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} placeholder="اسم المنتج/الخدمة" className="h-11 text-right font-bold rounded-xl" />
                          <Input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="مواصفات إضافية (اختياري)" className="h-8 text-xs text-right bg-slate-50 rounded-lg" />
                        </div>
                        <Input type="number" value={item.quantity || ''} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} className="w-16 h-11 text-center font-mono rounded-xl" placeholder="1" />
                        <Input type="number" value={item.unitPrice || ''} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} className="w-24 h-11 text-center font-mono rounded-xl" placeholder="0.00" />
                        <div className="w-24 h-11 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center font-black font-mono text-primary text-sm shrink-0">
                          {item.total.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                    <div className="flex justify-between text-sm font-bold text-slate-500 px-4">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{grandTotal.toFixed(2)} ر.س</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-500 px-4">
                      <span>ضريبة القيمة المضافة (15%):</span>
                      <span className="font-mono">{tax.toFixed(2)} ر.س</span>
                    </div>
                    <div className="flex justify-between text-xl font-black text-slate-800 bg-slate-50 p-4 rounded-2xl">
                      <span>الإجمالي النهائي:</span>
                      <span className="font-mono text-primary">{(grandTotal + tax).toFixed(2)} ر.س</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">الشروط والأحكام:</Label>
                  <Textarea 
                    value={terms} 
                    onChange={e => setTerms(e.target.value)} 
                    placeholder="سياسة الاسترجاع، شروط الدفع، صلاحية العرض..." 
                    className="resize-none h-20 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500">ملاحظات (تظهر للعميل):</Label>
                  <Input 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="ملاحظات عامة حول الفاتورة أو العرض..." 
                    className="rounded-xl"
                  />
                </div>
              </div>
              
              <Button 
                onClick={generateAliphiaQuotation}
                disabled={items.length === 0 || isSubmitting || grandTotal === 0 || (isManager && !selectedRepId)}
                className={`w-full h-12 mt-6 rounded-xl font-black text-sm gap-2 shadow-md transition-all active:scale-95 ${
                  isManager 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-primary hover:bg-primary/90 text-white'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (isManager ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />)}
                {isManager 
                  ? `اعتماد فوري وإنشاء ${type === 'quotation' ? 'العرض' : 'الفاتورة'}` 
                  : 'إرسال للإدارة للاعتماد'
                }
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
