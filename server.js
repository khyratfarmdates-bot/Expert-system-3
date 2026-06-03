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
} catch(e) {
  // dotenv might not be available in production, env vars set externally
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
app.all('/api_public/*splat', async (req, res) => {
  const username = process.env.VITE_ALIPHIA_USERNAME;
  const password = process.env.VITE_ALIPHIA_PASSWORD || '';
  const apiKey   = process.env.VITE_ALIPHIA_API_KEY;

  if (!username || !apiKey) {
    return res.status(401).json({ error: 'Aliphia credentials not configured on server' });
  }

  // بناء الرابط الكامل مع أي query strings
  const aliphiaPath = req.path.replace('/api_public', '');
  const queryString = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
  const aliphiaUrl  = `https://aliphia.com/v1/api_public${aliphiaPath}${queryString}`;

  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

  const headers = {
    'Authorization': `Basic ${basicAuth}`,
    'X-KEYALI-API': apiKey,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  };

  try {
    const aliphiaRes = await fetch(aliphiaUrl, {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method)
        ? new URLSearchParams(req.body).toString()
        : undefined,
    });

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
