// cleanup-migrated.mjs
// Elimina del index.html los cuerpos de funciones marcadas [MIGRADO]
// Reemplaza cada función migrada por un stub vacío de una línea

import { readFileSync, writeFileSync } from 'fs';

const FILE = new URL('../index.html', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let html   = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n'); // normalize CRLF → LF
const orig = html.length;

// Cuenta las llaves para encontrar el final del cuerpo de una función
function findFunctionEnd(src, startIdx) {
  let depth = 0, i = startIdx, inStr = false, strChar = '', inLineComment = false, inBlockComment = false;
  while (i < src.length) {
    const ch = src[i];
    const nx = src[i+1];
    if (inLineComment)  { if (ch === '\n') inLineComment = false; i++; continue; }
    if (inBlockComment) { if (ch === '*' && nx === '/') { inBlockComment = false; i += 2; continue; } i++; continue; }
    if (inStr)          { if (ch === '\\') { i += 2; continue; } if (ch === strChar) inStr = false; i++; continue; }
    if ((ch === '"' || ch === "'" || ch === '`') && !inStr) { inStr = true; strChar = ch; i++; continue; }
    if (ch === '/' && nx === '/') { inLineComment = true;  i += 2; continue; }
    if (ch === '/' && nx === '*') { inBlockComment = true; i += 2; continue; }
    if (ch === '{') { depth++; }
    if (ch === '}') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

// Buscar todas las marcas [MIGRADO] seguidas de una declaración de función/const/let/var/async
// Matches: // [MIGRADO...] optional extra text
//          optional more comment lines
//          function/const/let/var/async declaration
const MIGRADO_RE = /\/\/ \[MIGRADO[^\n]*\n((?:\/\/[^\n]*\n)*)((?:async\s+)?function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function|\w+\s*=\s*(?:async\s+)?function)/g;

let removed = 0;
let match;
const removals = []; // [start, end] pairs to remove

// Collect all ranges to remove
while ((match = MIGRADO_RE.exec(html)) !== null) {
  const markerStart = match.index;
  // Find the opening brace of the function
  const braceIdx = html.indexOf('{', match.index + match[0].length);
  if (braceIdx === -1) continue;
  const funcEnd = findFunctionEnd(html, braceIdx);
  if (funcEnd === -1) continue;
  // Include trailing newline if present
  const endIdx = funcEnd + 1 + (html[funcEnd+1] === '\n' ? 1 : 0);
  removals.push([markerStart, endIdx]);
  removed++;
}

// Apply removals in reverse order to preserve indices
removals.sort((a, b) => b[0] - a[0]);
for (const [start, end] of removals) {
  html = html.slice(0, start) + html.slice(end);
}

writeFileSync(FILE, html, 'utf8');
const saved = orig - html.length;
console.log(`✅ Eliminadas ${removed} funciones migradas — ${(saved/1024).toFixed(1)} KB ahorrados`);
console.log(`   Original: ${(orig/1024).toFixed(1)} KB → Nuevo: ${(html.length/1024).toFixed(1)} KB`);
