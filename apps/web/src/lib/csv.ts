import type { Tree } from '@forkcast/shared';
import type { Configuration } from '@forkcast/engine';
import { describeConfigurationText } from './describe';

function csvNumber(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  // French spreadsheet conventions: decimal comma, no grouping.
  return String(n).replace('.', ',');
}

function csvCell(text: string): string {
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV (";" separated, UTF-8 BOM, decimal comma) of comparison rows. */
export function configurationsToCsv(
  tree: Tree,
  rows: readonly Configuration[],
  paretoKeys: ReadonlySet<string>,
): string {
  const header = [
    '#',
    'Pareto',
    ...tree.criteria.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)),
    'Choix',
  ];
  const lines = [header.map(csvCell).join(';')];
  rows.forEach((row, i) => {
    const cells = [
      String(i + 1),
      paretoKeys.has(row.key) ? 'oui' : 'non',
      ...tree.criteria.map((c) => csvNumber(row.totals[c.id])),
      describeConfigurationText(tree, row),
    ];
    lines.push(cells.map(csvCell).join(';'));
  });
  return '﻿' + lines.join('\r\n');
}
