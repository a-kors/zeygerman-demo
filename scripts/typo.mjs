// Post-build typography: glue short Russian words to the next word with nbsp.
import fs from 'fs';
import path from 'path';

const SHORT = 'в|во|и|с|со|к|ко|о|об|у|а|я|на|не|ни|но|по|за|до|от|из|для|без|или|что|как|при|под|над|про|же|ли|бы';
const re = new RegExp(`(?<=^|[\\s(«">])(${SHORT})[ \\t\\r\\n]+(?=[^\\s<])`, 'giu');

function fixText(t) {
  return t.replace(re, (m, w) => `${w} `);
}

function processHtml(html) {
  const parts = html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/i);
  return parts.map((p) => (p.startsWith('<') ? p : fixText(p))).join('');
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) fs.writeFileSync(p, processHtml(fs.readFileSync(p, 'utf8')));
  }
}

walk(path.resolve('dist'));
