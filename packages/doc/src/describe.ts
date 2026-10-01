import type * as Y from 'yjs';
import type { Command, NodeKind } from '@forkcast/shared';
import { readCriterion, readNode } from './nodes';
import { getCriteria, getNodes } from './schema';

const KIND_LABEL: Record<NodeKind, string> = { and: 'ET', or: 'OU', leaf: 'feuille' };

function quote(text: string): string {
  const t = text.trim() || 'sans titre';
  return `« ${t.length > 60 ? `${t.slice(0, 57)}…` : t} »`;
}

function nodeLabel(doc: Y.Doc, id: string): string {
  const node = readNode(getNodes(doc).get(id), id);
  return quote(node?.label ?? id);
}

function criterionLabel(doc: Y.Doc, id: string): string {
  const c = readCriterion(getCriteria(doc).get(id), id);
  return quote(c?.label ?? id);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 }).format(n);
}

function countSubtree(json: { children?: unknown[] }): number {
  let n = 1;
  for (const c of (json.children ?? []) as Array<{ children?: unknown[] }>) n += countSubtree(c);
  return n;
}

/**
 * Human readable (French) summary of a command, computed BEFORE it is applied so that
 * labels of removed or renamed nodes are still available.
 */
export function describeCommand(doc: Y.Doc, command: Command): string {
  switch (command.type) {
    case 'setTitle':
      return `Titre de l’arbre renommé en ${quote(command.title)}`;
    case 'addChild':
      return `Ajout de ${quote(command.node.label)} sous ${nodeLabel(doc, command.parentId)}`;
    case 'addSibling':
      return `Ajout de ${quote(command.node.label)} à côté de ${nodeLabel(doc, command.siblingId)}`;
    case 'addSubtree': {
      const n = countSubtree(command.subtree);
      return `Ajout de la branche ${quote(command.subtree.label)} (${n} nœud${n > 1 ? 's' : ''}) sous ${nodeLabel(doc, command.parentId)}`;
    }
    case 'restoreNodes':
      return `Restauration de ${command.nodes.length} nœud${command.nodes.length > 1 ? 's' : ''}`;
    case 'move':
    case 'placeAt':
      return `Déplacement de ${nodeLabel(doc, command.nodeId)} sous ${nodeLabel(doc, command.parentId)}`;
    case 'remove':
      return `Suppression de ${nodeLabel(doc, command.nodeId)}`;
    case 'setKind':
      return `${nodeLabel(doc, command.nodeId)} devient ${KIND_LABEL[command.kind]}`;
    case 'rename':
      return `${nodeLabel(doc, command.nodeId)} renommé en ${quote(command.label)}`;
    case 'setNotes':
      return command.notes ? `Notes de ${nodeLabel(doc, command.nodeId)} modifiées` : `Notes de ${nodeLabel(doc, command.nodeId)} effacées`;
    case 'setOptional':
      return `${nodeLabel(doc, command.nodeId)} rendu ${command.optional ? 'optionnel' : 'obligatoire'}`;
    case 'setValues': {
      const parts = Object.entries(command.values).map(([cid, v]) => {
        const label = readCriterion(getCriteria(doc).get(cid), cid)?.label ?? cid;
        if (v === null) return `${label} effacé`;
        const value = typeof v === 'number' ? v : v.value;
        return `${label} = ${formatNumber(value)}`;
      });
      return `Valeurs de ${nodeLabel(doc, command.nodeId)} : ${parts.join(', ')}`;
    }
    case 'addCriterion':
      return `Critère ${quote(command.criterion.label)} ajouté`;
    case 'updateCriterion':
      return `Critère ${criterionLabel(doc, command.criterionId)} modifié`;
    case 'removeCriterion':
      return `Critère ${criterionLabel(doc, command.criterionId)} supprimé`;
    case 'restoreCriterion':
      return `Critère ${quote(command.criterion.label)} restauré`;
  }
}
