// The demo command (npm start): builds the React app if needed, then runs the server,
// which serves the app and the API together on one port.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builtPage = path.join(root, 'client', 'dist', 'index.html');
const sources = [
  path.join(root, 'client', 'src'),
  path.join(root, 'client', 'public'),
  path.join(root, 'client', 'index.html'),
];

function newestChange(target) {
  const stats = fs.statSync(target);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return fs
    .readdirSync(target)
    .reduce((newest, name) => Math.max(newest, newestChange(path.join(target, name))), 0);
}

function buildIsCurrent() {
  if (!fs.existsSync(builtPage)) return false;
  const builtAt = fs.statSync(builtPage).mtimeMs;
  return sources.every((source) => newestChange(source) <= builtAt);
}

if (!buildIsCurrent()) {
  console.log('Building the React app. This takes a few seconds and only happens after changes...');
  const build = spawnSync('npm', ['run', 'build', '-w', 'client'], { cwd: root, stdio: 'inherit', shell: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, [path.join('server', 'src', 'server.js')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

server.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
