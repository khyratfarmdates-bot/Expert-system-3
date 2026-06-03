// src/lib/aliphia.ts

const ALIPHIA_API_URL = '/api_public';

const hasCredentials = () => {
  return !!(import.meta.env.VITE_ALIPHIA_USERNAME && import.meta.env.VITE_ALIPHIA_PASSWORD && import.meta.env.VITE_ALIPHIA_API_KEY);
};

const getHeaders = () => {
  const username = import.meta.env.VITE_ALIPHIA_USERNAME || '';
  const password = import.meta.env.VITE_ALIPHIA_PASSWORD || '';
  const apiKey = import.meta.env.VITE_ALIPHIA_API_KEY || '';

  const basicAuth = btoa(`${username}:${password}`);

  return {
    'Authorization': `Basic ${basicAuth}`,
    'X-KEYALI-API': apiKey,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
};

export const fetchAliphiaClients = async () => {
  if (!hasCredentials()) {
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
      headers: getHeaders(),
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
  if (!hasCredentials()) {
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
      headers: getHeaders(),
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
  if (!hasCredentials()) {
    return { status: 'disconnected', latency: 0, message: 'مفاتيح الربط (API Keys) مفقودة' };
  }

  try {
    const response = await fetch(`${ALIPHIA_API_URL}/client/active.json`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const latency = Date.now() - start;
    
    if (response.ok) {
      return { status: 'connected', latency, message: 'متصل ومستقر' };
    } else {
      return { status: 'error', latency, message: 'خوادم ألف ياء ترفض الاتصال (تأكد من صحة المفاتيح)' };
    }
  } catch (error) {
    return { status: 'disconnected', latency: Date.now() - start, message: 'لا يوجد استجابة من خوادم ألف ياء' };
  }
};
