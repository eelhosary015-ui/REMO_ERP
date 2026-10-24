import { authHeaders, resolveUrl } from './api';

export const fetcher = (url: string) => {
  const resolved = resolveUrl(url);
  // SECURITY: the old fallback attached "Bearer preview-bypass-token" whenever
  // no user token was stored. It is not a JWT, so `jwt.verify()` on the server
  // threw "jwt malformed" for every such request. Anonymous requests now omit
  // the Authorization header and get a clean 401.
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...authHeaders({}, url)
  };
  return fetch(resolved, { headers })
    .then(res => {
      if (res.status === 401) {
        const isEmployeeUrl = url.includes('/employee-portal') || url.includes('/employee-login') || url.includes('/attendance/mobile-checkin');
        if (isEmployeeUrl) {
          localStorage.removeItem('employee_mobile_token');
          localStorage.removeItem('employee_mobile_profile');
        }
        return [];
      }
      if (res.status === 403) {
        return [];
      }
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        return [];
      }
      return res.json().catch(() => []);
    })
    .catch((err) => {
      console.warn(`Fetcher error for ${url}:`, err);
      return [];
    });
};
