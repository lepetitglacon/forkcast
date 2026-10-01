import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Client-side id generator (12 chars, URL safe, no increments). */
export const newId: () => string = customAlphabet(alphabet, 12);

/** Short readable id derived from a label (criteria), e.g. "Coût mensuel" → "cout-mensuel". */
export function slugify(label: string, maxLength = 32): string {
  const slug = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : newId();
}
