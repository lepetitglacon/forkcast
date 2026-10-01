import 'reflect-metadata';
import { Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { MCP_SCOPES } from '@forkcast/shared';
import { AppModule } from './app.module';
import { CollabService } from './collab/collab.service';
import { DocErrorFilter } from './common/doc-error.filter';
import type { Env } from './config/env';
import { OAuthProviderService } from './oauth/oauth-provider.service';

export interface CreateAppOptions {
  logger?: LogLevel[] | false;
}

/** Build the Nest application (shared by `main.ts` and the e2e tests). */
export async function createApp(options: CreateAppOptions = {}): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: options.logger ?? ['log', 'warn', 'error'],
  });
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.enableCors({
    origin: true,
    credentials: false,
    exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Mcp-Session-Id', 'Mcp-Protocol-Version', 'Last-Event-ID'],
  });
  app.useGlobalFilters(new DocErrorFilter());

  const config = app.get(ConfigService<Env, true>);
  const publicUrl = new URL(config.get('PUBLIC_URL', { infer: true }));
  app.use(
    mcpAuthRouter({
      provider: app.get(OAuthProviderService),
      issuerUrl: publicUrl,
      baseUrl: publicUrl,
      scopesSupported: [...MCP_SCOPES],
      resourceName: 'Forkcast MCP',
      resourceServerUrl: new URL('/mcp', publicUrl),
      serviceDocumentationUrl: new URL('https://github.com/forkcast/forkcast#mcp'),
    }),
  );
  return app;
}

/** Start listening and attach the collaboration WebSocket endpoint. */
export async function startApp(app: NestExpressApplication, port: number): Promise<string> {
  await app.listen(port);
  app.get(CollabService).attach(app.getHttpServer());
  const url = await app.getUrl();
  Logger.log(`Forkcast server listening on ${url}`, 'Bootstrap');
  return url;
}
