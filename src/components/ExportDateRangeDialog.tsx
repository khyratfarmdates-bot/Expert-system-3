import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

interface ExportDateRangeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (startDate: string, endDate: string) => void;
  title?: string;
}

export default function ExportDateRangeDialog({ 
  isOpen, 
  onOpenChange, 
  onConfirm,
  title = "تصدير التقرير المخصص"
}: ExportDateRangeDialogProps) {
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // Default to first day of month
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleConfirm = () => {
    onConfirm(startDate, endDate);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="text-right sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            يرجى تحديد الفترة الزمنية للبيانات التي ترغب في تضمينها في التقرير.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="start-date" className="font-bold">من تاريخ</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-right h-11"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end-date" className="font-bold">إلى تاريخ</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-right h-11"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-row-reverse gap-3 pt-4">
          <Button 
            onClick={handleConfirm}
            className="flex-1 font-bold h-11 rounded-xl bg-primary hover:bg-black transition-all"
          >
            توليد التقرير
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1 font-bold h-11 rounded-xl"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
