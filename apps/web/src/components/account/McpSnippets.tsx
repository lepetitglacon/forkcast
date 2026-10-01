import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { publicServerUrl } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function claudeCodeSnippet(token: string): string {
  return `claude mcp add --transport http forkcast ${publicServerUrl()}/mcp --header "Authorization: Bearer ${token}"`;
}

export function claudeDesktopSnippet(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        forkcast: {
          command: 'npx',
          args: ['-y', 'mcp-remote', `${publicServerUrl()}/mcp`, '--header', `Authorization: Bearer ${token}`],
        },
      },
    },
    null,
    2,
  );
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={async () => {
            const ok = await copyToClipboard(code);
            setCopied(ok);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/60 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{code}</pre>
    </div>
  );
}

/** Ready-to-paste MCP client configuration for Claude Code and Claude Desktop. */
export function McpSnippets({ token }: { token: string | null }) {
  const value = token ?? '<votre-jeton>';
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Le serveur MCP de Forkcast ({publicServerUrl()}/mcp) permet à un assistant de lire et de modifier vos arbres. Collez l’une de ces
        configurations dans votre client{token ? '' : ' en remplaçant <votre-jeton> par un jeton personnel'}.
      </p>
      <CodeBlock label="Claude Code (terminal)" code={claudeCodeSnippet(value)} />
      <CodeBlock label="Claude Desktop (claude_desktop_config.json)" code={claudeDesktopSnippet(value)} />
    </div>
  );
}
