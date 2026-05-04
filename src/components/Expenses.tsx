import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Receipt, 
  Wallet, 
  ArrowDownCircle, 
  AlertCircle,
  Loader2,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  where,
  deleteDoc,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SmartExport from './ui/SmartExport';
import { sendNotification } from '../lib/notifications';
import { softDelete } from '../lib/softDelete';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Expenses() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: 'مصروفات تشغيلية',
    projectId: '',
    paymentMethod: 'cash' as 'cash' | 'transfer',
    bankAccountId: '',
    invoiceNumber: ''
  });

  useEffect(() => {
    // Listen to strictly expenses
    const q = query(
      collection(db, 'transactions'), 
      where('type', '==', 'expense'),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateDisplay: doc.data().date?.toDate?.()?.toLocaleString('ar-SA') || doc.data().date
      })));
      setLoading(false);
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsub();
      unsubProjects();
      unsubBanks();
    };
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!formData.amount || !formData.description) {
      toast.error('يرجى ملء كافة الحقول المطلوبة');
      return;
    }

    setIsSubmitting(true);
    try {
      const isManager = profile.role === 'manager';
      await addDoc(collection(db, 'transactions'), {
        type: 'expense',
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        projectId: formData.projectId || null,
        paymentMethod: formData.paymentMethod,
        bankAccountId: formData.bankAccountId || null,
        invoiceNumber: formData.invoiceNumber || null,
        status: isManager ? 'approved' : 'pending',
        date: serverTimestamp(),
        createdBy: profile.uid,
        createdAt: serverTimestamp()
      });

      if (isManager && formData.bankAccountId) {
        // Only deduct if manager adds and specifies account
        const bankRef = doc(db, 'bankAccounts', formData.bankAccountId);
        const bankSnap = await getDoc(bankRef);
        if (bankSnap.exists()) {
          const currentBalance = bankSnap.data().initialBalance || 0;
          await updateDoc(bankRef, {
            initialBalance: currentBalance - parseFloat(formData.amount)
          });
        }
      }

      await logActivity(
        'تسجيل مصروف جديد',
        `تم تسجيل مصروف بقيمة ${formData.amount} ر.س: ${formData.description}`,
        'info',
        'financial',
        profile.uid
      );

      await sendNotification({
        title: 'تسجيل مصروف جديد',
        message: `تم تسجيل مصروف ${formData.description} بقيمة ${formData.amount} ر.س`,
        type: isManager ? 'info' : 'warning',
        category: 'financial',
        targetRole: 'manager',
        tab: 'expenses',
        priority: 'medium'
      });

      toast.success(isManager ? 'تم تسجيل المصروف بنجاح' : 'تم إرسال المصروف للمراجعة والاعتماد');
      setIsDialogOpen(false);
      setFormData({ 
        amount: '', 
        description: '', 
        category: 'مصروفات تشغيلية', 
        projectId: '', 
        paymentMethod: 'cash', 
        bankAccountId: '',
        invoiceNumber: '' 
      });
    } catch (error) {
      console.error(error);
      toast.error('فشل في تسجيل المصروف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveExpense = async (expense: any) => {
    if (profile?.role !== 'manager') return;
    if (!expense.bankAccountId) {
      toast.error('يرجى تحديد حساب الصرف أولاً (يمكن تعديل العملية)');
      return;
    }

    try {
      setIsSubmitting(true);
      const bankRef = doc(db, 'bankAccounts', expense.bankAccountId);
      const bankSnap = await getDoc(bankRef);
      
      if (!bankSnap.exists()) throw new Error('الحساب البنكي غير موجود');

      await updateDoc(doc(db, 'transactions', expense.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: profile.uid
      });

      const currentBalance = bankSnap.data().initialBalance || 0;
      await updateDoc(bankRef, {
        initialBalance: currentBalance - (expense.amount || 0)
      });

      toast.success('تم اعتماد المصروف وخصمه من الحساب');
    } catch (error: any) {
      toast.error(error.message || 'فشل في الاعتماد');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!profile || !selectedExpense) return;
    setIsSubmitting(true);
    try {
      const success = await softDelete(
        'transactions', 
        selectedExpense.id, 
        selectedExpense, 
        profile.uid, 
        `مصروف: ${selectedExpense.description}`
      );
      if (success) {
        setIsDeleteConfirmOpen(false);
      }
    } catch (error) {
      toast.error('فشل في الحذف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = e.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.invoiceNumber?.includes(searchTerm);
      const matchesFilter = filter === 'all' || e.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [expenses, searchTerm, filter]);

  const stats = useMemo(() => {
    return {
      total: expenses.filter(e => e.status === 'approved').reduce((acc, e) => acc + (e.amount || 0), 0),
      pending: expenses.filter(e => e.status === 'pending').reduce((acc, e) => acc + (e.amount || 0), 0),
      count: expenses.length
    };
  }, [expenses]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">المصروفات الإدارية والتشغيلية</h1>
          <p className="text-sm font-bold text-slate-500 tracking-tight">تتبع المصروفات النثرية، الرواتب، النثريات، والمصروفات الإدارية اليومية.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button className="bg-red-600 hover:bg-red-700 text-white rounded-xl gap-2 font-bold h-11 px-6 shadow-lg shadow-red-200">
                <Plus className="w-5 h-5" />
                تسجيل مصروف / فاتورة
              </Button>
            } />
            <DialogContent className="sm:max-w-[450px] text-right rounded-3xl" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">إضافة مصروف جديد</DialogTitle>
                <DialogDescription className="font-bold text-slate-400">تأكد من إرفاق رقم الفاتورة إن وجد لسهولة التتبع.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddExpense} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">المبلغ (ر.س) *</Label>
                    <Input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      className="rounded-xl h-11 text-right"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">رقم الفاتورة</Label>
                    <Input 
                      value={formData.invoiceNumber}
                      onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
                      className="rounded-xl h-11 text-right"
                      placeholder="INV-000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">البيان / الوصف *</Label>
                  <Input 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="مثال: فاتورة صيانة، أدوات مكتبية..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">التصنيف</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className="h-11 rounded-xl text-right">
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="مصروفات تشغيلية">مصروفات تشغيلية</SelectItem>
                      <SelectItem value="مواد وإنتاج">مواد وإنتاج</SelectItem>
                      <SelectItem value="أجور وعمالة">أجور وعمالة</SelectItem>
                      <SelectItem value="إيجارات">إيجارات</SelectItem>
                      <SelectItem value="مواصلات وبنزين">مواصلات وبنزين</SelectItem>
                      <SelectItem value="أخرى">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">المشروع المرتبط</Label>
                  <Select value={formData.projectId} onValueChange={v => setFormData({...formData, projectId: v})}>
                    <SelectTrigger className="h-11 rounded-xl text-right">
                      <SelectValue placeholder="اختياري" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مشروع</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label className="font-bold text-slate-700">طريقة الدفع</Label>
                    <Select value={formData.paymentMethod} onValueChange={v => setFormData({...formData, paymentMethod: v as any})}>
                      <SelectTrigger className="h-11 rounded-xl text-right text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">كاش (الخزينة)</SelectItem>
                        <SelectItem value="transfer">تحويل بنكي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">الحساب الصادر</Label>
                    <Select value={formData.bankAccountId} onValueChange={v => setFormData({...formData, bankAccountId: v})}>
                      <SelectTrigger className="h-11 rounded-xl text-right text-xs">
                        <SelectValue placeholder="اختر الحساب" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.filter(b => b.type === (formData.paymentMethod === 'cash' ? 'cash' : 'bank')).map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 font-black text-lg mt-4 shadow-lg shadow-red-100"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تسجيل المصروف'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <SmartExport 
            title="سجل المصروفات التشغيلية"
            data={expenses}
            columns={[
              { header: 'الوصف', key: 'description' },
              { header: 'المبلغ', key: 'amount' },
              { header: 'التصنيف', key: 'category' },
              { header: 'رقم الفاتورة', key: 'invoiceNumber' },
              { header: 'الحالة', key: 'status' }
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-none shadow-sm bg-white p-6 relative overflow-hidden group">
           <div className="relative z-10">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي المصروفات المعتمدة</h4>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-slate-800">{stats.total.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">( ر.س )</span>
            </div>
           </div>
           <ArrowDownCircle className="absolute -bottom-4 -right-4 w-24 h-24 text-red-50/50 group-hover:scale-110 transition-transform duration-500" />
        </Card>
        
        <Card className="rounded-3xl border-none shadow-sm bg-white p-6 relative overflow-hidden group">
           <div className="relative z-10">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">في انتظار الاعتماد</h4>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-amber-600">{stats.pending.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">( ر.س )</span>
            </div>
           </div>
           <Clock className="absolute -bottom-4 -right-4 w-24 h-24 text-amber-50/50 group-hover:scale-110 transition-transform duration-500" />
        </Card>

        <Card className="rounded-3xl border-none shadow-sm bg-white p-6 relative overflow-hidden group">
           <div className="relative z-10">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">عدد العمليات المسجلة</h4>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-slate-800">{stats.count}</span>
              <span className="text-xs font-bold text-slate-400">عملية</span>
            </div>
           </div>
           <Receipt className="absolute -bottom-4 -right-4 w-24 h-24 text-blue-50/50 group-hover:scale-110 transition-transform duration-500" />
        </Card>
      </div>

      <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="بحث في الوصف أو رقم الفاتورة..."
              className="pr-10 rounded-xl border-slate-100 bg-slate-50/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'ghost'} 
              onClick={() => setFilter('all')}
              className={`rounded-full h-8 text-[11px] font-black px-4 ${filter === 'all' ? 'bg-slate-800' : 'text-slate-500'}`}
            >الكل</Button>
            <Button 
              variant={filter === 'approved' ? 'default' : 'ghost'} 
              onClick={() => setFilter('approved')}
              className={`rounded-full h-8 text-[11px] font-black px-4 ${filter === 'approved' ? 'bg-emerald-600' : 'text-slate-500'}`}
            >معتمد</Button>
            <Button 
              variant={filter === 'pending' ? 'default' : 'ghost'} 
              onClick={() => setFilter('pending')}
              className={`rounded-full h-8 text-[11px] font-black px-4 ${filter === 'pending' ? 'bg-amber-600' : 'text-slate-500'}`}
            >معلق</Button>
          </div>
        </div>
        <Table className="text-right" dir="rtl">
          <TableHeader className="bg-slate-50/50 hover:bg-slate-50/50">
            <TableRow>
              <TableHead className="text-right py-4 font-black text-slate-400 text-[10px] uppercase">التاريخ</TableHead>
              <TableHead className="text-right py-4 font-black text-slate-400 text-[10px] uppercase">رقم الفاتورة</TableHead>
              <TableHead className="text-right py-4 font-black text-slate-400 text-[10px] uppercase">البيان / الفئة</TableHead>
              <TableHead className="text-right py-4 font-black text-slate-400 text-[10px] uppercase">المبلغ</TableHead>
              <TableHead className="text-center py-4 font-black text-slate-400 text-[10px] uppercase">الحالة</TableHead>
              <TableHead className="text-center py-4 font-black text-slate-400 text-[10px] uppercase">الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-200" />
                </TableCell>
              </TableRow>
            ) : filteredExpenses.length > 0 ? (
              filteredExpenses.map((tx) => (
                <TableRow key={tx.id} className="group hover:bg-slate-50 transition-colors">
                  <TableCell className="text-[11px] font-bold text-slate-400">{tx.dateDisplay}</TableCell>
                  <TableCell className="font-mono text-xs font-black text-slate-600">
                    {tx.invoiceNumber ? (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 opacity-30" />
                        {tx.invoiceNumber}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-[13px]">{tx.description}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{tx.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-red-600 tracking-tighter">
                    {tx.amount.toLocaleString()} <span className="text-[10px] font-bold opacity-40">ر.س</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Badge className={`rounded-full px-3 py-0.5 text-[9px] font-black border-none shadow-none uppercase ${
                        tx.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {tx.status === 'approved' ? 'معتمد' : 'بانتظار الاعتماد'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4 text-slate-400" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end" className="text-right font-bold" dir="rtl">
                          {profile?.role === 'manager' && tx.status === 'pending' && (
                            <DropdownMenuItem 
                              onClick={() => approveExpense(tx)}
                              className="text-emerald-600 gap-2 justify-end"
                            >
                              <span>اعتماد العملية</span>
                              <CheckCircle2 className="w-4 h-4" />
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2 justify-end">
                            <span>عرض الإيصال</span>
                            <FileText className="w-4 h-4 text-slate-400" />
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedExpense(tx);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="text-red-600 gap-2 justify-end"
                          >
                            <span>حذف</span>
                            <Trash2 className="w-4 h-4" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20 text-slate-400 font-bold">لا توجد مصروفات مسجلة</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-red-600">تأكيد الحذف</DialogTitle>
            <DialogDescription className="font-bold text-slate-400 py-2">
              هل أنت متأكد من رغبتك في حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء وسيؤثر على ميزانية الحساب البنكي إذا كان معتمداً.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
             <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 rounded-xl h-11 font-black"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'نعم، حذف'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="flex-1 rounded-xl h-11 font-black text-slate-500"
            >إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
