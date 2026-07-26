/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Both `.loca.lt` (localtunnel) and `.trycloudflare.com` (cloudflared
  // quick tunnels) are allow-listed — localtunnel's own infrastructure
  // proved unreliable (its data-connection port was refused from this
  // network), so the working setup ended up being cloudflared, but there's
  // no reason to pull the first one back out.
  server: {
    // Allows a tunnel to reach this dev server for a quick phone-shareable
    // preview — Vite otherwise rejects any request whose Host header it
    // doesn't recognize, as a DNS-rebinding guard. Local-only, dev-
    // convenience change; not meant to be a permanent part of this config.
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
  // `preview` (serves the production build via `vite preview`) has its own
  // allowedHosts, separate from `server` above — a tunnel pointed at the
  // preview port needs this too, and the preview server is the one actually
  // used for phone-sharing (see the note above `server`): a production
  // build is a handful of bundled files with no HMR websocket to fail,
  // unlike dev mode's hundreds of individual module requests, which is far
  // more likely to load reliably over a free tunnel.
  preview: {
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
  test: {
    environment: 'jsdom',
  },
});
