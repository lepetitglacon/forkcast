import * as React from 'react';
import { Input } from './input';
import { Textarea } from './textarea';

interface DraftProps {
  value: string;
  onCommit: (value: string) => void;
  /** Commit on Enter (inputs) or Ctrl/Cmd+Enter (textareas). */
  commitOnEnter?: boolean;
}

/**
 * Text input that edits a local draft and commits on blur / Enter, so that a shared
 * document is not written on every keystroke and remote changes show while not editing.
 */
export function DraftInput({
  value,
  onCommit,
  commitOnEnter = true,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: DraftProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <Input
      {...props}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setDraft(value);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' && commitOnEnter) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function DraftTextarea({
  value,
  onCommit,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: DraftProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <Textarea
      {...props}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        setDraft(value);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
