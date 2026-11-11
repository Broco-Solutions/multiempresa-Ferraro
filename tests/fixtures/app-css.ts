import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../../node_modules/.cache/multiempresa-test/app.css', import.meta.url));

/** Vitest globalSetup: compiles the real Tailwind stylesheet once for browser layout checks. */
export default function setup() {
  execFileSync('pnpm', ['exec', 'tailwindcss', '-i', 'src/app/globals.css', '-o', output], { stdio: 'pipe' });
}

/** Compiled application CSS, as served by Next.js. */
export function appCss() {
  return readFile(output, 'utf8');
}
