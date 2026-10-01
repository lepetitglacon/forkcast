import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Download, FileJson, FileUp, Image, Table2 } from 'lucide-react';
import { docToJson, importJson, recordActivity } from '@forkcast/doc';
import { toast } from 'sonner';
import { useDocContext } from '@/docs/DocContext';
import { useAnalysis } from '@/docs/useAnalysis';
import { useResolvedTheme } from '@/store/theme';
import { useUiStore } from '@/store/ui';
import { configurationsToCsv } from '@/lib/csv';
import { errorMessage } from '@/lib/errors';
import { downloadText, pickFile, slugifyFilename } from '@/lib/utils';
import { exportCanvasImage, type ImageFormat } from '@/components/canvas/exportImage';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ExportMenu() {
  const { doc, tree, readOnly, actor, guard } = useDocContext();
  const { getNodes } = useReactFlow();
  const theme = useResolvedTheme();
  const [csvRequested, setCsvRequested] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown | null>(null);
  const filename = slugifyFilename(tree.meta.title);

  const exportJson = () => {
    downloadText(`${filename}.json`, JSON.stringify(docToJson(doc), null, 2), 'application/json');
  };

  const exportImage = async (format: ImageFormat) => {
    const background = theme === 'dark' ? '#1b1c22' : '#fafaf9';
    try {
      await exportCanvasImage(format, getNodes(), filename, background);
    } catch (error) {
      toast.error('Export impossible', { description: errorMessage(error) });
    }
  };

  const chooseImport = async () => {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    try {
      setPendingImport(JSON.parse(await file.text()) as unknown);
    } catch {
      toast.error('Fichier illisible', { description: 'Le fichier n’est pas un JSON valide.' });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs"
            aria-label="Exporter"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Download /> Exporter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuLabel>Exporter</DropdownMenuLabel>
          <DropdownMenuItem onSelect={exportJson}>
            <FileJson /> JSON (format Forkcast)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportImage('png')}>
            <Image /> Image PNG
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportImage('svg')}>
            <Image /> Image SVG
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCsvRequested(true)} disabled={tree.criteria.length === 0}>
            <Table2 /> Tableau de comparaison (CSV)
          </DropdownMenuItem>
          {!readOnly && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void chooseImport()}>
                <FileUp /> Remplacer par un fichier JSON…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {csvRequested && <CsvExporter filename={filename} onDone={() => setCsvRequested(false)} />}
      <AlertDialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer le contenu de l’arbre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les nœuds et critères actuels seront remplacés par ceux du fichier. Cette opération n’est pas annulable avec
              Ctrl + Z ; exportez d’abord l’arbre si nécessaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                const result = guard(() => {
                  const imported = importJson(doc, pendingImport, 'import');
                  // importJson resets the history: the replacement becomes its first entry.
                  recordActivity(
                    doc,
                    {
                      ...actor,
                      actor: 'import',
                      summary: `Arbre remplacé par un fichier JSON (${imported.nodeCount} nœuds)`,
                      nodeIds: [imported.rootId],
                      coalesce: false,
                    },
                    'import',
                  );
                  return imported;
                });
                if (result) {
                  useUiStore.getState().select(null);
                  toast.success(`Arbre importé (${result.nodeCount} nœuds)`);
                }
                setPendingImport(null);
              }}
            >
              Remplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Mounted on demand so that the (possibly heavy) analysis only runs when exporting. */
function CsvExporter({ filename, onDone }: { filename: string; onDone: () => void }) {
  const { tree } = useDocContext();
  const analysis = useAnalysis(tree);
  useEffect(() => {
    const rows = analysis.enumerated ? analysis.configurations : analysis.pareto;
    const csv = configurationsToCsv(tree, rows, new Set(analysis.paretoKeys));
    downloadText(`${filename}-configurations.csv`, csv, 'text/csv;charset=utf-8');
    onDone();
  }, [analysis, tree, filename, onDone]);
  return null;
}
