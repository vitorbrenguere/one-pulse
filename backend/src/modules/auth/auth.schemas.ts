import { z } from 'zod';
import { NotImplementedError } from '../../shared/errors/not-implemented.error.js';

/** Contratos de entrada (spec 01-auth §3.1 e §3.2). */
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Stub da fase RED: qualquer parse lança NotImplementedError. */
function notImplementedSchema<T>(name: string): z.ZodType<T> {
  return z.unknown().transform((): T => {
    throw new NotImplementedError(name);
  });
}

export const registerSchema: z.ZodType<RegisterInput> = notImplementedSchema('registerSchema');
export const loginSchema: z.ZodType<LoginInput> = notImplementedSchema('loginSchema');
