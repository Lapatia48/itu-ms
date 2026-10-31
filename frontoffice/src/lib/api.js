// Client HTTP de l'API ITU Motor Society. Le proxy Vite renvoie /api vers le
// backend : aucune URL absolue a configurer en developpement.
const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const TOKEN_KEY = 'itu.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Emis quand le backend repond 401 : la coquille applicative ecoute cet
// evenement pour deconnecter proprement (token expire en cours de session).
const UNAUTHORIZED = 'itu:unauthorized';

export function onUnauthorized(handler) {
  window.addEventListener(UNAUTHORIZED, handler);
  return () => window.removeEventListener(UNAUTHORIZED, handler);
}

async function request(method, path, body, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Serveur injoignable. Réessayez dans un instant.', 0);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !options.silent401) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED));
    }
    // Le proxy Vite renvoie 502/503/504 quand le backend n'ecoute pas sur le
    // port 4000 : « Erreur 502 » n'aide personne, autant dire quoi faire.
    const injoignable = [502, 503, 504].includes(response.status);
    throw new ApiError(
      json?.message
        || (injoignable
          ? 'Serveur injoignable. Réessayez dans un instant.'
          : `Erreur ${response.status}`),
      response.status,
      json?.details
    );
  }

  return json?.data !== undefined ? json.data : json;
}

// Serialise les filtres en query string en ignorant les valeurs vides.
function withQuery(path, params) {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const api = {
  get: (path, params, options) => request('GET', withQuery(path, params), undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  del: (path, options) => request('DELETE', path, undefined, options),
};
