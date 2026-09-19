import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import formsHandler from './api/forms.js';
import examHandler from './api/exam.js';
import submitHandler from './api/submit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Emulate Vercel request helper
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Helper response wrapper
  const vercelRes = {
    setHeader: (name, val) => res.setHeader(name, val),
    status: (code) => ({
      json: (data) => sendJson(res, code, data),
      send: (body) => {
        res.writeHead(code);
        res.end(body);
      },
      end: () => {
        res.writeHead(code);
        res.end();
      }
    })
  };

  // API Routes
  if (pathname === '/api/forms') {
    return formsHandler(req, vercelRes);
  }

  if (pathname === '/api/exam') {
    return examHandler(req, vercelRes);
  }

  if (pathname === '/api/submit') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (e) {
          req.body = {};
        }
        submitHandler(req, vercelRes);
      });
      return;
    } else {
      return submitHandler(req, vercelRes);
    }
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath += '.html';
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Page Learning Exams Portal running at http://localhost:${PORT}`);
});
