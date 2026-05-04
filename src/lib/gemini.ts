import { GoogleGenAI, Type } from "@google/genai";
import { Project, Transaction } from "../types";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
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
      model: "gemini-3.1-flash-lite-preview",
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
    console.error("Batch scan error:", error);
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
      model: "gemini-3.1-flash-lite-preview",
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
    console.error("Error analyzing invoice:", err);
    if (err.status || err.details) {
      console.error("Detailed Error:", JSON.stringify(err, null, 2));
    }
    throw new Error(err.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي");
  }
};

export const analyzeProjectSpending = async (projectData: Partial<Project>, transactions: Partial<Transaction>[]): Promise<string | null> => {
  const ai = getGeminiClient();
  if (!ai) return "خدمة التحليل متوقفة: مفتاح API غير متوفر.";
  
  try {
    const prompt = `
      بناءً على البيانات التالية للمشروع الحالي، هل هناك بوادر أزمة مالية أو تجاوز للميزانية؟
      المشروع: ${JSON.stringify(projectData)}
      المعاملات المالية المرتبطة: ${JSON.stringify(transactions)}
      أرجو إعطاء تحليل مختصر جداً (جملة واحدة) وتنبيه إذا كان الصرف يتجاوز 70% من الميزانية المرصودة للمرحلة الحالية.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || null;
  } catch (error: unknown) {
    const err = error as any;
    console.error("Error analyzing spending:", err);
    if (err.status || err.details) {
      console.error("Detailed Error:", JSON.stringify(err, null, 2));
    }
    return null;
  }
};
