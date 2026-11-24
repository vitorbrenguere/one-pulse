import { z } from 'zod';

/** Maior valor de uma coluna `INT UNSIGNED` do MySQL. */
export const INT_UNSIGNED_MAX = 4_294_967_295;

/**
 * ID numérico vindo da URL (path ou query string), onde tudo chega como string.
 * Regex explícita em vez de `z.coerce.number()`, que aceitaria "1e3" (1000), " 1" (1)
 * e "0x10" (16) como ids válidos (spec 02 D-05). Compartilhado pelas specs 02 e 03.
 */
export function idParam(message: string) {
  return z
    .string({ error: message })
    .regex(/^[1-9]\d{0,9}$/, message)
    .transform(Number)
    .refine((id) => id <= INT_UNSIGNED_MAX, message);
}
