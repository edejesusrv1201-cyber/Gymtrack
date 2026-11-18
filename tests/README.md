# Pruebas de MyGymTrack

Sin dependencias ni instalación.

## 1. Revisión estática (Node)
```
node tests/static.js
```
Revisa la sintaxis de todos los JS, que cada script del `index.html` esté en el service worker
(si no, no funcionaría sin internet), que `?v=N` y `CACHE_NAME` coincidan, que el manifest y los íconos
existan, y que el catálogo de alimentos tenga ids únicos y calorías coherentes.

## 2. Prueba de humo en el navegador
Con el servidor local de desarrollo abre `http://localhost:PUERTO/tests/smoke.html`.
Crea datos de ejemplo, recorre todas las pantallas, registra una serie, abre los modales principales,
dibuja todas las animaciones de la guía, arma una dieta y exporta/importa un respaldo.
Muestra «✓ Todo bien» o la lista de fallos. **Borra los datos guardados de esa dirección** (solo corre en localhost).

Correrlas antes de cada versión: `node tests/static.js` y luego la página de humo.
