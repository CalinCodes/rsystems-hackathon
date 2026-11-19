import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  // `npm run tunnel` serves the built app here and shares it through a Cloudflare quick tunnel.
  // WHY 127.0.0.1: only the tunnel reaches it, never the rest of the local network.
  // WHY allowedHosts: Vite refuses unknown Host headers (DNS-rebinding guard); only the tunnel's domain is added.
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts: ['.trycloudflare.com'] },
});
