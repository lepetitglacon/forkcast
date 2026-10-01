import { ConfigService } from '@nestjs/config';
import { createApp, startApp } from './bootstrap';
import type { Env } from './config/env';

async function main(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  app.enableShutdownHooks();
  await startApp(app, config.get('PORT', { infer: true }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
