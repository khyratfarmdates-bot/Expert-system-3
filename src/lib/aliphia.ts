// src/lib/aliphia.ts

const ALIPHIA_API_URL = '/api_public';

let cachedCredentials: { username?: string, password?: string, apiKey?: string } | null = null;

export const getAliphiaCredentials = async () => {
  if (cachedCredentials) return cachedCredentials;

  // 1. أولوية القراءة من ملف .env.local كما طلب المستخدم
  if (import.meta.env.VITE_ALIPHIA_USERNAME && import.meta.env.VITE_ALIPHIA_API_KEY) {
    cachedCredentials = {
      username: import.meta.env.VITE_ALIPHIA_USERNAME,
      password: import.meta.env.VITE_ALIPHIA_PASSWORD || '',
      apiKey: import.meta.env.VITE_ALIPHIA_API_KEY
    };
    return cachedCredentials;
  }

  // 2. القراءة من التخزين المحلي كبديل (يمنع خطأ صلاحيات فايربيس)
  try {
    const local = localStorage.getItem('aliphia_credentials');
    if (local) {
      cachedCredentials = JSON.parse(local);
      return cachedCredentials;
    }
  } catch(e) {
    console.error("Failed to load local credentials", e);
  }
  
  return null;
};

export const saveAliphiaCredentials = async (creds: { username: string, password: string, apiKey: string }) => {
  localStorage.setItem('aliphia_credentials', JSON.stringify(creds));
  cachedCredentials = creds;
};

const getHeaders = async () => {
  const creds = await getAliphiaCredentials();
  if (!creds?.username || !creds?.apiKey) return {};
  
  const basicAuth = btoa(`${creds.username}:${creds.password}`);
  return {
    'Authorization': `Basic ${basicAuth}`,
    'X-KEYALI-API': creds.apiKey,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
};

export const fetchAliphiaClients = async () => {
  const creds = await getAliphiaCredentials();
  if (!creds) {
    console.warn("⚠️ مفاتيح Aliphia غير متوفرة. يتم استخدام بيانات تجريبية.");
    // Fallback Mock Data
    return [
      { id: 'AL-1001', name: 'شركة التقنية الحديثة', phone: '0500000001' },
      { id: 'AL-1002', name: 'مؤسسة الإعمار الذكي', phone: '0500000002' },
      { id: 'AL-1003', name: 'أحمد عبدالله للاتصالات', phone: '0500000003' },
    ];
  }

  try {
    const response = await fetch(`${ALIPHIA_API_URL}/client/active.json`, {
      method: 'GET',
      headers: await getHeaders(),
    });
    if (!response.ok) throw new Error('فشل جلب بيانات العملاء من ألف ياء');
    const data = await response.json();
    
    // Aliphia likely returns an array or an object with data
    const clientsList = Array.isArray(data) ? data : (data.data || []);
    
    return clientsList.map((c: any) => ({
      id: c.client_id?.toString() || c.id?.toString(),
      name: c.client_name || c.name || 'عميل غير معروف',
      phone: c.client_phone || c.phone || '',
      email: c.client_email || c.email || ''
    }));
  } catch (error) {
    console.error('Aliphia fetch error:', error);
    throw error;
  }
};

export const createAliphiaDocument = async (type: 'invoice' | 'quotation', docData: any) => {
  const creds = await getAliphiaCredentials();
  if (!creds) {
    console.warn(`⚠️ مفاتيح Aliphia غير متوفرة. سيتم محاكاة إنشاء ${type}.`);
    // Fallback Mock Create
    return {
        success: true, 
        id: Math.floor(Math.random() * 10000), 
        pdf_url: `https://aliphia.com/v1/invoices/${type === 'quotation' ? 'Q' : 'INV'}-MOCK-${Math.floor(Math.random() * 1000)}.pdf`
    };
  }

  try {
    const endpoint = type === 'invoice' ? '/invoice' : '/quote'; // Verify quote endpoint
    const formData = new URLSearchParams();
    
    // Map our data to Aliphia's expected fields
    // This mapping will need to be refined based on exact Aliphia API field names
    for (const key in docData) {
        if (typeof docData[key] === 'object') {
            formData.append(key, JSON.stringify(docData[key]));
        } else {
            formData.append(key, String(docData[key]));
        }
    }

    const response = await fetch(`${ALIPHIA_API_URL}${endpoint}`, {
      method: 'POST',
      headers: await getHeaders(),
      body: formData.toString()
    });
    
    if (!response.ok) throw new Error(`فشل إنشاء ${type === 'invoice' ? 'الفاتورة' : 'عرض السعر'}`);
    return await response.json();
  } catch (error) {
    console.error('Aliphia create doc error:', error);
    throw error;
  }
};

export const checkAliphiaConnection = async () => {
  const start = Date.now();
  const creds = await getAliphiaCredentials();
  
  if (!creds?.username || !creds?.apiKey) {
    return { status: 'disconnected', latency: 0, message: 'مفاتيح الربط غير مضافة (اضغط هنا للإعداد)' };
  }

  try {
    const headers = await getHeaders();
    const response = await fetch(`${ALIPHIA_API_URL}/client/active.json`, {
      method: 'GET',
      headers,
    });
    const latency = Date.now() - start;
    
    if (response.ok) {
      return { status: 'connected', latency, message: 'متصل ومستقر' };
    } else {
      return { status: 'error', latency, message: 'بيانات غير صحيحة أو الخادم يرفض الاتصال' };
    }
  } catch (error) {
    return { status: 'error', latency: Date.now() - start, message: 'المتصفح أو الخادم يمنع الاتصال' };
  }
};
