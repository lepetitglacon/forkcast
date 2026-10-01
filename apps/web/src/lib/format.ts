import type { Aggregation, Criterion, Direction, NodeKind } from '@forkcast/shared';

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1 });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

export type CriterionLike = Pick<Criterion, 'aggregation'> & { unit?: string | undefined };

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

export function formatPercent(p: number): string {
  return percentFormat.format(p);
}

/** Value of a criterion for display: unit appended, probabilities as percentages, "—" when absent. */
export function formatValue(criterion: CriterionLike, value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  if (criterion.aggregation === 'probOr') return formatPercent(value);
  const text = formatNumber(value);
  return criterion.unit ? `${text} ${criterion.unit}` : text;
}

/** "min – max" with the unit once; a single value when both bounds are equal. */
export function formatRange(
  criterion: CriterionLike,
  min: number | undefined,
  max: number | undefined,
): string {
  if (min === undefined && max === undefined) return '—';
  if (min === undefined) return formatValue(criterion, max);
  if (max === undefined) return formatValue(criterion, min);
  if (min === max) return formatValue(criterion, min);
  if (criterion.aggregation === 'probOr') return `${formatPercent(min)} – ${formatPercent(max)}`;
  const text = `${formatNumber(min)} – ${formatNumber(max)}`;
  return criterion.unit ? `${text} ${criterion.unit}` : text;
}

export function formatDateTime(value: number | string | Date): string {
  return dateTimeFormat.format(typeof value === 'object' ? value : new Date(value));
}

export function formatDate(value: number | string | Date): string {
  return dateFormat.format(typeof value === 'object' ? value : new Date(value));
}

export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: 'Somme',
  max: 'Maximum',
  min: 'Minimum',
  probOr: 'Probabilité (OU)',
};

export const AGGREGATION_HELP: Record<Aggregation, string> = {
  sum: 'Les valeurs des nœuds inclus sont additionnées.',
  max: 'La plus grande valeur des nœuds inclus est retenue.',
  min: 'La plus petite valeur des nœuds inclus est retenue.',
  probOr: 'Probabilité qu’au moins un risque survienne : 1 − Π(1 − pᵢ), valeurs entre 0 et 1.',
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  minimize: 'Minimiser',
  maximize: 'Maximiser',
};

export const KIND_LABELS: Record<NodeKind, string> = {
  and: 'ET',
  or: 'OU',
  leaf: 'Feuille',
};

export const KIND_DESCRIPTIONS: Record<NodeKind, string> = {
  and: 'Tous les enfants sont requis',
  or: 'Un seul enfant est choisi',
  leaf: 'Option sans enfant',
};

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(n)} ${n > 1 ? pluralForm : singular}`;
}
