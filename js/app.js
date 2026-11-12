/* ============================================================
   app.js — Router principal y arranque de la aplicación
   ============================================================ */

const App = (() => {
  const PRIMARY_VIEWS = ['hoy', 'plan', 'calorias', 'progreso', 'mas'];
  const VIEW_MODULES = {
    hoy: TodayView,
    plan: PlanView,
    calorias: CaloriesView,
    progreso: ProgressView,
    mas: MoreView,
    workout: WorkoutView,
    calculadora: CalculatorView,
    plancomidas: MealPlanView,
  };
  const HEADERS = {
    hoy: ['MiGymTrack', 'Tu progreso de hoy'],
    plan: ['Plan mensual', 'Organiza tus rutinas por día'],
    calorias: ['Calorías', 'Registro diario de comidas'],
    progreso: ['Progreso', 'Entreno, cuerpo y nutrición'],
    mas: ['Más', 'Ajustes, ejercicios y respaldo'],
    workout: ['Entrenamiento', ''],
    calculadora: ['Calculadora', 'Mantenimiento, déficit y superávit'],
    plancomidas: ['Plan de comidas', 'Tu semana de comidas y lista de compras'],
  };
  // sub-vistas: a qué pestaña principal regresa la flecha "atrás"
  const SUBVIEW_PARENT = { workout: 'hoy', calculadora: 'calorias', plancomidas: 'calorias' };

  let currentView = 'hoy';
  let currentParams = {};

  function navigate(viewName, params = {}) {
    // la antigua pestaña "Medidas" ahora vive dentro de Progreso
    if (viewName === 'medidas') { viewName = 'progreso'; params = { section: 'cuerpo' }; }
    if (typeof Modal !== 'undefined') Modal.close();
    currentView = viewName;
    currentParams = params;
    const root = document.getElementById('viewRoot');
    const mod = VIEW_MODULES[viewName];
    if (!mod) return;
    // en el entrenamiento la pantalla se mantiene encendida (si no lo apagas en Más)
    RestTimer.setWorkoutMode(viewName === 'workout');
    // las pantallas entran con animación solo al navegar (no en cada actualización de la misma pantalla)
    root.classList.add('anim-in');
    clearTimeout(navigate.animTimer);
    navigate.animTimer = setTimeout(() => root.classList.remove('anim-in'), 1100);
    mod.render(root, params);
    Theme.apply(viewName === 'workout' && params.date ? params.date : undefined);
    updateChrome();
    window.scrollTo(0, 0);
  }

  function updateChrome() {
    const [title, subtitle] = HEADERS[currentView] || ['MiGymTrack', ''];
    document.getElementById('headerTitle').textContent = title;
    document.getElementById('headerSubtitle').textContent = subtitle;

    const btnMore = document.getElementById('btnMore');
    const isSub = !PRIMARY_VIEWS.includes(currentView);
    const backTarget = SUBVIEW_PARENT[currentView] || 'hoy';
    btnMore.textContent = isSub ? '←' : '⚙️';
    btnMore.onclick = () => {
      if (isSub) navigate(backTarget);
      else navigate('mas');
    };

    RestTimer.showWidget();

    const activeTab = isSub ? backTarget : currentView;
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === activeTab);
    });
  }

  function initNav() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* modo archivo local: puede fallar, no pasa nada */ });
      });
    }
  }

  // avisa si hay una versión nueva publicada (solo con internet)
  function checkForUpdate() {
    const m = ((document.querySelector('script[src*="app.js"]') || {}).src || '').match(/v=(\d+)/);
    const running = m ? m[1] : null;
    if (!running || !navigator.onLine) return;
    fetch(`sw.js?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text()).then((txt) => {
      const l = txt.match(/migymtrack-v(\d+)/);
      if (!l || l[1] === running || document.getElementById('updateBanner')) return;
      const bar = Utils.el('div', { class: 'update-banner', id: 'updateBanner' }, [
        Utils.el('span', { text: '🆕 Hay una versión nueva de MiGymTrack' }),
      ]);
      const go = Utils.el('button', { class: 'btn-small', text: 'Actualizar' });
      go.addEventListener('click', async () => {
        go.disabled = true; go.textContent = '…';
        try {
          if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach((r) => r.unregister());
          if (window.caches) (await caches.keys()).forEach((k) => caches.delete(k));
        } catch (e) { /* igual se recarga */ }
        setTimeout(() => location.reload(), 300);
      });
      const close = Utils.el('button', { class: 'icon-btn', text: '✕', title: 'Más tarde' });
      close.addEventListener('click', () => bar.remove());
      bar.appendChild(Utils.el('div', { style: 'display:flex;align-items:center;gap:4px;flex:none;' }, [go, close]));
      document.body.appendChild(bar);
    }).catch(() => { /* sin conexión */ });
  }

  function init() {
    DB.ensureSeed();
    // pide al navegador (Safari incluido) que no borre los datos si hay poco espacio
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    Theme.init();
    initNav();
    // mientras haces scroll, el fondo animado se pausa: la pantalla se mueve fluida aunque el celular sea modesto
    let scrollT = null;
    window.addEventListener('scroll', () => {
      document.documentElement.classList.add('scrolling');
      clearTimeout(scrollT);
      scrollT = setTimeout(() => document.documentElement.classList.remove('scrolling'), 180);
    }, { passive: true });
    RestTimer.init();
    AutoBackup.init();
    navigate('hoy');
    registerServiceWorker();
    setTimeout(checkForUpdate, 3500);
  }

  return { navigate, init, get currentView() { return currentView; }, get currentParams() { return currentParams; } };
})();

document.addEventListener('DOMContentLoaded', App.init);
