// api/generate.js (debug version) — deploy to Vercel
import { createClient } from '@supabase/supabase-js';

const ALLOW_HEADERS = 'Content-Type, Authorization';
const ALLOW_METHODS = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const allowOrigin = allowed === '*' ? '*' : (origin || allowed);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Access-Control-Allow-Credentials': 'true',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || '';
  const ch = corsHeaders(origin);

  try {
    // quick env dump (masked) for debugging
    const env = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      HOST_SECRET: !!process.env.HOST_SECRET,
      ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN ?? null
    };

    // OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...ch, 'Content-Type': 'text/plain' });
      return res.end('');
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    }

    const { host_secret, family_code } = req.body || {};
    if (!host_secret || !family_code) {
      res.writeHead(400, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Missing host_secret or family_code' }));
    }

    if (host_secret !== process.env.HOST_SECRET) {
      res.writeHead(403, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Invalid host secret' }));
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY in env', env }));
    }

    // create client
    let supabase;
    try {
      supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    } catch (e) {
      console.error('createClient error', e);
      res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'createClient failed', detail: String(e), env }));
    }

    // call RPC
    const { data, error } = await supabase.rpc('generate_assignments_for_family', { in_family_code: family_code });

    if (error) {
      console.error('RPC returned error object:', error);
      res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'RPC error', detail: error }));
    }

    res.writeHead(200, { ...ch, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, message: data || 'generated', env }));
  } catch (err) {
    console.error('Unhandled exception:', err);
    res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Unhandled exception', message: String(err), stack: err?.stack }));
  }
}
