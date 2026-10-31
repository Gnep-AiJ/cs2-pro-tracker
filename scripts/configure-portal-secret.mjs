import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
assert.ok(accountId, 'CLOUDFLARE_ACCOUNT_ID is required');
assert.ok(process.env.PANDASCORE_API_TOKEN?.trim(), 'PandaScore token is required');
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'secret', 'put', 'PANDASCORE_API_TOKEN', '--project-name', 'cs2pro'], { stdio: ['pipe', 'inherit', 'inherit'], env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, CI: 'true', WRANGLER_SEND_METRICS: 'false' } });
child.stdin.end(process.env.PANDASCORE_API_TOKEN.trim());
child.on('error', () => { process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });
