import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const children = [
  spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--watch'], { stdio: 'inherit', env: { ...process.env, EXTENSION_WATCH: '1' } }),
  spawn(process.execPath, ['scripts/extension.mjs', '--watch'], { stdio: 'inherit' })
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
children.forEach(child => {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
});
console.log('Watching source → dist/. Sau khi sửa: Reload extension và tải lại tab OpenAI.');
