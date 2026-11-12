/* ============================================================
   foodDb.js — Base de alimentos incluida en la app (funciona sin
   internet) + utilidades de búsqueda, favoritos y cálculo de macros.

   Los valores son promedios por 100 g (tablas tipo USDA). Los
   alimentos preparados varían según la receta: úsalos como guía y
   crea los tuyos si quieres más precisión.
   ============================================================ */

const FoodDB = (() => {
  const CATEGORIES = [
    { key: 'proteina', label: 'Proteínas', icon: '🍗' },
    { key: 'lacteo', label: 'Lácteos', icon: '🥛' },
    { key: 'cereal', label: 'Cereales y tubérculos', icon: '🍚' },
    { key: 'legumbre', label: 'Legumbres', icon: '🫘' },
    { key: 'fruta', label: 'Frutas', icon: '🍌' },
    { key: 'verdura', label: 'Verduras', icon: '🥦' },
    { key: 'grasa', label: 'Grasas y frutos secos', icon: '🥑' },
    { key: 'bebida', label: 'Bebidas', icon: '🥤' },
    { key: 'dulce', label: 'Dulces y snacks', icon: '🍫' },
    { key: 'preparado', label: 'Comidas preparadas', icon: '🍕' },
  ];

  // [nombre, categoría, kcal, proteína, carbos, grasa, porciones "etiqueta|gramos;..."]  (valores por 100 g)
  const RAW = [
    // ---- proteínas ----
    ['Pechuga de pollo cocida', 'proteina', 165, 31, 0, 3.6, '1 filete mediano|120;1 pechuga entera|170'],
    ['Pechuga de pollo cruda', 'proteina', 120, 22.5, 0, 2.6, '1 filete mediano|150'],
    ['Muslo de pollo sin piel cocido', 'proteina', 179, 25, 0, 8, '1 muslo|100'],
    ['Pollo con piel asado', 'proteina', 239, 27, 0, 14, '1 presa|120'],
    ['Pavo pechuga cocida', 'proteina', 135, 30, 0, 1, '1 filete|120'],
    ['Carne molida de res magra (90/10) cocida', 'proteina', 217, 26, 0, 12, '1 porción|120'],
    ['Carne molida de res (80/20) cocida', 'proteina', 250, 26, 0, 16, '1 porción|120'],
    ['Bistec / lomo de res cocido', 'proteina', 206, 29, 0, 9, '1 bistec|150'],
    ['Lomo de cerdo cocido', 'proteina', 143, 26, 0, 3.5, '1 filete|130'],
    ['Chuleta de cerdo cocida', 'proteina', 231, 25, 0, 14, '1 chuleta|130'],
    ['Tocino frito', 'proteina', 541, 37, 1.4, 42, '1 tira|8'],
    ['Jamón de pavo', 'proteina', 104, 17, 1.7, 3, '1 rebanada|28'],
    ['Jamón de cerdo', 'proteina', 145, 21, 1.5, 5.5, '1 rebanada|28'],
    ['Salchicha', 'proteina', 290, 10.5, 4, 26, '1 unidad|45'],
    ['Hígado de res cocido', 'proteina', 175, 27, 4, 4.7, '1 porción|100'],
    ['Atún en agua (lata, escurrido)', 'proteina', 116, 26, 0, 1, '1 lata escurrida|120'],
    ['Atún en aceite (lata, escurrido)', 'proteina', 198, 29, 0, 8, '1 lata escurrida|120'],
    ['Sardinas en lata', 'proteina', 208, 25, 0, 11, '1 lata|90'],
    ['Salmón cocido', 'proteina', 206, 22, 0, 12, '1 filete|140'],
    ['Tilapia cocida', 'proteina', 128, 26, 0, 2.7, '1 filete|130'],
    ['Pescado blanco cocido (merluza, corvina)', 'proteina', 105, 22, 0, 1.5, '1 filete|140'],
    ['Camarón cocido', 'proteina', 99, 24, 0.2, 0.3, '1 porción|100'],
    ['Huevo entero (crudo)', 'proteina', 143, 12.6, 0.7, 9.5, '1 huevo mediano|50;1 huevo grande|60'],
    ['Huevo cocido', 'proteina', 155, 12.6, 1.1, 10.6, '1 huevo|50'],
    ['Huevo frito', 'proteina', 196, 13.6, 0.8, 15, '1 huevo|46'],
    ['Clara de huevo', 'proteina', 52, 10.9, 0.7, 0.2, '1 clara|33'],
    ['Yema de huevo', 'proteina', 322, 15.9, 3.6, 26.5, '1 yema|17'],
    ['Tofu firme', 'proteina', 144, 17, 3, 9, '1 porción|100'],
    ['Proteína en polvo (whey)', 'proteina', 400, 80, 8, 6, '1 scoop|30'],
    ['Barra de proteína', 'proteina', 360, 30, 35, 10, '1 barra|60'],

    // ---- lácteos ----
    ['Leche entera', 'lacteo', 61, 3.2, 4.8, 3.3, '1 vaso (240 ml)|245;1 taza|245'],
    ['Leche descremada', 'lacteo', 34, 3.4, 5, 0.1, '1 vaso (240 ml)|245'],
    ['Leche de almendra sin azúcar', 'lacteo', 15, 0.6, 0.3, 1.2, '1 vaso (240 ml)|240'],
    ['Leche de avena', 'lacteo', 48, 1, 6.7, 1.5, '1 vaso (240 ml)|240'],
    ['Yogur natural entero', 'lacteo', 61, 3.5, 4.7, 3.3, '1 pote|125'],
    ['Yogur griego natural 0%', 'lacteo', 59, 10.2, 3.6, 0.4, '1 pote|170'],
    ['Yogur griego entero', 'lacteo', 97, 9, 4, 5, '1 pote|170'],
    ['Queso fresco / campesino', 'lacteo', 280, 18, 3, 21, '1 porción|30'],
    ['Queso mozzarella', 'lacteo', 280, 28, 3, 17, '1 porción|30'],
    ['Queso cheddar', 'lacteo', 403, 25, 1.3, 33, '1 loncha|28'],
    ['Queso crema', 'lacteo', 342, 6, 4, 34, '1 cucharada|15'],
    ['Requesón / cottage', 'lacteo', 98, 11, 3.4, 4.3, '1/2 taza|113'],
    ['Mantequilla', 'lacteo', 717, 0.9, 0.1, 81, '1 cucharadita|5;1 cucharada|14'],

    // ---- cereales y tubérculos ----
    ['Arroz blanco cocido', 'cereal', 130, 2.7, 28, 0.3, '1 taza|158;1/2 taza|79;1 plato mediano|200'],
    ['Arroz integral cocido', 'cereal', 123, 2.7, 25.6, 1, '1 taza|195'],
    ['Arroz blanco crudo', 'cereal', 365, 7, 80, 0.7, '1/4 taza|46'],
    ['Pasta cocida', 'cereal', 158, 5.8, 31, 0.9, '1 taza|140'],
    ['Pasta cruda', 'cereal', 371, 13, 75, 1.5, '1 porción|80'],
    ['Avena en hojuelas (cruda)', 'cereal', 389, 16.9, 66, 6.9, '1/2 taza|40;1 cucharada|7'],
    ['Pan blanco', 'cereal', 265, 9, 49, 3.2, '1 rebanada|28'],
    ['Pan integral', 'cereal', 252, 12.5, 43, 3.5, '1 rebanada|32'],
    ['Pan francés / baguette', 'cereal', 270, 9, 56, 1.5, '1 trozo|50'],
    ['Arepa de maíz', 'cereal', 190, 4, 38, 1.5, '1 arepa mediana|100'],
    ['Tortilla de maíz', 'cereal', 218, 5.7, 44.6, 2.9, '1 tortilla|28'],
    ['Tortilla de harina', 'cereal', 310, 8.5, 51, 8, '1 tortilla|45'],
    ['Papa cocida', 'cereal', 87, 1.9, 20, 0.1, '1 papa mediana|150'],
    ['Papas fritas (French fries)', 'cereal', 312, 3.4, 41, 15, '1 porción|110'],
    ['Camote / batata cocido', 'cereal', 90, 2, 20.7, 0.2, '1 mediano|130'],
    ['Yuca cocida', 'cereal', 160, 1.4, 38, 0.3, '1 trozo|100'],
    ['Plátano maduro (crudo)', 'cereal', 122, 1.3, 31.9, 0.4, '1 plátano|180'],
    ['Plátano maduro frito', 'cereal', 230, 1.5, 38, 9, '1 tajada|35'],
    ['Plátano verde cocido', 'cereal', 122, 1, 32, 0.4, '1 trozo|100'],
    ['Maíz cocido (choclo)', 'cereal', 96, 3.4, 21, 1.5, '1 mazorca|150'],
    ['Quinoa cocida', 'cereal', 120, 4.4, 21.3, 1.9, '1 taza|185'],
    ['Cuscús cocido', 'cereal', 112, 3.8, 23, 0.2, '1 taza|157'],
    ['Granola', 'cereal', 471, 10, 64, 20, '1/2 taza|50'],
    ['Cereal de maíz (cornflakes)', 'cereal', 357, 7.5, 84, 0.4, '1 taza|30'],
    ['Galletas de soda', 'cereal', 421, 9, 71, 12, '1 galleta|3'],
    ['Harina de trigo', 'cereal', 364, 10, 76, 1, '1 cucharada|8'],
    ['Harina de maíz precocida', 'cereal', 360, 7, 77, 1.5, '1/4 taza|35'],

    // ---- legumbres (cocidas) ----
    ['Frijoles negros cocidos', 'legumbre', 132, 8.9, 23.7, 0.5, '1/2 taza|86;1 taza|172'],
    ['Frijoles rojos / pintos cocidos', 'legumbre', 127, 8.7, 22.8, 0.5, '1/2 taza|90;1 taza|177'],
    ['Lentejas cocidas', 'legumbre', 116, 9, 20, 0.4, '1/2 taza|99;1 taza|198'],
    ['Garbanzos cocidos', 'legumbre', 164, 8.9, 27.4, 2.6, '1/2 taza|82'],
    ['Arvejas cocidas', 'legumbre', 84, 5.4, 15.6, 0.2, '1/2 taza|80'],
    ['Hummus', 'legumbre', 166, 8, 14, 10, '2 cucharadas|30'],

    // ---- frutas ----
    ['Banano', 'fruta', 89, 1.1, 22.8, 0.3, '1 mediano|118;1 grande|136'],
    ['Manzana', 'fruta', 52, 0.3, 13.8, 0.2, '1 mediana|180'],
    ['Naranja', 'fruta', 47, 0.9, 11.8, 0.1, '1 mediana|130'],
    ['Mandarina', 'fruta', 53, 0.8, 13.3, 0.3, '1 unidad|90'],
    ['Pera', 'fruta', 57, 0.4, 15.2, 0.1, '1 mediana|178'],
    ['Uvas', 'fruta', 69, 0.7, 18.1, 0.2, '1 taza|150'],
    ['Fresas', 'fruta', 32, 0.7, 7.7, 0.3, '1 taza|150'],
    ['Arándanos / moras', 'fruta', 57, 0.7, 14.5, 0.3, '1 taza|148'],
    ['Piña', 'fruta', 50, 0.5, 13.1, 0.1, '1 rodaja|80;1 taza|165'],
    ['Mango', 'fruta', 60, 0.8, 15, 0.4, '1 taza|165;1 mediano|200'],
    ['Papaya', 'fruta', 43, 0.5, 10.8, 0.3, '1 taza|145'],
    ['Sandía', 'fruta', 30, 0.6, 7.6, 0.2, '1 taza|152'],
    ['Melón', 'fruta', 34, 0.8, 8.2, 0.2, '1 taza|160'],
    ['Kiwi', 'fruta', 61, 1.1, 14.7, 0.5, '1 unidad|70'],
    ['Durazno', 'fruta', 39, 0.9, 9.5, 0.3, '1 mediano|150'],
    ['Guayaba', 'fruta', 68, 2.6, 14.3, 1, '1 unidad|55'],
    ['Maracuyá', 'fruta', 97, 2.2, 23.4, 0.7, '1 unidad|18'],
    ['Aguacate', 'fruta', 160, 2, 8.5, 14.7, '1/2 aguacate|100;1 entero|200'],
    ['Pasas', 'fruta', 299, 3.1, 79.2, 0.5, '1 puñado|30'],
    ['Dátiles', 'fruta', 282, 2.5, 75, 0.4, '1 dátil|24'],

    // ---- verduras ----
    ['Brócoli cocido', 'verdura', 35, 2.4, 7.2, 0.4, '1 taza|156'],
    ['Espinaca cruda', 'verdura', 23, 2.9, 3.6, 0.4, '1 taza|30'],
    ['Lechuga', 'verdura', 15, 1.4, 2.9, 0.2, '1 taza|36'],
    ['Tomate', 'verdura', 18, 0.9, 3.9, 0.2, '1 mediano|120'],
    ['Cebolla', 'verdura', 40, 1.1, 9.3, 0.1, '1 mediana|110'],
    ['Zanahoria cruda', 'verdura', 41, 0.9, 9.6, 0.2, '1 mediana|61'],
    ['Pepino', 'verdura', 15, 0.7, 3.6, 0.1, '1/2 pepino|150'],
    ['Pimentón', 'verdura', 31, 1, 6, 0.3, '1 mediano|120'],
    ['Calabacín / zucchini', 'verdura', 17, 1.2, 3.1, 0.3, '1 mediano|196'],
    ['Coliflor cocida', 'verdura', 23, 1.8, 4.1, 0.5, '1 taza|124'],
    ['Champiñones', 'verdura', 22, 3.1, 3.3, 0.3, '1 taza|70'],
    ['Habichuelas verdes cocidas', 'verdura', 35, 1.9, 7.9, 0.3, '1 taza|125'],
    ['Remolacha cocida', 'verdura', 44, 1.7, 10, 0.2, '1 mediana|85'],
    ['Ahuyama / calabaza', 'verdura', 26, 1, 6.5, 0.1, '1 taza|116'],

    // ---- grasas y frutos secos ----
    ['Almendras', 'grasa', 579, 21, 22, 50, '1 puñado|28'],
    ['Maní / cacahuates', 'grasa', 567, 26, 16, 49, '1 puñado|28'],
    ['Nueces', 'grasa', 654, 15, 14, 65, '1 puñado|28'],
    ['Mantequilla de maní', 'grasa', 588, 25, 20, 50, '1 cucharada|16'],
    ['Aceite de oliva', 'grasa', 884, 0, 0, 100, '1 cucharadita|5;1 cucharada|14'],
    ['Aceite vegetal / girasol', 'grasa', 884, 0, 0, 100, '1 cucharadita|5;1 cucharada|14'],
    ['Aceite de coco', 'grasa', 862, 0, 0, 100, '1 cucharada|14'],
    ['Semillas de chía', 'grasa', 486, 17, 42, 31, '1 cucharada|12'],
    ['Linaza', 'grasa', 534, 18, 29, 42, '1 cucharada|10'],
    ['Mayonesa', 'grasa', 680, 1, 0.6, 75, '1 cucharada|14'],

    // ---- bebidas ----
    ['Jugo de naranja natural', 'bebida', 45, 0.7, 10.4, 0.2, '1 vaso (240 ml)|248'],
    ['Jugo de fruta embotellado', 'bebida', 46, 0.2, 11.2, 0.1, '1 vaso (240 ml)|248'],
    ['Gaseosa (cola)', 'bebida', 42, 0, 10.6, 0, '1 lata (355 ml)|370'],
    ['Cerveza', 'bebida', 43, 0.5, 3.6, 0, '1 lata (355 ml)|356'],
    ['Café negro', 'bebida', 1, 0.1, 0, 0, '1 taza|240'],

    // ---- dulces y snacks ----
    ['Chocolate negro 70%', 'dulce', 598, 7.8, 46, 43, '1 cuadro|10;1 barra|40'],
    ['Chocolate con leche', 'dulce', 535, 7.7, 59.4, 29.7, '1 cuadro|10;1 barra|40'],
    ['Helado de vainilla', 'dulce', 207, 3.5, 23.6, 11, '1 bola|66'],
    ['Galletas dulces', 'dulce', 450, 6, 70, 17, '1 galleta|10'],
    ['Papas fritas de bolsa', 'dulce', 536, 7, 53, 35, '1 bolsa pequeña|40'],
    ['Azúcar', 'dulce', 387, 0, 100, 0, '1 cucharadita|4'],
    ['Miel', 'dulce', 304, 0.3, 82.4, 0, '1 cucharada|21'],
    ['Mermelada', 'dulce', 250, 0.4, 65, 0.1, '1 cucharada|20'],
    ['Crema de avellanas con cacao', 'dulce', 539, 6.3, 57.5, 30.9, '1 cucharada|20'],

    // ---- comidas preparadas (aproximadas) ----
    ['Pizza de queso', 'preparado', 266, 11, 33, 10, '1 porción|107'],
    ['Hamburguesa con queso', 'preparado', 295, 15, 30, 14, '1 hamburguesa|170'],
    ['Empanada de carne frita', 'preparado', 300, 8, 28, 17, '1 empanada|90'],
    ['Arroz con pollo', 'preparado', 150, 8, 18, 5, '1 plato|300'],
    ['Sopa de pollo con verduras', 'preparado', 40, 3, 4, 1.5, '1 plato|300'],
    ['Sándwich de jamón y queso', 'preparado', 250, 12, 28, 10, '1 sándwich|150'],
  ];

  const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const BUILTIN = RAW.map(([name, cat, kcal, protein, carbs, fat, ports]) => ({
    id: `b_${slug(name)}`,
    builtin: true,
    name,
    cat,
    kcal, protein, carbs, fat,
    portions: (ports || '').split(';').filter(Boolean).map((p) => {
      const [label, g] = p.split('|');
      return { label, g: Number(g) };
    }),
  }));
  const BUILTIN_BY_ID = {};
  BUILTIN.forEach((f) => { BUILTIN_BY_ID[f.id] = f; });

  const GRAM_LABEL = /^\s*(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos?)\s*$/i;

  // Forma uniforme de cualquier alimento (de la app o tuyo):
  //   basis 'g'  -> valores por 100 g, se anota en gramos
  //   basis 's'  -> valores por porción, se anota en porciones
  function spec(food) {
    if (!food) return null;
    if (food.builtin) {
      return { id: food.id, name: food.name, basis: 'g', kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, portions: food.portions, builtin: true, cat: food.cat };
    }
    // alimento tuyo escrito "por 100 g" (nuevo formato)
    if (food.basis === 'g') {
      const portions = food.portionG > 0 ? [{ label: food.servingLabel || `1 porción (${food.portionG} g)`, g: Number(food.portionG) }] : [];
      return { id: food.id, name: food.name, basis: 'g', kcal: food.kcal, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0, portions, mine: true, combo: !!food.combo, recipe: !!food.recipe };
    }
    // formato antiguo con porción "100g" / "150 g": se convierte a por 100 g para poder anotar en gramos
    const m = GRAM_LABEL.exec(food.servingLabel || '');
    if (m) {
      const n = parseFloat(m[1].replace(',', '.'));
      if (n > 0) {
        const k = 100 / n;
        return {
          id: food.id, name: food.name, basis: 'g',
          kcal: (food.kcal || 0) * k, protein: (food.protein || 0) * k, carbs: (food.carbs || 0) * k, fat: (food.fat || 0) * k,
          portions: n === 100 ? [] : [{ label: `${n} g`, g: n }], mine: true, combo: !!food.combo, recipe: !!food.recipe,
        };
      }
    }
    return { id: food.id, name: food.name, basis: 's', kcal: food.kcal || 0, protein: food.protein || 0, carbs: food.carbs || 0, fat: food.fat || 0, servingLabel: food.servingLabel || '1 porción', portions: [], mine: true, combo: !!food.combo, recipe: !!food.recipe };
  }

  // macros de una cantidad (gramos para basis 'g', porciones para basis 's')
  function macros(sp, qty) {
    const k = sp.basis === 'g' ? qty / 100 : qty;
    return { kcal: sp.kcal * k, protein: sp.protein * k, carbs: sp.carbs * k, fat: sp.fat * k };
  }

  function allFoods() {
    const mine = DB.getFoods();
    return mine.map(spec).concat(BUILTIN.map(spec));
  }

  function findSpec(id) {
    if (!id) return null;
    if (BUILTIN_BY_ID[id]) return spec(BUILTIN_BY_ID[id]);
    const f = DB.getFoods().find((x) => x.id === id);
    return f ? spec(f) : null;
  }

  // búsqueda: lo tuyo primero; luego coincidencias al inicio, por palabra y en cualquier parte
  function search(query, opts = {}) {
    const q = norm(query).trim();
    const words = q.split(/\s+/).filter(Boolean);
    let list = allFoods();
    if (opts.cat) list = list.filter((f) => f.cat === opts.cat);
    if (opts.onlyMine) list = list.filter((f) => f.mine);
    if (!q) return list;
    const scored = [];
    list.forEach((f) => {
      const n = norm(f.name);
      if (!words.every((w) => n.includes(w))) return;
      let score = 3;
      if (n.startsWith(q)) score = 0;
      else if (n.split(/[\s/(),]+/).some((w) => w.startsWith(words[0]))) score = 1;
      else if (n.includes(q)) score = 2;
      if (f.mine) score -= 0.5;
      scored.push([score, f]);
    });
    scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'es'));
    return scored.map((s) => s[1]);
  }

  // ---------- favoritos ----------
  const favorites = () => (Array.isArray(DB.getSettings().favFoods) ? DB.getSettings().favFoods : []);
  function toggleFavorite(id) {
    const s = DB.getSettings();
    const list = Array.isArray(s.favFoods) ? s.favFoods.slice() : [];
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    s.favFoods = list;
    DB.saveSettings(s);
    return i < 0;
  }

  // alimentos usados últimamente (más reciente primero)
  function recentIds(limit = 12) {
    const log = DB.getCalorieLog();
    const seen = new Set();
    const ids = [];
    Object.keys(log).sort().reverse().forEach((d) => {
      [...log[d]].reverse().forEach((e) => {
        if (!e.foodId || seen.has(e.foodId)) return;
        seen.add(e.foodId);
        ids.push(e.foodId);
      });
    });
    return ids.slice(0, limit);
  }

  return { CATEGORIES, BUILTIN, spec, macros, allFoods, findSpec, search, favorites, toggleFavorite, recentIds, norm };
})();
