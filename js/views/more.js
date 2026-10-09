/* ============================================================
   views/more.js — Ajustes, catálogo de ejercicios y respaldo (récords y estadísticas viven en Progreso)
   ============================================================ */

const MoreView = (() => {
  const GROUPS = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];

  // ---------- personalización del fondo ----------
  function buildThemeCard() {
    const card = Utils.el('div', { class: 'card' });
    const cfg = Theme.settings();
    const res = Theme.resolve();

    function save(patch) {
      const s = DB.getSettings();
      Object.assign(s, patch);
      DB.saveSettings(s);
      Theme.apply();
      card.replaceWith(buildThemeCard());
    }

    card.appendChild(Utils.el('h3', { text: '🎨 Personalización' }));
    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin-bottom:8px;', text: 'Fondo' }));
    card.appendChild(Utils.segmented(
      [{ key: 'auto', label: 'Color del día' }, { key: 'fijo', label: 'Color fijo' }],
      cfg.mode,
      (k) => save({ themeMode: k }),
      true,
    ));

    // qué está mostrando ahora
    const now = Utils.el('div', { class: 'theme-now' });
    now.appendChild(Utils.el('div', { class: 'blobs' }, res.colors.map((c) => Utils.el('i', { style: `background:${c}` }))));
    let nowText;
    if (cfg.mode !== 'auto') nowText = `Fijo: ${cfg.preset.label}.`;
    else if (res.source === 'rutina') nowText = `Hoy toca ${res.routine.name}: el fondo toma su color.`;
    else if (res.source === 'descanso') nowText = 'Hoy es descanso: fondo azul calmado.';
    else nowText = `Hoy no hay rutina: usa el color base (${cfg.preset.label}).`;
    now.appendChild(Utils.el('span', { text: nowText }));
    card.appendChild(now);

    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin-bottom:8px;', text: `${cfg.mode === 'auto' ? 'Color base (cuando no hay rutina)' : 'Color'} · ${cfg.preset.label}` }));
    const swatches = Utils.el('div', { class: 'swatches' });
    Theme.PRESETS.forEach((p) => {
      const b = Utils.el('button', {
        class: 'swatch' + (p.key === cfg.preset.key ? ' active' : ''),
        type: 'button',
        title: p.label,
        'aria-label': p.label,
        style: `background:linear-gradient(135deg,${p.colors[0]},${p.colors[1]} 60%,${p.colors[2]});`,
      });
      b.addEventListener('click', () => save({ themePreset: p.key }));
      swatches.appendChild(b);
    });
    card.appendChild(swatches);

    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin-bottom:8px;', text: 'Intensidad del brillo' }));
    card.appendChild(Utils.segmented(
      [{ key: 'suave', label: 'Suave' }, { key: 'media', label: 'Media' }, { key: 'intensa', label: 'Intensa' }],
      cfg.intensity,
      (k) => save({ themeIntensity: k }),
      true,
    ));

    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:6px 0 8px;', text: 'Efecto lava (fondo en movimiento)' }));
    card.appendChild(Utils.segmented(
      [{ key: 'lava', label: 'Activado' }, { key: 'quieto', label: 'Quieto' }],
      cfg.motion,
      (k) => save({ themeMotion: k }),
      true,
    ));
    if (Theme.reducedMotion() && DB.getSettings().themeMotion !== 'lava') {
      card.appendChild(Utils.el('p', { class: 'small', style: 'margin-top:-4px;', text: 'Tu teléfono pide reducir animaciones, por eso viene quieto. Toca "Activado" para ver la lava.' }));
    }

    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:6px 0 8px;', text: 'Botones y detalles' }));
    card.appendChild(Utils.segmented(
      [{ key: 'tema', label: 'Color del fondo' }, { key: 'app', label: 'Naranja' }],
      cfg.accent,
      (k) => save({ themeAccent: k }),
      true,
    ));

    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:6px 0 8px;', text: 'Celebrar récords 🎆' }));
    card.appendChild(Utils.segmented(
      [{ key: 'on', label: 'Activada' }, { key: 'off', label: 'Desactivada' }],
      Celebrate.enabled() ? 'on' : 'off',
      (k) => save({ celebrate: k === 'on' }),
      true,
    ));
    const testBtn = Utils.el('button', { class: 'btn-secondary', text: '🎆 Ver la animación' });
    testBtn.addEventListener('click', () => Celebrate.preview());
    card.appendChild(testBtn);
    card.appendChild(Utils.el('p', { class: 'small mt-8', text: Celebrate.reducedMotion() && DB.getSettings().celebrate !== true ? 'Tu teléfono pide reducir animaciones, así que solo verás el aviso. Toca "Activada" para ver también los fuegos artificiales.' : 'Se activa al romper tu marca de peso, repeticiones o, en cardio, tiempo o distancia.' }));
    return card;
  }

  // ---------- cómo instalar la app ----------
  function buildInstallCard() {
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('h3', { text: '📲 Instalar en tu celular' }));
    if (Utils.isStandalone()) {
      card.appendChild(Utils.el('p', { text: '✅ Ya la tienes instalada: estás usando MiGymTrack como app.' }));
    }
    const step = (title, lines) => Utils.el('div', { style: 'margin-top:10px;' }, [
      Utils.el('div', { class: 'eyebrow', text: title }),
      Utils.el('p', { class: 'mt-8', text: lines }),
    ]);
    card.appendChild(step('iPhone / iPad (Safari)', '1) Abre la página en Safari. 2) Toca el botón Compartir (el cuadrado con la flecha hacia arriba). 3) Elige "Añadir a pantalla de inicio" y toca Añadir.'));
    card.appendChild(step('Android (Chrome)', 'Toca el menú ⋮ y elige "Instalar app" o "Añadir a pantalla de inicio".'));
    card.appendChild(Utils.el('p', { class: 'small', style: 'margin-top:10px;', text: 'Importante: la app instalada guarda sus datos aparte de los del navegador. Si ya la usabas en el navegador, exporta tu respaldo aquí abajo e impórtalo en la app instalada.' }));
    return card;
  }

  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();

    view.appendChild(buildThemeCard());
    view.appendChild(buildInstallCard());

    // ---- ajustes ----
    const settingsCard = Utils.el('div', { class: 'card' });
    settingsCard.appendChild(Utils.el('h3', { text: '⚙️ Ajustes' }));

    const unitsSel = Utils.el('select', {});
    ['kg', 'lb'].forEach((u) => unitsSel.appendChild(Utils.el('option', { value: u, text: u, selected: u === settings.units ? 'selected' : null })));
    unitsSel.value = settings.units;
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Ver los pesos en' }), unitsSel]));
    settingsCard.appendChild(Utils.el('p', { class: 'small', style: 'margin:-4px 0 12px;', text: 'Al registrar una serie o tu peso puedes escribirlo en kg o lb (botón junto al campo, útil según la máquina). Aquí eliges en qué unidad se muestra todo; los datos se guardan siempre en kg.' }));

    const restInput = Utils.el('input', { type: 'number', value: settings.restDefault });
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Descanso por defecto entre series (segundos)' }), restInput]));

    const kcalInput = Utils.el('input', { type: 'number', value: settings.calorieGoal });
    const proteinInput = Utils.el('input', { type: 'number', value: settings.proteinGoal });
    const carbInput = Utils.el('input', { type: 'number', value: settings.carbGoal });
    const fatInput = Utils.el('input', { type: 'number', value: settings.fatGoal });
    const waterInput = Utils.el('input', { type: 'number', value: settings.waterGoalMl || 2500 });
    const setsMinInput = Utils.el('input', { type: 'number', value: settings.weeklySetsMin || 10 });
    const setsMaxInput = Utils.el('input', { type: 'number', value: settings.weeklySetsMax || 20 });
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Meta de calorías diarias (kcal)' }), kcalInput]));
    settingsCard.appendChild(Utils.el('div', { class: 'grid-3' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Proteína (g)' }), proteinInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Carbos (g)' }), carbInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grasas (g)' }), fatInput]),
    ]));
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Meta de agua diaria (ml)' }), waterInput]));
    settingsCard.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:6px 0 6px;', text: 'Series por semana en cada grupo muscular' }));
    settingsCard.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Mínimo' }), setsMinInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Máximo' }), setsMaxInput]),
    ]));

    const saveSettingsBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Guardar ajustes' });
    saveSettingsBtn.addEventListener('click', () => {
      const s = DB.getSettings();
      Object.assign(s, {
        units: unitsSel.value,
        restDefault: Number(restInput.value) || 90,
        calorieGoal: Number(kcalInput.value) || 2500,
        proteinGoal: Number(proteinInput.value) || 150,
        carbGoal: Number(carbInput.value) || 280,
        fatGoal: Number(fatInput.value) || 70,
        waterGoalMl: Number(waterInput.value) || 2500,
        weeklySetsMin: Math.max(1, Number(setsMinInput.value) || 10),
        weeklySetsMax: Math.max(Number(setsMinInput.value) || 10, Number(setsMaxInput.value) || 20),
        onboarded: true,
      });
      DB.saveSettings(s);
      Utils.toast('Ajustes guardados');
    });
    settingsCard.appendChild(saveSettingsBtn);
    view.appendChild(settingsCard);

    // ---- catálogo de ejercicios ----
    const exCard = Utils.el('div', { class: 'card' });
    exCard.appendChild(Utils.el('div', { class: 'flex-between' }, [
      Utils.el('h3', { class: 'mb-0', text: '🏋️ Catálogo de ejercicios' }),
    ]));
    const exList = Utils.el('div', { class: 'mt-8' });
    function refreshExList() {
      exList.innerHTML = '';
      DB.getExercises().forEach((ex) => {
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: ex.name }),
            Utils.el('div', { class: `meta grp-${ex.group}`, text: ex.group }),
          ]),
          Utils.el('button', { class: 'icon-btn', text: '🗑️' }),
        ]);
        row.querySelector('button').addEventListener('click', () => {
          if (!Utils.confirmDialog(`¿Eliminar "${ex.name}" del catálogo? Tu historial ya registrado se conserva.`)) return;
          DB.saveExercises(DB.getExercises().filter((x) => x.id !== ex.id));
          refreshExList();
        });
        exList.appendChild(row);
      });
    }
    refreshExList();
    exCard.appendChild(exList);

    const newNameInput = Utils.el('input', { type: 'text', placeholder: 'Nombre del ejercicio' });
    const newGroupSel = Utils.el('select', {});
    GROUPS.forEach((g) => newGroupSel.appendChild(Utils.el('option', { value: g, text: g })));
    exCard.appendChild(Utils.el('div', { class: 'field-row mt-8' }, [
      Utils.el('div', { class: 'field' }, [newNameInput]),
      Utils.el('div', { class: 'field', style: 'max-width:110px;' }, [newGroupSel]),
    ]));
    const addExBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '➕ Agregar ejercicio' });
    addExBtn.addEventListener('click', () => {
      if (!newNameInput.value.trim()) return;
      const exercises = DB.getExercises();
      exercises.push({ id: DB.uid(), name: newNameInput.value.trim(), group: newGroupSel.value });
      DB.saveExercises(exercises);
      newNameInput.value = '';
      refreshExList();
    });
    exCard.appendChild(addExBtn);
    view.appendChild(exCard);

    // ---- respaldo ----
    const backupCard = Utils.el('div', { class: 'card' });
    backupCard.appendChild(Utils.el('h3', { text: '💾 Copia de seguridad' }));
    backupCard.appendChild(Utils.el('p', { text: 'Tus datos viven solo en este celular/navegador. Exporta un archivo de respaldo de vez en cuando por si cambias de teléfono o borras el navegador.' }));

    const exportBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '⬇️ Exportar mis datos (.json)' });
    exportBtn.addEventListener('click', () => {
      const data = DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      Utils.saveFile(blob, `migymtrack-backup-${Utils.todayISO()}.json`);
    });
    backupCard.appendChild(exportBtn);

    const importLabel = Utils.el('label', { class: 'btn-secondary btn-block mt-8', style: 'display:block;text-align:center;', text: '⬆️ Importar respaldo (.json)' });
    const importInput = Utils.el('input', { type: 'file', accept: 'application/json', class: 'hidden' });
    importLabel.appendChild(importInput);
    importInput.addEventListener('change', () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Utils.confirmDialog('Esto reemplazará tus datos actuales con los del respaldo. ¿Continuar?')) return;
          DB.importAll(data);
          Utils.toast('Datos restaurados');
          render(root);
        } catch (e) {
          Utils.toast('El archivo no es un respaldo válido');
        }
      };
      reader.readAsText(file);
    });
    backupCard.appendChild(importLabel);

    const exportXlsxBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: '📊 Exportar reporte en Excel (.xlsx)' });
    exportXlsxBtn.addEventListener('click', () => {
      try {
        ExcelBackup.exportAll();
      } catch (e) {
        console.error('Error exportando a Excel', e);
        Utils.toast('No se pudo generar el Excel');
      }
    });
    backupCard.appendChild(exportXlsxBtn);

    const importXlsxLabel = Utils.el('label', { class: 'btn-secondary btn-block mt-8', style: 'display:block;text-align:center;', text: '📊 Importar Excel (.xlsx)' });
    const importXlsxInput = Utils.el('input', { type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', class: 'hidden' });
    importXlsxLabel.appendChild(importXlsxInput);
    importXlsxInput.addEventListener('change', () => {
      const file = importXlsxInput.files[0];
      if (!file) return;
      if (!Utils.confirmDialog('Esto reemplazará tus datos actuales con los del Excel. ¿Continuar?')) { importXlsxInput.value = ''; return; }
      ExcelBackup.importFile(file, () => {
        Utils.toast('Datos restaurados desde Excel');
        render(root);
      }, () => {
        Utils.toast('El archivo no es un respaldo de Excel válido');
        importXlsxInput.value = '';
      });
    });
    backupCard.appendChild(importXlsxLabel);
    backupCard.appendChild(Utils.el('p', { class: 'small mt-8', text: 'El Excel trae un resumen con tus métricas (volumen, grupos musculares, récords, nutrición, cuerpo), tu historial de series, un mapa de constancia y más. También guarda tus datos en hojas ocultas, así que sirve igual para pasarlos a otro celular con "Importar Excel".' }));

    if (Utils.isIOS()) {
      backupCard.appendChild(Utils.el('p', { class: 'small', text: 'En iPhone se abre la hoja Compartir: elige "Guardar en Archivos" (o envíatelo por correo/WhatsApp). Para restaurar, usa "Importar" y escoge ese archivo.' }));
    }

    const wipeBtn = Utils.el('button', { class: 'btn-danger btn-block mt-8', text: '🗑️ Borrar todos los datos' });
    wipeBtn.addEventListener('click', () => {
      if (!Utils.confirmDialog('Esto borrará TODOS tus registros de esta app permanentemente. ¿Seguro?')) return;
      DB.wipeAll();
      DB.ensureSeed();
      Utils.toast('Datos borrados');
      render(root);
    });
    backupCard.appendChild(wipeBtn);
    view.appendChild(backupCard);

    // ---- acerca de ----
    const aboutCard = Utils.el('div', { class: 'card' });
    aboutCard.appendChild(Utils.el('h3', { text: 'ℹ️ Acerca de MiGymTrack' }));
    aboutCard.appendChild(Utils.el('p', { text: 'App personal para llevar tu progreso de gym: rutinas mensuales, series normales, aproximaciones y dropsets, cardio, calentamiento, cronómetro de descanso, calorías, agua y medidas, con métricas y gráficas de progreso por semana, grupo muscular y ejercicio. Todo se guarda localmente en tu celular.' }));
    // versión en uso y botón para forzar la actualización (por si el celular guarda la versión vieja)
    const running = ((document.querySelector('script[src*="app.js"]') || {}).src || '').match(/v=(\d+)/);
    const runningV = running ? running[1] : '?';
    const verLine = Utils.el('p', { class: 'small', style: 'margin:10px 0 8px;', text: `Versión en uso: v${runningV}` });
    const updBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '🔄 Buscar actualización' });
    updBtn.addEventListener('click', async () => {
      updBtn.disabled = true;
      updBtn.textContent = 'Buscando…';
      try {
        const txt = await fetch(`sw.js?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
        const m = txt.match(/migymtrack-v(\d+)/);
        const latest = m ? m[1] : null;
        if (latest && latest === runningV) {
          verLine.textContent = `Versión en uso: v${runningV} · ya tienes la más reciente ✓`;
          updBtn.textContent = '🔄 Buscar actualización';
          updBtn.disabled = false;
          return;
        }
        // hay una versión nueva (o no se pudo saber): limpia lo guardado y recarga. Tus datos no se tocan.
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) { /* sin internet: solo recarga */ }
      location.reload();
    });
    aboutCard.appendChild(verLine);
    aboutCard.appendChild(updBtn);
    view.appendChild(aboutCard);

    root.appendChild(view);
  }

  return { render };
})();
