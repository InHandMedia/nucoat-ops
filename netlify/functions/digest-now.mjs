// The "Send me this week's digest now" button on the Team tab. Owner only:
// the caller's sign-in is checked with Supabase before anything is sent.
import { config, table, sendDigest } from '../lib/digest.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const cfg = config();
  if (!cfg.url || !cfg.anon || !cfg.secret) {
    return Response.json({ ok: false, message: 'Not set up yet. Add SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY in Netlify, Environment variables, then redeploy.' });
  }
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return Response.json({ ok: false, message: 'Sign in first.' }, { status: 401 });

  const who = await fetch(`${cfg.url}/auth/v1/user`, { headers: { apikey: cfg.anon, Authorization: `Bearer ${jwt}` } });
  if (!who.ok) return Response.json({ ok: false, message: 'Sign in again, then retry.' }, { status: 401 });
  const user = await who.json();
  if (!/^[0-9a-f-]{36}$/i.test(user.id || '')) return Response.json({ ok: false, message: 'Sign in again, then retry.' }, { status: 401 });
  const rows = await table(cfg, 'profiles', `select=role&id=eq.${user.id}`);
  if (rows[0]?.role !== 'owner') return Response.json({ ok: false, message: 'Only the owner can send the digest.' }, { status: 403 });

  try {
    return Response.json(await sendDigest());
  } catch (e) {
    return Response.json({ ok: false, message: e.message || 'Something went wrong building the digest.' });
  }
};
