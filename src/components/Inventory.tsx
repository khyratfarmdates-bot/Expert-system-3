import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Plus, 
  Minus, 
  History, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search,
  Loader2,
  Filter,
  Layers,
  ShoppingBag
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  serverTimestamp, 
  orderBy, 
  where,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { sendNotification } from '../lib/notifications';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Inventory() {
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';
  const isSupervisor = profile?.role === 'supervisor';
  const isElevated = isManager || isSupervisor;

  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'مواد لوحات',
    quantity: '0',
    unit: 'متر',
    reorderLevel: '5'
  });

  useEffect(() => {
    const unsubItems = onSnapshot(
      query(collection(db, 'inventory'), orderBy('name', 'asc')),
      (snapshot) => {
        setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'inventoryLogs'), orderBy('timestamp', 'desc')),
      (snapshot) => {
        setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubItems();
      unsubLogs();
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const qty = parseFloat(newItem.quantity);
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        quantity: qty,
        reorderLevel: parseFloat(newItem.reorderLevel),
        lastUpdated: new Date().toISOString()
      });
      await logActivity('إضافة مخزون', `تمت إضافة مادة جديدة: ${newItem.name}`, 'info', 'system', profile.uid);
      
      await sendNotification({
        title: 'إضافة مخزون جديد',
        message: `تمت إضافة مادة ${newItem.name} بكمية ${newItem.quantity} ${newItem.unit}`,
        type: 'success',
        category: 'inventory',
        targetRole: 'manager',
        tab: 'inventory',
        priority: 'high'
      });

      toast.success('تمت إضافة المادة للمخزن');
      setIsAddDialogOpen(false);
      setNewItem({ name: '', category: 'مواد لوحات', quantity: '0', unit: 'متر', reorderLevel: '5' });
    } catch (e) {
      toast.error('فشل في الإضافة');
    }
  };

  const handleAdjustStock = async (itemId: string, currentQty: number, change: number, reason: string) => {
    if (!profile) return;
    try {
      if (currentQty + change < 0) {
        toast.error('الكمية المتبقية لا تكفي');
        return;
      }

      await updateDoc(doc(db, 'inventory', itemId), {
        quantity: increment(change),
        lastUpdated: new Date().toISOString()
      });

      await addDoc(collection(db, 'inventoryLogs'), {
        itemId,
        change,
        reason,
        userId: profile.uid,
        userName: profile.name || 'موظف',
        timestamp: new Date().toISOString()
      });

      toast.success('تم تحديث المخزون بنجاح');

      // Check for low stock notification
      const newTotal = currentQty + change;
      const itemSnap = await getDoc(doc(db, 'inventory', itemId));
      const itemData = itemSnap.data();
      if (itemData && newTotal <= (itemData.reorderLevel || 5)) {
        await sendNotification({
          title: 'تحذير: نقص مواد حاد',
          message: `المادة ${itemData.name} وصلت للحد الأدنى الحرج (${newTotal} ${itemData.unit}) - يرجى تأمين الكمية فوراً لتجنب توقف العمل`,
          type: 'error',
          category: 'inventory',
          targetRole: 'manager',
          tab: 'inventory',
          priority: 'high'
        });
      }

      setIsAdjustDialogOpen(false);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (e) {
      toast.error('فشل التحديث');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = items.filter(item => item.quantity <= item.reorderLevel);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">إدارة المخازن والمواد</h1>
          <p className="text-[13px] text-muted-foreground font-bold">مراقبة مستويات البنرات، الفينيل، الأحبار ومواد اللوحات</p>
        </div>
        {isElevated && (
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            className="rounded-xl bg-primary hover:bg-black font-bold h-11 px-6 shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة مادة جديدة
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        <Card className="rounded-2xl border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 md:p-6">
            <Package className="w-5 h-5 text-primary mb-3" />
            <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase">إجمالي المواد</p>
            <h3 className="text-xl md:text-2xl font-black text-primary">{items.length}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-amber-50">
          <CardContent className="p-4 md:p-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 mb-3" />
            <p className="text-[10px] md:text-xs font-bold text-amber-600 uppercase">مواد منخفضة</p>
            <h3 className="text-xl md:text-2xl font-black text-amber-700">{lowStockItems.length}</h3>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-blue-50">
          <CardContent className="p-4 md:p-6">
            <History className="w-5 h-5 text-blue-600 mb-3" />
            <p className="text-[10px] md:text-xs font-bold text-blue-600 uppercase">حركات اليوم</p>
            <h3 className="text-xl md:text-2xl font-black text-blue-700">
              {logs.filter(l => (l.timestamp || '').split('T')[0] === new Date().toISOString().split('T')[0]).length}
            </h3>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-emerald-50">
          <CardContent className="p-4 md:p-6">
            <ShoppingBag className="w-5 h-5 text-emerald-600 mb-3" />
            <p className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase">طلب توريد</p>
            <h3 className="text-[12px] md:text-sm font-black text-emerald-700">تنبيه ذكي مفعل</h3>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="البحث في المخزن..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl pr-10 border-slate-200 focus:ring-primary h-11"
          />
        </div>
        <Button variant="outline" className="rounded-xl h-11 w-11 p-0 border-slate-200">
          <Filter className="w-4 h-4 text-slate-400" />
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : filteredItems.map(item => (
          <Card key={item.id} className="rounded-2xl border-border bg-white shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <CardContent className="p-3 md:p-6">
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="flex flex-col min-w-0">
                  <h4 className="font-black text-primary text-[11px] md:text-base leading-tight truncate">{item.name}</h4>
                  <p className="text-[9px] text-muted-foreground font-bold truncate opacity-60">{item.category}</p>
                </div>
                <div className={`shrink-0 p-1.5 rounded-lg ${item.quantity <= item.reorderLevel ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                   <Layers className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-1">
                  <span className={`text-xl md:text-2xl font-black ${item.quantity <= item.reorderLevel ? 'text-amber-600' : 'text-primary'}`}>
                    {item.quantity}
                  </span>
                  <span className="text-[8px] md:text-xs text-muted-foreground font-bold">{item.unit}</span>
                </div>
                
                <div className="flex gap-1 mt-1">
                  {isElevated && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setAdjustAmount('1');
                          setIsAdjustDialogOpen(true);
                        }}
                        className="h-7 flex-1 rounded-lg border-slate-100 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedItem(item);
                          setAdjustAmount('-1');
                          setIsAdjustDialogOpen(true);
                        }}
                        className="h-7 flex-1 rounded-lg border-slate-100 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border bg-white shadow-sm">
        <CardHeader className="border-b border-slate-50">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            سجل حركات المخزن الأخيرة
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {logs.slice(0, 10).map((log, i) => {
              const item = items.find(it => it.id === log.itemId);
              return (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${log.change > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {log.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary">{item?.name || 'مادة محذوفة'}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{log.reason} - بواسطة {log.userName}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={`font-black text-sm ${log.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {log.change > 0 ? '+' : ''}{log.change} {item?.unit}
                    </p>
                    <p className="text-[9px] text-muted-foreground font-bold" dir="ltr">{new Date(log.timestamp).toLocaleString('ar-SA')}</p>
                  </div>
                </div>
              );
            })}
            {logs.length === 0 && <div className="p-10 text-center text-muted-foreground text-sm italic">لا توجد حركات مسجلة</div>}
          </div>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">إضافة صنف للمخزن</DialogTitle>
            <DialogDescription className="text-xs">تسجيل مادة خام جديدة لمراقبة استهلاكها.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4 py-4 text-right">
            <div className="space-y-2">
              <Label className="font-bold text-sm">اسم المادة</Label>
              <Input 
                required
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                placeholder="مثلاً: بنر 440 جرام، فينيل لامع..." 
                className="h-11 rounded-lg text-right"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-sm">التصنيف</Label>
                <Input 
                  value={newItem.category}
                  onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  className="h-11 rounded-lg text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-sm">الوحدة</Label>
                <Input 
                  value={newItem.unit}
                  onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                  placeholder="متر، لفة..."
                  className="h-11 rounded-lg text-right"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-sm">الكمية الحالية</Label>
                <Input 
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                  className="h-11 rounded-lg text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-sm">مستوى التنبيه</Label>
                <Input 
                  type="number"
                  value={newItem.reorderLevel}
                  onChange={(e) => setNewItem({...newItem, reorderLevel: e.target.value})}
                  className="h-11 rounded-lg text-right"
                />
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full h-12 rounded-xl bg-primary font-bold">تسجيل المادة</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تعديل المخزون: {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center mb-4">
               <span className="text-xs font-bold text-muted-foreground">الكمية الحالية:</span>
               <span className="font-black text-xl text-primary">{selectedItem?.quantity} {selectedItem?.unit}</span>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-sm">مقدار التغيير (+ أو -)</Label>
              <Input 
                type="number"
                placeholder="مثلاً: 10 أو -5" 
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="h-11 rounded-lg text-right font-black"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-sm">السبب</Label>
              <Input 
                placeholder="شراء جديد، استهلاك في مشروع..." 
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="h-11 rounded-lg text-right"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => handleAdjustStock(selectedItem?.id, selectedItem?.quantity, parseFloat(adjustAmount), adjustReason)}
              disabled={!adjustAmount || !adjustReason}
              className="w-full h-12 rounded-xl bg-primary font-bold shadow-lg shadow-primary/20"
            >
              تحديث الكمية فوراً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
