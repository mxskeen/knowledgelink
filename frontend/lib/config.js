export const API_CONFIG = {
  BASE_URL: typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000') : '',
  ENDPOINTS: {
    LINKS: '/api/links',
    SEARCH: '/api/search',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_ME: '/api/auth/me',
    AUTH_LOGOUT: '/api/auth/logout',
  },
  TIMEOUT: 60000,
  RETRY_ATTEMPTS: 2,
};

export const getApiUrl = (endpoint) => {
  if (typeof window !== 'undefined' && !API_CONFIG.BASE_URL) return endpoint;
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export const fetchWithRetry = async (url, options = {}, retries = API_CONFIG.RETRY_ATTEMPTS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'include' });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (retries > 0 && (error.name === 'AbortError' || error.message.includes('timeout'))) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}; 