import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '@forkcast/shared';
import { assistantDetail, authorLabel, dayLabel, filterHistory, formatRelativeTime, groupByDay, historyCounts, scopeHistory } from './history';

const NOW = new Date(2026, 9, 1, 15, 0, 0).getTime();
const HOUR = 3600 * 1000;

function entry(id: string, actor: ActivityEntry['actor'], at: number, extra: Partial<ActivityEntry> = {}): ActivityEntry {
  return { id, actor, at, summary: id, nodeIds: [], ...extra };
}

const log: ActivityEntry[] = [
  entry('a', 'import', NOW - 50 * HOUR),
  entry('b', 'user', NOW - 26 * HOUR, { actorLabel: 'Alice' }),
  entry('c', 'ai', NOW - 2 * HOUR, { actorLabel: 'Assistant IA · Claude Code' }),
  entry('d', 'user', NOW - 60 * 1000, { actorLabel: 'Bob' }),
];

describe('history helpers', () => {
  it('filters by author type, newest first', () => {
    expect(filterHistory(log, 'all').map((e) => e.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(filterHistory(log, 'people').map((e) => e.id)).toEqual(['d', 'b', 'a']);
    expect(filterHistory(log, 'ai').map((e) => e.id)).toEqual(['c']);
    expect(filterHistory([], 'ai')).toEqual([]);
  });

  it('groups by calendar day with French labels', () => {
    const groups = groupByDay(filterHistory(log, 'all'), NOW);
    expect(groups.map((g) => [g.label, g.entries.map((e) => e.id).join('')])).toEqual([
      ['Aujourd’hui', 'dc'],
      ['Hier', 'b'],
      [dayLabel(NOW - 50 * HOUR, NOW), 'a'],
    ]);
    expect(dayLabel(NOW - 50 * HOUR, NOW)).toBe('Mardi 29 septembre 2026');
  });

  it('formats relative times in French', () => {
    expect(formatRelativeTime(NOW - 10 * 1000, NOW)).toBe('à l’instant');
    expect(formatRelativeTime(NOW - 5 * 60 * 1000, NOW)).toBe('il y a 5 minutes');
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('il y a 3 heures');
    expect(formatRelativeTime(NOW - 26 * HOUR, NOW)).toBe('hier');
  });

  it('names authors, assistant entries included', () => {
    expect(authorLabel(log[2]!)).toBe('Assistant IA');
    expect(assistantDetail(log[2]!)).toBe('Claude Code');
    expect(authorLabel(log[1]!)).toBe('Alice');
    expect(authorLabel(log[0]!)).toBe('Import');
    expect(authorLabel(entry('x', 'user', NOW))).toBe('Quelqu’un');
  });
});

describe('scopeHistory / historyCounts', () => {
  const log = [
    entry('a', 'user', 1, { nodeIds: ['root', 'psp'] }),
    entry('b', 'ai', 2, { nodeIds: ['psp', 'stripe'] }),
    entry('c', 'user', 3, { nodeIds: ['hosting'] }),
    entry('d', 'ai', 4, { nodeIds: [] }),
  ];

  it('shows the whole tree when no node is selected', () => {
    expect(scopeHistory(log, null, 'all').map((e) => e.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(historyCounts(log, null)).toEqual({ all: 4, people: 2, ai: 2 });
  });

  it('keeps only the entries touching the selected node, author filter on top', () => {
    expect(scopeHistory(log, 'psp', 'all').map((e) => e.id)).toEqual(['b', 'a']);
    expect(scopeHistory(log, 'psp', 'ai').map((e) => e.id)).toEqual(['b']);
    expect(scopeHistory(log, 'psp', 'people').map((e) => e.id)).toEqual(['a']);
    expect(scopeHistory(log, 'nope', 'all')).toEqual([]);
    expect(historyCounts(log, 'psp')).toEqual({ all: 2, people: 1, ai: 1 });
  });
});
