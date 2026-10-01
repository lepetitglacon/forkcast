import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RenameDialogProps {
  open: boolean;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void | Promise<void>;
}

export function RenameDialog({ open, initialTitle, onOpenChange, onSubmit }: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && <RenameForm initialTitle={initialTitle} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ initialTitle, onSubmit, onCancel }: { initialTitle: string; onSubmit: RenameDialogProps['onSubmit']; onCancel: () => void }) {
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        try {
          await onSubmit(title.trim());
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Renommer l’arbre</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="rename-title">Titre</Label>
        <Input id="rename-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={busy || !title.trim()}>
          Renommer
        </Button>
      </DialogFooter>
    </form>
  );
}
