// Local TLS-termination rehearsal, not a public hosting proxy.
import https from 'node:https';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
const directory = mkdtempSync(join(tmpdir(), 'sochat-release-tls-'));
chmodSync(directory, 0o700);
try {
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(directory, 'key.pem'),
      '-out',
      join(directory, 'cert.pem'),
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
    ],
    { stdio: 'ignore' },
  );
  const server = https.createServer(
    {
      key: readFileSync(join(directory, 'key.pem')),
      cert: readFileSync(join(directory, 'cert.pem')),
    },
    (req, res) => {
      const headers = {
        ...req.headers,
        host: 'localhost:18180',
        'x-forwarded-proto': 'https',
        'x-forwarded-for': req.socket.remoteAddress ?? '127.0.0.1',
      };
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: 18180,
          path: req.url ?? '/',
          method: req.method ?? 'GET',
          headers,
        },
        (reply) => {
          res.writeHead(reply.statusCode ?? 502, reply.headers);
          reply.pipe(res);
        },
      );
      upstream.setTimeout(30000, () => upstream.destroy());
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.on('aborted', () => upstream.destroy());
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
    },
  );
  const cleanup = () =>
    server.close(() => {
      rmSync(directory, { recursive: true, force: true });
      process.exit();
    });
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
  server.on('error', () => {
    rmSync(directory, { recursive: true, force: true });
    process.exitCode = 1;
  });
  server.listen(18143, '127.0.0.1', () =>
    process.stdout.write('Local release TLS proxy ready\n'),
  );
} catch (error) {
  rmSync(directory, { recursive: true, force: true });
  throw error;
}
