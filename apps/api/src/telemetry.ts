import process from 'node:process';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace';
import { resourceFromAttributes } from '@opentelemetry/resources';
export class SafeTraceExporter implements SpanExporter {
  readonly write: (line: string) => void;
  constructor(
    write: (line: string) => void = (line) => {
      process.stdout.write(line + '\n');
    },
  ) {
    this.write = write;
  }
  export(spans: ReadableSpan[], done: (result: { code: number }) => void) {
    for (const span of spans)
      this.write(
        JSON.stringify({
          event: 'otel_trace',
          name: span.name,
          trace_id: span.spanContext().traceId,
          method: span.attributes['http.request.method'],
          route: span.attributes['http.route'],
          status: span.attributes['http.response.status_code'],
          duration_ms: span.duration[0] * 1000 + span.duration[1] / 1e6,
        }),
      );
    done({ code: 0 });
  }
  async shutdown() {}
}
let sdk: NodeSDK | undefined;
export function startTelemetry() {
  if (process.env.OTEL_ENABLED !== 'true') return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (
    endpoint &&
    !['localhost', '127.0.0.1', 'collector', '[::1]'].includes(
      new URL(endpoint).hostname,
    )
  )
    throw new Error(
      'External telemetry destination requires privacy approval.',
    );
  sdk = new NodeSDK({
    autoDetectResources: false,
    resource: resourceFromAttributes({ 'service.name': 'sochat-api' }),
    instrumentations: [],
    textMapPropagator: null,
    spanProcessors: [
      new SimpleSpanProcessor({
        exporter: endpoint
          ? new OTLPTraceExporter({ url: endpoint + '/v1/traces' })
          : new SafeTraceExporter(),
      }),
    ],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: endpoint
          ? new OTLPMetricExporter({ url: endpoint + '/v1/metrics' })
          : new ConsoleMetricExporter(),
        exportIntervalMillis: 60000,
      }),
    ],
  });
  sdk.start();
}
export const stopTelemetry = () => sdk?.shutdown();
export async function instrument<T>(
  method: string,
  route: string,
  status: number,
  work: () => Promise<T>,
): Promise<T> {
  return trace
    .getTracer('sochat.http')
    .startActiveSpan(method + ' ' + route, async (span) => {
      const started = performance.now();
      let code = status;
      try {
        return await work();
      } catch (error) {
        code =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof error.status === 'number'
            ? error.status
            : 500;
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        const attributes = {
          'http.request.method': method.toUpperCase(),
          'http.route': route,
          'http.response.status_code': code,
        };
        span.setAttributes(attributes);
        metrics
          .getMeter('sochat.http')
          .createCounter('sochat.http.requests')
          .add(1, attributes);
        metrics
          .getMeter('sochat.http')
          .createHistogram('sochat.http.duration', { unit: 'ms' })
          .record(performance.now() - started, attributes);
        span.end();
      }
    });
}
