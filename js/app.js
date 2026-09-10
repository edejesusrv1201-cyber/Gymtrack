/* ============================================================
   app.js — Router principal y arranque de la aplicación
   ============================================================ */

const App = (() => {
  const PRIMARY_VIEWS = ['hoy', 'plan', 'calorias', 'medidas', 'mas'];
  const VIEW_MODULES = {
    hoy: TodayView,
    plan: PlanView,
    calorias: CaloriesView,
    medidas: MeasurementsView,
    mas: MoreView,
    workout: WorkoutView,
    calculadora: CalculatorView,
  };
  const HEADERS = {
    hoy: ['MiGymTrack', 'Tu progreso de hoy'],
    plan: ['Plan mensual', 'Organiza tus rutinas por día'],
    calorias: ['Calorías', 'Registro diario de comidas'],
    medidas: ['Medidas', 'Peso y medidas corporales'],
    mas: ['Más', 'Ajustes, ejercicios y respaldo'],
    workout: ['Entrenamiento', ''],
    calculadora: ['Calculadora', 'Mantenimiento, déficit y superávit'],
  };
  // sub-vistas: a qué pestaña principal regresa la flecha "atrás"
  const SUBVIEW_PARENT = { workout: 'hoy', calculadora: 'calorias' };

  let currentView = 'hoy';
  let currentParams = {};

  function navigate(viewName, params = {}) {
    currentView = viewName;
    currentParams = params;
    const root = document.getElementById('viewRoot');
    const mod = VIEW_MODULES[viewName];
    if (!mod) return;
    mod.render(root, params);
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

  function init() {
    DB.ensureSeed();
    initNav();
    RestTimer.init();
    navigate('hoy');
    registerServiceWorker();
  }

  return { navigate, init, get currentView() { return currentView; }, get currentParams() { return currentParams; } };
})();

document.addEventListener('DOMContentLoaded', App.init);
