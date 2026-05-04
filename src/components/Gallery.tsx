import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  ExternalLink,
  X,
  Calendar,
  LayoutGrid,
  LayoutList,
  Printer,
  FileText,
  Share2,
  Copy,
  Megaphone
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface GalleryItem {
  id: string;
  title: string;
  url: string;
  source: 'project' | 'purchase' | 'employee' | 'payroll' | 'other';
  date: any;
  category: string;
  description?: string;
  fullData: any;
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSource, setActiveSource] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const collectionsToWatch = [
      { path: 'projects', source: 'project', labelField: 'title' },
      { path: 'workers', source: 'employee', labelField: 'name' },
      { path: 'employees', source: 'employee', labelField: 'name' },
      { path: 'purchases', source: 'purchase', labelField: 'itemName' },
      { path: 'payrolls', source: 'payroll', labelField: 'employeeName' },
      { path: 'expenses', source: 'purchase', labelField: 'description' },
      { path: 'gallery', source: 'raw', labelField: 'title' }
    ];

    const unsubscribers = collectionsToWatch.map(coll => {
      return onSnapshot(collection(db, coll.path), (snap) => {
        const collItems: GalleryItem[] = [];
        snap.docs.forEach(d => {
          const data = d.data();
          
          // Case 1: Simple single attachment/url
          const url = data.attachmentUrl || data.attachmentBase64 || data.url;
          if (url) {
            collItems.push({
              id: d.id,
              title: data[coll.labelField] || (coll.path === 'gallery' ? data.title : 'بلا عنوان'),
              url: url,
              source: (coll.path === 'gallery' ? data.source : coll.source) as any,
              date: data.createdAt || data.date || data.joinedAt,
              category: coll.path,
              fullData: data
            });
          }

          // Case 2: Array of photos (Specifically for Projects)
          if (Array.isArray(data.photoUrls)) {
            data.photoUrls.forEach((photo: string, index: number) => {
              // Avoid duplicates if url is already added
              if (photo === url) return; 
              
              collItems.push({
                id: `${d.id}_${index}`,
                title: `${data[coll.labelField] || 'مشروع'} - صورة ${index + 1}`,
                url: photo,
                source: coll.source as any,
                date: data.createdAt || data.date,
                category: coll.path,
                fullData: data
              });
            });
          }
        });

        setItems(prev => {
          const otherColls = prev.filter(p => !collectionsToWatch.find(c => c.path === p.category));
          const currentPathItems = collItems;
          // This logic is a bit flawed for multiple collections, better to merge and deduplicate
          const combined = [...prev.filter(p => p.category !== coll.path), ...collItems];
          return combined.sort((a, b) => {
            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
            return dateB.getTime() - dateA.getTime();
          });
        });
        setLoading(false);
      });
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSource = activeSource === 'all' || item.source === activeSource;
      return matchesSearch && matchesSource;
    });
  }, [items, searchTerm, activeSource]);

  const handleDelete = async (item: GalleryItem) => {
    // Custom non-blocking confirmation could be better, but let's fix the logic first
    try {
      const collectionName = item.category === 'purchase' ? 'purchases' : item.category;
      await deleteDoc(doc(db, collectionName, item.id));
      toast.success('تم حذف المرفق بنجاح');
      if (selectedImage?.id === item.id) setSelectedImage(null);
    } catch (err) {
      console.error("Delete Error:", err);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'project': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">مشروع</Badge>;
      case 'purchase': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">مشتريات</Badge>;
      case 'employee': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">موظف</Badge>;
      case 'marketing': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none">دعائي</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none">أخرى</Badge>;
    }
  };

  const handlePrint = (url: string) => {
    const win = window.open('');
    if (win) {
      win.document.write(`
        <html>
          <body style="margin:0; display:flex; justify-content:center; align-items:center;">
            ${url.startsWith('data:application/pdf') 
              ? `<iframe src="${url}" width="100%" height="100%" style="border:none;"></iframe>`
              : `<img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain;">`
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

  const handleCopy = async (url: string) => {
    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        if (url.startsWith('data:image/')) {
          const response = await fetch(url);
          const blob = await response.blob();
          await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ]);
        } else {
          await navigator.clipboard.writeText(url);
        }
        toast.success('تم النسخ للحافظة بنجاح');
      } else {
        // Fallback for non-secure or older environments
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('تم النسخ (طريقة بديلة)');
      }
    } catch (err) {
      console.error("Copy Error:", err);
      toast.error('فشل النسخ للحافظة');
    }
  };

  const handleShare = async (item: GalleryItem) => {
    try {
      if (navigator.share) {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const file = new File([blob], `${item.title}.png`, { type: blob.type });
        await navigator.share({
          files: [file],
          title: item.title,
          text: `مشاركة ${item.title} من نظام أمان`
        });
      } else {
        handleCopy(item.url);
      }
    } catch (err) {
      toast.error('مشاركة الملف غير مدعومة في هذا المتصفح');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">معرض الوسائط الذكي</h2>
          <p className="text-slate-500 font-medium">إدارة مركزية لجميع المرفقات والصور في النظام</p>
        </div>
        <div className="flex items-center gap-2">
           <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setViewMode('grid')}
            className={`rounded-xl ${viewMode === 'grid' ? 'bg-primary text-white border-primary' : ''}`}
           >
             <LayoutGrid className="w-5 h-5" />
           </Button>
           <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setViewMode('list')}
            className={`rounded-xl ${viewMode === 'list' ? 'bg-primary text-white border-primary' : ''}`}
           >
             <LayoutList className="w-5 h-5" />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <Card className="md:col-span-1 rounded-[2rem] border-none shadow-sm p-6 space-y-6 h-fit bg-white">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">بحث في الصور</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="اسم السجل..."
                className="rounded-xl pr-9 h-11"
              />
            </div>
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase">تصنيف المصدر</label>
             <div className="flex flex-col gap-1">
                {[
                  { id: 'all', label: 'الكل', icon: Filter },
                  { id: 'project', label: 'المشاريع', icon: LayoutGrid },
                  { id: 'purchase', label: 'المشتريات', icon: Download },
                  { id: 'marketing', label: 'صور دعائية', icon: Megaphone },
                  { id: 'employee', label: 'الموظفين', icon: ImageIcon }
                ].map(src => (
                  <Button
                    key={src.id}
                    variant="ghost"
                    onClick={() => setActiveSource(src.id)}
                    className={`justify-start gap-3 rounded-xl h-11 font-black text-xs ${
                      activeSource === src.id ? 'bg-primary/10 text-primary' : 'text-slate-500'
                    }`}
                  >
                    <src.icon className="w-4 h-4" />
                    {src.label}
                  </Button>
                ))}
             </div>
          </div>

          <div className="pt-4 border-t space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase">إجمالي الصور</span>
                <span className="text-xl font-black text-slate-800">{filteredItems.length}</span>
             </div>
          </div>
        </Card>

        {/* Gallery Content */}
        <div className="md:col-span-3 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 opacity-20">
               <ImageIcon className="w-20 h-20 animate-pulse" />
               <p className="font-black mt-4">جاري تحميل المعرض...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="rounded-[3rem] border-none shadow-sm p-20 text-center">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ImageIcon className="w-10 h-10 text-slate-200" />
               </div>
               <h3 className="text-xl font-black text-slate-700">لا توجد صور حالياً</h3>
               <p className="text-slate-400 font-medium">الصور والمرفقات المرفوعة ستظهر هنا تلقائياً</p>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-square rounded-[2rem] overflow-hidden bg-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer"
                    onClick={() => setSelectedImage(item)}
                  >
                    <img 
                      src={item.url} 
                      alt={item.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end backdrop-blur-[2px]">
                       <p className="text-white font-black text-xs truncate mb-1 bg-black/40 px-2 py-1 rounded w-fit">{item.title}</p>
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider scale-90 origin-right">
                            {item.source}
                          </span>
                          <div className="flex gap-1">
                             <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-white/20 hover:bg-white text-slate-900 backdrop-blur-md">
                                <ExternalLink className="w-4 h-4" />
                             </Button>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-3">
               {filteredItems.map((item) => (
                 <Card key={item.id} className="rounded-2xl p-4 border-none shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 rounded-xl overflow-hidden shadow-inner flex-shrink-0">
                          <img src={item.url} className="w-full h-full object-cover" onClick={() => setSelectedImage(item)} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-800 truncate">{item.title}</h4>
                          <div className="flex items-center gap-3 mt-1">
                             {getSourceBadge(item.source)}
                             <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {item.date?.toDate?.()?.toLocaleDateString('ar-SA') || 'تاريخ قديم'}
                             </span>
                          </div>
                       </div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="rounded-full text-slate-400 hover:text-rose-600"
                            onClick={() => handleDelete(item)}
                          >
                             <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="rounded-full text-slate-400 hover:text-primary"
                            onClick={() => setSelectedImage(item)}
                          >
                             <ExternalLink className="w-4 h-4" />
                          </Button>
                       </div>
                    </div>
                 </Card>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2.5rem] border-none bg-slate-950/98 backdrop-blur-3xl shadow-2xl" dir="rtl">
          {selectedImage && (
            <div className="relative flex flex-col h-auto max-h-[90vh]">
               {/* Main Content Area: Image + Sidebar */}
               <div className="flex flex-col md:flex-row items-center justify-between p-8 gap-8 overflow-hidden min-h-[400px]">
                  {/* Image Container */}
                  <div className="flex-1 w-full h-[50vh] md:h-[60vh] flex items-center justify-center overflow-hidden bg-white/5 rounded-3xl border border-white/10 shadow-2xl group relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-4 left-4 z-50 rounded-full bg-black/40 text-white hover:bg-rose-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </Button>

                    {selectedImage.url.startsWith('data:application/pdf') ? (
                      <div className="flex flex-col items-center gap-6 p-16">
                        <div className="w-32 h-32 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-500">
                          <FileText className="w-16 h-16" />
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-white mb-2 tracking-tight">مستند PDF</p>
                          <Badge className="bg-red-500 text-white border-none px-4 py-1">جاهز للطباعة</Badge>
                        </div>
                      </div>
                    ) : (
                      <motion.img 
                        initial={{ opacity: 0, scale: 0.9, rotate: -1 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        src={selectedImage.url} 
                        alt={selectedImage.title} 
                        className="max-h-full max-w-full object-contain shadow-2xl transition-transform duration-700 group-hover:scale-[1.03]" 
                      />
                    )}
                  </div>
 
                  {/* Vertical Sidebar Actions */}
                  <div className="flex md:flex-col items-center gap-4 bg-white/5 backdrop-blur-2xl p-5 rounded-[2.5rem] border border-white/10 shadow-2xl shrink-0 animate-in slide-in-from-left-10 duration-500">
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       onClick={() => handlePrint(selectedImage.url)} 
                       className="w-14 h-14 rounded-2xl text-white/50 hover:bg-primary hover:text-white hover:scale-110 active:scale-90 transition-all shadow-lg" 
                       title="طباعة"
                     >
                       <Printer className="w-8 h-8" />
                     </Button>
                     <div className="hidden md:block w-8 h-px bg-white/10 mx-auto" />
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       onClick={() => handleCopy(selectedImage.url)} 
                       className="w-14 h-14 rounded-2xl text-white/50 hover:bg-primary hover:text-white hover:scale-110 active:scale-90 transition-all shadow-lg" 
                       title="نسخ"
                     >
                       <Copy className="w-8 h-8" />
                     </Button>
                     <div className="hidden md:block w-8 h-px bg-white/10 mx-auto" />
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       onClick={() => handleShare(selectedImage)} 
                       className="w-14 h-14 rounded-2xl text-white/50 hover:bg-emerald-500 hover:text-white hover:scale-110 active:scale-90 transition-all shadow-lg" 
                       title="مشاركة"
                     >
                       <Share2 className="w-8 h-8" />
                     </Button>
                  </div>
               </div>
 
               {/* Bottom Info & Main Actions Bar */}
               <div className="p-10 bg-gradient-to-t from-black to-black/80 backdrop-blur-3xl border-t border-white/10">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                     <div className="space-y-3 text-center md:text-right">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                           {getSourceBadge(selectedImage.source)}
                           <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700 uppercase tracking-widest font-black">
                             {selectedImage.category}
                           </Badge>
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tight leading-none drop-shadow-lg">{selectedImage.title}</h3>
                        <p className="text-slate-400 text-sm font-medium opacity-80">تم الرفع في: {selectedImage.date?.toDate?.()?.toLocaleDateString('ar-SA') || 'تاريخ غير متوفر'}</p>
                     </div>
 
                     <div className="flex items-center gap-4 w-full md:w-auto">
                        <Button 
                          variant="outline" 
                          className="flex-1 md:flex-none rounded-2xl bg-white text-slate-900 hover:bg-slate-100 border-none h-16 px-10 text-lg font-black gap-3 transition-all active:scale-95 shadow-xl shadow-white/5"
                          onClick={() => window.open(selectedImage.url)}
                        >
                           <Download className="w-6 h-6" /> تحميل المرفق
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="flex-1 md:flex-none rounded-2xl h-16 px-10 text-lg font-black gap-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-xl shadow-rose-500/5"
                          onClick={() => {
                            if(confirm('هل أنت متأكد من الحذف النهائي؟')) handleDelete(selectedImage);
                          }}
                        >
                           <Trash2 className="w-6 h-6" /> حذف نهائي
                        </Button>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
