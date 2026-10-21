import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import nextEnv from '@next/env';

export function containsSecret(content, env = {}) {
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_API_KEY', 'CRON_SECRET']) {
    if (env[name] && env[name].length >= 8 && content.includes(env[name])) return true;
  }
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(content)) return true;
  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString()).role === 'service_role') return true; } catch {}
  }
  return false;
}
export function scanDirectory(directory, env = {}) {
  if (!fs.existsSync(directory)) throw new Error('Client build directory is missing');
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) count += scanDirectory(file, env);
    else if (/\.(js|json|html|css|map)$/.test(entry.name)) {
      count++;
      if (containsSecret(fs.readFileSync(file, 'utf8'), env)) throw new Error(`Server credential detected in ${file}`);
    }
  }
  return count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    nextEnv.loadEnvConfig(process.cwd(), false);
    const count = scanDirectory(path.join(process.cwd(), '.next/static'), process.env);
    if (!count) throw new Error('Client build contains no scannable files');
    const sw = path.join(process.cwd(), 'public/sw.js');
    if (fs.existsSync(sw) && containsSecret(fs.readFileSync(sw, 'utf8'), process.env)) throw new Error('Server credential detected in service worker');
    console.log(`[Security Guard] ${count} client files checked.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
