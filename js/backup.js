/* ============================================================
   backup.js — Respaldo con recordatorio. Guarda cuándo hiciste
   el último respaldo y te avisa en Hoy si pasa una semana.
   ============================================================ */

const Backup = (() => {
  const REMIND_DAYS = 7;

  const last = () => DB.getSettings().lastBackup || null;

  function mark() {
    const s = DB.getSettings();
    s.lastBackup = Utils.todayISO();
    DB.saveSettings(s);
  }

  // días desde el último respaldo (null = nunca)
  function daysSince() {
    const l = last();
    if (!l) return null;
    return Math.floor((Utils.parseISO(Utils.todayISO()) - Utils.parseISO(l)) / 86400000);
  }

  // ¿vale la pena avisar? (hay algo que perder y pasó una semana)
  function due() {
    const st = Gamify.computeStats();
    const hasData = st.sessions > 0 || st.foodDays > 0 || st.weighIns > 0;
    if (!hasData) return false;
    const d = daysSince();
    return d === null || d >= REMIND_DAYS;
  }

  // genera y guarda/comparte el archivo JSON
  async function run() {
    const data = DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const ok = await Utils.saveFile(blob, `migymtrack-backup-${Utils.todayISO()}.json`);
    if (ok !== false) mark();
    return ok !== false;
  }

  function label() {
    const d = daysSince();
    if (d === null) return 'Aún no has hecho un respaldo desde la app';
    if (d === 0) return 'Último respaldo: hoy ✓';
    return `Último respaldo: hace ${d} día${d === 1 ? '' : 's'}`;
  }

  return { last, mark, daysSince, due, run, label };
})();
