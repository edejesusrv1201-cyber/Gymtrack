/* ============================================================
   modal.js — hoja modal genérica (bottom sheet) reutilizada
   por todas las vistas para formularios rápidos.
   Se abre con un resorte y se cierra deslizándose hacia abajo
   (si las animaciones de menús están activadas).
   ============================================================ */

const Modal = (() => {
  let backdrop = null;

  const animated = () => document.documentElement.dataset.ui === 'on';

  // quita al instante cualquier ventana que se esté cerrando
  function clearClosing() {
    document.querySelectorAll('.modal-backdrop.closing').forEach((n) => n.remove());
  }

  function close() {
    if (!backdrop) return;
    const node = backdrop;
    backdrop = null;
    if (animated()) {
      node.classList.add('closing');
      setTimeout(() => node.remove(), 230);
    } else {
      node.remove();
    }
  }

  function open(title, bodyNode, opts = {}) {
    // reemplaza la ventana actual sin animar (evita parpadeos al encadenar menús)
    if (backdrop) { backdrop.remove(); backdrop = null; }
    clearClosing();
    backdrop = Utils.el('div', { class: 'modal-backdrop' });
    const sheet = Utils.el('div', { class: 'modal-sheet' });
    const header = Utils.el('div', { class: 'modal-title' }, [
      Utils.el('h3', { text: title }),
      Utils.el('button', { class: 'icon-btn', text: '✕', onclick: () => { close(); if (opts.onClose) opts.onClose(); } }),
    ]);
    sheet.appendChild(header);
    sheet.appendChild(bodyNode);
    backdrop.appendChild(sheet);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && opts.dismissOnBackdrop !== false) {
        close();
        if (opts.onClose) opts.onClose();
      }
    });
    document.body.appendChild(backdrop);
    return { close };
  }

  return { open, close };
})();
