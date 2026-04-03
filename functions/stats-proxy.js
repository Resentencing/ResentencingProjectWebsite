// Hostname for the main Netlify site
const NETLIFY_SITE_HOST = 'resentencing.netlify.app';

// Explicit local dev origins
const LOCAL_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

// Public-safe datasets exposed by the Flask stats endpoint
const ALLOWED_DATASETS = new Set([
  'years_reduced',
  'sentence_type',
  'parole_eligibility'
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

  // Only accept GET
  if (event.httpMethod !== 'GET') {
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

  // Require server-side stats endpoint
  const STATS_API_URL = process.env.STATS_API_URL;
  if (!STATS_API_URL) {
    return {
      statusCode: 500,
      headers: cors(event),
      body: 'Server misconfigured'
    };
  }

  // Validate requested dataset before forwarding upstream
  const dataset = (event.queryStringParameters?.dataset || '').trim();
  if (!ALLOWED_DATASETS.has(dataset)) {
    return {
      statusCode: 400,
      headers: cors(event),
      body: 'Invalid dataset'
    };
  }

  // Forward to backend stats endpoint
  try {
    const url = new URL(STATS_API_URL);
    url.searchParams.set('dataset', dataset);

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
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
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };

  return allow
    ? { ...base, 'Access-Control-Allow-Origin': allow }
    : base;
}
