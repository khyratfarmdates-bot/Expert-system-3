import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Truck, DollarSign, Store, Phone, Mail, MapPin, Plus, Loader2 } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

export default function SuppliersList() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vatNumber: '',
    address: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "suppliers"), (snap) => {
      setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('يرجى إدخال اسم المورد');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "suppliers"), {
        ...formData,
        createdAt: serverTimestamp()
      });
      toast.success('تمت إضافة المورد بنجاح');
      setIsDialogOpen(false);
      setFormData({ name: '', phone: '', vatNumber: '', address: '' });
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الإضافة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">سجل الموردين</h2>
          <p className="text-sm font-bold text-slate-500">إدارة تفاصيل الموردين، وإضافتهم يدوياً أو تلقائياً مع فواتير المشتريات.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 font-bold h-11 px-6">
              <Plus className="w-5 h-5" />
              إضافة مورد جديد
            </Button>
          } />
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-right">مورد جديد</DialogTitle>
              <DialogDescription className="text-right font-bold text-slate-500">
                أدخل تفاصيل المورد لإضافته للسجل
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="space-y-4 pt-4">
              <div className="space-y-2 text-right">
                <Label className="font-bold text-slate-700">اسم المورد / الشركة *</Label>
                <Input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="rounded-xl h-11 text-right"
                  placeholder="شركة المواد الأساسية"
                />
              </div>
              <div className="space-y-2 text-right">
                <Label className="font-bold text-slate-700">رقم الهاتف</Label>
                <Input 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="rounded-xl h-11 text-right"
                  placeholder="05..."
                />
              </div>
              <div className="space-y-2 text-right">
                <Label className="font-bold text-slate-700">الرقم الضريبي VAT</Label>
                <Input 
                  value={formData.vatNumber}
                  onChange={e => setFormData({...formData, vatNumber: e.target.value})}
                  className="rounded-xl h-11 text-right"
                  placeholder="3000..."
                />
              </div>
              <div className="space-y-2 text-right">
                <Label className="font-bold text-slate-700">العنوان</Label>
                <Input 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="rounded-xl h-11 text-right"
                  placeholder="المدينة، الحي..."
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-white mt-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "إضافة المورد"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-3xl border-none shadow-sm bg-blue-50">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-2">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <CardTitle className="text-xl font-black text-blue-900">الموردين النشطين</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-blue-900">{suppliers.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(supplier => (
          <Card key={supplier.id} className="rounded-3xl border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Store className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">{supplier.name}</h3>
                  <div className="flex flex-col gap-2 mt-3 text-sm font-bold text-slate-500">
                    {supplier.phone && (
                      <span className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg"><Phone className="w-4 h-4 text-slate-400" /> {supplier.phone}</span>
                    )}
                    {supplier.vatNumber && (
                      <span className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg"><DollarSign className="w-4 h-4 text-slate-400" /> الضريبي: {supplier.vatNumber}</span>
                    )}
                    {supplier.address && (
                      <span className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg"><MapPin className="w-4 h-4 text-slate-400" /> {supplier.address}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {suppliers.length === 0 && (
           <div className="col-span-full text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
             <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
             <p className="text-lg font-black text-slate-500">لا يوجد موردين مضافين للسجل</p>
           </div>
        )}
      </div>
    </div>
  );
}
