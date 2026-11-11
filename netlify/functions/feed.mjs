// Private calendar feed. Apple Calendar (and its Mac widget) subscribes to
//   https://<site>/.netlify/functions/feed?token=<your token>
// and gets that person's open tasks and meetings. The token is checked in the
// database (function calendar_feed in supabase/migration_07_workspace.sql).
export default async (req) => {
  const token = new URL(req.url).searchParams.get('token') || '';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Not found', { status: 404 });

  const url = Netlify.env.get('VITE_SUPABASE_URL');
  const key = Netlify.env.get('VITE_SUPABASE_ANON_KEY');
  if (!url || !key) return new Response('Feed is not configured', { status: 500 });

  const res = await fetch(`${url}/rest/v1/rpc/calendar_feed`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token })
  });
  if (!res.ok) return new Response('Feed unavailable', { status: 502 });
  const ics = await res.json();
  if (!ics) return new Response('Not found', { status: 404 });

  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' }
  });
};
