import { build, context } from 'esbuild';

const options = {
  entryPoints: ['src/extension/background.js', 'src/extension/content.js'],
  outdir: 'dist', bundle: true, format: 'iife', target: 'chrome120', logLevel: 'info'
};
if (process.argv.includes('--watch')) {
  const watcher = await context(options);
  await watcher.watch();
} else await build(options);
