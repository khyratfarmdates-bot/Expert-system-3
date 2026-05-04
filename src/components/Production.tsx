import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Factory, Settings, Box, PlayCircle, Layers } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

export default function Production() {
  const [productionOrders, setProductionOrders] = useState<any[]>([]);

  useEffect(() => {
    // We will listen to the production_orders collection.
    const unsub = onSnapshot(collection(db, "production_orders"), (snap) => {
      setProductionOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">التصنيع والإنتاج</h2>
        <p className="text-sm font-bold text-slate-500">إدارة أوامر التشغيل، تحويل المواد الخام إلى منتجات نهائية، ومتابعة خطوط الإنتاج.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-3xl border-none shadow-sm bg-indigo-50">
          <CardHeader>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-2">
              <Factory className="w-5 h-5 text-indigo-600" />
            </div>
            <CardTitle className="text-xl font-black text-indigo-900">أوامر الإنتاج النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-indigo-900">{productionOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-800">سجل أوامر التشغيل والإنتاج</h3>
            <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
              <Settings className="w-4 h-4" />
              أمر إنتاج جديد
            </button>
         </div>
         {productionOrders.length === 0 && (
           <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
             <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
             <p className="text-lg font-black text-slate-500">لا توجد أوامر إنتاج مسجلة حالياً</p>
           </div>
         )}
      </div>
    </div>
  );
}
