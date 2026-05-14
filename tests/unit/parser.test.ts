import { describe, it, expect } from 'vitest';
import { tokenize, expandGlobs } from '../../src/kernel/parser';

describe('shell parser', () => {
  it('tokenizes simple commands', () => {
    expect(tokenize('ls -la /home')).toEqual(['ls', '-la', '/home']);
  });

  it('respects single quotes', () => {
    expect(tokenize(`echo 'hello world'`)).toEqual(['echo', 'hello world']);
  });

  it('respects double quotes', () => {
    expect(tokenize(`echo "hello world"`)).toEqual(['echo', 'hello world']);
  });

  it('handles mixed quotes', () => {
    expect(tokenize(`echo "a 'b' c"`)).toEqual(['echo', `a 'b' c`]);
  });

  it('collapses whitespace', () => {
    expect(tokenize('a   b\tc')).toEqual(['a', 'b', 'c']);
  });

  it('treats empty input as empty array', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('expands simple glob *.txt', () => {
    const result = expandGlobs('*.txt', ['foo.txt', 'bar.md', 'baz.txt']);
    expect(result).toEqual(['foo.txt', 'baz.txt']);
  });

  it('expands ? wildcard', () => {
    const result = expandGlobs('a?.txt', ['a1.txt', 'a2.txt', 'ab.txt', 'foo.txt']);
    expect(result).toEqual(['a1.txt', 'a2.txt', 'ab.txt']);
  });

  it('returns pattern unchanged if no match', () => {
    expect(expandGlobs('nope.*', ['a.txt'])).toEqual(['nope.*']);
  });
});
