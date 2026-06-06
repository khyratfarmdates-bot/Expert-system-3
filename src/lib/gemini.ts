import { GoogleGenAI, Type } from "@google/genai";
import { Project, Transaction } from "../types";

const getGeminiClient = () => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || 
                 (typeof localStorage !== 'undefined' ? localStorage.getItem('VITE_GEMINI_API_KEY') : '') || 
                 (typeof window !== 'undefined' ? (window as any).VITE_GEMINI_API_KEY : '') ||
                 (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') || 
                 '';
  if (!apiKey || apiKey === 'undefined' || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    console.warn("Gemini API key is not configured or is using a placeholder.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export interface InvoiceData {
  amount: number;
  date: string;
  vendor: string;
  items: string[];
  description: string;
}

export interface QuickScanResult {
  isValidInvoice: boolean;
  isBlurry: boolean;
  data?: {
    amount: number;
    vendor: string;
    date: string;
    items?: string[];
    description?: string;
  };
  errorReason?: string;
}

export const quickAnalyzeInvoice = async (dataUrl: string): Promise<QuickScanResult> => {
  const ai = getGeminiClient();
  if (!ai) throw new Error("مفتاح API غير متوفر.");
  
  let mimeType = "image/jpeg";
  let base64Data = dataUrl;

  if (dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(';');
    mimeType = parts[0].split(':')[1];
    base64Data = parts[1].replace('base64,', '');
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            { text: `كخبير فحص فوري، تحقق من هذه الصورة واطلعني بالنتائج بصيغة JSON فقط:
1. هل هي فاتورة شراء واضحة؟ (isValidInvoice)
2. هل النص مهزوز أو غير مقروء؟ (isBlurry)
3. إذا كانت فاتورة، استخرج (amount, vendor, date).
4. إذا لم تكن فاتورة، اذكر السبب في errorReason باختصار.` },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidInvoice: { type: Type.BOOLEAN },
            isBlurry: { type: Type.BOOLEAN },
            data: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                vendor: { type: Type.STRING },
                date: { type: Type.STRING },
              }
            },
            errorReason: { type: Type.STRING }
          },
          required: ["isValidInvoice", "isBlurry"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as QuickScanResult;
    }
    return { isValidInvoice: false, isBlurry: false, errorReason: "لم يتم التعرف" };
  } catch (error) {
    console.warn("Batch scan warning:", error);
    return { isValidInvoice: false, isBlurry: true, errorReason: "خطأ فني" };
  }
};

export const analyzeInvoice = async (dataUrl: string): Promise<InvoiceData> => {
  const ai = getGeminiClient();
  if (!ai) throw new Error("مفتاح API غير متوفر. يرجى إضافة GEMINI_API_KEY في النظام.");
  
  let mimeType = "image/jpeg";
  let base64Data = dataUrl;

  if (dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(';');
    mimeType = parts[0].split(':')[1];
    base64Data = parts[1].replace('base64,', '');
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            { text: `قم بتحليل المستند أو الفاتورة المرفقة (سواء صورة أو ملف PDF) واستخراج المعلومات بدقة واحترافية:
1. المبلغ الإجمالي: استخرج الرقم فقط.
2. التاريخ: بصيغة YYYY-MM-DD.
3. اسم المورد: الاسم التجاري الصريح بدون فروع.
4. الأصناف: قائمة بأسماء المنتجات أو الخدمات.
5. الوصف: وصف عام للمستند ومحتواه.

اعتمد على الدقة في قراءة النصوص العربية والإنجليزية بالأرقام حتى من داخل ملفات PDF.
رد بصيغة JSON فقط متطابقة مع المخطط.` },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || "image/jpeg",
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            vendor: { type: Type.STRING },
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: { type: Type.STRING },
          },
          required: ["amount", "vendor"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as InvoiceData;
    }
    throw new Error("لم يتم إرجاع أي نص من الذكاء الاصطناعي");
  } catch (error: unknown) {
    const err = error as any;
    console.warn("Invoice analysis warning:", err.message || err);
    throw new Error(err.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي");
  }
};

