/* ============================================================
   foodMore.js — Más alimentos de la base (supermercado y comida
   de la región) + fibra, azúcar y sodio de los más comunes.
   Valores promedio por 100 g: úsalos como guía.
   ROWS: [nombre, categoría, kcal, proteína, carbos, grasa, porciones, fibra g, azúcar g, sodio mg]
   MICRO: datos extra de alimentos que ya estaban: nombre → [fibra, azúcar, sodio mg]
   ============================================================ */

const FoodMore = (() => {
  const ROWS = [
    // ---- proteínas ----
    ['Chorizo', 'proteina', 455, 24, 2, 38, '1 unidad|60', 0, 1, 1200],
    ['Costilla de cerdo asada', 'proteina', 290, 24, 0, 21, '1 porción|150', 0, 0, 90],
    ['Carne desmechada / guisada', 'proteina', 180, 28, 2, 6, '1 porción|120', 0.3, 1, 380],
    ['Pollo rostizado sin piel', 'proteina', 190, 29, 0, 8, '1 porción|130', 0, 0, 90],
    ['Bacalao cocido', 'proteina', 105, 23, 0, 0.9, '1 filete|140', 0, 0, 78],
    ['Pulpo / calamar cocido', 'proteina', 160, 29, 4, 2, '1 porción|120', 0, 0, 230],
    ['Salchicha de pavo', 'proteina', 160, 13, 5, 10, '1 unidad|45', 0, 1, 900],
    ['Seitán', 'proteina', 120, 25, 4, 1, '1 porción|100', 0.5, 0, 350],
    ['Tempeh', 'proteina', 192, 20, 8, 11, '1 porción|100', 0, 0, 9],
    ['Proteína vegetal en polvo', 'proteina', 380, 75, 8, 6, '1 scoop|33', 3, 1, 800],
    ['Huevo revuelto', 'proteina', 148, 10, 1.6, 11, '2 huevos|120', 0, 1.4, 145],
    // ---- lácteos ----
    ['Yogur griego con fruta', 'lacteo', 95, 5, 13, 2.5, '1 vaso|150', 0.3, 11, 40],
    ['Yogur bebible', 'lacteo', 70, 3, 12, 1.2, '1 botella|200', 0, 11, 45],
    ['Kéfir', 'lacteo', 55, 3.5, 4.5, 2, '1 vaso|240', 0, 4, 40],
    ['Queso parmesano', 'lacteo', 431, 38, 4, 29, '1 cda|10', 0, 0.9, 1500],
    ['Queso oaxaca / quesillo', 'lacteo', 300, 22, 2, 23, '1 porción|40', 0, 1, 700],
    ['Crema / nata', 'lacteo', 193, 3, 3, 19, '1 cda|15', 0, 3, 40],
    ['Leche condensada', 'lacteo', 321, 8, 54, 9, '1 cda|20', 0, 54, 130],
    ['Leche de soya sin azúcar', 'lacteo', 33, 3, 1.5, 1.8, '1 vaso|240', 0.4, 0.5, 50],
    ['Leche con chocolate', 'lacteo', 83, 3.4, 11, 2.5, '1 vaso|240', 0.5, 10, 60],
    // ---- cereales ----
    ['Pan de hamburguesa', 'cereal', 270, 9, 49, 4, '1 pan|60', 2, 6, 500],
    ['Tostada de maíz', 'cereal', 390, 8, 62, 13, '1 tostada|12', 5, 1, 300],
    ['Tortilla chips / nachos', 'cereal', 490, 7, 60, 25, '1 puñado|30', 4, 1, 450],
    ['Cereal de avena (tipo Cheerios)', 'cereal', 375, 10, 76, 5, '1 taza|30', 9, 4, 450],
    ['Cereal azucarado', 'cereal', 380, 5, 85, 3, '1 taza|35', 2, 35, 400],
    ['Barra de cereal', 'cereal', 400, 6, 70, 11, '1 barra|25', 3, 28, 170],
    ['Gallo pinto / casamiento', 'cereal', 140, 5, 25, 2, '1 plato|250', 4, 0.5, 280],
    ['Pretzels', 'cereal', 380, 10, 80, 3, '1 puñado|30', 3, 3, 1300],
    ['Avena cocida con leche', 'cereal', 90, 4, 14, 2.5, '1 taza|250', 1.5, 5, 60],
    // ---- legumbres ----
    ['Frijoles refritos', 'legumbre', 110, 6, 15, 3, '½ taza|120', 6, 0.5, 450],
    ['Frijoles blancos cocidos', 'legumbre', 139, 9.7, 25, 0.5, '½ taza|100', 6, 0.3, 6],
    ['Edamame cocido', 'legumbre', 121, 12, 9, 5, '½ taza|80', 5, 2, 6],
    // ---- frutas ----
    ['Toronja / pomelo', 'fruta', 42, 0.8, 11, 0.1, '½ unidad|150', 1.6, 7, 0],
    ['Ciruela', 'fruta', 46, 0.7, 11, 0.3, '1 unidad|60', 1.4, 10, 0],
    ['Cereza', 'fruta', 63, 1, 16, 0.2, '1 taza|140', 2.1, 13, 0],
    ['Higo', 'fruta', 74, 0.8, 19, 0.3, '1 unidad|50', 2.9, 16, 1],
    ['Coco fresco', 'fruta', 354, 3.3, 15, 33, '1 trozo|45', 9, 6, 20],
    // ---- verduras ----
    ['Ensalada mixta (lechuga, tomate, pepino)', 'verdura', 20, 1, 4, 0.2, '1 plato|150', 1.5, 2, 15],
    ['Repollo / col', 'verdura', 25, 1.3, 6, 0.1, '1 taza|90', 2.5, 3.2, 18],
    ['Apio', 'verdura', 16, 0.7, 3, 0.2, '1 tallo|40', 1.6, 1.3, 80],
    ['Berenjena cocida', 'verdura', 35, 0.8, 9, 0.2, '1 taza|100', 2.5, 3, 1],
    ['Espárragos cocidos', 'verdura', 22, 2.4, 4, 0.2, '6 puntas|90', 2, 1.3, 14],
    ['Chayote cocido', 'verdura', 19, 0.8, 4.5, 0.1, '1 unidad|200', 1.7, 1.7, 2],
    // ---- grasas y frutos secos ----
    ['Pistachos', 'grasa', 560, 20, 28, 45, '1 puñado|30', 10, 8, 1],
    ['Marañón / anacardos', 'grasa', 553, 18, 30, 44, '1 puñado|30', 3, 6, 12],
    ['Semillas de girasol', 'grasa', 584, 21, 20, 51, '1 puñado|30', 9, 3, 9],
    ['Semillas de calabaza (pepitas)', 'grasa', 559, 30, 11, 49, '1 puñado|30', 6, 1, 7],
    ['Mantequilla de almendra', 'grasa', 614, 21, 19, 56, '1 cda|16', 10, 4, 7],
    ['Aceitunas', 'grasa', 115, 0.8, 6, 11, '5 unidades|20', 3, 0, 1500],
    // ---- salsas y aderezos ----
    ['Kétchup', 'salsa', 100, 1, 26, 0.1, '1 cda|17', 0.3, 22, 900],
    ['Mostaza', 'salsa', 66, 4, 6, 4, '1 cdita|5', 3, 1, 1100],
    ['Salsa de soya', 'salsa', 53, 8, 5, 0.6, '1 cda|15', 0.8, 0.4, 5500],
    ['Salsa picante', 'salsa', 30, 1, 6, 0.5, '1 cdita|5', 1, 2, 2000],
    ['Aderezo ranch', 'salsa', 430, 1, 6, 45, '1 cda|15', 0, 3, 800],
    ['Salsa BBQ', 'salsa', 170, 1, 40, 0.5, '1 cda|17', 0.5, 33, 1000],
    ['Guacamole', 'salsa', 160, 2, 9, 15, '2 cdas|30', 6, 1, 300],
    ['Pico de gallo / salsa fresca', 'salsa', 25, 1, 5, 0.2, '2 cdas|30', 1.5, 3, 200],
    ['Salsa de tomate para pasta', 'salsa', 55, 1.8, 9, 1.5, '½ taza|120', 2, 6, 400],
    // ---- bebidas ----
    ['Agua de coco', 'bebida', 19, 0.7, 3.7, 0.2, '1 vaso|250', 1, 2.6, 105],
    ['Bebida energética', 'bebida', 45, 0, 11, 0, '1 lata|250', 0, 11, 80],
    ['Bebida deportiva', 'bebida', 26, 0, 6.5, 0, '1 botella|500', 0, 6, 40],
    ['Jugo de manzana', 'bebida', 46, 0.1, 11, 0.1, '1 vaso|240', 0.2, 10, 4],
    ['Gaseosa light / cero', 'bebida', 1, 0, 0, 0, '1 lata|355', 0, 0, 15],
    ['Café con leche', 'bebida', 40, 2, 4, 1.5, '1 taza|240', 0, 4, 30],
    ['Té sin azúcar', 'bebida', 1, 0, 0.2, 0, '1 taza|240', 0, 0, 3],
    ['Vino tinto', 'bebida', 85, 0.1, 2.6, 0, '1 copa|150', 0, 0.6, 5],
    ['Licor (ron, whisky, vodka)', 'bebida', 230, 0, 0, 0, '1 trago|45', 0, 0, 1],
    // ---- dulces y snacks ----
    ['Palomitas de maíz (sin mantequilla)', 'dulce', 387, 13, 78, 4.5, '3 tazas|24', 14, 1, 8],
    ['Palomitas con mantequilla', 'dulce', 500, 9, 58, 28, '3 tazas|30', 10, 1, 800],
    ['Pan dulce', 'dulce', 370, 8, 60, 11, '1 pieza|70', 2, 20, 300],
    ['Dona / donut', 'dulce', 420, 5, 50, 22, '1 dona|60', 1.5, 25, 350],
    ['Pastel / bizcocho', 'dulce', 370, 5, 55, 15, '1 trozo|90', 1, 35, 300],
    ['Gomitas', 'dulce', 340, 6, 77, 0, '1 puñado|30', 0, 46, 30],
    ['Barra de chocolate con maní', 'dulce', 490, 8, 60, 24, '1 barra|50', 2, 48, 200],
    ['Galletas rellenas de chocolate', 'dulce', 480, 4.5, 70, 20, '3 galletas|34', 2, 38, 400],
    ['Chips de plátano', 'dulce', 519, 2, 58, 33, '1 puñado|30', 4, 20, 250],
    ['Mezcla de frutos secos (trail mix)', 'dulce', 462, 13, 45, 29, '1 puñado|30', 5, 30, 60],
    ['Flan', 'dulce', 125, 4, 20, 3, '1 porción|120', 0, 19, 80],
    ['Arroz con leche', 'dulce', 130, 3, 23, 3, '1 vaso|200', 0.2, 12, 50],
    ['Gelatina', 'dulce', 62, 1.5, 14, 0, '1 vaso|130', 0, 14, 50],
    ['Dulce de leche', 'dulce', 315, 7, 55, 7, '1 cda|20', 0, 50, 120],
    // ---- comidas preparadas ----
    ['Baleada con frijoles, queso y crema', 'preparado', 250, 9, 32, 10, '1 baleada|150', 4, 2, 450],
    ['Pupusa de queso', 'preparado', 220, 8, 28, 8, '1 pupusa|110', 2, 1, 400],
    ['Tamal de cerdo', 'preparado', 190, 6, 24, 8, '1 tamal|180', 2, 1, 350],
    ['Tacos de carne (tortilla de maíz)', 'preparado', 210, 11, 20, 9, '1 taco|80', 2, 1, 330],
    ['Burrito de pollo', 'preparado', 220, 10, 28, 7, '1 burrito|250', 2, 2, 600],
    ['Quesadilla de queso', 'preparado', 300, 13, 28, 15, '1 quesadilla|120', 1, 1, 600],
    ['Pollo frito empanizado', 'preparado', 280, 20, 10, 17, '1 presa|110', 0.5, 0, 600],
    ['Nuggets de pollo', 'preparado', 290, 15, 18, 18, '1 nugget|18', 1, 0.5, 550],
    ['Hot dog con pan', 'preparado', 290, 10, 23, 17, '1 hot dog|120', 1, 4, 800],
    ['Pizza pepperoni', 'preparado', 270, 12, 31, 11, '1 porción|110', 2, 3, 650],
    ['Pasta con salsa boloñesa', 'preparado', 160, 8, 20, 5, '1 plato|300', 2, 3, 380],
    ['Arroz frito', 'preparado', 170, 5, 28, 4, '1 plato|250', 1, 1, 450],
    ['Ensalada César con pollo', 'preparado', 130, 10, 6, 7, '1 plato|250', 1.5, 2, 400],
    ['Sopa de res con verduras', 'preparado', 50, 5, 4, 1.5, '1 plato|300', 1, 1.5, 350],
    ['Wrap de pollo', 'preparado', 190, 12, 22, 6, '1 wrap|200', 2, 2, 500],
    ['Omelette de 2 huevos', 'preparado', 154, 11, 1, 12, '1 omelette|130', 0, 1, 330],
    ['Pancakes', 'preparado', 227, 6, 28, 10, '1 pancake|60', 1, 6, 430],
  ];

  const MICRO = {
    'Pechuga de pollo cocida': [0, 0, 74], 'Huevo entero (crudo)': [0, 0.4, 142], 'Atún en agua (lata, escurrido)': [0, 0, 250],
    'Leche entera': [0, 5, 43], 'Yogur natural entero': [0, 5, 46], 'Yogur griego natural 0%': [0, 3.6, 36], 'Queso fresco / campesino': [0, 2, 700],
    'Arroz blanco cocido': [0.4, 0, 1], 'Arroz integral cocido': [1.8, 0.4, 5], 'Pasta cocida': [1.8, 0.6, 1], 'Avena en hojuelas (cruda)': [10, 1, 6],
    'Pan blanco': [2.7, 5, 490], 'Pan integral': [6, 5, 450], 'Tortilla de maíz': [5, 0.9, 45], 'Papa cocida': [1.8, 0.9, 5], 'Camote / batata cocido': [3, 6.5, 36],
    'Frijoles negros cocidos': [8.7, 0.3, 1], 'Frijoles rojos / pintos cocidos': [7.4, 0.3, 2], 'Lentejas cocidas': [7.9, 1.8, 2], 'Garbanzos cocidos': [7.6, 4.8, 7],
    'Banano': [2.6, 12, 1], 'Manzana': [2.4, 10, 1], 'Naranja': [2.4, 9, 0], 'Fresas': [2, 4.9, 1], 'Piña': [1.4, 10, 1], 'Mango': [1.6, 14, 2], 'Papaya': [1.7, 7.8, 8],
    'Aguacate': [6.7, 0.7, 7], 'Brócoli cocido': [3.3, 1.4, 41], 'Espinaca cruda': [2.2, 0.4, 79], 'Tomate': [1.2, 2.6, 5], 'Zanahoria cruda': [2.8, 4.7, 69],
    'Almendras': [12, 4.4, 1], 'Maní / cacahuates': [8.5, 4.7, 18], 'Nueces': [6.7, 2.6, 2], 'Mantequilla de maní': [6, 9, 430], 'Aceite de oliva': [0, 0, 2],
    'Gaseosa (cola)': [0, 10.6, 4], 'Jugo de naranja natural': [0.2, 8.4, 1], 'Cerveza': [0, 0, 4], 'Chocolate negro 70%': [11, 24, 20], 'Azúcar': [0, 100, 1],
    'Miel': [0.2, 82, 4], 'Papas fritas de bolsa': [4, 0.5, 520], 'Galletas dulces': [2, 25, 400], 'Granola': [7, 18, 20], 'Cereal de maíz (cornflakes)': [3, 8, 650],
    'Pizza de queso': [2.3, 3.6, 600], 'Hamburguesa con queso': [1.5, 5, 600], 'Arroz con pollo': [1, 1, 330], 'Sándwich de jamón y queso': [2, 4, 800],
    'Proteína en polvo (whey)': [1, 4, 400], 'Jamón de pavo': [0, 1, 1000], 'Tocino frito': [0, 0, 1700],
  };

  return { ROWS, MICRO };
})();
