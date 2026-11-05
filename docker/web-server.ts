import express from 'express';
import helmet from 'helmet';
import http from 'node:http';
import path from 'node:path';
const app = express();
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    strictTransportSecurity: false,
  }),
);
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api', (req, res) => {
  const upstream = http.request(
    {
      hostname: 'api',
      port: 3000,
      path: req.originalUrl,
      method: req.method,
      headers: { ...req.headers, host: 'api:3000' },
    },
    (reply) => {
      res.writeHead(reply.statusCode ?? 502, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.setTimeout(30000, () => upstream.destroy());
  upstream.on('error', () => {
    if (!res.headersSent)
      res.status(502).type('application/problem+json').json({
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        detail: 'API chưa sẵn sàng.',
      });
    else res.destroy();
  });
  req.on('close', () => {
    if (req.destroyed) upstream.destroy();
  });
  req.pipe(upstream);
});
app.use(express.static(path.resolve('apps/web/dist')));
app.listen(8080, '0.0.0.0');
