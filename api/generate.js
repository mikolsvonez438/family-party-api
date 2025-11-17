// api/generate.js
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
    // needed for some browsers to expose response body to JS
    'Access-Control-Allow-Credentials': 'true',
  };
}

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin || req.headers.referer || '';
    const ch = corsHeaders(origin);

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...ch,
        'Content-Type': 'text/plain'
      });
      return res.end('');
    }

    // Only accept POST for generation
    if (req.method !== 'POST') {
      res.writeHead(405, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    // Parse body
    const { host_secret, family_code } = req.body || {};
    if (!host_secret || !family_code) {
      res.writeHead(400, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing host_secret or family_code' }));
    }

    const HOST_SECRET = process.env.HOST_SECRET;
    if (!HOST_SECRET || host_secret !== HOST_SECRET) {
      res.writeHead(403, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid host secret' }));
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing supabase config' }));
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data, error } = await supabase.rpc('generate_assignments_for_family', { in_family_code: family_code });

    if (error) {
      // return safe error to client
      console.error('RPC error:', error);
      res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Generation failed', detail: error.message || error }));
    }

    res.writeHead(200, { ...ch, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: data || 'generated' }));
  } catch (err) {
    console.error('Unhandled exception in /api/generate:', err);
    const origin = req?.headers?.origin || req?.headers?.referer || '';
    const ch = corsHeaders(origin);
    res.writeHead(500, { ...ch, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Server error', message: String(err) }));
  }
}
