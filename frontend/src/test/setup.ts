import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { resetRequestLog, server } from './server';

// 'error': requisição sem handler falha alto, em vez de passar despercebida.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetRequestLog();
  vi.useRealTimers();
});

afterAll(() => server.close());
