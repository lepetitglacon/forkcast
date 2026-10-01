import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CommandSchema,
  NodeJsonSchema,
  TreeJsonSchema,
  countJsonNodes,
  normalizeValue,
  BuildSubtreeToolInput,
} from '../src';

describe('TreeJsonSchema', () => {
  it('accepts a nested tree with bare numbers and value objects', () => {
    const parsed = TreeJsonSchema.parse({
      format: 'forkcast-tree',
      version: 1,
      title: 'T',
      criteria: [{ id: 'cost', label: 'Coût' }],
      root: {
        label: 'root',
        children: [
          { label: 'a', values: { cost: 3 } },
          { label: 'b', values: { cost: { value: 4, estimatedBy: 'ai' } } },
        ],
      },
    });
    expect(countJsonNodes(parsed.root)).toBe(3);
  });

  it('rejects unknown kinds and malformed ids', () => {
    expect(() =>
      NodeJsonSchema.parse({ label: 'x', kind: 'xor' }),
    ).toThrow();
    expect(() => NodeJsonSchema.parse({ id: 'has space', label: 'x' })).toThrow();
  });

  it('can be converted to JSON Schema (needed by the MCP SDK) despite recursion', () => {
    const schema = z.toJSONSchema(z.object(BuildSubtreeToolInput));
    expect(JSON.stringify(schema)).toContain('subtree');
  });
});

describe('CommandSchema', () => {
  it('discriminates on type', () => {
    expect(CommandSchema.parse({ type: 'remove', nodeId: 'abc' })).toEqual({
      type: 'remove',
      nodeId: 'abc',
    });
    expect(() => CommandSchema.parse({ type: 'nope' })).toThrow();
  });
});

describe('normalizeValue', () => {
  it('wraps numbers and applies the estimatedBy flag only when absent', () => {
    expect(normalizeValue(3)).toEqual({ value: 3 });
    expect(normalizeValue(3, 'ai')).toEqual({ value: 3, estimatedBy: 'ai' });
    expect(normalizeValue({ value: 1, estimatedBy: 'ai' })).toEqual({ value: 1, estimatedBy: 'ai' });
  });
});
