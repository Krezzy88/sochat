import process from 'node:process';
import { pathToFileURL } from 'node:url';

/** Keep local installs on the Node 22 baseline used by CI. */
export function assertSupportedNode(version) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!parts || Number(parts[1]) !== 22 || Number(parts[2]) < 19) {
    throw new Error(
      `SổChat requires Node.js 22.19+ within major 22; received ${version}. Run nvm use.`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assertSupportedNode(process.versions.node);
}
