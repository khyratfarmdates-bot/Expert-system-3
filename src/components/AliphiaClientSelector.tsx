import React, { useState, useEffect } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAliphiaClients } from '../lib/aliphia';

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
  
  // For adding a new client
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', phone: '', email: '' });
  const [isAdding, setIsAdding] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const data = await fetchAliphiaClients();
      // Adjust according to actual Aliphia response structure if needed
      // Currently assumes it returns an array of clients directly or handles it in lib
      setClients(data);
    } catch (error) {
      console.error("Error fetching clients", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleAddNewClient = async () => {
    if (!newClientData.name) return;
    setIsAdding(true);
    try {
      // MOCK SUCCESS
      setTimeout(() => {
        const newClient: AliphiaClient = {
          id: 'AL-' + Math.floor(Math.random() * 10000),
          ...newClientData
        };
        setClients(prev => [...prev, newClient]);
        onSelect(newClient);
        setIsAdding(false);
        setIsAddDialogOpen(false);
        setNewClientData({ name: '', phone: '', email: '' });
      }, 1500);
    } catch (error) {
      console.error(error);
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <Label className="font-bold text-slate-700">العميل (مرتبط بـ ألف ياء)</Label>
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <Select 
            value={selectedClientId} 
            onValueChange={(val) => {
              const selected = clients.find(c => c.id === val) || null;
              onSelect(selected);
            }}
          >
            <SelectTrigger className="w-full text-right h-11">
              <SelectValue placeholder={loading ? "جاري تحميل العملاء..." : "اختر العميل من ألف ياء..."} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-11 w-11 p-0 shrink-0 border-dashed text-primary hover:bg-primary/5 hover:border-primary">
              <UserPlus className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px] text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-primary">إضافة عميل جديد (ألف ياء)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم العميل / الشركة *</Label>
                <Input 
                  placeholder="شركة التقنية المحدودة" 
                  value={newClientData.name}
                  onChange={(e) => setNewClientData({...newClientData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input 
                  placeholder="05XXXXXXXX" 
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({...newClientData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input 
                  type="email"
                  placeholder="client@example.com" 
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                />
              </div>
            </div>
            <Button 
              onClick={handleAddNewClient} 
              disabled={!newClientData.name || isAdding}
              className="w-full h-11 font-bold text-md"
            >
              {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : "إنشاء وحفظ في ألف ياء"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
