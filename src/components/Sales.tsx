import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, DollarSign, ArrowUpRight, ReceiptText, Plus, Loader2 } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "../lib/AuthContext";
import { sendNotification } from "../lib/notifications";

export default function Sales() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    amount: "",
    description: "",
    category: "مبيعات"
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "revenues"), orderBy("createdAt", "desc")), (snap) => {
      setSales(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.amount) {
      toast.error("يرجى ملء كافة الحقول");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "revenues"), {
        ...formData,
        amount: parseFloat(formData.amount),
        createdAt: serverTimestamp(),
        createdBy: profile?.uid
      });

      await sendNotification({
        title: 'تسجيل إيراد جديد',
        message: `تم تسجيل إيراد من ${formData.customerName} بمبلغ ${formData.amount} ر.س`,
        type: 'success',
        category: 'financial',
        targetRole: 'manager',
        tab: 'sales',
        priority: 'high'
      });

      toast.success("تم تسجيل الإيراد بنجاح");
      setIsDialogOpen(false);
      setFormData({ customerName: "", amount: "", description: "", category: "مبيعات" });
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء التسجيل");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">المبيعات والإيرادات</h2>
          <p className="text-sm font-bold text-slate-500">إدارة مبيعات المنتجات أو الخدمات وإيرادات المشاريع، وإصدار الفواتير.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-bold h-11">
              <Plus className="w-5 h-5" />
              تسجيل إيراد جديد
            </Button>
          } />
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-right">تسجيل إيراد / مبيع</DialogTitle>
              <DialogDescription className="text-right font-bold text-slate-500">
                أدخل تفاصيل العملية المالية لتسجيلها في النظام
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSale} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">اسم العميل / المشروع *</Label>
                <Input 
                  required
                  value={formData.customerName}
                  onChange={e => setFormData({...formData, customerName: e.target.value})}
                  className="rounded-xl h-11 text-right"
                  placeholder="أدخل اسم العميل..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">المبلغ الإجمالي (ر.س) *</Label>
                  <Input 
                    required
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">التصنيف</Label>
                  <Input 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="rounded-xl h-11 text-right"
                    placeholder="مبيعات، مشاريع..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">الوصف / التفاصيل</Label>
                <Input 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="rounded-xl h-11 text-right"
                  placeholder="مثلاً: دفعة أولى من مشروع..."
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ وحفظ الفاتورة"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-3xl border-none shadow-sm bg-emerald-50">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <CardTitle className="text-xl font-black text-emerald-900">إجمالي المبيعات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-emerald-900">
              {sales.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()} <span className="text-lg">ر.س</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-800">سجل الفواتير والمبيعات</h3>
            <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
              <ReceiptText className="w-4 h-4" />
              إنشاء فاتورة مبيعات جديدة
            </button>
         </div>
         {sales.length === 0 && (
           <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
             <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
             <p className="text-lg font-black text-slate-500">لا توجد مبيعات مسجلة بعد</p>
           </div>
         )}
      </div>
    </div>
  );
}
