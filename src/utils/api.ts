export const getBaseUrl = () => {
  const isCapacitor =
    (window as any).Capacitor !== undefined ||
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:';

  // 1) User-configured server URL (from Login → "إعدادات السيرفر")
  let saved = localStorage.getItem('API_BASE_URL');
  if (saved) {
    saved = saved.trim();
    if (saved && !saved.startsWith('http://') && !saved.startsWith('https://')) {
      saved = 'http://' + saved;
    }
    
    // In web browser environment, purge stale/mismatched API_BASE_URL entries
    if (!isCapacitor) {
      try {
        const parsedSaved = new URL(saved);
        if (parsedSaved.host !== window.location.host) {
          // If saved points to a different host (e.g. old preview URL or stale localhost), clear it
          localStorage.removeItem('API_BASE_URL');
          saved = null;
        }
      } catch (_) {
        localStorage.removeItem('API_BASE_URL');
        saved = null;
      }
    }

    if (saved) {
      return saved.replace(/\/$/, '');
    }
  }

  // 2) Detect Capacitor / Cordova / file:// webview
  if (isCapacitor) {
    const meta = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
    if (meta?.content && (meta.content.startsWith('http://') || meta.content.startsWith('https://'))) {
      return meta.content.replace(/\/$/, '');
    }
    return 'http://192.168.1.100:3000'; // Default fallback for Capacitor
  }

  return window.location.origin;
};

