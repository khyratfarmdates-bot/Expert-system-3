import React, { useEffect, useState } from 'react';
import { checkAliphiaConnection } from '../lib/aliphia';
import { Server, Wifi, WifiOff, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function AliphiaStatusCard() {
  const [statusInfo, setStatusInfo] = useState<{status: string, latency: number, message: string} | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const performCheck = async () => {
    setIsChecking(true);
    const result = await checkAliphiaConnection();
    setStatusInfo(result);
    setIsChecking(false);
  };

  useEffect(() => {
    performCheck();
    // Recheck every 30 seconds
    const interval = setInterval(performCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!statusInfo && !isChecking) return null;

  const isConnected = statusInfo?.status === 'connected';
  const isError = statusInfo?.status === 'error';
  const isDisconnected = statusInfo?.status === 'disconnected';

  return (
    <Card className={`rounded-xl border-none shadow-sm overflow-hidden transition-colors duration-500 ${
      isConnected ? 'bg-emerald-50' : 
      isError ? 'bg-amber-50' : 
      'bg-red-50'
    }`}>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
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

        {isConnected && statusInfo?.latency > 0 && (
          <div className="flex flex-col items-end text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> استجابة
            </div>
            <span>{statusInfo.latency} ms</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
