// Registro integrado de WhatsApp (Meta Embedded Signup). El número queda bajo
// la app de Meta de Stackline: el navegador solo obtiene un código de un solo
// uso y los ids del número; el backend lo canjea por el token y lo guarda en el
// almacén de secretos. El token nunca pasa por el navegador.
//
// Requiere VITE_META_APP_ID y VITE_META_CONFIG_ID (configuración de inicio de
// sesión de tipo «WhatsApp Embedded Signup» en la app de Meta).

const APP_ID = import.meta.env.VITE_META_APP_ID;
const CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID;
const SDK = 'https://connect.facebook.net/es_LA/sdk.js';
const VERSION = 'v21.0';

export const metaSignupConfigured = () => Boolean(APP_ID && CONFIG_ID);

function cargarSdk() {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: VERSION });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onerror = () => reject(new Error('No se pudo cargar el SDK de Meta'));
    document.body.appendChild(s);
  });
}

/**
 * Abre la ventana de Meta y resuelve con { signupCode, wabaId, phoneNumberId }.
 * Rechaza si el cliente la cierra o no termina.
 */
export async function startEmbeddedSignup() {
  if (!metaSignupConfigured()) throw new Error('Falta VITE_META_APP_ID o VITE_META_CONFIG_ID');
  const FB = await cargarSdk();
  let ids = null;
  const escuchar = (e) => {
    if (!/facebook\.com$/.test(new URL(e.origin).hostname)) return;
    try {
      const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (d?.type === 'WA_EMBEDDED_SIGNUP' && d.event === 'FINISH') ids = { wabaId: d.data.waba_id, phoneNumberId: d.data.phone_number_id };
    } catch { /* mensajes que no son del registro */ }
  };
  window.addEventListener('message', escuchar);
  try {
    const code = await new Promise((resolve, reject) => {
      FB.login((r) => (r.authResponse?.code ? resolve(r.authResponse.code) : reject(new Error('Registro cancelado'))), {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      });
    });
    // El evento con los ids llega por postMessage, a veces después del callback.
    for (let i = 0; i < 20 && !ids; i += 1) await new Promise((r) => setTimeout(r, 150)); // eslint-disable-line no-await-in-loop
    if (!ids) throw new Error('Meta no devolvió el número registrado');
    return { signupCode: code, ...ids };
  } finally {
    window.removeEventListener('message', escuchar);
  }
}
