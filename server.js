import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// تحميل ملف .env.local لكي يتعرف السيرفر على مفاتيح ألف ياء
const require = createRequire(import.meta.url);
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local', override: true });
  dotenv.config({ path: '.env', override: true });
  console.log("🔑 [Aliphia Config] Loaded environment variables:", {
    VITE_ALIPHIA_USERNAME: process.env.VITE_ALIPHIA_USERNAME || 'NOT FOUND',
    VITE_ALIPHIA_API_KEY: process.env.VITE_ALIPHIA_API_KEY ? 'FOUND (length: ' + process.env.VITE_ALIPHIA_API_KEY.length + ')' : 'NOT FOUND',
    VITE_ALIPHIA_PASSWORD: process.env.VITE_ALIPHIA_PASSWORD ? 'FOUND' : 'NOT FOUND'
  });
} catch(e) {
  console.log("ℹ️ [Aliphia Config] dotenv skipped (in production environments, variables should be set in environment directly).");
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let lastReceivedCreds = null;

// ======================================================
// Aliphia API Proxy - يحل مشكلة CORS في الإنتاج
// يعمل على /api_public/* ويعيد التوجيه لخوادم ألف ياء
// ======================================================
app.all('/api_public/*splat', async (req, res) => {
  // محاولة القراءة أولاً من الترويسات المرسلة من العميل (الواجهة الأمامية)
  let authHeader = req.headers['authorization'];
  let apiKey = req.headers['x-keyali-api'];

  // إذا لم يرسلها العميل، نستخدم بيئة السيرفر كبديل
  if (!authHeader || !apiKey) {
    const username = process.env.VITE_ALIPHIA_USERNAME;
    const password = process.env.VITE_ALIPHIA_PASSWORD || '';
    const serverApiKey = process.env.VITE_ALIPHIA_API_KEY;

    if (username && serverApiKey) {
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
      authHeader = `Basic ${basicAuth}`;
      apiKey = serverApiKey;
    }
  }

  // حفظ آخر بيانات مستلمة للتشخيص
  lastReceivedCreds = {
    authHeaderReceived: !!req.headers['authorization'],
    apiKeyReceived: !!req.headers['x-keyali-api'],
    finalAuthHeader: authHeader,
    finalApiKey: apiKey,
    // محاولة استخراج الاسم والباسورد لتبسيط الفحص للمستخدم
    decodedUserPass: authHeader && authHeader.startsWith('Basic ') 
      ? Buffer.from(authHeader.substring(6), 'base64').toString('utf8') 
      : 'N/A'
  };

  if (!authHeader || !apiKey) {
    return res.status(401).json({ error: 'Aliphia credentials not configured on client or server' });
  }

  // بناء الرابط الكامل بطريقة مضمونة ومباشرة مع معلمات الاستعلام
  const aliphiaUrl = 'https://aliphia.com/v1/api_public' + req.originalUrl.substring('/api_public'.length);

  const headers = {
    'Authorization': authHeader,
    'X-KEYALI-API': apiKey,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  try {
    const fetchOptions = {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method)
        ? new URLSearchParams(req.body).toString()
        : undefined,
    };

    const aliphiaRes = await fetch(aliphiaUrl, fetchOptions);
    console.log(`📡 [Aliphia Proxy] ${req.method} ${aliphiaUrl} -> Status: ${aliphiaRes.status}`);

    const contentType = aliphiaRes.headers.get('content-type') || '';
    res.status(aliphiaRes.status);

    if (contentType.includes('application/json')) {
      res.json(await aliphiaRes.json());
    } else {
      res.send(await aliphiaRes.text());
    }
  } catch (error) {
    console.error('Aliphia proxy error:', error);
    res.status(500).json({ error: 'Proxy request to Aliphia failed' });
  }
});

// ======================================================
// Diagnostic Route - لفحص أي الحسابات تعمل مع ألف ياء
// ======================================================
app.get('/test-aliphia-connection', async (req, res) => {
  const results = {};

  const testCreds = async (username, password, apiKey, subPath) => {
    if (!username || !apiKey) {
      return { status: 'missing', error: 'Credentials are empty' };
    }
    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
    try {
      const response = await fetch(`https://aliphia.com/v1/api_public${subPath}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'X-KEYALI-API': apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      const text = await response.text();
      let parsed = text;
      try {
        parsed = JSON.parse(text);
      } catch(e) {}

      return {
        pathTested: subPath,
        status: response.status,
        ok: response.ok,
        errorMsg: parsed.error || (response.ok ? null : text.substring(0, 100)),
        dataSample: parsed
      };
    } catch(e) {
      return { status: 'error', error: e.message };
    }
  };

  const oldApiKey = "ali_k0IC7CCdEd6dyIM0cbiyXF9Zo9LKEBAo0KyV";

  const userEnv = process.env.VITE_ALIPHIA_USERNAME || "08818672809340I";
  const passEnv = process.env.VITE_ALIPHIA_PASSWORD || "IXJ52u3I3nNqSf8";

  // فحص مفاتيح .env.local الحالية على المسار الصحيح
  results.activeConnectionTest = await testCreds(
    process.env.VITE_ALIPHIA_USERNAME,
    process.env.VITE_ALIPHIA_PASSWORD || '',
    process.env.VITE_ALIPHIA_API_KEY,
    '/clients/active'
  );

  // إبقاء فحص المسارات كمرجع احتياطي
  results.EnvUser_NewKey_OldPath = await testCreds(process.env.VITE_ALIPHIA_USERNAME, process.env.VITE_ALIPHIA_PASSWORD || '', process.env.VITE_ALIPHIA_API_KEY, '/client/active.json');

  // عرض آخر بيانات تم إرسالها من المتصفح (نافذة الإعدادات)
  results.lastRequestFromBrowser = lastReceivedCreds || "No request received yet since server start";

  res.json(results);
});

// تقديم ملفات التطبيق المبني
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*all', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