export const resolveUrl = (url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = getBaseUrl();
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

/**
 * Detect whether the app is running inside a Capacitor mobile webview.
 * Used to adjust UX (no HMR, no dev-only features, etc.)
 */
export const isMobileApp = () => {
  return (
    (window as any).Capacitor !== undefined ||
    window.location.protocol === 'file:' ||
    window.location.protocol === 'capacitor:'
  );
};

/**
 * A JWT always has three dot-separated, non-empty segments. Anything else
 * ("null", "undefined", an empty string, "preview-bypass-token", a truncated
 * value) can never pass `jwt.verify()` on the server and used to surface as the
 * "jwt malformed" error. Such values are never sent as a bearer token.
 */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const NON_JWT_VALUES = new Set(['', 'null', 'undefined', 'NaN']);

export const isUsableAuthToken = (value: string | null | undefined): value is string => {
  if (typeof value !== 'string') return false;
  const token = value.trim();
  return !NON_JWT_VALUES.has(token) && JWT_SHAPE.test(token);
};

const isEmployeeRequestUrl = (url?: string) =>
  !!url && (
    url.includes('/employee-portal') ||
    url.includes('/mobile-checkin') ||
    url.includes('/employee-login')
  );

/**
 * Returns the token that may safely be attached to a request, or null.
 *
 * SECURITY: this used to fall back to the hard-coded "preview-bypass-token"
 * whenever no user token was stored. That value is not a JWT, so every request
 * made before login (or after the token was cleared) was rejected with
 * "jwt malformed" and filled the server log. Anonymous requests now simply omit
 * the Authorization header and receive a clean 401 on protected routes.
 */
export const getAuthToken = (url?: string): string | null => {
  const userToken = localStorage.getItem('token');
  if (isEmployeeRequestUrl(url)) {
    const employeeToken = localStorage.getItem('employee_mobile_token');
    if (isUsableAuthToken(employeeToken)) return employeeToken.trim();
    return isUsableAuthToken(userToken) ? userToken.trim() : null;
  }

  if (isUsableAuthToken(userToken)) return userToken.trim();
  const employeeToken = localStorage.getItem('employee_mobile_token');
  return isUsableAuthToken(employeeToken) ? employeeToken.trim() : null;
};

/** Builds request headers, adding Authorization only when a usable JWT exists. */
export const authHeaders = (
  extraHeaders: Record<string, string> = {},
  url?: string
): Record<string, string> => {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = getAuthToken(url);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const getHeaders = (extraHeaders: Record<string, string> = {}, url?: string) => {
  return {
    'Accept': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    'ngrok-skip-browser-warning': 'true',
    ...authHeaders(extraHeaders, url)
  };
};

const checkHtmlResponse = (res: Response, method: string, url: string) => {
  if (res.status === 401) {
    const isEmployeeUrl = url.includes('/employee-portal') || url.includes('/employee-login') || url.includes('/attendance/mobile-checkin');
    if (isEmployeeUrl || localStorage.getItem('employee_mobile_token')) {
      localStorage.removeItem('employee_mobile_token');
      localStorage.removeItem('employee_mobile_profile');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return;
  }

  if (res.status === 403) {
    console.warn(`API ${method} ${url} denied with ${res.status}`);
    return;
  }

  // Handle transient gateway/server errors during cold-starts or restarts (502/503/504)
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    console.warn(`[API] Server is starting or temporarily unavailable (${res.status}) on ${method} ${url}`);
    res.json = async () => {
      throw new Error(`Server temporarily unavailable (${res.status})`);
    };
    return;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    if (!res.ok) {
      console.warn(`API ${method} ${url} returned ${res.status} HTML error page`);
    } else {
      console.warn(`API ${method} ${url} returned HTML instead of JSON`);
    }
    // Provide safe fallback json method to prevent uncaught exceptions
    res.json = async () => {
      return {};
    };
  }
};

const safeFetchWithRetry = async (url: string, initOptions: RequestInit = {}): Promise<Response> => {
  let resolved = resolveUrl(url);
  try {
    const res = await fetch(resolved, initOptions);
    return res;
  } catch (err) {
    // If request failed due to network / CORS error and API_BASE_URL was saved, clear it and retry with window.location.origin
    if (localStorage.getItem('API_BASE_URL')) {
      console.warn(`[API] Fetch failed for ${resolved}. Clearing stale API_BASE_URL and retrying...`);
      localStorage.removeItem('API_BASE_URL');
      resolved = `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
      try {
        const retryRes = await fetch(resolved, initOptions);
        return retryRes;
      } catch (_) {}
    }
    // Brief retry delay for cold starts / dev server restarts
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const fallbackRes = await fetch(resolved, initOptions);
      return fallbackRes;
    } catch (finalErr) {
      console.warn(`[API] Fetch failed after retry for ${resolved}:`, finalErr);
      throw finalErr;
    }
  }
};

export const authFetch = async (url: string, options: RequestInit = {}) => {
  const resolved = resolveUrl(url);
  const headers = getHeaders((options.headers as Record<string, string>) || {}, url);
  const res = await safeFetchWithRetry(url, { ...options, headers });
  checkHtmlResponse(res, options.method || 'GET', resolved);
  return res;
};

export const apiFetch = authFetch;

export const api = {
  get: async (url: string) => {
    const resolved = resolveUrl(url);
    const res = await safeFetchWithRetry(url, {
      headers: getHeaders({}, url)
    });
    checkHtmlResponse(res, 'GET', resolved);
    return res;
  },
  post: async (url: string, body: any) => {
    const resolved = resolveUrl(url);
    const res = await safeFetchWithRetry(url, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }, url),
      body: JSON.stringify(body)
    });
    checkHtmlResponse(res, 'POST', resolved);
    return res;
  },
  put: async (url: string, body?: any) => {
    const resolved = resolveUrl(url);
    const res = await safeFetchWithRetry(url, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }, url),
      body: JSON.stringify(body)
    });
    checkHtmlResponse(res, 'PUT', resolved);
    return res;
  },
  delete: async (url: string) => {
    const resolved = resolveUrl(url);
    const res = await safeFetchWithRetry(url, {
      method: 'DELETE',
      headers: getHeaders({}, url)
    });
    checkHtmlResponse(res, 'DELETE', resolved);
    return res;
  },
  patch: async (url: string, body?: any) => {
    const resolved = resolveUrl(url);
    const res = await safeFetchWithRetry(url, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }, url),
      body: JSON.stringify(body)
    });
    checkHtmlResponse(res, 'PATCH', resolved);
    return res;
  }
};
