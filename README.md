# Forkcast

Éditeur web collaboratif d'**arbres de décision ET/OU** pour la phase préliminaire de conception
d'une fonctionnalité : on décompose le besoin, on liste les options techniques (outils, services,
approches), on attribue des coûts et des risques, et l'outil calcule et compare **toutes les
combinaisons possibles**.

Trois façons d'éditer le même arbre, toutes en temps réel :

1. **seul, hors ligne** dans le navigateur (local-first, sans compte) ;
2. **à plusieurs**, synchronisé par le serveur (Yjs + Hocuspocus) ;
3. **par un assistant IA** (Claude Code, Claude Desktop, claude.ai…) branché sur le **serveur MCP**
   du projet : ses modifications apparaissent en direct dans l'interface, sont marquées comme
   estimations et peuvent être annulées.

Ergonomie inspirée d'Excalidraw : canvas infini, édition clavier façon mind map, look crayonné
optionnel (police Excalifont + rough.js). Licence MIT.

---

## Sommaire

- [Sémantique ET/OU](#sémantique-etou)
- [Architecture local-first](#architecture-local-first)
- [Monorepo](#monorepo)
- [Démarrage](#démarrage)
- [Serveur : API, synchro, droits](#serveur--api-synchro-droits)
- [Serveur MCP](#serveur-mcp)
- [Déploiement](#déploiement)
- [Décisions structurantes](#décisions-structurantes)
- [Tests](#tests)

---

## Sémantique ET/OU

Un arbre est composé de **nœuds** de trois types :

| Type   | Badge | Signification                                                                 |
| ------ | ----- | ----------------------------------------------------------------------------- |
| `and`  | ET    | tous les enfants sont requis                                                  |
| `or`   | OU    | **exactement un** enfant est choisi (XOR) → une configuration par choix       |
| `leaf` | —     | une option / un élément concret, qui porte ses valeurs                        |

- Un enfant d'un nœud ET peut être **optionnel** : c'est un OU implicite entre « inclus » et « exclu ».
- Un nœud interne peut porter ses **propres valeurs** (coût fixe) : elles s'ajoutent à son agrégat.
- Les **critères** (coût mensuel, temps de dev, risque…) ont une **agrégation** et une **direction** :

| Agrégation | Combinaison des enfants d'un ET       | Élément neutre | Usage typique                        |
| ---------- | ------------------------------------- | -------------- | ------------------------------------ |
| `sum`      | Σ                                     | 0              | coûts, délais cumulés                |
| `max`      | max                                   | −∞ (absent)    | durée du chemin critique             |
| `min`      | min                                   | +∞ (absent)    | plus courte disponibilité            |
| `probOr`   | 1 − Π(1 − pᵢ)                         | 0              | risque = probabilité qu'au moins un… |

- Un critère **absent** sur un nœud vaut l'élément neutre de son agrégation. Pour `max`/`min`, un
  total sans aucune valeur reste « — ».
- Une **configuration** est un choix pour chaque nœud OU atteignable et pour chaque optionnel
  atteignable. Le moteur compte d'abord les configurations (`Π` pour un ET, `Σ` pour un OU,
  `n + 1` pour un optionnel), les **énumère** jusqu'à 5 000, et au-delà fournit sans énumérer le
  **front de Pareto** et le **top N par critère** (programmation dynamique, exacte car toutes les
  agrégations sont monotones).
- Chaque nœud OU (et chaque sous-arbre contenant des choix) expose une **plage \[min, max]** par
  critère ; un nœud replié affiche ce résumé.

## Architecture local-first

- Le document est un **Y.Doc** (Yjs) : `meta` (titre, racine, version de schéma), `criteria`,
  `nodes` (un `Y.Map` par nœud, `values` imbriqué) et `activity` (journal des modifications de
  l'assistant). Les enfants ne sont **pas** stockés dans un `Y.Array` : un déplacement = `parentId`
  + `orderKey` (fractional indexing) modifiés dans une transaction, ce qui évite les duplications de
  branches lors de déplacements concurrents. Les ids sont générés côté client (nanoid). Les
  positions ne sont pas stockées (layout calculé), l'état « replié » est local à chaque vue.
- Le **snapshot** (`Tree`) dérivé du Y.Doc est immuable et **réparé de façon déterministe** sur
  chaque client : cycles issus de déplacements concurrents cassés en rattachant à la racine le nœud
  d'id le plus petit du cycle, parents supprimés → racine, collisions d'`orderKey` départagées par id.
- **Toutes les écritures passent par les commandes de `@forkcast/doc`** (front, serveur, MCP) :
  validation Zod, erreurs typées (`NODE_NOT_FOUND`, `INVALID_MOVE`, `CRITERION_NOT_FOUND`…),
  transaction Yjs avec origine explicite (`local` | `mcp` | `import` | `system`). Chaque commande
  renvoie son **inverse sérialisable**, ce qui permet (1) l'annulation des modifications de
  l'assistant depuis n'importe quel client via le journal `activity`, (2) des lots atomiques
  (rollback manuel si une commande échoue).
- **Undo/redo** : `Y.UndoManager` limité aux transactions d'origine `local` ; les modifications
  distantes et celles de l'IA ne sont jamais annulées par Ctrl+Z.
- Hors ligne : chaque document est persisté dans IndexedDB (`y-indexeddb`), y compris les documents
  synchronisés, qui fusionnent à la reconnexion. Sans compte, l'application est 100 % fonctionnelle.
- Les valeurs écrites par l'assistant portent `estimatedBy: 'ai'` et sont affichées différemment
  jusqu'à ce qu'un humain les modifie.
- **Historique de toutes les modifications** : chaque commande, humaine ou IA, passe par
  `executeCommand` qui l'applique et l'inscrit dans le journal `activity` du document, avec son
  auteur, sa couleur et un résumé en français (`describeCommand`). Les modifications répétées d'une
  même chose par la même personne en moins de 30 s sont fusionnées. Le journal est partagé et
  synchronisé comme le reste du document (10 000 entrées au plus) ; les entrées de l'assistant
  conservent leurs commandes inverses pour être annulables depuis n'importe quel client.

## Monorepo

```
forkcast/
├── packages/
│   ├── shared/   schémas Zod + types : arbre, JSON d'import/export, commandes, DTO API, entrées des tools MCP
│   ├── engine/   moteur de calcul pur (agrégats, plages, énumération, Pareto, k-best, explication)
│   └── doc/      schéma Yjs, snapshot réparé, commandes + inverses, JSON ↔ Y.Doc, journal, undo, migrations
├── apps/
│   ├── web/      React 18 + Vite + React Flow + Yjs (local-first, collaboration, mode sketch)
│   └── server/   NestJS : API REST, Hocuspocus in-process (WebSocket /collab), serveur MCP, OAuth 2.1
├── docker-compose.yml        Mongo + server + web (nginx)
└── .github/workflows/ci.yml  build, typecheck, lint, tests, e2e
```

pnpm workspaces + Turborepo, TypeScript strict partout, configs ESLint/TS partagées à la racine,
Vitest pour les packages et le front, Jest pour Nest.

| Script (racine)  | Effet                                                   |
| ---------------- | ------------------------------------------------------- |
| `pnpm build`     | construit packages puis apps (`turbo run build`)        |
| `pnpm dev`       | packages en watch + Vite + Nest en watch                |
| `pnpm test`      | tests unitaires de tous les workspaces                  |
| `pnpm typecheck` | `tsc --noEmit` partout                                  |
| `pnpm lint`      | ESLint (flat config, règles React hooks pour le front)  |

## Démarrage

Prérequis : Node ≥ 22.12 (24 recommandé), pnpm 12, Docker (pour MongoDB).

```bash
pnpm install
docker compose up -d mongo      # MongoDB sur localhost:27017
cp apps/server/.env.example apps/server/.env   # ajuster JWT_SECRET, PUBLIC_URL, WEB_URL
pnpm build                      # construit les packages (nécessaire une première fois)
pnpm dev                        # web sur http://localhost:5173, API sur http://localhost:3000
```

Le front Vite proxifie `/api`, `/collab` (WebSocket) et `/mcp` vers le serveur : tout est servi
depuis `http://localhost:5173`. Au premier lancement, un arbre d'exemple (« Ajouter le paiement en
ligne ») est créé localement.

Pile complète en conteneurs (front nginx + API + Mongo) :

```bash
docker compose up --build       # http://localhost:8080
```

## Serveur : API, synchro, droits

Variables d'environnement (`apps/server/.env.example`) : `PORT`, `MONGO_URI`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `PUBLIC_URL` (URL publique de l'API, utilisée comme issuer OAuth et URL de
ressource MCP), `WEB_URL` (écran de consentement OAuth), `COLLAB_DEBOUNCE`, `MCP_RATE_LIMIT`.

API REST (JWT `Authorization: Bearer`) :

| Route                                           | Rôle                                               |
| ----------------------------------------------- | -------------------------------------------------- |
| `POST /api/auth/register`, `/login`, `GET /me`  | comptes                                            |
| `GET/POST /api/trees`, `GET/PATCH/DELETE /:id`  | métadonnées des arbres (`initialState` base64 Yjs) |
| `GET/PATCH/DELETE /api/trees/:id/members/:uid`  | propriétaire / éditeur / lecteur                   |
| `POST /api/trees/:id/invitations`               | lien d'invitation (rôle, expiration)               |
| `GET/POST /api/invitations/:token[/accept]`     | aperçu et acceptation                              |
| `GET/POST/DELETE /api/tokens`                   | tokens d'accès personnels MCP (scopes read/write)  |
| `GET /api/oauth/consent/:id`, `POST /decision`  | écran de consentement OAuth (web)                  |

Synchro : WebSocket Hocuspocus sur **`/collab`**, nom de document = id de l'arbre, `token` = JWT
(ou token personnel). `onAuthenticate` vérifie le rôle ; un **lecteur** obtient une connexion en
lecture seule (ses modifications sont ignorées côté serveur). Persistance MongoDB (collection
`ydocs`) via l'extension Database, avec debounce ; le titre et la date de mise à jour des métadonnées
sont resynchronisés à chaque sauvegarde.

Le serveur **n'implémente aucune logique métier** : il importe `@forkcast/doc` et `@forkcast/engine`.

## Serveur MCP

Endpoint **`POST /mcp`** (Streamable HTTP, sans état). Authentification par en-tête
`Authorization: Bearer …` :

- **token d'accès personnel** (`fkp_…`) créé dans l'interface (Compte → Tokens MCP), révocable,
  scopé `read` et/ou `write`, avec expiration optionnelle ;
- **jeton OAuth 2.1** (`fko_…`) obtenu par un connecteur distant (claude.ai, Claude Desktop) :
  enregistrement dynamique des clients (`POST /register`), PKCE, `/authorize` → consentement dans
  l'app web → `/token`, refresh tokens, révocation, métadonnées `/.well-known/oauth-authorization-server`
  et `/.well-known/oauth-protected-resource/mcp`.

Principe : chaque tool ouvre le Y.Doc via une **connexion directe Hocuspocus** (dans le même
process), applique les commandes de `@forkcast/doc` avec l'origine `mcp`, enregistre une entrée dans
le journal `activity` du document (résumé, nœuds touchés, commandes inverses) et referme la
connexion. Les clients connectés voient le changement en direct, surligné « modifié par
l'assistant », annulable en un clic. Toutes les valeurs écrites sont marquées `estimatedBy: 'ai'`.

| Tool                     | Description                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `list_trees`             | arbres accessibles (id, titre, rôle)                                                     |
| `create_tree`            | nouvel arbre, critères et arbre complet imbriqué en un appel                             |
| `get_tree`               | snapshot lisible imbriqué, agrégats et plages des nœuds à choix                          |
| `build_subtree`          | **tool principal** : insère une branche entière depuis une structure imbriquée           |
| `add_node` / `update_node` / `move_node` / `delete_node` | édition unitaire (suppression > 5 nœuds : `confirm: true` exigé) |
| `set_values`             | valeurs en lot `[{ nodeId, criterionId, value }]`                                        |
| `add_criterion` / `update_criterion` | critères                                                                     |
| `compute_configurations` | nombre total, front de Pareto, top N par critère, résumés lisibles des choix             |
| `explain_configuration`  | détail des nœuds inclus et contribution de chacun au total                               |
| `export_tree` / `import_tree` | JSON forkcast (`format: "forkcast-tree"`)                                           |

Resources : `tree://{treeId}` (JSON avec agrégats, listées pour l'utilisateur du token).
Prompt : `explore_feature_options` (feature, contexte, arbre existant) guide l'assistant pour
décomposer, proposer des alternatives, estimer puis comparer.

Règles : ids stables, erreurs explicites (`ERROR NODE_NOT_FOUND: …`, `CONFIRM_REQUIRED`,
`READ_ONLY_TOKEN`, `FORBIDDEN`…), respect des droits du token et du rôle sur l'arbre, rate limiting
par token, journal des opérations dans MongoDB (`mcp_operations`).

### Configuration dans Claude Code

```bash
claude mcp add --transport http forkcast https://<votre-serveur>/mcp \
  --header "Authorization: Bearer fkp_xxxxxxxxxxxxxxxx"
```

### Configuration dans Claude Desktop (token personnel, via `mcp-remote`)

```json
{
  "mcpServers": {
    "forkcast": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<votre-serveur>/mcp", "--header", "Authorization: Bearer fkp_xxxxxxxxxxxxxxxx"]
    }
  }
}
```

### Connecteur distant (claude.ai, Claude Desktop → Connecteurs)

Ajoutez `https://<votre-serveur>/mcp` : le client découvre le serveur d'autorisation via
`/.well-known/oauth-protected-resource/mcp`, s'enregistre dynamiquement, puis vous redirige vers
l'application web (`<WEB_URL>/oauth/consent`) pour autoriser l'accès avec votre compte.
`PUBLIC_URL` doit être l'URL publique **exacte** du serveur (issuer OAuth).

## Déploiement

- **Front statique** : `pnpm --filter @forkcast/web build` → `apps/web/dist`, à publier sur
  **Cloudflare Pages** (ou tout hébergeur statique). Définir `VITE_API_URL=https://api.exemple.com`
  et `VITE_WS_URL=wss://api.exemple.com/collab` au build. Prévoir un rewrite SPA (`/* → /index.html`).
- **Serveur** : image `apps/server/Dockerfile` (multi-stage, `pnpm deploy`) sur **Fly.io**,
  **Railway** ou un VPS. Variables : `MONGO_URI` (MongoDB Atlas), `JWT_SECRET` (long et aléatoire),
  `PUBLIC_URL=https://api.exemple.com`, `WEB_URL=https://app.exemple.com`. Le serveur doit accepter
  les WebSockets (`/collab`).
- **MongoDB Atlas** : un cluster M0 suffit pour démarrer ; collections `users`, `trees`,
  `memberships`, `invitations`, `ydocs`, `mcp_tokens`, `mcp_operations`, `oauth_*`.
- Alternative tout-en-un : `docker compose up --build` derrière un reverse proxy TLS (le front
  nginx proxifie `/api`, `/collab`, `/mcp` et les routes OAuth vers le serveur, donc une seule origine).

## Décisions structurantes

- **Yjs plutôt que Loro.** Loro offre un *movable tree* natif, mais son écosystème serveur
  (équivalent Hocuspocus, providers, persistance, awareness, undo) est bien plus mince. Le modèle
  « pas de `Y.Array` d'enfants, déplacement = `parentId` + `orderKey` » plus le snapshot réparé de
  façon déterministe couvrent les cas de déplacements concurrents sans dépendre d'un CRDT d'arbre.
- **Hocuspocus dans le process Nest** (upgrade WebSocket sur le serveur HTTP de Nest) plutôt qu'en
  process séparé : une seule base, une seule authentification, un seul déploiement, et surtout les
  tools MCP et l'API REST utilisent `openDirectConnection` sur la même instance (document en mémoire,
  diffusion immédiate aux clients). Le module `collab` est isolé ; le passer en process séparé
  reviendrait à remplacer les connexions directes par un `HocuspocusProvider` côté serveur.
- **MCP sans état** (`sessionIdGenerator: undefined`, réponses JSON) : un serveur MCP par requête,
  pas de session à maintenir, horizontalement scalable, et simple à proxifier.
- **Inverses sérialisables** plutôt qu'un second `UndoManager` pour annuler les modifications de
  l'IA : les origines de transaction ne traversent pas le réseau, le journal `activity` du document si.
- **NestJS 12 est publié en ESM** : le serveur reste en CommonJS (Node ≥ 22.12 sait `require()` un
  module ESM) et Jest charge Nest nativement grâce à `NODE_OPTIONS=--experimental-vm-modules`
  (déjà dans les scripts `test` et `test:e2e`).

## Tests

```bash
pnpm test                                   # engine (dont DP vs force brute sur arbres aléatoires), doc (dont fusions concurrentes), shared, web
pnpm --filter @forkcast/server test:e2e     # MongoDB en mémoire : auth, droits, invitations, OAuth, tools MCP → client Yjs connecté
```

Les tests e2e démarrent un vrai serveur (HTTP + WebSocket), connectent un `HocuspocusProvider` et
vérifient qu'un appel de tool MCP apparaît sur le client, avec le flag `estimatedBy: 'ai'` et
l'entrée de journal correspondante.

## Licence

MIT. La police **Excalifont** (`apps/web/public/fonts/Excalifont`) provient d'Excalidraw et est
distribuée sous SIL Open Font License 1.1.
