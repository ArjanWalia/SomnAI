import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SomnAI web app. The dev server runs on 5173 (see docs/SETUP.md).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
