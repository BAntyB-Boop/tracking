import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // 1. Check if it's an API route (/api/*)
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').split('/')[0].replace('.js', '');
    const apiFilePath = path.join(__dirname, 'api', `${apiName}.js`);

    if (fs.existsSync(apiFilePath)) {
      try {
        // Collect request body if POST/PUT
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }

        // Prepare req object for Vercel-style Serverless handler
        req.query = Object.fromEntries(reqUrl.searchParams.entries());
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch {
          req.body = body;
        }

        // Add helper status & json methods to res
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (data) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return res;
        };

        const module = await import(`file://${apiFilePath}?t=${Date.now()}`);
        return await module.default(req, res);
      } catch (err) {
        console.error(`API Error in ${apiName}:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `API route ${apiName} not found` }));
    }
  }

  // 2. Static file serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p><a href="/">Back to Home</a></p>');
  }
});

server.listen(PORT, () => {
  console.log('\n========================================================');
  console.log(`🚀 SwiftRoute Terminal Server running at: http://localhost:${PORT}`);
  console.log(`📦 Neon DB Status: ${process.env.DATABASE_URL ? 'Connected (Live SQL)' : 'Not set (Using Mock Fallback)'}`);
  console.log('========================================================\n');
  console.log('Available Pages:');
  console.log(` • Tracking (Public):  http://localhost:${PORT}/`);
  console.log(` • Sign In:            http://localhost:${PORT}/login.html`);
  console.log(` • Admin Dashboard:    http://localhost:${PORT}/admin.html`);
  console.log(` • Driver Check-in:    http://localhost:${PORT}/admin.html?screen=checkin`);
  console.log('\nAPI Endpoints:');
  console.log(` • GET  /api/track?tn=SR-2609-118245`);
  console.log(` • GET  /api/parcels`);
  console.log(` • GET  /api/dashboard`);
  console.log(` • GET  /api/stations`);
  console.log(` • POST /api/checkin`);
  console.log(` • POST /api/login`);
  console.log('========================================================\n');
});
