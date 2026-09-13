/* ============================================================
   views/more.js — Ajustes, catálogo de ejercicios y respaldo
   ============================================================ */

const MoreView = (() => {
  const GROUPS = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];

  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();

    // ---- ajustes ----
    const settingsCard = Utils.el('div', { class: 'card' });
    settingsCard.appendChild(Utils.el('h3', { text: '⚙️ Ajustes' }));

    const unitsSel = Utils.el('select', {});
    ['kg', 'lb'].forEach((u) => unitsSel.appendChild(Utils.el('option', { value: u, text: u, selected: u === settings.units ? 'selected' : null })));
    unitsSel.value = settings.units;
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Unidad de peso' }), unitsSel]));

    const restInput = Utils.el('input', { type: 'number', value: settings.restDefault });
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Descanso por defecto entre series (segundos)' }), restInput]));

    const kcalInput = Utils.el('input', { type: 'number', value: settings.calorieGoal });
    const proteinInput = Utils.el('input', { type: 'number', value: settings.proteinGoal });
    const carbInput = Utils.el('input', { type: 'number', value: settings.carbGoal });
    const fatInput = Utils.el('input', { type: 'number', value: settings.fatGoal });
    const waterInput = Utils.el('input', { type: 'number', value: settings.waterGoalMl || 2500 });
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Meta de calorías diarias (kcal)' }), kcalInput]));
    settingsCard.appendChild(Utils.el('div', { class: 'grid-3' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Proteína (g)' }), proteinInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Carbos (g)' }), carbInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grasas (g)' }), fatInput]),
    ]));
    settingsCard.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Meta de agua diaria (ml)' }), waterInput]));

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

    // ---- récords personales ----
    const recordsCard = Utils.el('div', { class: 'card' });
    recordsCard.appendChild(Utils.el('h3', { text: '🏆 Récords personales' }));
    const recordRows = DB.getExercises()
      .map((ex) => ({ ex, rec: WorkoutView.exerciseRecords(ex.id, ex.group === 'cardio') }))
      .filter((r) => r.rec)
      .sort((a, b) => a.ex.name.localeCompare(b.ex.name));
    if (recordRows.length === 0) {
      recordsCard.appendChild(Utils.el('p', { text: 'Aún no tienes marcas registradas. En cuanto anotes series de un ejercicio, tu récord (máximo y mínimo) aparecerá aquí y como guía cuando vayas a entrenarlo.' }));
    } else {
      recordRows.forEach(({ ex, rec }) => {
        const isCardio = ex.group === 'cardio';
        recordsCard.appendChild(Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: ex.name }),
            Utils.el('div', { class: `meta grp-${ex.group}`, text: ex.group }),
          ]),
          Utils.el('div', { style: 'text-align:right;' }, [
            Utils.el('div', { style: 'font-weight:700;color:var(--accent);', text: WorkoutView.formatRecordSet(rec.max.set, isCardio, settings.units) }),
            Utils.el('div', { class: 'meta', text: Utils.friendlyDate(rec.max.date) }),
          ]),
        ]));
      });
    }
    view.appendChild(recordsCard);

    // ---- respaldo ----
    const backupCard = Utils.el('div', { class: 'card' });
    backupCard.appendChild(Utils.el('h3', { text: '💾 Copia de seguridad' }));
    backupCard.appendChild(Utils.el('p', { text: 'Tus datos viven solo en este celular/navegador. Exporta un archivo de respaldo de vez en cuando por si cambias de teléfono o borras el navegador.' }));

    const exportBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '⬇️ Exportar mis datos (.json)' });
    exportBtn.addEventListener('click', () => {
      const data = DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `migymtrack-backup-${Utils.todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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

    const exportXlsxBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: '📊 Exportar a Excel (.xlsx)' });
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
    backupCard.appendChild(Utils.el('p', { class: 'small mt-8', text: 'El Excel trae todos tus datos en varias hojas (rutinas, series, medidas, calorías...). Útil para revisarlos o para pasarlos a otro celular igual que el respaldo .json.' }));

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
    aboutCard.appendChild(Utils.el('p', { text: 'App personal para llevar tu progreso de gym: rutinas mensuales, registro de series (peso/reps o duración/distancia para cardio), calentamiento dinámico, cronómetro de descanso, calorías, agua y medidas, con gráficos de progreso. Todo se guarda localmente en tu celular.' }));
    view.appendChild(aboutCard);

    root.appendChild(view);
  }

  return { render };
})();
