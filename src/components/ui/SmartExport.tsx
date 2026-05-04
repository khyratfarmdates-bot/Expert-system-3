import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  Table as TableIcon, 
  Share2, 
  Calendar as CalendarIcon,
  ChevronRight,
  X
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { utils, writeFile } from 'xlsx';

interface SmartExportProps {
  data: Record<string, unknown>[];
  title: string;
  columns: { header: string; key: string }[];
}

export default function SmartExport({ data, title, columns }: SmartExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel' | 'link'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const filterData = () => {
    if (!startDate && !endDate) return data;
    return data.filter(item => {
      // Handle the case where date is a Firestore timestamp
      const dateVal = (item.date as any)?.toDate ? (item.date as any).toDate() : ((item.createdAt as any)?.toDate ? (item.createdAt as any).toDate() : new Date((item.date as string) || (item.createdAt as string) || 0));
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      return dateVal >= start && dateVal <= end;
    });
  };

  const exportToPDF = (filtered: Record<string, unknown>[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Add title
    doc.setFontSize(18);
    doc.text(title, 140, 15, { align: 'center' });
    
    const tableData = filtered.map(item => columns.map(col => String(item[col.key] || '')));
    const headers = columns.map(col => col.header);

    (doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`${title}_${new Date().toLocaleDateString()}.pdf`);
  };

  const exportToExcel = (filtered: Record<string, unknown>[]) => {
    const dataToExport = filtered.map(item => {
      const row: Record<string, unknown> = {};
      columns.forEach(col => {
        row[col.header] = item[col.key];
      });
      return row;
    });
    
    const ws = utils.json_to_sheet(dataToExport);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "التقرير");
    writeFile(wb, `${title}_${new Date().toLocaleDateString()}.xlsx`);
  };

  const generateLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    toast.success('تم نسخ رابط التقرير الحالي للمشاركة');
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filtered = filterData();
      if (filtered.length === 0) {
        toast.error('لا توجد بيانات لتصديرها في النطاق الزمني المحدد');
        setIsExporting(false);
        return;
      }

      if (format === 'pdf') exportToPDF(filtered);
      else if (format === 'excel') exportToExcel(filtered);
      else if (format === 'link') generateLink();

      setIsOpen(false);
      toast.success('تم التصدير بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2 rounded-xl border-primary/20 hover:bg-primary/5 text-primary font-black shadow-sm h-11 px-6">
            <Download className="w-4 h-4" />
            تصدير ذكي
          </Button>
        }
      />
      <DialogContent className="max-w-md rounded-[2.5rem] p-0 border-none shadow-2xl bg-white overflow-hidden">
        <div className="bg-primary p-8 text-white relative">
           <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full"
           >
             <X className="w-5 h-5" />
           </Button>
           <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
             <Download className="w-6 h-6" />
           </div>
           <h3 className="text-2xl font-black">تصدير التقارير</h3>
           <p className="text-white/60 text-sm font-medium mt-1">خصص التقرير المراد تصديره بكل دقة</p>
        </div>

        <div className="p-8 space-y-6">
           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">النطاق الزمني</label>
              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 block pr-1">من تاريخ</span>
                    <div className="relative">
                       <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <Input 
                        type="date" 
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="rounded-xl border-slate-100 pr-9 h-11 text-xs"
                       />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 block pr-1">إلى تاريخ</span>
                    <div className="relative">
                       <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <Input 
                        type="date" 
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="rounded-xl border-slate-100 pr-9 h-11 text-xs"
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">صيغة التصدير</label>
              <div className="grid grid-cols-3 gap-2">
                 {[
                   { id: 'pdf', label: 'PDF', icon: FileText, color: 'hover:border-rose-400 hover:bg-rose-50' },
                   { id: 'excel', label: 'Excel', icon: TableIcon, color: 'hover:border-emerald-400 hover:bg-emerald-50' },
                   { id: 'link', label: 'رابط', icon: Share2, color: 'hover:border-blue-400 hover:bg-blue-50' }
                 ].map(opt => (
                   <button
                    key={opt.id}
                    onClick={() => setFormat(opt.id as any)}
                    className={`flex flex-col items-center justify-center py-4 px-2 rounded-[1.5rem] border-2 transition-all group ${
                      format === opt.id 
                        ? 'border-primary bg-primary/5 text-primary' 
                        : `border-slate-100 text-slate-400 bg-white ${opt.color}`
                    }`}
                   >
                      <opt.icon className={`w-6 h-6 mb-2 transition-transform group-hover:scale-110 ${format === opt.id ? 'text-primary' : 'text-slate-300'}`} />
                      <span className="text-[10px] font-black">{opt.label}</span>
                   </button>
                 ))}
              </div>
           </div>

           <Button 
            onClick={handleExport}
            disabled={isExporting}
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm gap-3 group"
           >
              {isExporting ? (
                <>جاري التصدير...</>
              ) : (
                <>
                  تأكيد التصدير
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[-4px]" />
                </>
              )}
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
