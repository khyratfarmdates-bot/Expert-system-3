// src/lib/aliphia.ts

const ALIPHIA_API_URL = '/api_public';

export interface AliphiaCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  userId?: string;       // رقم المستخدم في ألف ياء (مطلوب لإنشاء المستندات)
  invoiceGroupId?: string; // مجموعة الترقيم (افتراضي: 1)
  taxRateId?: string;    // معرّف ضريبة القيمة المضافة 15% في ألف ياء
}

let cachedCredentials: AliphiaCredentials | null = null;

export const getAliphiaCredentials = async (): Promise<AliphiaCredentials | null> => {
  if (cachedCredentials) return cachedCredentials;

  // 1. القراءة من التخزين المحلي
  try {
    const local = localStorage.getItem('aliphia_credentials');
    if (local) {
      cachedCredentials = JSON.parse(local);
      return cachedCredentials;
    }
  } catch(e) {
    console.error("Failed to load local credentials", e);
  }

  // 2. القراءة من ملف البيئة كاحتياطي
  if (import.meta.env.VITE_ALIPHIA_USERNAME && import.meta.env.VITE_ALIPHIA_API_KEY) {
    cachedCredentials = {
      username: import.meta.env.VITE_ALIPHIA_USERNAME,
      password: import.meta.env.VITE_ALIPHIA_PASSWORD || '',
      apiKey: import.meta.env.VITE_ALIPHIA_API_KEY,
      userId: import.meta.env.VITE_ALIPHIA_USER_ID || '1',
      invoiceGroupId: '1',
      taxRateId: import.meta.env.VITE_ALIPHIA_TAX_RATE_ID || '',
    };
    return cachedCredentials;
  }
  
  return null;
};

export const saveAliphiaCredentials = async (creds: AliphiaCredentials) => {
  localStorage.setItem('aliphia_credentials', JSON.stringify(creds));
  cachedCredentials = creds;
};

