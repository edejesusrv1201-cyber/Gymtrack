// Revisión estática de MyGymTrack — sin dependencias.  Uso:  node tests/static.js
// Comprueba: sintaxis de cada JS, que todo script del index esté en el service worker,
// que las versiones (?v=N y CACHE_NAME) coincidan, y que manifest e íconos existan.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let fails = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { fails += 1; console.log(`  ✗ ${msg}`); };
const check = (cond, good, wrong) => (cond ? ok(good) : bad(wrong));

console.log('Sintaxis de los JS');
const jsFiles = [];
(function walk(dir) {
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach((d) => {
    const rel = path.posix.join(dir, d.name);
    if (d.isDirectory()) { if (!['supabase', 'icons', 'tests', 'node_modules', '.git'].includes(d.name)) walk(rel); } else if (d.name.endsWith('.js')) jsFiles.push(rel);
  });
})('js');
jsFiles.push('sw.js');
jsFiles.forEach((f) => { try { new vm.Script(read(f), { filename: f }); } catch (e) { bad(`${f}: ${e.message}`); } });
if (!fails) ok(`${jsFiles.length} archivos sin errores de sintaxis`);

console.log('Index y service worker');
const index = read('index.html');
const sw = read('sw.js');
const scripts = [...index.matchAll(/<script[^>]+src="([^"?]+)(?:\?v=(\d+))?"/g)].map((m) => ({ src: m[1], v: m[2] }));
scripts.forEach((s) => { if (!fs.existsSync(path.join(root, s.src))) bad(`FALTA el archivo ${s.src}`); });
if (scripts.every((s) => fs.existsSync(path.join(root, s.src)))) ok(`${scripts.length} scripts del index existen`);
const assets = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
scripts.forEach((s) => { if (!assets.includes(s.src)) bad(`${s.src} está en index.html pero no en el service worker (no funcionaría sin internet)`); });
assets.forEach((a) => { if (!fs.existsSync(path.join(root, a))) bad(`el service worker lista ${a} y no existe`); });
if (scripts.every((s) => assets.includes(s.src))) ok('todos los scripts del index están en el service worker');

console.log('Versiones');
const vs = new Set([...index.matchAll(/\?v=(\d+)/g)].map((m) => m[1]));
const cache = /CACHE_NAME\s*=\s*'migymtrack-v(\d+)'/.exec(sw);
check(vs.size === 1, `index.html usa una sola versión (v${[...vs][0]})`, `index.html mezcla versiones: ${[...vs].join(', ')}`);
check(cache && vs.has(cache[1]), `CACHE_NAME coincide (v${cache && cache[1]})`, 'CACHE_NAME no coincide con el ?v= del index');

console.log('Manifest e íconos');
try {
  const m = JSON.parse(read('manifest.json'));
  ok(`manifest válido («${m.name}»)`);
  (m.icons || []).forEach((i) => check(fs.existsSync(path.join(root, i.src.split('?')[0])), `ícono ${i.src}`, `FALTA el ícono ${i.src}`));
} catch (e) { bad(`manifest.json: ${e.message}`); }

console.log('Datos');
// el catálogo de alimentos: ids únicos y calorías coherentes con los macros
const ctx = { window: {}, console };
vm.createContext(ctx);
try {
  vm.runInContext(`${read('js/foodMore.js')}\n${read('js/foodDb.js').replace(/DB\./g, 'DBX.')}`.replace('const FoodMore', 'var FoodMore').replace('const FoodDB', 'var FoodDB'), Object.assign(ctx, { DBX: { getFoods: () => [], getSettings: () => ({}), getCalorieLog: () => ({}) } }));
  const foods = ctx.FoodDB.BUILTIN;
  const ids = foods.map((f) => f.id);
  check(new Set(ids).size === ids.length, `${foods.length} alimentos con ids únicos`, 'hay alimentos con id repetido');
  const odd = foods.filter((f) => { if (/cerveza|vino|licor/i.test(f.name)) return false; /* el alcohol aporta calorías sin macros */ const k = 4 * f.protein + 4 * f.carbs + 9 * f.fat; return f.kcal > 40 && Math.abs(k - f.kcal) / f.kcal > 0.3; });
  check(odd.length === 0, 'calorías coherentes con los macros (±30 %)', `calorías raras en: ${odd.map((f) => `${f.name} (${f.kcal} vs ${Math.round(4 * f.protein + 4 * f.carbs + 9 * f.fat)})`).join('; ')}`);
  const noPort = foods.filter((f) => !f.portions.length);
  if (noPort.length) console.log(`  · ${noPort.length} alimentos sin porción sugerida (solo informativo)`);
} catch (e) { bad(`no pude cargar el catálogo de alimentos: ${e.message}`); }

console.log(fails ? `\n✗ ${fails} problema(s)` : '\n✓ Todo en orden');
process.exit(fails ? 1 : 0);
