// Get API base URL with support for cross-device access
function getApiBaseUrl() {
  // 1. Check environment variable (set at build time for production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }
  
  // 2. Check localStorage (allows runtime configuration for cross-device access)
  const storedApiUrl = localStorage.getItem('apiBaseUrl');
  if (storedApiUrl) {
    try {
      const url = new URL(storedApiUrl);
      return url.origin;
    } catch (e) {
      console.warn('[CONFIG] Invalid API URL in localStorage, ignoring:', storedApiUrl);
      localStorage.removeItem('apiBaseUrl');
    }
  }
  
  // 3. Check URL parameter (for easy configuration: ?apiUrl=http://192.168.1.100:4000)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const paramApiUrl = urlParams.get('apiUrl');
    if (paramApiUrl) {
      try {
        const url = new URL(paramApiUrl);
        // Store in localStorage for future use
        localStorage.setItem('apiBaseUrl', url.origin);
        return url.origin;
      } catch (e) {
        console.warn('[CONFIG] Invalid API URL in query parameter:', paramApiUrl);
      }
    }
  }
  
  // 4. Auto-detect: if accessing from a local IP, try to use the same host
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    const currentProtocol = window.location.protocol;
    const currentPort = window.location.port;
    
    // If we're on a local IP (not localhost), try to use the same host for API
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      // Check if it's a local network IP
      const ipParts = currentHost.split('.').map(Number);
      if (ipParts.length === 4 && ipParts.every(p => !isNaN(p))) {
        const [a, b] = ipParts;
        // Check if it's a private IP range
        if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127) {
          // Use same host with default backend port
          const detectedUrl = `${currentProtocol}//${currentHost}:4000`;
          console.log('[CONFIG] Auto-detected API URL:', detectedUrl);
          return detectedUrl;
        }
      }
    }
  }
  
  // 5. Default fallback
  return "http://localhost:4000";
}

export const API_BASE_URL = getApiBaseUrl();

export const API_BASE = `${API_BASE_URL}/api`;

// Helper function to update API URL at runtime (useful for cross-device configuration)
export function setApiBaseUrl(url) {
  try {
    const apiUrl = new URL(url);
    localStorage.setItem('apiBaseUrl', apiUrl.origin);
    console.log('[CONFIG] API URL updated to:', apiUrl.origin);
    // Reload page to apply new configuration
    window.location.reload();
  } catch (e) {
    console.error('[CONFIG] Invalid API URL:', url, e);
    throw new Error('Invalid API URL format');
  }
}