const getHeaders = async (contentType = 'application/json') => {
  const creds = await getAliphiaCredentials();
  if (!creds?.username || !creds?.apiKey) return {};
  
  const rawAuth = `${creds.username}:${creds.password || ''}`;
  const basicAuth = btoa(unescape(encodeURIComponent(rawAuth)));
  const headers: Record<string, string> = {
    'Authorization': `Basic ${basicAuth}`,
    'X-KEYALI-API': creds.apiKey
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
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
    const response = await fetch(`${ALIPHIA_API_URL}/clients/active`, {
      method: 'GET',
      headers: await getHeaders(''),
    });
    if (!response.ok) throw new Error('فشل جلب بيانات العملاء من ألف ياء');
    const data = await response.json();
    
    // استخراج قائمة العملاء بمرونة سواء كانت مصفوفة (Array) أو كائن (Object)
    let clientsList: any[] = [];
    if (Array.isArray(data)) {
      clientsList = data;
    } else if (data.response && (data.response.clients || data.response.client)) {
      const rawClients = data.response.clients || data.response.client;
      clientsList = Array.isArray(rawClients) 
        ? rawClients 
        : Object.values(rawClients);
    } else if (data.response) {
      clientsList = Array.isArray(data.response) 
        ? data.response 
        : Object.values(data.response);
    } else if (data.data) {
      clientsList = Array.isArray(data.data) 
        ? data.data 
        : Object.values(data.data);
    }
    
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

export const createAliphiaDocument = async (
  type: 'invoice' | 'quotation',
  docData: any,
  onCreated?: (id: string) => Promise<void>
) => {
  const creds = await getAliphiaCredentials();
  if (!creds) {
    console.warn(`⚠️ مفاتيح Aliphia غير متوفرة.`);
    return { success: true, id: Math.floor(Math.random() * 10000), pdf_url: '' };
  }

  try {
    const isInvoice = type === 'invoice';
    const endpoint = isInvoice ? '/invoice' : '/quote';
    const docKey   = isInvoice ? 'invoice'  : 'quote';
    const itemsKey = isInvoice ? 'invoice_items' : 'quote_items';
    const dateKey  = isInvoice ? 'invoice_date_created' : 'quote_date_created';

    // استخدام بيانات الاعتماد المخزنة
    const userId        = creds.userId        || docData.user_id         || '1';
    const groupId       = creds.invoiceGroupId || docData.invoice_group_id || '1';
    const taxRateId     = creds.taxRateId     || '';
    const docDate       = docData.date || new Date().toISOString().split('T')[0];

    let docId = docData.existing_id;

    if (!docId) {
      // الخطوة 1: إنشاء مستند فارغ
      const createBody: any = {
        client_id: String(docData.client_id || ''),
        [dateKey]: docDate,
      };

      if (isInvoice) {
        createBody.invoice_date_supply = docDate;
        createBody.invoice_date_due = docData.date_due || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        createBody.invoice_group_id = String(groupId);
        createBody.user_id = String(userId);
      } else {
        createBody.invoice_group_id = String(groupId);
        createBody.user_id = String(userId);
      }

      const createPayload = {
        [docKey]: createBody
      };

      console.log(`📤 [Aliphia] ${type} POST → ${endpoint} | Payload:`, JSON.stringify(createPayload));

      const createResponse = await fetch(`${ALIPHIA_API_URL}${endpoint}`, {
        method: 'POST',
        headers: await getHeaders('application/json'),
        body: JSON.stringify(createPayload)
      });

      const createResponseText = await createResponse.text();
      console.log(`📥 [Aliphia] POST ${createResponse.status}:`, createResponseText.substring(0, 400));

      let createResponseData: any = {};
      try { createResponseData = JSON.parse(createResponseText); } catch(e) {}

      if (!createResponse.ok) {
        const errMsg = createResponseData?.error || createResponseData?.message || `HTTP ${createResponse.status}`;
        throw new Error(`فشل إنشاء المستند: ${errMsg}`);
      }

      docId = createResponseData?.response?.[docKey]?.[`${docKey}_id`] || 
              createResponseData?.[`${docKey}_id`];

      if (!docId) {
        throw new Error(`لم يتم استرجاع معرف المستند من ألف ياء`);
      }

      console.log(`✅ [Aliphia] ${type} created successfully with ID: ${docId}`);

      // استدعاء رد اتصال التحديث الفوري لحفظ الـ ID في قاعدة البيانات قبل المتابعة
      if (onCreated) {
        try {
          await onCreated(String(docId));
          console.log(`✅ [Aliphia] local record updated with ID: ${docId}`);
        } catch (dbErr) {
          console.error(`⚠️ [Aliphia] onCreated callback failed:`, dbErr);
        }
      }
    } else {
      console.log(`ℹ️ [Aliphia] Using existing document ID: ${docId}, skipping POST creation.`);
    }

    // الخطوة 2: تحديث المستند بالبنود
    const itemsList = Array.isArray(docData.items) ? docData.items : [];
    const formattedItems = itemsList.map((item: any, index: number) => {
      const itemObj: any = {
        item_name: String(item.name || ''),
        item_price: Number(item.price || 0),
        item_quantity: Number(item.quantity || 1),
        item_order: index + 1,
        item_lookup_id: 0
      };
      if (item.description) {
        itemObj.item_description = String(item.description);
      }
      if (taxRateId) {
        itemObj.item_tax_rate_id = String(taxRateId);
      }
      return itemObj;
    });

    // تحديث كل البيانات المطلوبة لتجنب 500 في الـ PUT
    const updateBody: any = {
      [`${docKey}_id`]: String(docId),
      client_id: String(docData.client_id || ''),
      [dateKey]: docDate,
      [itemsKey]: formattedItems
    };

    if (isInvoice) {
      updateBody.invoice_date_supply = docDate;
      updateBody.invoice_date_due = docData.date_due || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      updateBody.invoice_group_id = String(groupId);
      updateBody.user_id = String(userId);
    } else {
      updateBody.invoice_group_id = String(groupId);
      updateBody.user_id = String(userId);
    }

    if (docData.terms) updateBody.terms = docData.terms;
    if (docData.notes) updateBody.notes = docData.notes;

    const updatePayload = {
      [docKey]: updateBody
    };

    console.log(`📤 [Aliphia] ${type} PUT → ${endpoint} | Payload:`, JSON.stringify(updatePayload));

    const updateResponse = await fetch(`${ALIPHIA_API_URL}${endpoint}`, {
      method: 'PUT',
      headers: await getHeaders('application/json'),
      body: JSON.stringify(updatePayload)
    });

    const updateResponseText = await updateResponse.text();
    console.log(`📥 [Aliphia] PUT ${updateResponse.status}:`, updateResponseText.substring(0, 400));

    let updateResponseData: any = {};
    try { updateResponseData = JSON.parse(updateResponseText); } catch(e) {}

    if (!updateResponse.ok) {
      const errMsg = updateResponseData?.error || updateResponseData?.message || `HTTP ${updateResponse.status}`;
      throw new Error(`فشل إضافة البنود للمستند: ${errMsg}`);
    }

    // الخطوة 3: جلب تفاصيل المستند بالكامل للحصول على رقم المستند ورابط PDF
    console.log(`🔄 [Aliphia] Fetching details for ${type} ${docId}...`);
    const detailResponse = await fetch(`${ALIPHIA_API_URL}${endpoint}/${docId}`, {
      method: 'GET',
      headers: await getHeaders(''),
    });

    if (detailResponse.ok) {
      const detailText = await detailResponse.text();
      let detailData: any = {};
      try { detailData = JSON.parse(detailText); } catch(e) {}
      
      if (detailData.response?.[docKey]) {
        const docDetail = detailData.response?.[docKey] || {};
        return {
          ...docDetail,
          id: docDetail[`${docKey}_id`] || docId,
          pdf_url: docDetail.pdf_url || '',
          response: docDetail,
          status: "success"
        };
      }
    }

    // fallback لو فشل الـ GET لأي سبب، نرجع رد الـ PUT المنسق
    return {
      ...updateResponseData,
      id: docId,
      pdf_url: '',
      response: {
        [`${docKey}_id`]: docId,
        pdf_url: ''
      },
      status: "success"
    };
  } catch (error) {
    console.error('Aliphia create doc error:', error);
    throw error;
  }
};

export const createAliphiaClient = async (clientData: { name: string; phone?: string; email?: string }) => {
  const creds = await getAliphiaCredentials();
  if (!creds) {
    console.warn("⚠️ مفاتيح Aliphia غير متوفرة. يتم محاكاة إنشاء العميل.");
    return {
      success: true,
      client: {
        id: 'AL-' + Math.floor(Math.random() * 10000),
        name: clientData.name,
        phone: clientData.phone || '',
        email: clientData.email || ''
      }
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('client_name', clientData.name);
    if (clientData.phone) formData.append('client_phone', clientData.phone);
    if (clientData.email) formData.append('client_email', clientData.email);

    const response = await fetch(`${ALIPHIA_API_URL}/client`, {
      method: 'POST',
      headers: await getHeaders('application/x-www-form-urlencoded'),
      body: formData.toString()
    });

    if (!response.ok) throw new Error('فشل إنشاء العميل في ألف ياء');
    const data = await response.json();
    
    const newId = data.response?.client_id || data.data?.client_id || data.id || Math.floor(Math.random() * 10000).toString();
    
    return {
      success: true,
      client: {
        id: newId.toString(),
        name: clientData.name,
        phone: clientData.phone || '',
        email: clientData.email || ''
      }
    };
  } catch (error) {
    console.error('Aliphia create client error:', error);
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
    const headers = await getHeaders('');
    const response = await fetch(`${ALIPHIA_API_URL}/clients/active`, {
      method: 'GET',
      headers,
    });
    const latency = Date.now() - start;
    
    if (response.ok) {
      return { status: 'connected', latency, message: 'متصل ومستقر' };
    } else {
      let errorText = '';
      try {
        const clone = response.clone();
        const errJson = await clone.json();
        errorText = errJson.error || errJson.message || errJson.msg || (typeof errJson === 'object' ? JSON.stringify(errJson) : '');
      } catch (e) {
        try {
          const clone = response.clone();
          errorText = await clone.text();
        } catch (et) {}
      }

      if (errorText.toLowerCase().includes('hourly limit') || response.status === 429) {
        return { 
          status: 'error', 
          latency, 
          message: 'تم تجاوز الحد المسموح به للطلبات في الساعة (انتظر حتى نهاية الساعة)' 
        };
      }

      const cleanErrorMsg = errorText ? errorText.substring(0, 150) : `كود الخطأ: ${response.status}`;
      return { 
        status: 'error', 
        latency, 
        message: `الخادم يرفض الاتصال: ${cleanErrorMsg}` 
      };
    }
  } catch (error: any) {
    const errMsg = error?.message || 'خطأ في الشبكة';
    return { status: 'error', latency: Date.now() - start, message: `المتصفح أو الخادم يمنع الاتصال: ${errMsg}` };
  }
};


export const fetchAliphiaInvoices = async () => {
  const creds = await getAliphiaCredentials();
  if (!creds) return [];

  try {
    const response = await fetch(`${ALIPHIA_API_URL}/invoices`, {
      method: 'GET',
      headers: await getHeaders(''),
    });
    
    if (response.status === 404) {
      try {
        const errData = await response.clone().json();
        if (errData.error === 'InvoiceNotFound' || errData.error === 'InvoiceNotFound') {
          return [];
        }
      } catch (e) {}
    }
    
    if (!response.ok) throw new Error('فشل جلب الفواتير من ألف ياء');
    const data = await response.json();
    
    // استخراج الفواتير بمرونة
    const list = 
      Array.isArray(data) ? data : 
      (data.response && Array.isArray(data.response.invoices) ? data.response.invoices :
      (data.response && Array.isArray(data.response.invoice) ? data.response.invoice :
      (data.response && typeof data.response === 'object' ? Object.values(data.response) :
      (data.data || []))));
      
    return list;
  } catch (error) {
    console.error('Aliphia invoices fetch error:', error);
    return [];
  }
};

export const fetchAliphiaQuotations = async () => {
  const creds = await getAliphiaCredentials();
  if (!creds) return [];

  try {
    const response = await fetch(`${ALIPHIA_API_URL}/quotes`, {
      method: 'GET',
      headers: await getHeaders(''),
    });
    
    if (response.status === 404) {
      try {
        const errData = await response.clone().json();
        if (errData.error === 'QuoteNotFound' || errData.error === 'QuoteNotFound') {
          return [];
        }
      } catch (e) {}
    }
    
    if (!response.ok) throw new Error('فشل جلب عروض الأسعار من ألف ياء');
    const data = await response.json();
    
    const list = 
      Array.isArray(data) ? data : 
      (data.response && Array.isArray(data.response.quotes) ? data.response.quotes :
      (data.response && Array.isArray(data.response.quote) ? data.response.quote :
      (data.response && typeof data.response === 'object' ? Object.values(data.response) :
      (data.data || []))));
      
    return list;
  } catch (error) {
    console.error('Aliphia quotes fetch error:', error);
    return [];
  }
};

export const fetchAliphiaInvoiceDetails = async (invoiceId: string) => {
  const creds = await getAliphiaCredentials();
  if (!creds) throw new Error('بيانات الربط مع ألف ياء غير متوفرة');

  try {
    const response = await fetch(`${ALIPHIA_API_URL}/invoice/${invoiceId}`, {
      method: 'GET',
      headers: await getHeaders(''),
    });
    if (!response.ok) {
      let errorText = '';
      try {
        const clone = response.clone();
        const errJson = await clone.json();
        errorText = errJson.error || errJson.message || errJson.msg || (typeof errJson === 'object' ? JSON.stringify(errJson) : '');
      } catch (e) {
        try {
          const clone = response.clone();
          errorText = await clone.text();
        } catch (et) {}
      }
      const cleanMsg = errorText ? errorText.substring(0, 150) : `كود الحالة: ${response.status}`;
      throw new Error(`فشل جلب تفاصيل الفاتورة من ألف ياء: ${cleanMsg}`);
    }
    const data = await response.json();
    return data.response?.invoice || data.invoice || data.response || data;
  } catch (error) {
    console.error('Aliphia invoice detail fetch error:', error);
    throw error;
  }
};

export const fetchAliphiaQuotationDetails = async (quoteId: string) => {
  const creds = await getAliphiaCredentials();
  if (!creds) throw new Error('بيانات الربط مع ألف ياء غير متوفرة');

  try {
    const response = await fetch(`${ALIPHIA_API_URL}/quote/${quoteId}`, {
      method: 'GET',
      headers: await getHeaders(''),
    });
    if (!response.ok) {
      let errorText = '';
      try {
        const clone = response.clone();
        const errJson = await clone.json();
        errorText = errJson.error || errJson.message || errJson.msg || (typeof errJson === 'object' ? JSON.stringify(errJson) : '');
      } catch (e) {
        try {
          const clone = response.clone();
          errorText = await clone.text();
        } catch (et) {}
      }
      const cleanMsg = errorText ? errorText.substring(0, 150) : `كود الحالة: ${response.status}`;
      throw new Error(`فشل جلب تفاصيل عرض السعر من ألف ياء: ${cleanMsg}`);
    }
    const data = await response.json();
    return data.response?.quote || data.quote || data.response || data;
  } catch (error) {
    console.error('Aliphia quote detail fetch error:', error);
    throw error;
  }
};
