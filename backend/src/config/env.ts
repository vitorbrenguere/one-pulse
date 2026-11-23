import { z } from 'zod';

/** Spec 01-auth §3.3: validado no boot (fail fast). */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3333),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65_535),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  JWT_SECRET: z.string().min(32, 'deve ter no mínimo 32 caracteres'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(28_800),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  CORS_ORIGIN: z.url(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida e normaliza as variáveis de ambiente. Chaves desconhecidas (o resto do
 * process.env) são descartadas. Em caso de erro, a mensagem lista cada variável inválida.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`);
    throw new Error(`Configuração de ambiente inválida:\n${lines.join('\n')}`);
  }
  return result.data;
}
