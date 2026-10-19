// Folds the standalone build into one HTML file that opens from disk (file://) without a server.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'dist-standalone';
let html = readFileSync(`${dir}/index.html`, 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => `<style>${readFileSync(dir + href, 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_, src) => {
  const js = readFileSync(dir + src, 'utf8').replace(/<\/script/g, '<\\/script');
  return `<script type="module">${js}</script>`;
});
writeFileSync(`${dir}/radial-file-wheel.html`, html);
console.log(`${dir}/radial-file-wheel.html (${Math.round(html.length / 1024)} kB)`);
