import React, { useState, useEffect } from 'react';
import { UserPlus, Loader2, Search, Check, Building, Phone, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchAliphiaClients, createAliphiaClient } from '../lib/aliphia';
import { toast } from 'sonner';


export interface AliphiaClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface AliphiaClientSelectorProps {
  onSelect: (client: AliphiaClient | null) => void;
  selectedClientId?: string;
}

export default function AliphiaClientSelector({ onSelect, selectedClientId }: AliphiaClientSelectorProps) {
  const [clients, setClients] = useState<AliphiaClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // For adding a new client
  const [view, setView] = useState<'list' | 'add'>('list'); // 'list' or 'add'
  const [newClientData, setNewClientData] = useState({ name: '', phone: '', email: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await fetchAliphiaClients();
      setClients(data);
    } catch (error) {
      console.error("Error fetching clients", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      setView('list');
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.phone && client.phone.includes(searchQuery)) ||
    (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddNewClient = async () => {
    if (!newClientData.name) return;
    setIsAdding(true);
    try {
      const result = await createAliphiaClient(newClientData);
      if (result.success && result.client) {
        setClients(prev => [...prev, result.client]);
        onSelect(result.client);
        toast.success('تم إنشاء العميل بنجاح في ألف ياء!');
      }
      setIsAdding(false);
      setIsOpen(false);
      setNewClientData({ name: '', phone: '', email: '' });
    } catch (error) {
      console.error(error);
      toast.error('فشل إنشاء العميل في ألف ياء');
      setIsAdding(false);
    }
  };


  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <div className="flex gap-2 items-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full text-right justify-between h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors font-bold text-slate-700"
        >
          {selectedClient ? (
            <span className="flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              {selectedClient.name}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">اختر العميل من ألف ياء...</span>
          )}
          <Search className="w-4 h-4 text-slate-400" />
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 text-right" dir="rtl">
          {view === 'list' ? (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center w-full">
                  <DialogTitle className="text-xl font-black text-slate-800">البحث واختيار عميل ألف ياء</DialogTitle>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="relative">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم العميل، الهاتف أو البريد..."
                    className="w-full h-11 pr-10 pl-4 rounded-xl text-right font-bold border-slate-200"
                  />
                  <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-400" />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="text-sm font-bold">جاري تحميل العملاء من ألف ياء...</span>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-bold text-sm">
                      لا يوجد عملاء يطابقون هذا البحث
                    </div>
                  ) : (
                    filteredClients.map((client) => {
                      const isSelected = client.id === selectedClientId;
                      return (
                        <div
                          key={client.id}
                          onClick={() => {
                            onSelect(client);
                            setIsOpen(false);
                          }}
                          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:shadow-sm ${
                            isSelected 
                              ? 'border-emerald-500 bg-emerald-50/50' 
                              : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                          }`}
                        >
                          <div className="space-y-1">
                            <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              {client.name}
                            </h4>
                            <div className="flex gap-4 text-xs font-bold text-slate-500">
                              {client.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {client.phone}
                                </span>
                              )}
                              {client.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" /> {client.email}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl h-11 border-dashed text-emerald-600 hover:bg-emerald-50/50 hover:border-emerald-300 font-bold gap-2"
                    onClick={() => setView('add')}
                  >
                    <UserPlus className="w-4 h-4" />
                    إضافة عميل جديد
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl h-11 font-bold"
                    onClick={() => setIsOpen(false)}
                  >
                    إغلاق
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setView('list')}
                    className="h-8 w-8 rounded-lg"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <DialogTitle className="text-xl font-black text-slate-800">إضافة عميل جديد (ألف ياء)</DialogTitle>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">اسم العميل / الشركة *</Label>
                  <Input 
                    placeholder="شركة التقنية المحدودة" 
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">رقم الجوال</Label>
                  <Input 
                    placeholder="05XXXXXXXX" 
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">البريد الإلكتروني</Label>
                  <Input 
                    type="email"
                    placeholder="client@example.com" 
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <Button 
                    type="button"
                    onClick={handleAddNewClient} 
                    disabled={!newClientData.name || isAdding}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-md"
                  >
                    {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ وإنشاء في ألف ياء"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 rounded-xl font-bold"
                    onClick={() => setView('list')}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
