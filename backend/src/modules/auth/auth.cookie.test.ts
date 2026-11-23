import { describe, expect, it } from 'vitest';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions } from './auth.cookie.js';

describe('auth cookie', () => {
  it('[AUTH-07] usa o nome de cookie definido na spec', () => {
    expect(AUTH_COOKIE_NAME).toBe('onepulse_token');
  });

  it('[AUTH-09] em produção, o cookie é Secure', () => {
    expect(buildAuthCookieOptions('production', 28_800)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 28_800_000,
    });
  });

  it.each(['development', 'test'] as const)('[AUTH-09] em %s, o cookie NÃO é Secure', (nodeEnv) => {
    expect(buildAuthCookieOptions(nodeEnv, 28_800)).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 28_800_000,
    });
  });
});
