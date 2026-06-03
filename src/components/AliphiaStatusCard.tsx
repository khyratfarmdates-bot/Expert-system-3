import React, { useEffect, useState } from 'react';
import { checkAliphiaConnection } from '../lib/aliphia';
import { Server, Wifi, WifiOff, AlertTriangle, Activity, Settings, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AliphiaSettingsModal from './AliphiaSettingsModal';


// ذاكرة تخزين مؤقتة لمنع تكرار الطلبات المتوازية أو المتكررة
let cachedStatus: { status: string, latency: number, message: string } | null = null;
let activeCheckPromise: Promise<any> | null = null;

export default function AliphiaStatusCard() {
  const [statusInfo, setStatusInfo] = useState<{status: string, latency: number, message: string} | null>(cachedStatus);
  const [isChecking, setIsChecking] = useState(!cachedStatus);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const performCheck = async (force = false) => {
    if (cachedStatus && !force) {
      setStatusInfo(cachedStatus);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);

    if (activeCheckPromise && !force) {
      try {
        const result = await activeCheckPromise;
        setStatusInfo(result);
      } catch (e) {}
      setIsChecking(false);
      return;
    }

    activeCheckPromise = checkAliphiaConnection();
    try {
      const result = await activeCheckPromise;
      cachedStatus = result;
      setStatusInfo(result);
    } catch (error) {
      console.error("Connection check failed:", error);
    } finally {
      activeCheckPromise = null;
      setIsChecking(false);
    }
  };

  useEffect(() => {
    performCheck();
    // تم إلغاء التحديث التلقائي الدوري (setInterval) لتجنب البطء وتكرار استهلاك الموارد
  }, []);

  if (!statusInfo && !isChecking) return null;

  const isConnected = statusInfo?.status === 'connected';
  const isError = statusInfo?.status === 'error';
  const isDisconnected = statusInfo?.status === 'disconnected';

  return (
    <>
    <Card 
      className={`rounded-xl border-none shadow-sm overflow-hidden transition-all duration-300 relative ${
      isConnected ? 'bg-emerald-50 hover:bg-emerald-100/70' : 
      isError ? 'bg-amber-50 hover:bg-amber-100/70' : 
      'bg-red-50 hover:bg-red-100/70'
    }`}>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setIsSettingsOpen(true)}>
          <div className={`p-2 rounded-lg ${
            isConnected ? 'bg-emerald-100 text-emerald-600' : 
            isError ? 'bg-amber-100 text-amber-600' : 
            'bg-red-100 text-red-600'
          }`}>
            {isConnected ? <Wifi className="w-5 h-5" /> : 
             isError ? <AlertTriangle className="w-5 h-5" /> : 
             <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">حالة الربط مع خوادم ألف ياء</h3>
              {isConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <p className={`text-xs font-medium ${
              isConnected ? 'text-emerald-600' : 
              isError ? 'text-amber-600' : 
              'text-red-600'
            }`}>
              {isChecking ? 'جاري فحص الاتصال...' : statusInfo?.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
            disabled={isChecking}
            onClick={(e) => {
              e.stopPropagation();
              performCheck(true);
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>

          {isConnected && statusInfo?.latency > 0 ? (
            <div className="flex flex-col items-end text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3" /> استجابة
              </div>
              <span>{statusInfo.latency} ms</span>
            </div>
          ) : (
            <div 
              className="flex items-center text-xs text-slate-500 font-medium gap-1 cursor-pointer"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="w-4 h-4" /> الإعدادات
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    
    <AliphiaSettingsModal 
      open={isSettingsOpen} 
      onOpenChange={setIsSettingsOpen} 
      onSuccess={() => performCheck(true)} 
    />
    </>
  );
}

