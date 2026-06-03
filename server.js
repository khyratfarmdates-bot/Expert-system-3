import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// تحميل ملف .env.local لكي يتعرف السيرفر على مفاتيح ألف ياء
const require = createRequire(import.meta.url);
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });
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

// ======================================================
// Aliphia API Proxy - يحل مشكلة CORS في الإنتاج
// يعمل على /api_public/* ويعيد التوجيه لخوادم ألف ياء
// ======================================================
app.all('/api_public/*', async (req, res) => {
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

// تقديم ملفات التطبيق المبني
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*all', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
