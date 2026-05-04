import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Search, 
  Plus, 
  User, 
  History, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Filter,
  Monitor,
  Truck,
  DraftingCompass,
  Laptop,
  Smartphone,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AssetStatus = 'available' | 'assigned' | 'under-maintenance' | 'retired';
type AssetCategory = 'electronics' | 'vehicles' | 'tools' | 'furniture' | 'other';

interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  category: AssetCategory;
  status: AssetStatus;
  condition: string;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    assignedDate: any;
  };
  purchaseDate: any;
  value: number;
  notes: string;
  customFields: {
    label: string;
    value: string;
  }[];
  history: {
    type: 'assigned' | 'returned' | 'maintenance' | 'status-change';
    date: any;
    note: string;
    userName: string;
  }[];
}

export default function AssetsManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<AssetCategory | 'all'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // New Asset Form
  const [newAsset, setNewAsset] = useState({
    name: '',
    serialNumber: '',
    category: 'electronics' as AssetCategory,
    condition: 'جديد',
    value: 0,
    notes: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    customFields: [] as { label: string; value: string }[]
  });

  const [newField, setNewField] = useState({ label: '', value: '' });

  useEffect(() => {
    const unsubAssets = onSnapshot(query(collection(db, 'assets'), orderBy('name')), (snap) => {
      setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)));
      setLoading(false);
    });

    const unsubEmps = onSnapshot(collection(db, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAssets();
      unsubEmps();
    };
  }, []);

  const handleAddAsset = async () => {
    if (!newAsset.name || !newAsset.serialNumber) {
      toast.error('يرجى إكمال البيانات الأساسية');
      return;
    }

    try {
      await addDoc(collection(db, 'assets'), {
        ...newAsset,
        status: 'available',
        history: [{
          type: 'status-change',
          date: new Date(),
          note: 'تمت إضافة الأصل إلى النظام',
          userName: 'المدير'
        }],
        createdAt: serverTimestamp()
      });
      setIsAddDialogOpen(false);
      setNewAsset({
        name: '',
        serialNumber: '',
        category: 'electronics',
        condition: 'جديد',
        value: 0,
        notes: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        customFields: []
      });
      toast.success('تمت إضافة الأصل بنجاح');
    } catch (err) {
      toast.error('خطأ في إضافة الأصل');
    }
  };

  const handleAssignAsset = async (assetId: string, employeeId: string) => {
    const asset = assets.find(a => a.id === assetId);
    const employee = employees.find(e => e.id === employeeId);

    if (!asset || !employee) return;

    try {
      await updateDoc(doc(db, 'assets', assetId), {
        status: 'assigned',
        assignedTo: {
          id: employee.id,
          name: employee.name,
          email: employee.email || '',
          assignedDate: new Date()
        },
        history: [
          {
            type: 'assigned',
            date: new Date(),
            note: `تم تسليم العهدة للموظف: ${employee.name}`,
            userName: 'المدير'
          },
          ...asset.history
        ]
      });
      toast.success('تم تعيين العهدة بنجاح');
    } catch (err) {
      toast.error('خطأ في تعيين العهدة');
    }
  };

  const handleReturnAsset = async (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    try {
      await updateDoc(doc(db, 'assets', assetId), {
        status: 'available',
        assignedTo: null,
        history: [
          {
            type: 'returned',
            date: new Date(),
            note: `تم استعادة العهدة من الموظف: ${asset.assignedTo?.name}`,
            userName: 'المدير'
          },
          ...asset.history
        ]
      });
      toast.success('تم استعادة العهدة بنجاح');
    } catch (err) {
      toast.error('خطأ في استعادة العهدة');
    }
  };

  const getCategoryIcon = (category: AssetCategory) => {
    switch (category) {
      case 'electronics': return Laptop;
      case 'vehicles': return Truck;
      case 'tools': return DraftingCompass;
      case 'furniture': return Package;
      default: return Package;
    }
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         a.assignedTo?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">إدارة الأصول والعهدة</h2>
          <p className="text-slate-500 font-medium">تتبع ممتلكات الشركة وعهد الموظفين بدقة</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger
            render={
              <Button className="rounded-2xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2 px-6">
                <Plus className="w-5 h-5" /> إضافة أصل جديد
              </Button>
            }
          />
          <DialogContent className="max-w-2xl rounded-[2rem] p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">إضافة أصل جديد للنظام</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">اسم الأصل</label>
                <Input 
                  value={newAsset.name}
                  onChange={e => setNewAsset({...newAsset, name: e.target.value})}
                  placeholder="مثال: لابتوب ديل XPS"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">الرقم التسلسلي</label>
                <Input 
                  value={newAsset.serialNumber}
                  onChange={e => setNewAsset({...newAsset, serialNumber: e.target.value})}
                  placeholder="SN-123456789"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">التصنيف</label>
                <Select value={newAsset.category} onValueChange={(v: AssetCategory) => setNewAsset({...newAsset, category: v})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electronics">إلكترونيات</SelectItem>
                    <SelectItem value="vehicles">مركبات</SelectItem>
                    <SelectItem value="tools">أدوات فنية</SelectItem>
                    <SelectItem value="furniture">أثاث مكتبي</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">الحالة الفنية</label>
                <Select value={newAsset.condition} onValueChange={v => setNewAsset({...newAsset, condition: v})}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="جديد">جديد</SelectItem>
                    <SelectItem value="ممتاز">ممتاز</SelectItem>
                    <SelectItem value="جيد">جيد</SelectItem>
                    <SelectItem value="يحتاج صيانة">يحتاج صيانة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">القيمة التقديرية (SAR)</label>
                <Input 
                  type="number"
                  value={newAsset.value}
                  onChange={e => setNewAsset({...newAsset, value: Number(e.target.value)})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">تاريخ الشراء</label>
                <Input 
                  type="date"
                  value={newAsset.purchaseDate}
                  onChange={e => setNewAsset({...newAsset, purchaseDate: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase mr-2 text-right block">ملاحظات إضافية</label>
                <textarea 
                  value={newAsset.notes}
                  onChange={e => setNewAsset({...newAsset, notes: e.target.value})}
                  className="w-full h-24 p-3 rounded-xl border border-slate-200 text-sm outline-primary"
                  placeholder="أي تفاصيل أخرى..."
                />
              </div>

              {/* Custom Fields Section */}
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-dashed">
                <div className="flex items-center justify-between">
                   <label className="text-xs font-black text-slate-800 uppercase">حقول مخصصة (تخصيص العقدة)</label>
                   <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (!newField.label || !newField.value) {
                        toast.error('يرجى تعبئة اسم وقيمة الحقل');
                        return;
                      }
                      setNewAsset({
                        ...newAsset,
                        customFields: [...newAsset.customFields, newField]
                      });
                      setNewField({ label: '', value: '' });
                    }}
                    className="text-primary hover:bg-primary/5 text-[10px] font-black h-7"
                   >
                     + إضافة حقل
                   </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   <Input 
                    placeholder="اسم الحقل (مثلاً: رقم اللوحة)"
                    value={newField.label}
                    onChange={e => setNewField({...newField, label: e.target.value})}
                    className="h-9 rounded-lg text-xs"
                   />
                   <Input 
                    placeholder="القيمة (مثلاً: أ ب ج 123)"
                    value={newField.value}
                    onChange={e => setNewField({...newField, value: e.target.value})}
                    className="h-9 rounded-lg text-xs"
                   />
                </div>

                <div className="flex flex-wrap gap-2">
                   {newAsset.customFields.map((field, idx) => (
                     <Badge key={idx} variant="secondary" className="rounded-lg py-1 px-3 flex items-center gap-2 group">
                       <span className="text-slate-400 font-bold">{field.label}:</span>
                       <span className="font-black">{field.value}</span>
                       <button 
                        onClick={() => setNewAsset({
                          ...newAsset, 
                          customFields: newAsset.customFields.filter((_, i) => i !== idx)
                        })}
                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                       >
                         ×
                       </button>
                     </Badge>
                   ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddAsset} className="w-full md:w-auto px-12 rounded-xl bg-primary font-black">حفظ الأصل</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-3xl border-none shadow-sm p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الأصول</p>
              <h3 className="text-2xl font-black text-slate-800">{assets.length}</h3>
            </div>
          </div>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">متاح حالياً</p>
              <h3 className="text-2xl font-black text-slate-800">{assets.filter(a => a.status === 'available').length}</h3>
            </div>
          </div>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">تحت العهدة</p>
              <h3 className="text-2xl font-black text-slate-800">{assets.filter(a => a.status === 'assigned').length}</h3>
            </div>
          </div>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase">تحتاج صيانة</p>
              <h3 className="text-2xl font-black text-slate-800">{assets.filter(a => a.status === 'under-maintenance' || a.condition === 'يحتاج صيانة').length}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="bg-white rounded-[3rem] border-none shadow-sm overflow-hidden">
        <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('all')}
              className="rounded-full text-xs font-black h-8 px-5"
            >الكل</Button>
            <Button 
              variant={activeCategory === 'electronics' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('electronics')}
              className="rounded-full text-xs font-black h-8 px-5 gap-2"
            ><Laptop className="w-3 h-3" /> إلكترونيات</Button>
            <Button 
              variant={activeCategory === 'vehicles' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('vehicles')}
              className="rounded-full text-xs font-black h-8 px-5 gap-2"
            ><Truck className="w-3 h-3" /> مركبات</Button>
            <Button 
              variant={activeCategory === 'tools' ? 'default' : 'outline'}
              onClick={() => setActiveCategory('tools')}
              className="rounded-full text-xs font-black h-8 px-5 gap-2"
            ><DraftingCompass className="w-3 h-3" /> أدوات فنية</Button>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الأصل أو الموظف..."
              className="rounded-2xl pr-10 focus-visible:ring-primary h-10"
            />
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 grayscale opacity-20">
               <Package className="w-16 h-16 animate-bounce" />
               <p className="font-black mt-4">جاري تحميل الأصول...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-600">لا توجد أصول مطابقة</h3>
              <p className="text-slate-400 text-sm font-medium">جرب تغيير معايير البحث أو إضافة أصول جديدة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredAssets.map((asset) => {
                  const CategoryIcon = getCategoryIcon(asset.category);
                  return (
                    <motion.div
                      layout
                      key={asset.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group"
                    >
                      <Card className="rounded-[2.5rem] border-none shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden bg-slate-50 relative group-hover:-translate-y-1">
                        <div className="absolute top-4 left-4">
                           <Badge className={`rounded-xl px-3 py-1 font-black ${
                             asset.status === 'available' ? 'bg-emerald-100 text-emerald-700' :
                             asset.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                             'bg-rose-100 text-rose-700'
                           }`}>
                             {asset.status === 'available' ? 'متاح' : 
                              asset.status === 'assigned' ? 'عهدة' : 'تحت الصيانة'}
                           </Badge>
                        </div>
                        
                        <div className="p-8">
                           <div className="flex items-center gap-4 mb-6">
                              <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center text-primary border border-slate-100">
                                 <CategoryIcon className="w-8 h-8" />
                              </div>
                              <div>
                                 <h4 className="text-lg font-black text-slate-800 leading-tight">{asset.name}</h4>
                                 <p className="text-xs font-black text-primary mt-1">{asset.serialNumber}</p>
                              </div>
                           </div>

                           <div className="space-y-3 mb-8">
                              <div className="flex items-center justify-between text-xs">
                                 <span className="text-slate-400 font-bold">الحالة:</span>
                                 <span className="text-slate-700 font-black">{asset.condition}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                 <span className="text-slate-400 font-bold">تاريخ الشراء:</span>
                                 <span className="text-slate-700 font-black">{asset.purchaseDate}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                 <span className="text-slate-400 font-bold">القيمة:</span>
                                 <span className="text-primary font-black uppercase">{asset.value.toLocaleString()} SAR</span>
                              </div>
                              {asset.customFields && asset.customFields.length > 0 && (
                                <div className="pt-3 border-t border-slate-100 space-y-2">
                                  {asset.customFields.map((field, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[10px]">
                                      <span className="text-slate-400 font-bold">{field.label}:</span>
                                      <span className="text-slate-700 font-black">{field.value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                           </div>

                           {asset.status === 'assigned' ? (
                             <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 mb-6 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                                   <User className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[10px] font-black text-emerald-600 uppercase">في عهدة</p>
                                   <p className="text-sm font-black text-slate-800 truncate">{asset.assignedTo?.name}</p>
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => handleReturnAsset(asset.id)} className="rounded-full hover:bg-emerald-100 text-emerald-600">
                                   <QrCode className="w-4 h-4" />
                                </Button>
                             </div>
                           ) : (
                             <div className="flex gap-2 mb-6">
                                <Select onValueChange={(val) => handleAssignAsset(asset.id, val)}>
                                   <SelectTrigger className="rounded-2xl bg-white border-slate-200">
                                      <SelectValue placeholder="تسليم العهدة لموظف..." />
                                   </SelectTrigger>
                                   <SelectContent>
                                      {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                      ))}
                                   </SelectContent>
                                </Select>
                             </div>
                           )}

                           <div className="flex items-center justify-between">
                              <Button variant="ghost" className="text-[10px] font-black text-slate-400 hover:text-primary gap-2">
                                 <History className="w-3 h-3" /> سجل الحركات
                              </Button>
                              <div className="flex items-center gap-1">
                                 <Button size="icon" variant="ghost" className="rounded-full w-8 h-8 text-slate-400">
                                    <MoreVertical className="w-4 h-4" />
                                 </Button>
                              </div>
                           </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
