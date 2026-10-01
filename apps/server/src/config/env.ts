import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().default('mongodb://localhost:27017/forkcast'),
  JWT_SECRET: z.string().min(8).default('dev-secret-change-me-please'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  /** Public URL of this API (OAuth issuer, MCP resource URL). */
  PUBLIC_URL: z.url().default('http://localhost:3000'),
  /** Public URL of the web app (OAuth consent screen). */
  WEB_URL: z.url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default(''),
  COLLAB_DEBOUNCE: z.coerce.number().int().nonnegative().default(2000),
  MCP_RATE_LIMIT: z.coerce.number().int().positive().default(120),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  return EnvSchema.parse(config);
}
