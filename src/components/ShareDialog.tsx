// src/components/ShareDialog.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Search, Users, User, ShieldCheck, BadgeDollarSign, Landmark, HelpCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState('all');

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
        toast.error('فشل تحميل قائمة المستخدمين للمشاركة');
      }
    };
    fetchUsers();
    // Reset selections and search query on open
    setSelected(new Set());
    setSearchQuery('');
    setActiveRoleFilter('all');
  }, [open]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllFiltered = (filteredList: any[]) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      const allSelected = filteredList.every(u => newSet.has(u.id));
      if (allSelected) {
        filteredList.forEach(u => newSet.delete(u.id));
      } else {
        filteredList.forEach(u => newSet.add(u.id));
      }
      return newSet;
    });
  };

  const handleInternalShare = async () => {
    setLoading(true);
    try {
      const currentUser = getAuth().currentUser;
      const promises = Array.from(selected).map(uid =>
        addDoc(collection(db, 'shares'), {
          docId: doc?.id || doc?.invoice_id || doc?.quote_id,
          type,
          sharedWith: uid,
          sharedBy: currentUser?.uid ?? 'system',
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(promises);
      toast.success('تم مشاركة المستند داخلياً بنجاح ✅');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء مشاركة المستند ❌');
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const handleWhatsAppShare = () => {
    const clientName = doc?.client_name || doc?.client || 'العميل الكريم';
    const docNum = doc?.invoice_number || doc?.quote_number || doc?.id;
    const total = parseFloat(doc?.invoice_total || doc?.quote_total || doc?.total || 0).toLocaleString();
    const text = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بك أخي ${clientName}.\n\nمرفق لكم ${type === 'invoice' ? 'الفاتورة' : 'عرض السعر'} رقم *${docNum}* بقيمة *${total} ر.س*.`;
    const encoded = encodeURIComponent(text);
    
    // Open a WhatsApp tab for selected users
    let openedCount = 0;
    Array.from(selected).forEach(uid => {
      const targetUser = users.find(u => u.id === uid);
      const phone = targetUser?.phone || targetUser?.phoneNumber;
      if (phone) {
        // Clean phone number (replace space, dashes, ensure country code)
        const cleanPhone = phone.replace(/[\s-+]/g, '');
        window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`, '_blank');
        openedCount++;
      } else {
        // Fallback: general whatsapp sharing text
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
        openedCount++;
      }
    });

    if (openedCount > 0) {
      toast.success(`جاري فتح الواتساب لمشاركة المستند (${openedCount}) مستخدمين`);
    } else {
      toast.warning('يرجى تحديد مستخدمين يملكون أرقام جوال مسجلة');
    }
    onOpenChange(false);
  };

  // Helper: Get user role style & label
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'manager':
        return { label: 'مدير', style: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: ShieldCheck };
      case 'supervisor':
        return { label: 'مشرف مالي', style: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Landmark };
      case 'sales_rep':
        return { label: 'مندوب مبيعات', style: 'bg-amber-50 text-amber-700 border-amber-100', icon: BadgeDollarSign };
      default:
        return { label: 'موظف', style: 'bg-slate-50 text-slate-700 border-slate-100', icon: User };
    }
  };

  // Helper: Initials generator
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.trim().split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // Filter users based on search query and role filter
  const filteredUsers = users.filter(user => {
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || email.includes(query);
    const matchesRole = activeRoleFilter === 'all' || user.role === activeRoleFilter;
    return matchesSearch && matchesRole;
  });

  const isAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selected.has(u.id));

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl max-h-[90vh] flex flex-col p-6 overflow-hidden" dir="rtl">
        <DialogHeader className="space-y-1 text-right">
          <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            مشاركة المستند مع فريق العمل
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400">
            اختر المستخدمين لمشاركة {type === 'invoice' ? 'الفاتورة' : 'عرض السعر'} رقم {doc.invoice_number || doc.quote_number || doc.id}
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filter Section */}
        <div className="space-y-3 my-4">
          <div className="relative">
            <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <Input
              placeholder="ابحث بالاسم أو البريد الإلكتروني..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-11 rounded-xl border-slate-200/80 focus-visible:ring-primary/20 bg-slate-50/50 text-xs font-bold"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'manager', label: 'المدراء' },
              { id: 'supervisor', label: 'المشرفين' },
              { id: 'sales_rep', label: 'المناديب' },
              { id: 'employee', label: 'الموظفين' },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveRoleFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                  activeRoleFilter === filter.id
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* User List Container */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 pl-1 min-h-[220px] max-h-[300px]">
          {filteredUsers.length > 0 && (
            <div 
              onClick={() => selectAllFiltered(filteredUsers)}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-slate-200 hover:bg-slate-50/40 cursor-pointer transition-colors"
            >
              <Checkbox 
                checked={isAllFilteredSelected} 
                onCheckedChange={() => selectAllFiltered(filteredUsers)} 
                className="rounded-md"
              />
              <span className="text-[10px] font-black text-slate-500">تحديد الكل ({filteredUsers.length} مستخدم)</span>
            </div>
          )}

          <AnimatePresence initial={false}>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => {
                const badge = getRoleBadge(user.role);
                const isSelected = selected.has(user.id);
                return (
                  <motion.div
                    key={user.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    onClick={() => toggleSelect(user.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-primary/5 border-primary/25 shadow-sm'
                        : 'bg-white hover:bg-slate-50/50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(user.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md focus-visible:ring-primary/20"
                      />
                      
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 ${badge.style}`}>
                        {getInitials(user.name)}
                      </div>

                      <div className="min-w-0 text-right">
                        <p className="text-xs font-black text-slate-800 truncate">{user.name || 'مستخدم غير مسمى'}</p>
                        <p className="text-[10px] font-semibold text-slate-400 truncate">{user.email || 'لا يوجد بريد إلكتروني'}</p>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black shrink-0 ${badge.style}`}>
                      <badge.icon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                <HelpCircle className="w-10 h-10 opacity-20 mb-2" />
                <p className="text-[11px] font-bold">لا يوجد نتائج تطابق بحثك</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-100 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl font-bold text-xs h-11 border-slate-200 hover:bg-slate-50 cursor-pointer sm:order-first"
          >
            إلغاء
          </Button>

          <div className="flex flex-1 gap-2 w-full sm:w-auto">
            <Button
              onClick={handleInternalShare}
              disabled={loading || selected.size === 0}
              className="flex-1 rounded-xl font-black text-xs h-11 bg-slate-900 text-white hover:bg-black transition-all gap-1 cursor-pointer"
            >
              مشاركة بالنظام ({selected.size})
            </Button>
            <Button
              onClick={handleWhatsAppShare}
              disabled={selected.size === 0}
              className="flex-1 rounded-xl font-black text-xs h-11 bg-emerald-600 text-white hover:bg-emerald-700 transition-all gap-1 cursor-pointer"
            >
              واتساب ({selected.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
