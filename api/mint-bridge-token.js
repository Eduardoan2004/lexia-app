// ════════════════════════════════════════════════════════
//  EANDRES SIL — Puente de sesión entre index.html y los
//  módulos embebidos (Dashboard AI, Biblioteca, Interacciones)
//
//  Recibe el ID token del sistema principal, lo verifica con
//  Firebase Admin, y devuelve un Custom Token para el mismo
//  usuario, que el módulo usa para loguearse en su propia
//  instancia de Firebase Auth — sin depender de que el
//  navegador comparta localStorage/cookies entre dominios.
// ════════════════════════════════════════════════════════
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT en Vercel');
  const serviceAccount = JSON.parse(raw);
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://lexia-app-gamma.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'Falta idToken' });

    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(idToken);
    const customToken = await getAuth(app).createCustomToken(decoded.uid);
    return res.status(200).json({ customToken });
  } catch (err) {
    console.error('mint-bridge-token error:', err.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
