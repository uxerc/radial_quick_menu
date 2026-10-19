import { describe, expect, it } from 'vitest';
import { basename, dirname, joinPath, safeFileName, uniqueName, withExt } from './paths';

describe('paths', () => {
  it('joins and splits', () => {
    expect(joinPath('', 'a/', '/b', 'c.png')).toBe('a/b/c.png');
    expect(dirname('a/b/c.png')).toBe('a/b');
    expect(dirname('c.png')).toBe('');
    expect(basename('a/b/c.png')).toBe('c.png');
    expect(withExt('shot.final.png', 'jpg')).toBe('shot.final.jpg');
  });

  it('numbers duplicates like Explorer', () => {
    const taken = new Set(['a.png', 'a (1).png']);
    expect(uniqueName('a.png', (n) => taken.has(n))).toBe('a (2).png');
    expect(uniqueName('b.png', (n) => taken.has(n))).toBe('b.png');
  });

  it('strips characters Windows rejects', () => {
    expect(safeFileName('https://x.com/a?b', 'link')).toBe('https x.com a b');
    expect(safeFileName('   ', 'snippet')).toBe('snippet');
  });
});
