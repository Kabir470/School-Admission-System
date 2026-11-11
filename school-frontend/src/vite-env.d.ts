/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time fallback for the backend URL. The runtime value in /config.js wins. */
  readonly VITE_API_URL?: string;
}

interface Window {
  /** Written by /config.js before the bundle loads. */
  __APP_CONFIG__?: { apiUrl?: string };
}
