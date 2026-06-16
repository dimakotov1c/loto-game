import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));

// извлечь блок LotoCore из index.html и выполнить его в песочнице
export function loadCore() {
  const html = readFileSync(path.join(here, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\/ === LOTO-CORE-START ===([\s\S]*?)\/\/ === LOTO-CORE-END ===/);
  if (!m) throw new Error('Маркеры LOTO-CORE не найдены в index.html');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  if (!ctx.LotoCore) throw new Error('LotoCore не определён');
  return ctx.LotoCore;
}

// детерминированный ГПСЧ для повторяемых тестов
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
