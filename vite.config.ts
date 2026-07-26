/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allows a localtunnel (npx localtunnel) to reach this dev server for a
    // quick phone-shareable preview — Vite otherwise rejects any request
    // whose Host header it doesn't recognize, as a DNS-rebinding guard.
    // Local-only, dev-convenience change; not meant to be a permanent part
    // of this config.
    allowedHosts: ['.loca.lt'],
  },
  test: {
    environment: 'jsdom',
  },
});
