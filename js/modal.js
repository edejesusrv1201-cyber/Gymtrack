/* ============================================================
   modal.js — hoja modal genérica (bottom sheet) reutilizada
   por todas las vistas para formularios rápidos.
   ============================================================ */

const Modal = (() => {
  let backdrop = null;

  function close() {
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
  }

  function open(title, bodyNode, opts = {}) {
    close();
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
