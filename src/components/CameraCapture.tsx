import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, RefreshCcw, Check, FileText, Loader2, Edit3, Printer, Share2, Copy, Building2, Megaphone, Receipt, Image as ImageIcon, ChevronRight, ScanLine, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { analyzeInvoice, quickAnalyzeInvoice, InvoiceData, type QuickScanResult } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from 'motion/react';

type CaptureMode = 'selection' | 'invoice' | 'project' | 'marketing' | 'auto-scan';

export default function CameraCapture() {
  const { profile } = useAuth();
  const [mode, setMode] = useState<CaptureMode>('selection');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<InvoiceData | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-Scan States
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error' | 'blurry' | 'scanning' | null, message: string }>({ status: null, message: '' });
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Project Media State
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (mode === 'project') {
      const fetchProjects = async () => {
        setLoadingProjects(true);
        try {
          const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error("Error fetching projects:", error);
          toast.error("فشل تحميل قائمة المشاريع");
        } finally {
          setLoadingProjects(false);
        }
      };
      fetchProjects();
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'auto-scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsAutoScanning(true);
      startScanLoop();
    } catch {
      toast.error("فشل الوصول للكاميرا. تأكد من إعطاء الصلاحيات.");
      setMode('selection');
    }
  };

  const stopCamera = () => {
    setIsAutoScanning(false);
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startScanLoop = () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(async () => {
      await performScan();
    }, 4000); // 4 seconds interval to give user time to swap
  };

  const performScan = async () => {
    if (!videoRef.current || !canvasRef.current || !isAutoScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.6);

    setFeedback({ status: 'scanning', message: 'جاري فحص الورقة...' });

    try {
      const result = await quickAnalyzeInvoice(imageData);
      
      if (result.isValidInvoice && result.data) {
        // Success
        setFeedback({ status: 'success', message: `تم العثور على فاتورة: ${result.data.vendor} - ${result.data.amount} ر.س` });
        
        // Save to DB
        await addDoc(collection(db, 'transactions'), {
          type: 'purchase',
          amount: result.data.amount,
          vendor: result.data.vendor,
          description: `مسح تلقائي مستمر - ${result.data.vendor}`,
          date: result.data.date || new Date().toISOString(),
          createdBy: profile?.uid,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        
        // Save to gallery
        await saveToGallery(imageData, 'المشتريات');
        
        setProcessedCount(prev => prev + 1);
        
        // Wait longer before next scan to show success
        setTimeout(() => {
          setFeedback({ status: null, message: '' });
          if (isAutoScanning) startScanLoop();
        }, 2500);
      } else if (result.isBlurry) {
        setFeedback({ status: 'blurry', message: 'الصورة غير واضحة.. يرجى تثبيت الجوال' });
        setTimeout(() => {
          setFeedback({ status: null, message: '' });
          if (isAutoScanning) startScanLoop();
        }, 2000);
      } else {
        setFeedback({ status: 'error', message: result.errorReason || 'ليست فاتورة صريحة' });
        setTimeout(() => {
          setFeedback({ status: null, message: '' });
          if (isAutoScanning) startScanLoop();
        }, 1500);
      }
    } catch (err) {
      console.error("Scan loop error:", err);
      if (isAutoScanning) startScanLoop();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const downscaleImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_SIZE = 1200;
          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const saveToGallery = async (imageData: string, customCategory?: string) => {
    if (!profile) return;
    try {
      await addDoc(collection(db, 'gallery'), {
        title: mode === 'invoice' ? `فاتورة ممسوحة - ${new Date().toLocaleDateString('ar-EG')}` : 
               mode === 'marketing' ? `صورة دعائية - ${new Date().toLocaleDateString('ar-EG')}` :
               `ميديا مشروع - ${new Date().toLocaleDateString('ar-EG')}`,
        url: imageData,
        source: mode,
        category: customCategory || (mode === 'invoice' ? 'المشتريات' : mode === 'marketing' ? 'صور دعائية' : 'المشاريع'),
        date: serverTimestamp(),
        createdBy: profile.uid,
        projectId: selectedProjectId || null
      });
    } catch {
      console.error('Failed to save to gallery:');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
      try {
        toast.info(mode === 'invoice' ? 'جاري معالجة الفاتورة...' : 'جاري معالجة الصورة...');
        const downscaled = await downscaleImage(file);
        setCapturedImage(downscaled);
        
        if (mode === 'marketing') {
          await saveToGallery(downscaled, 'صور دعائية');
          toast.success('تم حفظ الصورة التسويقية في المعرض بنجاح');
          reset();
        } else if (mode === 'project') {
          if (!selectedProjectId) {
            toast.error('يرجى اختيار المشروع أولاً');
            setCapturedImage(null);
            return;
          }
          await saveToGallery(downscaled, 'المشاريع');
          // Also save to archive
          await addDoc(collection(db, 'archive'), {
            title: `رفع ميداني - مشروع ${projects.find(p => p.id === selectedProjectId)?.name || ''}`,
            url: downscaled,
            type: 'image',
            projectId: selectedProjectId,
            createdBy: profile?.uid,
            createdAt: serverTimestamp(),
            tags: ['ميداني', 'مشروع']
          });
          toast.success('تم حفظ ميديا المشروع في الأرشيف والمعرض');
          reset();
        } else {
          // Invoice mode - keep capturedImage for analysis
          await saveToGallery(downscaled);
          toast.success('تم الحفظ كمسودة، يمكنك البدء بالتحليل الآن');
        }
      } catch {
        toast.error('حدث خطأ أثناء معالجة الصورة');
      }
    } else if (file.type === 'application/pdf' && mode === 'invoice') {
      toast.info('جاري معالجة ملف PDF...');
      const reader = new FileReader();
      reader.onload = async (event) => {
        const pdfData = event.target?.result as string;
        setCapturedImage(pdfData);
        await saveToGallery(pdfData);
        toast.success('تم تحميل ملف PDF بنجاح');
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('تنسيق الملف غير مدعوم لهذا الوضع');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processImage = async () => {
    if (!capturedImage) return;
    setAnalyzing(true);
    try {
      const result = await analyzeInvoice(capturedImage);
      if (result) {
        setParsedData(result);
        toast.success('تم تحليل الفاتورة بنجاح');
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء المعالجة');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveInvoice = async () => {
    if (!parsedData || !profile) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        type: 'purchase',
        amount: parsedData.amount,
        vendor: parsedData.vendor,
        description: parsedData.description || `فاتورة من ${parsedData.vendor}`,
        date: parsedData.date || new Date().toISOString(),
        createdBy: profile.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success('تمت إضافة الفاتورة للنظام بنجاح');
      reset();
    } catch {
      toast.error('فشل حفظ البيانات');
    }
  };

  const reset = () => {
    setCapturedImage(null);
    setParsedData(null);
    setMode('selection');
    setSelectedProjectId('');
  };

  const handlePrint = () => {
    if (!capturedImage) return;
    const win = window.open('');
    if (win) {
      win.document.write(`
        <html>
          <body style="margin:0; display:flex; justify-content:center; align-items:center;">
            ${capturedImage.startsWith('data:application/pdf') 
              ? `<iframe src="${capturedImage}" width="100%" height="100%" style="border:none;"></iframe>`
              : `<img src="${capturedImage}" style="max-width:100%; max-height:100%; object-fit:contain;">`
            }
          </body>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 100);
            }
          </script>
        </html>
      `);
      win.document.close();
    }
  };

  const handleCopy = async () => {
    if (!capturedImage) return;
    try {
      if (capturedImage.startsWith('data:image/')) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        toast.success('تم نسخ الصورة للحافظة');
      } else {
        await navigator.clipboard.writeText(capturedImage);
        toast.success('تم نسخ رابط البيانات للحافظة');
      }
    } catch {
      toast.error('فشل النسخ للمحافظة');
    }
  };

  const handleShare = async () => {
    if (!capturedImage) return;
    try {
      if (navigator.share) {
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const file = new File([blob], "upload.png", { type: blob.type });
        await navigator.share({
          files: [file],
          title: 'ملف مرفوع',
          text: 'مشاركة ملف من نظام أمان'
        });
      } else {
        handleCopy();
      }
    } catch {
      toast.error('مشاركة الملف غير مدعومة في هذا المتصفح');
    }
  };

  if (mode === 'auto-scan') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col pt-safe" dir="rtl">
        {/* Video Background */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Top UI */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10">
          <Button variant="ghost" onClick={() => setMode('selection')} className="text-white hover:bg-white/10 rounded-full h-12 w-12">
            <XCircle className="w-8 h-8" />
          </Button>
          <div className="flex flex-col items-center">
            <Badge className="bg-primary text-white border-none px-4 py-1.5 rounded-full font-black text-lg">
              {processedCount} فواتير
            </Badge>
            <span className="text-[10px] text-white/70 font-bold mt-1 uppercase tracking-widest">تمت معالجتها</span>
          </div>
          <div className="w-12" /> {/* Spacer */}
        </div>

        {/* Framing Guide */}
        <div className="absolute inset-x-8 top-[20%] bottom-[30%] border-2 border-dashed border-white/30 rounded-3xl pointer-events-none flex items-center justify-center">
          <div className="w-full h-px bg-white/20 animate-scan" style={{
            boxShadow: '0 0 15px #3b82f6',
            position: 'absolute',
            top: '50%'
          }} />
        </div>

        {/* Feedback Overlay */}
        <AnimatePresence>
          {feedback.status && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute inset-0 flex items-center justify-center p-8 z-20 pointer-events-none"
            >
              <Card className={`w-full max-w-sm rounded-[2.5rem] border-none shadow-2xl overflow-hidden ${
                feedback.status === 'success' ? 'bg-emerald-500/95' :
                feedback.status === 'error' ? 'bg-red-500/95' :
                feedback.status === 'blurry' ? 'bg-amber-500/95' :
                'bg-blue-600/90'
              } backdrop-blur-md text-white`}>
                <CardContent className="p-10 flex flex-col items-center text-center gap-6">
                  {feedback.status === 'success' && <CheckCircle2 className="w-24 h-24 animate-bounce" />}
                  {feedback.status === 'error' && <XCircle className="w-24 h-24 animate-shake" />}
                  {feedback.status === 'blurry' && <AlertTriangle className="w-24 h-24 animate-pulse" />}
                  {feedback.status === 'scanning' && <Loader2 className="w-24 h-24 animate-spin" />}
                  
                  <div>
                    <h3 className="text-2xl font-black mb-2">{
                      feedback.status === 'success' ? 'تمت الإضافة!' :
                      feedback.status === 'error' ? 'عذراً!' :
                      feedback.status === 'blurry' ? 'غير واضحة!' :
                      'جاري التحليل...'
                    }</h3>
                    <p className="text-lg font-bold opacity-90 leading-relaxed">{feedback.message}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Controls */}
        <div className="absolute bottom-10 left-0 right-0 p-6 flex justify-center z-10">
          <div className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl border border-white/20 flex items-center gap-8">
             <div className="text-center px-4">
                <p className="text-white font-black text-xl leading-none">وضع المسح المستمر</p>
                <p className="text-white/60 text-[10px] font-bold mt-1">ضع الفاتورة أمام الكاميرا وانتظر التأكيد</p>
             </div>
             <Button 
               size="lg" 
               className="rounded-2xl h-16 w-16 bg-white text-black hover:bg-slate-100 shadow-xl p-0"
               onClick={() => stopCamera()}
             >
                <RefreshCcw className="w-8 h-8" />
             </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'selection') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20" dir="rtl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 mb-2">الرفع الميداني السريع</h2>
          <p className="text-slate-500 font-bold">بوابة واحدة لرفع جميع أنواع الملفات والمستندات</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="group cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all border-none bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden" 
            onClick={() => setMode('invoice')}
          >
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Receipt className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-primary mb-1">فاتورة مشتريات</h3>
                <p className="text-xs text-slate-600 font-bold">مسح فوري وقراءة بالذكاء الاصطناعي</p>
              </div>
              <ChevronRight className="w-5 h-5 text-primary opacity-30 group-hover:opacity-100 transition-opacity" />
            </div>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-xl hover:shadow-indigo-500/10 transition-all border-none bg-gradient-to-br from-indigo-50 to-indigo-100/50 relative overflow-hidden" 
            onClick={() => setMode('project')}
          >
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-indigo-600 mb-1">ميديا مشروع</h3>
                <p className="text-xs text-slate-600 font-bold">توثيق سير العمل في المشاريع</p>
              </div>
              <ChevronRight className="w-5 h-5 text-indigo-400 opacity-30 group-hover:opacity-100 transition-opacity" />
            </div>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-xl hover:shadow-orange-500/10 transition-all border-none bg-gradient-to-br from-orange-50 to-orange-100/50 relative overflow-hidden" 
            onClick={() => setMode('marketing')}
          >
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Megaphone className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-orange-600 mb-1">صورة تسويقية</h3>
                <p className="text-xs text-slate-600 font-bold">إضافة صور دعائية للمعرض</p>
              </div>
              <ChevronRight className="w-5 h-5 text-orange-400 opacity-30 group-hover:opacity-100 transition-opacity" />
            </div>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-xl hover:shadow-emerald-500/10 transition-all border-none bg-gradient-to-br from-emerald-50 to-emerald-100/50 relative overflow-hidden md:col-span-3 h-32 flex items-center" 
            onClick={() => setMode('auto-scan')}
          >
            <div className="p-6 flex flex-row items-center justify-between w-full gap-4">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-3xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <ScanLine className="w-10 h-10" />
                </div>
                <div className="text-right">
                  <h3 className="text-2xl font-black text-emerald-700 mb-1">المسح المتعدد الذكي (Turbo)</h3>
                  <p className="text-sm text-slate-600 font-bold italic">ضع الجوال على الحامل وابدأ بتبديل الأوراق.. النظام سيقوم بالباقي!</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">وضع الذراع الميكانيكي</Badge>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20" dir="rtl">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMode('selection')} className="rounded-full">
             <ChevronRight className="w-5 h-5" />
          </Button>
          <div>
            <h3 className="font-black text-slate-900">
              {mode === 'invoice' ? 'مسح فاتورة شراء' : mode === 'project' ? 'توثيق مشروع' : 'رفع صورة تسويقية'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">الوضع الميداني السريع</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          {mode === 'invoice' ? <Receipt className="w-3 h-3 ml-1" /> : mode === 'project' ? <Building2 className="w-3 h-3 ml-1" /> : <Megaphone className="w-3 h-3 ml-1" />}
          {mode === 'invoice' ? 'مشتريات' : mode === 'project' ? 'مشاريع' : 'تسويق'}
        </Badge>
      </div>

      {mode === 'project' && !capturedImage && (
        <Card className="border-none shadow-sm bg-indigo-50/50">
          <CardContent className="p-6">
            <Label className="text-indigo-900 font-black mb-3 block">اختر المشروع المراد التوثيق له</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-white border-indigo-100 h-12 rounded-xl text-indigo-900 font-bold">
                <SelectValue placeholder={loadingProjects ? "جاري تحميل المشاريع..." : "اختر المشروع من القائمة"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div 
        className={`camera-upload-box bg-gradient-to-br transition-all duration-300 rounded-xl p-8 flex items-center justify-between shadow-lg overflow-hidden relative ${
          isDragging ? "from-primary to-primary/80 border-4 border-dashed border-white scale-[1.02]" : 
          mode === 'project' ? "from-indigo-600 to-indigo-800" :
          mode === 'marketing' ? "from-orange-500 to-orange-700" :
          "from-blue-600 to-blue-800"
        } border-[4px] border-transparent text-white`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="camera-content z-10 w-full">
          <h3 className="text-xl font-bold mb-2">
            {mode === 'invoice' ? 'رفع فوري للفواتير' : mode === 'project' ? 'رفع ميديا المشروع' : 'رفع صورة تسويقية'}
          </h3>
          <p className="text-sm opacity-90 max-w-sm leading-relaxed">
            {mode === 'invoice' ? 'استخدم الكاميرا لمسح الفاتورة أو اختر ملف PDF/صورة وسيقوم النظام باستخراج البيانات فورا.' :
             mode === 'project' ? 'التقط صوراً أو فيديوهات لموقع العمل لتوثيق الإنجاز وربطها بملف المشروع مباشرة.' :
             'قم برفع أفضل الصور الدعائية للمنتجات أو الخدمات ليتم إدراجها في قسم الصور الدعائية بالمعرض.'}
          </p>
          {!capturedImage && (
            <div className="mt-6 flex flex-wrap gap-4">
              <input
                type="file"
                accept={mode === 'marketing' ? 'image/*' : 'image/*,video/*'}
                capture="environment"
                id="camera-input"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label htmlFor="camera-input" className="bg-white hover:bg-slate-50 text-slate-900 border-none font-bold rounded-xl px-8 h-12 transition-all cursor-pointer inline-flex items-center justify-center shadow-md">
                <Camera className="w-5 h-5 ml-2" />
                {mode === 'marketing' ? 'التقاط صورة' : 'التقاط صورة أو فيديو'}
              </label>

              <input
                type="file"
                accept={mode === 'invoice' ? 'image/*,application/pdf' : mode === 'marketing' ? 'image/*' : 'image/*,video/*'}
                id="gallery-input"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label htmlFor="gallery-input" className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold rounded-xl px-8 h-12 transition-all cursor-pointer inline-flex items-center justify-center backdrop-blur-sm">
                <ImageIcon className="w-5 h-5 ml-2" />
                من الملفات
              </label>
            </div>
          )}
        </div>
        <div className="text-8xl opacity-10 absolute -left-4 -bottom-4 rotate-12 select-none">
          {mode === 'invoice' ? '📄' : mode === 'project' ? '🏗️' : '📣'}
        </div>
      </div>

      <Card className="rounded-xl border-border bg-white shadow-sm overflow-hidden border-t-4 border-t-primary">
        <CardContent className="p-0">
          {capturedImage && !parsedData && mode === 'invoice' && (
            <div className="p-4 md:p-8 space-y-6 text-center">
              <div className="flex flex-col md:flex-row items-center gap-6 max-w-2xl mx-auto">
                <div className="relative flex-1 bg-slate-100 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center min-h-[300px] border border-slate-200">
                  {capturedImage.startsWith('data:application/pdf') ? (
                    <div className="flex flex-col items-center gap-4 py-12">
                      <div className="w-24 h-24 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center">
                        <FileText className="w-12 h-12" />
                      </div>
                      <p className="font-bold text-slate-700">تم تحميل ملف PDF بنجاح</p>
                      <Badge variant="outline" className="text-slate-500 border-slate-300">
                        سيتم تحليل النص والصور بداخل الملف
                      </Badge>
                    </div>
                  ) : (
                    <img src={capturedImage} alt="Captured" className="max-w-full max-h-[70vh] object-contain block mx-auto transition-transform duration-300" />
                  )}
                </div>

                <div className="flex md:flex-col items-center gap-3 bg-white/50 backdrop-blur-xl p-3 rounded-[2rem] border border-slate-200 shadow-xl shrink-0 animate-in fade-in zoom-in-95 duration-500">
                   <Button variant="ghost" size="icon" onClick={handlePrint} className="w-12 h-12 rounded-2xl text-slate-600 hover:bg-primary hover:text-white transition-all shadow-sm" title="طباعة">
                     <Printer className="w-5 h-5" />
                   </Button>
                   <div className="hidden md:block w-8 h-px bg-slate-200 mx-auto" />
                   <Button variant="ghost" size="icon" onClick={handleCopy} className="w-12 h-12 rounded-2xl text-slate-600 hover:bg-primary hover:text-white transition-all shadow-sm" title="نسخ">
                     <Copy className="w-5 h-5" />
                   </Button>
                   <div className="hidden md:block w-8 h-px bg-slate-200 mx-auto" />
                   <Button variant="ghost" size="icon" onClick={handleShare} className="w-12 h-12 rounded-2xl text-slate-600 hover:bg-primary hover:text-white transition-all shadow-sm" title="مشاركة">
                     <Share2 className="w-5 h-5" />
                   </Button>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <Button 
                  onClick={processImage} 
                  disabled={analyzing}
                  className="w-full max-w-xs bg-primary hover:bg-black text-white px-8 h-12 rounded-xl font-bold shadow-md"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin ml-2" />
                      جاري استخراج البيانات...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 ml-2" />
                      تحليل المستند بالذكاء الاصطناعي
                    </>
                  )}
                </Button>
                <Button variant="ghost" onClick={reset} className="text-slate-400 font-bold hover:text-red-500 hover:bg-red-50 rounded-lg h-9">
                  <RefreshCcw className="w-4 h-4 ml-2" />
                  إلغاء وإعادة المحاولة
                </Button>
              </div>
            </div>
          )}

          {parsedData && mode === 'invoice' && (
            <div className="p-8">
              <div className="flex items-center gap-4 p-5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 mb-8">
                <div className="bg-emerald-500 text-white rounded-full p-2">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">تم التعرف على البيانات بنجاح</h4>
                  <p className="text-xs opacity-80">يرجى مراجعة التفاصيل أدناه قبل الاعتماد</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">المبلغ الإجمالي <Edit3 className="w-3 h-3" /></Label>
                    <div className="flex items-center gap-2">
                       <Input 
                         type="number" 
                         value={parsedData.amount} 
                         onChange={(e) => setParsedData({...parsedData, amount: Number(e.target.value)})}
                         className="text-2xl font-black text-primary border-none bg-transparent shadow-none px-0 focus-visible:ring-0"
                       />
                       <span className="text-sm font-bold text-slate-400">ر.س</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">المورد <Edit3 className="w-3 h-3" /></Label>
                    <Input 
                      type="text" 
                      value={parsedData.vendor} 
                      onChange={(e) => setParsedData({...parsedData, vendor: e.target.value})}
                      className="text-lg font-bold text-primary border-none bg-transparent shadow-none px-0 focus-visible:ring-0"
                    />
                  </div>
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">التاريخ <Edit3 className="w-3 h-3" /></Label>
                    <Input 
                      type="date" 
                      value={parsedData.date} 
                      onChange={(e) => setParsedData({...parsedData, date: e.target.value})}
                      className="text-base font-bold text-primary border-none bg-transparent shadow-none px-0 focus-visible:ring-0"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">الأصناف المكتشفة</Label>
                  <div className="flex flex-wrap gap-2">
                    {parsedData.items && parsedData.items.length > 0 ? parsedData.items.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 text-xs">
                        {item}
                      </Badge>
                    )) : <p className="text-xs text-slate-400">لم يتم اكتشاف أصناف</p>}
                  </div>
                  <div className="mt-4">
                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">الوصف الإضافي / ملاحظات <Edit3 className="w-3 h-3" /></Label>
                    <Input 
                      type="text" 
                      value={parsedData.description || ''} 
                      onChange={(e) => setParsedData({...parsedData, description: e.target.value})}
                      placeholder="أضف وصفاً إضافياً"
                      className="text-sm font-medium text-slate-600 bg-slate-50 border-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-10 mt-8 border-t border-slate-100">
                <Button onClick={saveInvoice} className="flex-1 h-[52px] bg-primary hover:bg-black text-white rounded-xl text-lg font-bold shadow-lg shadow-slate-200">
                  حفظ في النظام مباشرة
                </Button>
                <Button variant="outline" onClick={reset} className="h-[52px] px-8 rounded-xl border-slate-200 font-bold text-slate-500 hover:bg-slate-50">
                  إلغاء العملية
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

