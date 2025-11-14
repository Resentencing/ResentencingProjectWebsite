// Hostname for the main Netlify site
const NETLIFY_SITE_HOST = 'resentencing.netlify.app';

// Explicit local dev origins
const LOCAL_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;

  // Allow exact local dev origins
  if (LOCAL_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname;

    // Main production site
    if (host === NETLIFY_SITE_HOST) return true;

    // Netlify preview / branch deploy aliases for THIS site, e.g.:
    // pr-12--resentencing.netlify.app
    // my-feature--resentencing.netlify.app
    if (host.endsWith(`--${NETLIFY_SITE_HOST}`)) return true;

    return false;
  } catch {
    // Invalid origin string
    return false;
  }
}

export async function handler(event) {
  // Allow CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(event) };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors(event),
      body: 'Method Not Allowed'
    };
  }

  // Require known Origin (basic CSRF/abuse guard)
  const origin = header(event, 'origin');
  if (!isAllowedOrigin(origin)) {
    return {
      statusCode: 403,
      headers: cors(event),
      body: 'Forbidden'
    };
  }

  // Require server-side secrets
  const BACKEND_URL = process.env.BACKEND_URL;
  const API_KEY = process.env.API_KEY;
  if (!BACKEND_URL || !API_KEY) {
    return {
      statusCode: 500,
      headers: cors(event),
      body: 'Server misconfigured'
    };
  }

  // Basic JSON validation
  let payload;
  try {
    payload = JSON.parse(event.body || '');
  } catch {
    return {
      statusCode: 400,
      headers: cors(event),
      body: 'Invalid JSON'
    };
  }

  if (typeof payload?.query !== 'string' || !payload.query) {
    return {
      statusCode: 400,
      headers: cors(event),
      body: 'Invalid payload'
    };
  }

  // Forward to backend
  try {
    const resp = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY // secret for backend
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();

    if (resp.ok) {
      return {
        statusCode: resp.status,
        headers: {
          ...cors(event),
          'Content-Type':
            resp.headers.get('content-type') || 'application/json'
        },
        body: text
      };
    }

    // General error descriptors
    return {
      statusCode: resp.status,
      headers: {
        ...cors(event),
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: 'Upstream error'
    };
  } catch {
    return {
      statusCode: 502,
      headers: {
        ...cors(event),
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: 'Bad Gateway'
    };
  }
}

// helpers
function header(event, name) {
  // Netlify normalizes headers to lower-case, but we defend either way
  return (
    event?.headers?.[name] ||
    event?.headers?.[name.toLowerCase()] ||
    ''
  );
}

function cors(event) {
  const origin = header(event, 'origin');
  const allow = isAllowedOrigin(origin) ? origin : '';

  const base = {
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };

  return allow
    ? { ...base, 'Access-Control-Allow-Origin': allow }
    : base;
}