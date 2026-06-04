// src/components/ShareDialog.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { User2 } from 'lucide-react';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: any; // invoice or quote document
  type: 'invoice' | 'quote';
}

export function ShareDialog({ open, onOpenChange, doc, type }: ShareDialogProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Load all active users (employees & workers) from Firestore when dialog opens
  useEffect(() => {
    if (!open) return;
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(list);
      } catch (e) {
        console.error('Failed to fetch users for sharing', e);
      }
    };
    fetchUsers();
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const handleInternalShare = async () => {
    setLoading(true);
    try {
      const currentUser = getAuth().currentUser;
      const promises = Array.from(selected).map(uid =>
        addDoc(collection(db, 'shares'), {
          docId: doc.id || doc.invoice_id || doc.quote_id,
          type,
          sharedWith: uid,
          sharedBy: currentUser?.uid ?? 'system',
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(promises);
      alert('تم مشاركة المستند داخلياً بنجاح');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء مشاركة المستند');
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const handleWhatsAppShare = () => {
    const clientName = doc.client_name || doc.client || 'العميل الكريم';
    const docNum = doc.invoice_number || doc.quote_number || doc.id;
    const total = parseFloat(doc.invoice_total || doc.quote_total || doc.total || 0).toLocaleString();
    const text = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بك أخي ${clientName}.\n\nمرفق لكم ${type === 'invoice' ? 'الفاتورة' : 'عرض السعر'} رقم *${docNum}* بقيمة *${total} ر.س*.`;
    const encoded = encodeURIComponent(text);
    // Open a WhatsApp tab for each selected user (or just once if you prefer)
    Array.from(selected).forEach(() => {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center">مشاركة {type === 'invoice' ? 'الفاتورة' : 'العرض'} مع الأشخاص</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {users.map(user => (
            <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
              <Checkbox checked={selected.has(user.id)} onCheckedChange={() => toggleSelect(user.id)} />
              <User2 className="w-5 h-5 text-slate-600" />
              <span>{user.name || user.email || 'مستخدم غير مسمى'}</span>
            </label>
          ))}
        </div>
        <DialogFooter className="flex space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>إلغاء</Button>
          <Button onClick={handleInternalShare} disabled={loading || selected.size === 0}>مشاركة داخل النظام</Button>
          <Button onClick={handleWhatsAppShare} disabled={selected.size === 0}>مشاركة عبر واتساب</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
