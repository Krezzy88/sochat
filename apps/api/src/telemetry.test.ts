import { expect, it, vi } from 'vitest';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { SafeTraceExporter } from './telemetry.ts';
it('exports only allowlisted operational fields even if a span carries private attributes', () => {
  const lines: string[] = [];
  const exporter = new SafeTraceExporter((line) => lines.push(line));
  const done = vi.fn();
  exporter.export(
    [
      {
        name: 'POST /api/assistant/query',
        spanContext: () => ({ traceId: 'abc' }),
        duration: [0, 1000000],
        attributes: {
          'http.request.method': 'POST',
          'http.route': '/api/assistant/query',
          'http.response.status_code': 200,
          message: 'secret-message',
          email: 'private@example.test',
          amount: 123456,
          'exception.message': 'key-secret',
        },
      } as unknown as ReadableSpan,
    ],
    done,
  );
  expect(lines[0]).not.toMatch(/secret|private|123456/);
  expect(JSON.parse(lines[0]!)).toMatchObject({ status: 200, duration_ms: 1 });
  expect(done).toHaveBeenCalledWith({ code: 0 });
});
