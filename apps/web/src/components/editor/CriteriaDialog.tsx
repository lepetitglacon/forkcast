import { useUiStore } from '@/store/ui';
import { CriteriaPanel } from '@/components/panels/CriteriaPanel';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CriteriaDialog() {
  const open = useUiStore((s) => s.criteriaOpen);
  const setCriteriaOpen = useUiStore((s) => s.setCriteriaOpen);
  return (
    <Dialog open={open} onOpenChange={setCriteriaOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Critères</DialogTitle>
          <DialogDescription>
            Coût, délai, risque… Chaque critère définit comment les valeurs des nœuds se combinent et dans quel sens comparer les
            configurations.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-1">{open && <CriteriaPanel />}</div>
      </DialogContent>
    </Dialog>
  );
}
