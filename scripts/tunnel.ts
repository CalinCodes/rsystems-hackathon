// Usage: npm run tunnel [-- --no-build]
// Builds the app, serves it on 127.0.0.1:4173 and opens a Cloudflare quick tunnel to it, so any phone or laptop can
// open the app at a temporary https://<random>.trycloudflare.com address. Ctrl+C stops both.
//
// Privacy: the tunnel only carries the app's files. Messages are still checked inside the visitor's own browser and
// are never sent to this laptop or to Cloudflare. Ollama (localhost:11434) is deliberately NOT tunnelled: a visitor's
// browser tries its OWN localhost, and without a model there it falls back to rules only.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'app');
const LOCAL = 'http://127.0.0.1:4173';
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

/** cloudflared from PATH, or where the winget / MSI installer puts it on Windows. */
function findCloudflared(): string | null {
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'),
    join(process.env['ProgramFiles(x86)'] ?? '', 'cloudflared', 'cloudflared.exe'),
    join(process.env.ProgramFiles ?? '', 'cloudflared', 'cloudflared.exe'),
  ];
  // One command string (not args + shell): Node warns that shell + args are concatenated unescaped.
  const onPath = spawnSync('cloudflared --version', { stdio: 'ignore', shell: true });
  if (onPath.status === 0) return 'cloudflared';
  return candidates.find((p) => p !== '' && existsSync(p)) ?? null;
}

function build(): void {
  console.log('Building the app…');
  const r = spawnSync('npm run build -w app', { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error('Build failed; the tunnel was not started.');
    process.exit(1);
  }
}

function startTunnel(bin: string): ChildProcess {
  // --no-autoupdate: never replace the binary in the middle of a demo.
  const child = spawn(bin, ['tunnel', '--no-autoupdate', '--url', LOCAL], { stdio: ['ignore', 'pipe', 'pipe'] });
  let shown = false;
  const onData = (chunk: Buffer): void => {
    const url = URL_RE.exec(chunk.toString())?.[0];
    if (!url || shown) return;
    shown = true;
    console.log(`\n  Scam Shield is online at:\n\n    ${url}\n\n  Open it on any phone or laptop. Ctrl+C stops it.\n`);
  };
  child.stdout?.on('data', onData);
  child.stderr?.on('data', onData); // cloudflared prints its URL on stderr
  return child;
}

async function main(): Promise<void> {
  const bin = findCloudflared();
  if (bin === null) {
    console.error('cloudflared is not installed. Windows: winget install --id Cloudflare.cloudflared -e');
    process.exit(1);
  }
  if (!process.argv.includes('--no-build')) build();
  const server = await preview({ root: APP }); // host, port and allowedHosts come from app/vite.config.ts
  console.log(`Serving the built app on ${LOCAL} (this computer only).`);
  const tunnel = startTunnel(bin);
  const stop = (): void => {
    tunnel.kill();
    void server.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  tunnel.on('exit', (code) => {
    console.error(`cloudflared stopped (code ${code ?? 'none'}).`);
    void server.close().then(() => process.exit(code ?? 1));
  });
}

main().catch((e: unknown) => {
  console.error(`tunnel failed (${e instanceof Error ? e.message : 'unknown error'})`);
  process.exit(1);
});
