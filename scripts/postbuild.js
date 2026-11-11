// The API (api/_lib/seo) injects page-specific metadata into the built HTML. If the CDN served dist/index.html
// directly for "/", visitors and crawlers would skip that step, so the file is renamed to shell.html.
import { existsSync, renameSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
if (existsSync(new URL('index.html', dist))) {
  renameSync(new URL('index.html', dist), new URL('shell.html', dist));
  console.log('dist/index.html -> dist/shell.html');
}
