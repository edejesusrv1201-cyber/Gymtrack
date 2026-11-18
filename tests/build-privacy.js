// Genera privacy.html (política de privacidad pública, para las tiendas) a partir del texto de js/privacy.js.
// Uso:  node tests/build-privacy.js     (corre otra vez cada vez que cambies js/privacy.js)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let src = fs.readFileSync(path.join(root, 'js/privacy.js'), 'utf8');
src = src.replace(/^const Privacy/m, 'var Privacy');
const ctx = { Utils: {}, Modal: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const SECTIONS = ctx.Privacy.SECTIONS;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>Privacidad · MyGymTrack</title>
<style>
  :root{color-scheme:light dark;--bg:#f5f6fa;--fg:#161a26;--dim:#5b6278;--card:#fff;--line:#e1e4ee;--accent:#e8502e}
  @media (prefers-color-scheme:dark){:root{--bg:#090b10;--fg:#eef0f7;--dim:#9aa2b8;--card:#141824;--line:#262c3d;--accent:#ff8c46}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  main{max-width:720px;margin:0 auto;padding:24px 16px 56px}
  h1{font-size:26px;margin:0 0 4px}
  h2{font-size:18px;margin:0 0 8px}
  .sub{color:var(--dim);margin:0 0 20px}
  section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:0 0 12px}
  ul{margin:0;padding-left:20px}
  li{margin:6px 0}
  a{color:var(--accent)}
  footer{color:var(--dim);font-size:14px;margin-top:20px}
</style>
</head>
<body>
<main>
  <h1>🔒 Privacidad y datos</h1>
  <p class="sub">MyGymTrack · Última actualización: ${new Date().toISOString().slice(0, 10)}</p>
  <p>En pocas palabras: tus datos son tuyos, viven en tu teléfono y solo suben a la nube si creas una cuenta.</p>
${SECTIONS.map(([t, items]) => `  <section>\n    <h2>${esc(t)}</h2>\n    <ul>\n${items.map((i) => `      <li>${esc(i)}</li>`).join('\n')}\n    </ul>\n  </section>`).join('\n')}
  <section>
    <h2>🧒 Menores de edad</h2>
    <ul><li>MyGymTrack no está dirigida a menores de 13 años y no recopila datos de ellos a propósito.</li></ul>
  </section>
  <section>
    <h2>📬 Contacto y cambios</h2>
    <ul>
      <li>Para preguntas o para pedir que borremos tus datos: en la app, Más → Enviar feedback. También puedes borrar tu cuenta tú mismo en Más → Cuenta y nube.</li>
      <li>Si esta política cambia, la fecha de arriba se actualiza.</li>
    </ul>
  </section>
  <footer><a href="./">← Abrir MyGymTrack</a></footer>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'privacy.html'), html);
console.log('privacy.html generado con', SECTIONS.length, 'secciones');