export const generateLocalSpendingAnalysis = (projectData: Partial<Project>, transactions: Partial<Transaction>[]): string => {
  const projName = projectData.title || projectData.name || "المشروع التجريبي";
  const budget = Number(projectData.budget) || 0;
  const progress = Number(projectData.progress) || 0;

  // Filter transactions for this project, or default to all if none explicitly linked
  const projectTxs = transactions && transactions.length > 0
    ? transactions.filter(t => !t.projectId || t.projectId === projectData.id)
    : [];

  const totalExpenses = projectTxs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalIncome = projectTxs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  if (budget <= 0) {
    const balance = totalIncome - totalExpenses;
    return `📋 مؤشر أداء مشروع (${projName}): يسير بنسق منتظم بنسبة إنجاز مقدرة بـ ${progress}%. بلغ إجمالي المقبوضات المسجلة ${totalIncome.toLocaleString('en-US')} ريال في حين بلغت المصروفات التشغيلية ${totalExpenses.toLocaleString('en-US')} ريال (صافي السيولة المتوفرة: ${balance.toLocaleString('en-US')} ريال).`;
  }

  const spendRatio = Math.round((totalExpenses / budget) * 100);

  if (spendRatio > 100) {
    return `⚠️ تنبيه حرج لمشروع (${projName}): الصرف الفعلي تجاوز قيمة الميزانية الإجمالية بنسبة ${spendRatio}% (المصروفات: ${totalExpenses.toLocaleString('en-US')} ريال مقابل ميزانية مرصودة ${budget.toLocaleString('en-US')} ريال). يوصى بإيقاف الصرف مؤقتاً ومراجعة بنود التكاليف.`;
  }

  if (spendRatio >= 70) {
    return `⚠️ إشعار احترازي لمشروع (${projName}): تدفق الصرف يقترب من الحد الأقصى بنسبة ${spendRatio}% من الميزانية المحددة (${totalExpenses.toLocaleString('en-US')} ريال من أصل ${budget.toLocaleString('en-US')} ريال)، بينما نسبة الإنجاز الفعلي للمشروع عند ${progress}%. ننصح بتدقيق التكاليف القادمة.`;
  }

  return `📈 أداء مستقر وتدفق مالي آمن لمشروع (${projName}): نسبة المصروفات آمنة وتحت السيطرة بنسبة ${spendRatio}% من الميزانية الكلية (المصروفات الفعلية: ${totalExpenses.toLocaleString('en-US')} ريال من ميزانية مرصودة بقيمة ${budget.toLocaleString('en-US')} ريال)، متماشياً مع نسبة الإنجاز الحالية البالغة ${progress}%.`;
};

export const analyzeProjectSpending = async (projectData: Partial<Project>, transactions: Partial<Transaction>[]): Promise<string | null> => {
  const ai = getGeminiClient();
  if (!ai) {
    // If API client is not configured, fallback gracefully to our rule-based analysis
    return generateLocalSpendingAnalysis(projectData, transactions);
  }
  
  try {
    const prompt = `
      بناءً على البيانات التالية للمشروع الحالي، هل هناك بوادر أزمة مالية أو تجاوز للميزانية؟
      المشروع: ${JSON.stringify(projectData)}
      المعاملات المالية المرتبطة: ${JSON.stringify(transactions)}
      أرجو إعطاء تحليل مختصر جداً (جملة واحدة) وتنبيه إذا كان الصرف يتجاوز 70% من الميزانية المرصودة للمرحلة الحالية.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || generateLocalSpendingAnalysis(projectData, transactions);
  } catch (error: unknown) {
    const err = error as any;
    console.warn("Project spending analysis fell back to local calculations:", err.message || err);
    // Fallback smoothly to rule-based analysis instead of returning null and breaking dashboard display
    return generateLocalSpendingAnalysis(projectData, transactions);
  }
};

export interface ExtractedProjectData {
  title?: string;
  description?: string;
  budget?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  locationLink?: string;
  startDate?: string;
  endDate?: string;
  projectType?: 'residential' | 'commercial' | 'industrial' | 'renovation';
  supervisor?: string;
  contractNumber?: string;
  engOffice?: string;
  totalArea?: string;
}

export const parseProjectFromText = async (text: string): Promise<ExtractedProjectData | null> => {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("مفتاح API غير متوفر أو غير صالح. يرجى إعداد مفتاح الذكاء الاصطناعي في الإعدادات.");
  }

  try {
    const prompt = `
      قم بتحليل النص التالي واستخراج تفاصيل المشروع الهندسية والمالية بدقة وتنسيقها في الكائن المطلوب.
      
      النص المراد تحليله:
      "${text}"
      
      ملاحظات هامة للاستخراج:
      1. title: عنوان المشروع (مثال: فيلا سكنية - حي الياسمين).
      2. budget: القيمة المالية للعقد كـ رقم فقط (مثال: 500000).
      3. clientPhone: رقم الجوال (حاول توحيده بصيغة 05xxxxxxxx إن أمكن).
      4. startDate & endDate: التواريخ بصيغة YYYY-MM-DD (إذا ذكر مثلاً "تبدأ في يوليو" وكان هذا العام 2026، اجعله 2026-07-01).
      5. projectType: يجب أن يكون أحد هذه الخيارات فقط: 'residential' (إذا كان فيلا، شقة، قصر، سكني)، 'commercial' (معارض، مكاتب، تجاري)، 'industrial' (مصنع، مستودع، هنجر)، 'renovation' (ترميم، تعديل، تشطيب لشيء قائم).
      6. description: نطاق العمل الفني (تفاصيل إضافية عن العمل أو البنود).
      
      أرجع فقط كائن JSON يطابق المواصفات.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            budget: { type: Type.NUMBER },
            clientName: { type: Type.STRING },
            clientPhone: { type: Type.STRING },
            clientEmail: { type: Type.STRING },
            locationLink: { type: Type.STRING },
            startDate: { type: Type.STRING },
            endDate: { type: Type.STRING },
            projectType: { 
              type: Type.STRING,
              enum: ['residential', 'commercial', 'industrial', 'renovation']
            },
            supervisor: { type: Type.STRING },
            contractNumber: { type: Type.STRING },
            engOffice: { type: Type.STRING },
            totalArea: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ExtractedProjectData;
    }
    return null;
  } catch (error) {
    console.error("AI parsing failed:", error);
    throw error;
  }
};
