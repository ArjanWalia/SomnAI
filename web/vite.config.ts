import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // getUserMedia (camera/mic) requires a secure context. localhost counts as
    // secure, so dev works without HTTPS. For LAN testing use `vite --host` with
    // a tunnel that terminates TLS.
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
