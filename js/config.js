/* ============================================================
   config.js — Conexión al servidor del ranking global (Supabase).
   Se llena una sola vez (ver supabase/setup.sql). La clave "pública"
   (anon / publishable) está pensada para ir en la app: no da acceso
   a las tablas, solo a las funciones del ranking.
   ============================================================ */
window.GT_CONFIG = {
  supabaseUrl: 'https://hbcruzvypyzuqyabjskx.supabase.co',
  friends: true,  // liga de amigos (supabase/friends.sql ya ejecutado el 2026-11-24)
  cloud: true,    // cuentas y respaldo en la nube (supabase/cloud.sql ya ejecutado el 2026-11-18)
  supabaseKey: 'sb_publishable_UxH6DEYxMsSTdCOEcORyzg_LoXGDbrP',   // clave pública (publishable)
};
