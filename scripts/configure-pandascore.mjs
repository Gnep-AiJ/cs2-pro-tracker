import { readFile, writeFile } from 'node:fs/promises';
// Read the credential from stdin so it never appears in command-line arguments.
process.stdout.write('Ready for PandaScore credential on stdin (not echoed).\n');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 512) throw new Error('Invalid credential');
  if (!/[\r\n]/.test(input)) continue;
  const token = input.trim();
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(token)) throw new Error('Invalid credential');
  const path = new URL('../.env.local', import.meta.url);
  const original = await readFile(path, 'utf8');
  const line = `PANDASCORE_API_TOKEN=${token}`;
  const updated = /^PANDASCORE_API_TOKEN=.*$/m.test(original) ? original.replace(/^PANDASCORE_API_TOKEN=.*$/m, line) : `${original.trimEnd()}\n${line}\n`;
  await writeFile(path, updated, 'utf8');
  process.stdout.write('PandaScore configured in ignored server environment.\n');
  process.exit(0);
  break;
}
