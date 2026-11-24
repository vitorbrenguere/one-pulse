import { z } from 'zod';
import { NotImplementedError } from '../../shared/errors/not-implemented.error.js';

/** Contratos de entrada (spec 02 §3). */
export interface UserIdParam {
  id: number;
}

export interface UpdateProfileInput {
  name?: string;
  jobTitle?: string | null;
}

/** Stub da fase RED: qualquer parse lança NotImplementedError. */
function notImplementedSchema<T>(name: string): z.ZodType<T> {
  return z.unknown().transform((): T => {
    throw new NotImplementedError(name);
  });
}

export const userIdParamSchema: z.ZodType<UserIdParam> = notImplementedSchema('userIdParamSchema');
export const updateProfileSchema: z.ZodType<UpdateProfileInput> = notImplementedSchema('updateProfileSchema');
