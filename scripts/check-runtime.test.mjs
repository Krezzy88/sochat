import { describe, expect, it } from 'vitest';
import { assertSupportedNode } from './check-runtime.mjs';

describe('the Node 22 toolchain requirement', () => {
  it.each(['22.13.0', '22.23.4', '22.99.0'])(
    'accepts supported Node %s',
    (version) => {
      expect(() => assertSupportedNode(version)).not.toThrow();
    },
  );

  it.each([
    '20.19.0',
    '22.12.0',
    '24.0.0',
    '24.13.0',
    '26.0.0',
    'invalid',
    '22.13.0-rc.1',
  ])('rejects unsupported Node %s with an actionable error', (version) => {
    expect(() => assertSupportedNode(version)).toThrow(
      /requires Node.js 22.13.*Run nvm use/,
    );
  });
});
