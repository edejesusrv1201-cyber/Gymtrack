# Llevar MyGymTrack a una tienda — guía para hablarlo con tu amigo

Estado: la app ya es una **PWA completa** (instalable, funciona sin internet, con cuenta en la nube, ranking, panel de administración, política de privacidad y borrado de cuenta dentro de la app). Lo que falta para tiendas es **empaquetado + trámites**, casi nada de código.

## 1. Caminos posibles

| Camino | Qué es | Costo | Esfuerzo | Notas |
|---|---|---|---|---|
| **A. Seguir como PWA** | Gente la instala desde el navegador (como ahora) | $0 | Ya está | Sin revisión de nadie. Poco descubrimiento |
| **B. Google Play (TWA)** | La misma web empaquetada como app de Android | $25 (cuenta de desarrollador, pago único) | Bajo: 1–2 días | **Recomendado como primer paso.** Se hace con [PWABuilder](https://pwabuilder.com) o Bubblewrap |
| **C. App Store (iOS)** | Hay que envolverla con Capacitor | $99/año + una Mac | Medio–alto | Apple suele rechazar "solo una web en un envoltorio": hay que añadir algo nativo (notificaciones, Salud, etc.) |

## 2. Lo que ya está hecho
- Manifest con íconos (incluye *maskable*), categorías y accesos directos (Entrenar / Comida / Progreso).
- Política de privacidad pública: `privacy.html` (se regenera con `node tests/build-privacy.js`).
- Aviso de salud dentro de Privacidad.
- Borrado de cuenta y de datos dentro de la app (Más → Cuenta y nube → Borrar mi cuenta). Google lo exige.
- Sin publicidad, sin rastreadores, funciona offline.
- Pruebas automáticas (`node tests/static.js` y `tests/smoke.html`).
- Registro de errores internos que viaja con el feedback (si la persona lo permite).

## 3. Lo que falta (en orden)
1. **Dominio propio** (~$10–15/año) *o* un repositorio llamado `edejesusrv1201-cyber.github.io`.
   Google verifica la app con un archivo `/.well-known/assetlinks.json` que debe estar en la **raíz** del dominio; con la dirección actual (`.../Gymtrack/`) no se puede.
2. **Correo para enviar emails de confirmación** (SMTP propio: Resend, Brevo, etc.). El correo gratis de Supabase limita a muy pocos mensajes por hora y se atoraría con más gente.
3. **Material de la ficha**: ícono 512, gráfico de 1024×500, 4–8 capturas de pantalla, descripción corta y larga, categoría *Salud y bienestar*.
4. **Formularios de Play Console**: Seguridad de los datos (datos que se recogen: correo, datos de salud y forma física opcionales, cifrados en tránsito, se pueden borrar), clasificación de contenido, política de privacidad (URL de `privacy.html`), URL/forma de borrar la cuenta.
5. **Prueba cerrada**: las cuentas personales nuevas suelen necesitar un grupo de testers (12 personas durante 14 días) antes de publicar. Verifícalo en Play Console porque las reglas cambian. Tus amigos que ya prueban la app sirven para esto.
6. **Plan de respaldo de Supabase** (el plan gratis no hace copias automáticas; Pro sí) cuando haya usuarios reales.

## 4. Decisiones que conviene tomar juntos
- **Nombre y marca**: ¿MyGymTrack se queda? Revisar que no choque con otra app/marca antes de publicar.
- **¿Gratis, con anuncios o con plan de pago?** Hoy todo es gratis. Lo natural: gratis + opcional "Pro" (nube, ranking, dieta automática). Google Play cobra ~15 % de lo que se venda.
- **Quién administra**: hoy el panel de administración solo lo ve tu cuenta. Con un socio, se añade su correo a la tabla `gt_admins` (instrucción en `supabase/admin.sql`).
- **Soporte**: un correo de contacto visible en la ficha (no está puesto en `privacy.html` a propósito: añade el que decidan).
- **Contenido médico**: las dietas y calorías son estimaciones; el aviso de salud ya está. Si crece, conviene que lo revise un nutriólogo.

## 5. Pasos técnicos para Google Play (cuando estén 1–4)
1. Abrir <https://pwabuilder.com>, pegar la URL de la app, revisar el reporte (debe salir en verde) y generar el paquete Android.
2. Guardar la **llave de firma** en un lugar seguro (si se pierde, no se puede actualizar la app).
3. Subir el `.aab` a Play Console → prueba cerrada → producción.
4. Cada actualización de la web se refleja sola en la app de Play (es una TWA): no hay que volver a subir nada salvo cambios del paquete.

## 6. Proteger el código (decidido por partes)

Ya está: archivo LICENSE (todos los derechos reservados), aviso © en la app y `js/guard.js`
(la app solo abre en las direcciones de `hosts` en config.js; si cambias de dominio, agrégalo antes).
Eso frena copias simples, pero quien sepa programar puede quitarlo: el código de una web siempre se puede leer.

Falta (requiere decidirlo):
- **Repositorio privado para el código** y publicar solo la versión comprimida/ofuscada. En GitHub gratis,
  Pages deja de funcionar si el repo es privado: se usa un repo público solo con el resultado, o Netlify /
  Cloudflare Pages (gratis con repo privado). El historial público actual sigue mostrando el código viejo.
- Registrar la obra (Dirección Nacional de Derecho de Autor) y la marca (DIGERPI) en Panamá.
- La protección fuerte es el servidor: cuentas y membresía validadas en Supabase.

## 7. APK, iPhone y widgets

- **Hoy:** Android → «Instalar app» crea una app real (WebAPK) que se actualiza sola. iPhone → Safari →
  Compartir → «Añadir a pantalla de inicio». Accesos rápidos en Android al mantener presionado el icono.
- **APK / Play Store:** TWA (PWABuilder o Bubblewrap). La app sigue cargando la web, así que se actualiza
  sola; solo se vuelve a subir si cambian nombre, icono o permisos. Requiere `assetlinks.json` en la raíz
  del dominio (dominio propio o repo `<usuario>.github.io`) y guardar bien la llave de firma.
- **App Store:** envoltura con Capacitor, Mac con Xcode y 99 USD/año; Apple rechaza webs sin funciones nativas.
- **Widgets en pantalla:** una web no puede. Se necesitan en código nativo (Android: AppWidget en la
  envoltura Capacitor; iOS: WidgetKit). Hacerlo junto con la publicación en tiendas.
