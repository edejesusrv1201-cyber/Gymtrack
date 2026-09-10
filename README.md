# MiGymTrack 🏋️

App personal (offline, sin servidor) para llevar tu progreso de gym:

- **Plan mensual**: define rutinas (Push, Pull, Piernas, Descanso, o las que quieras) y asígnalas a cada día del mes. La pantalla "Hoy" te dice automáticamente qué toca entrenar.
- **Registro de entrenamiento**: por cada ejercicio anotas peso, repeticiones y si te costó (😃 fácil / 🙂 normal / 😖 costó / ❌ fallé). Muestra tu última marca en ese ejercicio como referencia.
- **Cronómetro de descanso**: al registrar una serie se inicia solo un cronómetro de descanso (widget flotante, con vibración y sonido al terminar). También lo puedes abrir manualmente con presets (30s, 60s, 90s, 2:00, 3:00) o un tiempo personalizado.
- **Calorías**: guarda tus alimentos frecuentes (con calorías y macros) y regístralos rápido por comida (desayuno/almuerzo/cena/snacks). Ves el total del día contra tu meta.
- **Medidas corporales**: peso, cintura, pecho, brazo, muslo, etc., con fecha y un gráfico simple de progreso.
- **Todo tus datos se guardan en tu propio celular** (no hay servidor ni internet involucrado). Puedes exportar/importar un respaldo en JSON desde "Más".

## Cómo probarla ahora mismo (en tu computadora)

1. Descomprime la carpeta `gymtrack`.
2. Abre una terminal dentro de esa carpeta y ejecuta:
   ```
   python3 -m http.server 8000
   ```
3. Abre `http://localhost:8000` en tu navegador.

(También puedes simplemente abrir `index.html` con doble clic, pero algunas funciones —como el cronómetro con sonido— funcionan mejor servidas por http.)

## Cómo instalarla en tu Samsung como una app de verdad

Como es una app web (PWA), no necesitas Play Store. Tienes dos caminos:

### Opción recomendada: subirla a GitHub Pages (gratis, 10 minutos)

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Crea un repositorio nuevo, por ejemplo `mi-gym-track`.
3. Sube todos los archivos de la carpeta `gymtrack` (arrastra y suelta desde la web de GitHub, o usa `git`).
4. Ve a **Settings → Pages**, en "Source" elige la rama `main` y carpeta `/root`, guarda.
5. GitHub te dará una URL tipo `https://tu-usuario.github.io/mi-gym-track/`.
6. Abre esa URL en Chrome desde tu Samsung.
7. Toca el menú (⋮) de Chrome → **"Instalar app"** (o "Añadir a pantalla de inicio"). Se instalará como una app normal, con su ícono, y funcionará sin internet después de abrirla la primera vez.

### Opción rápida sin subir nada a internet

1. Copia la carpeta `gymtrack` completa a tu celular (por cable, o súbela a tu Drive/Google Fotos... mejor por cable o un cable USB / Compartir por WhatsApp Web como zip y descomprimirla con un administrador de archivos como "Files" de Samsung).
2. Con un explorador de archivos que pueda abrir HTML (o Chrome mismo con "Abrir archivo"), abre `index.html`.
3. Desde el menú de Chrome, toca **"Añadir a pantalla de inicio"**.

Con este método el ícono funciona, pero el guardado offline avanzado (el "service worker") puede no activarse en todos los Samsung al abrir por archivo local — GitHub Pages es más confiable a largo plazo.

## Importante: respalda tus datos

Todo se guarda en el almacenamiento local del navegador de tu celular. Si borras los datos de Chrome, desinstalas la app o cambias de teléfono, **perderás tu historial** a menos que hayas exportado un respaldo.

Ve a la pestaña **Más → Copia de seguridad → "Exportar mis datos"** de vez en cuando (por ejemplo, una vez al mes) y guarda ese archivo `.json` en un lugar seguro (Drive, correo, etc.). Para restaurar, usa "Importar respaldo" con ese mismo archivo.

## Estructura del código

```
gymtrack/
├── index.html            # esqueleto de la app y navegación
├── manifest.json         # metadata de la PWA (ícono, nombre, etc.)
├── sw.js                 # service worker (caché offline)
├── css/styles.css        # todos los estilos (tema oscuro, mobile-first)
├── icons/                # íconos de la app
└── js/
    ├── db.js             # capa de datos (localStorage) + datos de ejemplo
    ├── utils.js           # helpers de fecha/formato/DOM
    ├── modal.js           # hoja modal reutilizable
    ├── timer.js           # cronómetro de descanso (widget flotante)
    ├── app.js             # router principal / navegación
    └── views/
        ├── today.js        # pantalla "Hoy"
        ├── plan.js         # plan mensual + rutinas
        ├── workout.js      # registro de series (peso/reps/dificultad)
        ├── calories.js     # calorías + alimentos frecuentes
        ├── measurements.js # medidas corporales + gráfico
        └── more.js          # ajustes, catálogo de ejercicios, respaldo
```

Es JavaScript plano (sin frameworks ni pasos de compilación), así que puedes abrir cualquier archivo y modificarlo directamente. Ideas para seguir mejorándola: agregar gráficas de progreso por ejercicio, un modo claro, recordatorios/notificaciones, o sincronizar el respaldo automáticamente a un Google Drive.

¡A entrenar! 💪
