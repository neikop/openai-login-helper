import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync } from 'fflate';

const files = {};
async function collect(dir, relative = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const key = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collect(join(dir, entry.name), key);
    else if (entry.isFile()) files[`openai-login-helper/${key}`] = new Uint8Array(await readFile(join(dir, entry.name)));
  }
}
await collect('dist');
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
for (const name of ['README.md']) files[`openai-login-helper/${name}`] = new Uint8Array(await readFile(name));
await mkdir('artifacts', { recursive: true });
const output = `artifacts/openai-login-helper-${manifest.version}.zip`;
await writeFile(output, zipSync(files, { level: 6 }));
console.log(`Created ${output}`);
