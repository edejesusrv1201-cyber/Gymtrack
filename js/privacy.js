/* ============================================================
   privacy.js — Aviso de privacidad: qué se guarda, dónde y quién lo ve.
   Se abre desde Más y desde la tarjeta de la cuenta.
   ============================================================ */

const Privacy = (() => {
  const SECTIONS = [
    ['📱 En tu teléfono', [
      'Tus entrenos, comidas, medidas, rutinas, fotos y ajustes se guardan en este teléfono. Nada sale de aquí si tú no lo activas.',
      'No usamos publicidad, rastreadores ni vendemos datos.',
    ]],
    ['☁️ Cuenta y nube (opcional)', [
      'Si creas una cuenta, guardamos tu correo y una copia de tus datos (entrenos, comidas, medidas, rutinas y ajustes). Las fotos de progreso no se suben.',
      'La copia está protegida para que solo tu cuenta pueda leerla. Tu contraseña la gestiona el proveedor de acceso: nosotros nunca la vemos.',
      'Quien administra la app tiene acceso técnico al servidor. Solo miraría tus datos si hace falta para ayudarte con un problema, y contigo enterado.',
      'Puedes borrar tu cuenta y la copia cuando quieras: Más → ☁️ Cuenta y nube → «Borrar mi cuenta».',
    ]],
    ['🌍 Ranking (opcional)', [
      'Se publica el nombre que elijas, tu sexo (solo si lo indicas) y las mejores marcas de fuerza que se publiquen (peso × repeticiones). Es visible para todas las personas que usan el ranking.',
      'No se publican tus entrenos completos, comidas, medidas ni fotos. Puedes quitar tus marcas o tu usuario en Progreso → Ranking.',
    ]],
    ['🍽️ Búsqueda de alimentos', [
      'Al buscar un producto en internet solo se envía el texto que escribiste, a través de nuestro servidor, a Open Food Facts (una base de datos abierta). Al escanear un código de barras, solo viaja ese número.',
    ]],
    ['💬 Comentarios', [
      'Lo que escribes en «Enviar feedback» llega a quien administra la app, con tu nombre solo si lo pones y los datos del dispositivo solo si los marcas.',
    ]],
  ];

  function open() {
    const body = Utils.el('div', { class: 'privacy-body' });
    body.appendChild(Utils.el('p', { class: 'small', text: 'En pocas palabras: tus datos son tuyos, viven en tu teléfono y solo suben a la nube si creas una cuenta.' }));
    SECTIONS.forEach(([title, items]) => {
      const sec = Utils.el('div', { class: 'gd-sec' });
      sec.appendChild(Utils.el('div', { class: 'eyebrow', text: title }));
      const ul = Utils.el('ul', { class: 'gd-list' });
      items.forEach((t) => ul.appendChild(Utils.el('li', {}, [Utils.el('span', { text: t })])));
      sec.appendChild(ul);
      body.appendChild(sec);
    });
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:14px;', text: 'Si tienes dudas o quieres que borremos algo, escríbelo en Más → Enviar feedback.' }));
    Modal.open('🔒 Privacidad y datos', body);
  }

  // enlace pequeño para poner en otras pantallas
  function link(text) {
    const b = Utils.el('button', { type: 'button', class: 'link-btn small', text: text || '🔒 Privacidad y datos' });
    b.addEventListener('click', open);
    return b;
  }

  return { open, link };
})();
