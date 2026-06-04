import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Landmark, 
  Wallet, 
  CreditCard, 
  History, 
  Settings2, 
  MoreVertical, 
  Download, 
  Trash2, 
  PauseCircle, 
  PlayCircle,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Building2
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { logActivity } from '../lib/activity';
import { toast } from 'sonner';
import { BankAccount, Transaction } from '../types';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BankingAndVault() {
  const { profile } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workerTransactions, setWorkerTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [viewingTransactionsId, setViewingTransactionsId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    iban: '',
    ibanCertificateUrl: '',
    type: 'bank' as 'bank' | 'cash',
    initialBalance: '',
    status: 'active' as 'active' | 'suspended'
  });

  useEffect(() => {
    const unsubBanks = onSnapshot(collection(db, 'bankAccounts'), (snapshot) => {
      setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
      setLoading(false);
    });

    const unsubTx = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    const unsubWorkerTx = onSnapshot(collection(db, 'workerTransactions'), (snapshot) => {
      setWorkerTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubBanks();
      unsubTx();
      unsubWorkerTx();
    };
  }, []);

  const accountBalances = useMemo(() => {
    return bankAccounts.map(acc => {
      const accTransactions = transactions.filter(t => t.bankAccountId === acc.id && t.status === 'approved');
      const wTransactions = workerTransactions.filter(t => t.bankAccountId === acc.id);
      
      const income = accTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const expense = accTransactions.filter(t => t.type === 'expense' || t.type === 'purchase').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const workerExpense = wTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      return {
        ...acc,
        balance: (acc.initialBalance || 0) + income - expense - workerExpense
      };
    });
  }, [bankAccounts, transactions, workerTransactions]);

  const stats = useMemo(() => {
    const bankTotal = accountBalances.filter(a => a.type === 'bank').reduce((sum, a) => sum + a.balance, 0);
    const cashTotal = accountBalances.filter(a => a.type === 'cash').reduce((sum, a) => sum + a.balance, 0);
    return { bankTotal, cashTotal, total: bankTotal + cashTotal };
  }, [accountBalances]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    try {
      const data = {
        ...formData,
        initialBalance: parseFloat(formData.initialBalance || '0'),
        lastUpdated: serverTimestamp()
      };

      if (selectedAccountId) {
        await updateDoc(doc(db, 'bankAccounts', selectedAccountId), data);
        toast.success('تم تحديث الحساب بنجاح');
      } else {
        await addDoc(collection(db, 'bankAccounts'), data);
        toast.success('تم إضافة الحساب بنجاح');
      }

      await logActivity(
        selectedAccountId ? 'تحديث حساب مالي' : 'إضافة حساب مالي جديد',
        `تم ${selectedAccountId ? 'تحديث' : 'إضافة'} حساب: ${formData.name}`,
        'info',
        'financial',
        profile.uid
      );

      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ الحساب');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      bankName: '',
      accountNumber: '',
      iban: '',
      ibanCertificateUrl: '',
      type: 'bank',
      initialBalance: '',
      status: 'active'
    });
    setSelectedAccountId(null);
    setIsEditing(false);
  };

  const handleEdit = (acc: BankAccount) => {
    setFormData({
      name: acc.name,
      bankName: acc.bankName || '',
      accountNumber: acc.accountNumber || '',
      iban: acc.iban || '',
      ibanCertificateUrl: acc.ibanCertificateUrl || '',
      type: acc.type,
      initialBalance: acc.initialBalance.toString(),
      status: acc.status
    });
    setSelectedAccountId(acc.id);
    setIsEditing(true);
    setIsAddDialogOpen(true);
  };

  const toggleStatus = async (acc: BankAccount) => {
    const nextStatus = acc.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'bankAccounts', acc.id), { status: nextStatus });
      toast.success(nextStatus === 'suspended' ? 'تم إيقاف الحساب' : 'تم تفعيل الحساب');
    } catch (error) {
      toast.error('فشل في تغيير حالة الحساب');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب؟ ستفقد سجل العمليات المرتبط به في العرض.')) return;
    try {
      await deleteDoc(doc(db, 'bankAccounts', id));
      toast.success('تم حذف الحساب بنجاح');
    } catch (error) {
      toast.error('فشل في حذف الحساب');
    }
  };

  const filteredAccounts = accountBalances.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    acc.accountNumber?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-auto">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">إدارة البنوك والخزينة</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium">النظام المالي المركزي لمراقبة وإدارة النقدية والحسابات المصرفية للمؤسسة</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <Button
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white gap-2 px-5 h-10 md:h-11 shadow-sm transition-all text-xs md:text-sm font-semibold cursor-pointer shrink-0"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4.5 h-4.5" />
            <span>إضافة حساب / خزينة</span>
          </Button>
          <DialogContent className="sm:max-w-[480px] rounded-xl p-6 border border-slate-200 shadow-xl" dir="rtl">
            <DialogHeader className="space-y-1.5 text-right">
              <DialogTitle className="text-lg font-bold text-slate-900">{isEditing ? 'تعديل بيانات الحساب' : 'إضافة حساب جديد'}</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">أدخل معلومات الحساب البنكي أو الخزينة النقدية بدقة للمطابقة الحسابية.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-4 mt-3">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs font-semibold text-slate-600">نوع الحساب</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(v: any) => setFormData({...formData, type: v})}
                  >
                    <SelectTrigger className="rounded-lg h-10 border-slate-200 text-slate-800 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">حساب بنكي</SelectItem>
                      <SelectItem value="cash">خزينة نقدية (كاش)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs font-semibold text-slate-600">اسم الحساب / الخزينة</Label>
                  <Input 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="مثال: حساب مصرف الراجحي - رئيسي"
                    className="rounded-lg h-10 border-slate-200 text-sm text-slate-800"
                  />
                </div>

                {formData.type === 'bank' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-600">اسم البنك</Label>
                      <Input 
                        value={formData.bankName}
                        onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                        placeholder="مثال: مصرف الراجحي"
                        className="rounded-lg h-10 border-slate-200 text-sm text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-600">رقم الحساب</Label>
                      <Input 
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                        placeholder="123456789..."
                        className="rounded-lg h-10 border-slate-200 font-mono text-sm text-slate-800"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs font-semibold text-slate-600">رقم الآيبان (IBAN)</Label>
                      <Input 
                        value={formData.iban}
                        onChange={(e) => setFormData({...formData, iban: e.target.value})}
                        className="rounded-lg h-10 border-slate-200 font-mono text-sm text-slate-800"
                        placeholder="SA0000000000000000000000"
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs font-semibold text-slate-600">رابط شهادة الآيبان (PDF/صورة)</Label>
                      <Input 
                        value={formData.ibanCertificateUrl}
                        onChange={(e) => setFormData({...formData, ibanCertificateUrl: e.target.value})}
                        className="rounded-lg h-10 border-slate-200 text-sm text-slate-800"
                        placeholder="أدخل رابط المستند الرسمي لتسهيل الوصول..."
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1 col-span-2">
                  <Label className="text-xs font-semibold text-slate-600">الرصيد الافتتاحي (ر.س)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    required
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({...formData, initialBalance: e.target.value})}
                    className="rounded-lg h-10 border-slate-200 font-bold text-base text-slate-900"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full h-11 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-colors">
                  {isEditing ? 'حفظ التحديثات' : 'إضافة الحساب'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Section with sleek professional design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm overflow-hidden relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">أرصدة حسابات البنوك</span>
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
              <Landmark className="w-4.5 h-4.5" />
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tracking-tight">
            {stats.bankTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-normal text-slate-500 mr-1.5">ر.س</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">مطابق للحسابات المصرفية المضافة</p>
        </Card>

        <Card className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm overflow-hidden relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">إجمالي السيولة النقدية (الكاش)</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tracking-tight">
            {stats.cashTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-normal text-slate-500 mr-1.5">ر.س</span>
          </h3>
          <p className="text-[10px] text-emerald-600 mt-1 font-medium">الخزائن والعهد المتداولة ميدانياً</p>
        </Card>

        <Card className="rounded-xl border border-slate-900 bg-slate-900 text-white p-6 shadow-md overflow-hidden relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">إجمالي ملاءة الخزينة والبنوك</span>
            <div className="p-2.5 bg-slate-800 text-white rounded-lg">
              <Building2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-emerald-400 font-mono tracking-tight">
            {stats.total.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-xs font-normal text-slate-300 mr-1.5">ر.س</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">مجموع الأرصدة والسيولة المتاحة فوراً</p>
        </Card>
      </div>

      <Card className="rounded-xl border border-slate-200/60 shadow-sm bg-white overflow-hidden">
        <Tabs defaultValue="all" className="w-full">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-50/65 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <CardTitle className="text-base font-bold text-slate-800">تفاصيل وسجلات الصناديق والحسابات</CardTitle>
              <TabsList className="bg-slate-200/60 p-1 rounded-lg h-9 w-fit">
                <TabsTrigger value="all" className="rounded-md font-bold text-xs px-4 h-7">الكل</TabsTrigger>
                <TabsTrigger value="bank" className="rounded-md font-bold text-xs px-4 h-7">الحسابات البنكية</TabsTrigger>
                <TabsTrigger value="cash" className="rounded-md font-bold text-xs px-4 h-7">العهد والخزائن</TabsTrigger>
              </TabsList>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="بحث عن حساب بنكي أو آيبان..." 
                className="rounded-lg h-9 pr-9 bg-white border-slate-200 text-xs text-slate-700 placeholder-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          
          <TabsContent value="all" className="m-0">
            <AccountTable 
              accounts={filteredAccounts} 
              onEdit={handleEdit} 
              onToggleStatus={toggleStatus} 
              onDelete={handleDelete}
              onViewTransactions={setViewingTransactionsId}
            />
          </TabsContent>
          <TabsContent value="bank" className="m-0">
            <AccountTable 
              accounts={filteredAccounts.filter(a => a.type === 'bank')} 
              onEdit={handleEdit} 
              onToggleStatus={toggleStatus} 
              onDelete={handleDelete}
              onViewTransactions={setViewingTransactionsId}
            />
          </TabsContent>
          <TabsContent value="cash" className="m-0">
            <AccountTable 
              accounts={filteredAccounts.filter(a => a.type === 'cash')} 
              onEdit={handleEdit} 
              onToggleStatus={toggleStatus} 
              onDelete={handleDelete}
              onViewTransactions={setViewingTransactionsId}
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Transaction History Dialog */}
      <Dialog open={!!viewingTransactionsId} onOpenChange={(open) => !open && setViewingTransactionsId(null)}>
        <DialogContent className="sm:max-w-3xl rounded-xl p-0 overflow-hidden border border-slate-200 shadow-xl" dir="rtl">
          <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <span>سجل الحساب والتدفقات المالية</span>
            </h2>
            <span className="text-xs text-slate-300 font-semibold bg-slate-800 px-2.5 py-1 rounded">
              {accountBalances.find(a => a.id === viewingTransactionsId)?.name}
            </span>
          </div>
          <div className="p-6 max-h-[60vh] overflow-auto no-scrollbar">
            <Table dir="rtl">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-right font-semibold text-slate-500 text-xs">التاريخ والوقت</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-xs">الوصف / التصنيف</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-xs">الحالة</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-xs">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions
                  .filter(t => t.bankAccountId === viewingTransactionsId)
                  .sort((a,b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
                  .map(tx => (
                    <TableRow key={tx.id} className="border-slate-50 transition-colors">
                      <TableCell className="font-semibold text-slate-500 text-xs">
                        {tx.date?.toDate?.().toLocaleString('ar-SA') || '-'}
                      </TableCell>
                      <TableCell className="font-bold text-slate-800 text-xs">
                        {tx.description}
                        {tx.category && <span className="block text-[10px] text-slate-400 mt-0.5">{tx.category}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded px-1.5 py-0.5 pointer-events-none border-none font-bold text-[9px] ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                          {tx.type === 'income' ? 'وارد' : 'صادر'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-500'} font-mono`}>
                        {tx.type === 'income' ? '+' : '-'} {tx.amount?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">ر.س</span>
                      </TableCell>
                    </TableRow>
                  ))}
                {workerTransactions
                  .filter(t => t.bankAccountId === viewingTransactionsId)
                  .map(tx => (
                    <TableRow key={tx.id} className="border-slate-50">
                      <TableCell className="font-semibold text-slate-500 text-xs">
                        {new Date(tx.date).toLocaleString('ar-SA')}
                      </TableCell>
                      <TableCell className="font-bold text-slate-800 text-xs">
                        صرف عهدة / راتب - {tx.workerName || 'موظف'}
                      </TableCell>
                      <TableCell>
                        <Badge className="rounded px-1.5 py-0.5 pointer-events-none border-none font-bold text-[9px] bg-red-50 text-red-500">
                          صادر
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-sm text-red-500 font-mono">
                        - {tx.amount?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">ر.س</span>
                      </TableCell>
                    </TableRow>
                  ))}
                {transactions.filter(t => t.bankAccountId === viewingTransactionsId).length === 0 && 
                 workerTransactions.filter(t => t.bankAccountId === viewingTransactionsId).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2.5 opacity-45">
                        <History className="w-10 h-10 text-slate-300" />
                        <p className="font-semibold text-xs text-slate-500">لا توجد تدفقات نقدية مسجلة لهذا الحساب</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountTable({ accounts, onEdit, onToggleStatus, onDelete, onViewTransactions }: any) {
  return (
    <div className="overflow-x-auto">
      <Table dir="rtl">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-slate-100 h-12">
            <TableHead className="text-right font-semibold text-slate-500 text-xs px-6">اسم الحساب / الوعاء</TableHead>
            <TableHead className="text-right font-semibold text-slate-500 text-xs">البيانات البنكية</TableHead>
            <TableHead className="text-right font-semibold text-slate-500 text-xs">الرصيد المتاح</TableHead>
            <TableHead className="text-right font-semibold text-slate-500 text-xs">الحالة</TableHead>
            <TableHead className="text-left font-semibold text-slate-500 text-xs px-6">إجراءات التحكم</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((acc: any) => (
            <TableRow key={acc.id} className="border-slate-100 group hover:bg-slate-50/40 transition-colors">
              <TableCell className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                    acc.type === 'bank' ? 'bg-slate-100 text-slate-800' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {acc.type === 'bank' ? <Building2 className="w-4.5 h-4.5" /> : <Wallet className="w-4.5 h-4.5" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{acc.name}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                      {acc.type === 'bank' ? acc.bankName : 'خزينة عهدة نقدية'}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {acc.type === 'bank' ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-600 font-mono">{acc.accountNumber}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-medium text-slate-400 truncate max-w-[140px] font-mono">{acc.iban}</p>
                      {acc.ibanCertificateUrl && (
                        <a 
                          href={acc.ibanCertificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-5 w-5 rounded text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm"
                          title="عرض شهادة الآيبان"
                        >
                          <FileText className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-300">-</span>
                )}
              </TableCell>
              <TableCell>
                <p className="font-bold text-slate-900 font-mono text-sm">
                  {acc.balance?.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-500">ر.س</span>
                </p>
              </TableCell>
              <TableCell>
                <Badge className={`rounded px-1.5 py-0.5 font-bold text-[9px] border-none pointer-events-none ${acc.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                  {acc.status === 'active' ? 'نشط' : 'موقف مالياً'}
                </Badge>
              </TableCell>
              <TableCell className="px-6 py-4 text-left">
                <div className="flex items-center gap-1.5 justify-end">
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-lg h-8 w-8 text-slate-400 hover:text-slate-950 hover:bg-slate-100"
                    onClick={() => onViewTransactions(acc.id)}
                   >
                    <History className="w-4 h-4" />
                   </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 text-slate-400 hover:bg-slate-100">
                        <MoreVertical className="w-4.5 h-4.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-lg p-1 border border-slate-200 shadow-lg text-right" dir="rtl">
                      <DropdownMenuLabel className="font-semibold text-[10px] text-slate-400 pr-3 py-1.5">إجراءات الحساب</DropdownMenuLabel>
                      <DropdownMenuItem className="rounded font-medium text-xs py-2 px-3 focus:bg-slate-50 cursor-pointer" onClick={() => onEdit(acc)}>
                        <Settings2 className="w-3.5 h-3.5 ml-2 text-slate-500" />
                        تعديل البيانات
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded font-medium text-xs py-2 px-3 focus:bg-slate-50 cursor-pointer" onClick={() => onToggleStatus(acc)}>
                        {acc.status === 'active' ? (
                          <><PauseCircle className="w-3.5 h-3.5 ml-2 text-red-500" /> تعليق الحساب</>
                        ) : (
                          <><PlayCircle className="w-3.5 h-3.5 ml-2 text-emerald-500" /> تنشيط الحساب</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-slate-100" />
                      <DropdownMenuItem className="rounded font-medium text-xs py-2 px-3 focus:bg-red-50 text-red-500 cursor-pointer" onClick={() => onDelete(acc.id, acc.name)}>
                        <Trash2 className="w-3.5 h-3.5 ml-2" />
                        حذف نهائي
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {accounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-24 text-center">
                <div className="flex flex-col items-center gap-3 opacity-25">
                  <Landmark className="w-14 h-14" />
                  <p className="text-sm font-semibold">لم يتم العثور على حسابات أو خزائن مسجلة</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
