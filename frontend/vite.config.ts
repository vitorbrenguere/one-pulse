import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Fuso fixo nos testes: garante que bugs de timezone (spec 05 §4.5, UI-05) apareçam
// em qualquer máquina, inclusive em CI rodando em UTC.
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Spec 05 §2.1 (D-02): mesma origem para o navegador → o cookie httpOnly SameSite=Lax é enviado.
    proxy: {
      '/api': { target: 'http://localhost:3333', changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
