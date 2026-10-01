import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hocuspocus, onAuthenticatePayload } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, RawData, WebSocket } from 'ws';
import type * as Y from 'yjs';
import { initDoc, isInitialized, migrateDoc } from '@forkcast/doc';
import type { Role } from '@forkcast/shared';
import { AuthService } from '../auth/auth.service';
import type { Env } from '../config/env';
import { TokensService } from '../tokens/tokens.service';
import { AccessService } from '../trees/access.service';
import { TreesService } from '../trees/trees.service';
import { YDocStoreService } from '../trees/ydoc-store.service';

/** Context attached to every Hocuspocus connection (WebSocket or direct). */
export interface CollabContext {
  userId: string;
  role: Role;
  via: 'jwt' | 'pat' | 'mcp' | 'rest' | 'system';
  readOnly?: boolean;
}

export const COLLAB_PATH = '/collab';

function toFetchRequest(req: IncomingMessage): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else headers.set(key, value);
  }
  const host = req.headers.host ?? 'localhost';
  return new Request(`http://${host}${req.url ?? '/'}`, { method: 'GET', headers });
}

function toUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) {
    const buf = Buffer.concat(data);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Hocuspocus runs INSIDE the Nest process: it shares the HTTP server (WebSocket upgrade on
 * /collab), the auth services and the MongoDB connection. Tools (MCP, REST) open direct
 * connections on the same instance so their changes reach connected clients immediately.
 */
@Injectable()
export class CollabService implements OnModuleDestroy {
  private readonly logger = new Logger(CollabService.name);
  readonly hocuspocus: Hocuspocus<CollabContext>;
  private wss?: WebSocketServer;

  constructor(
    config: ConfigService<Env, true>,
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly access: AccessService,
    private readonly store: YDocStoreService,
    private readonly trees: TreesService,
  ) {
    const debounce = config.get('COLLAB_DEBOUNCE', { infer: true });
    this.hocuspocus = new Hocuspocus<CollabContext>({
      quiet: true,
      debounce,
      maxDebounce: Math.max(debounce * 5, 10_000),
      unloadImmediately: true,
      extensions: [
        new Database({
          fetch: async ({ documentName }) => this.store.load(documentName),
          store: async ({ documentName, state, document }) => {
            // A document whose tree was deleted meanwhile must not be re-created.
            if (!(await this.trees.findById(documentName))) return;
            await this.store.save(documentName, state);
            await this.trees.touch(documentName, TreesService.titleOf(document));
          },
        }),
      ],
      onAuthenticate: (payload) => this.authenticate(payload),
      afterLoadDocument: async ({ document, documentName }) => {
        if (!isInitialized(document)) {
          const tree = await this.trees.findById(documentName);
          initDoc(document, { title: tree?.title ?? 'Arbre' }, 'system');
        }
        migrateDoc(document, 'system');
      },
    });
  }

  private async authenticate(payload: onAuthenticatePayload<CollabContext>): Promise<CollabContext> {
    const identity = await this.resolveIdentity(payload.token);
    if (!identity) throw new Error('Unauthorized');
    const role = await this.access.getRole(identity.userId, payload.documentName);
    if (!role) throw new Error('Forbidden');
    const readOnly = role === 'viewer' || !identity.canWrite;
    if (readOnly) payload.connectionConfig.readOnly = true;
    return { userId: identity.userId, role, via: identity.via, readOnly };
  }

  private async resolveIdentity(token: string): Promise<{ userId: string; via: 'jwt' | 'pat'; canWrite: boolean } | null> {
    if (!token) return null;
    const jwt = this.auth.verify(token);
    if (jwt) return { userId: jwt.userId, via: 'jwt', canWrite: true };
    const pat = await this.tokens.verify(token);
    if (pat) return { userId: pat.userId, via: 'pat', canWrite: pat.scopes.includes('write') };
    return null;
  }

  /** Attach the WebSocket upgrade handler to Nest's HTTP server. */
  attach(httpServer: HttpServer): void {
    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;
    httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== COLLAB_PATH) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const connection = this.hocuspocus.handleConnection(ws, toFetchRequest(req));
        ws.on('message', (data: RawData) => connection.handleMessage(toUint8Array(data)));
        ws.on('close', (code: number, reason: Buffer) => connection.handleClose({ code, reason: reason.toString() }));
        ws.on('error', (error: Error) => {
          this.logger.warn(`WebSocket error: ${error.message}`);
          connection.handleClose({ code: 1011, reason: 'error' });
        });
      });
    });
    this.logger.log(`Collaboration endpoint ready on ${COLLAB_PATH}`);
  }

  /**
   * Run a synchronous function against the live document of a tree (loaded from MongoDB
   * when nobody has it open). Changes are broadcast to connected clients and persisted.
   */
  async withDocument<T>(treeId: string, context: CollabContext, fn: (doc: Y.Doc) => T): Promise<T> {
    const connection = await this.hocuspocus.openDirectConnection(treeId, context);
    try {
      let out!: T;
      await connection.transact((doc) => {
        out = fn(doc);
      });
      return out;
    } finally {
      await connection.disconnect();
    }
  }

  closeConnections(treeId: string): void {
    this.hocuspocus.closeConnections(treeId);
  }

  async onModuleDestroy(): Promise<void> {
    this.hocuspocus.flushPendingStores();
    this.hocuspocus.closeConnections();
    this.wss?.close();
    await this.hocuspocus.hooks('onDestroy', { instance: this.hocuspocus });
  }
}
