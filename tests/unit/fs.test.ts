import { describe, it, expect, beforeEach } from 'vitest';
import { createFS } from '../../src/kernel/fs';
import { SNAPSHOT } from '../../src/kernel/fs-snapshot';

describe('virtual filesystem', () => {
  let fs: ReturnType<typeof createFS>;
  beforeEach(() => { fs = createFS(SNAPSHOT); });

  it('reads a file', () => {
    expect(fs.read('/home/orkan/readme')).toContain('welcome');
  });

  it('throws on missing file', () => {
    expect(() => fs.read('/nope/missing.txt')).toThrow(/no such file/i);
  });

  it('lists a directory', () => {
    const entries = fs.list('/home/orkan');
    expect(entries).toContain('projects');
    expect(entries).toContain('readme');
    expect(entries).toContain('.bash_history');
  });

  it('resolves ~ to /home/orkan', () => {
    expect(fs.resolve('~')).toBe('/home/orkan');
    expect(fs.resolve('~/projects')).toBe('/home/orkan/projects');
  });

  it('resolves relative paths from cwd', () => {
    expect(fs.resolve('projects', '/home/orkan')).toBe('/home/orkan/projects');
    expect(fs.resolve('..', '/home/orkan')).toBe('/home');
    expect(fs.resolve('.', '/home/orkan')).toBe('/home/orkan');
  });

  it('exists returns true/false', () => {
    expect(fs.exists('/home/orkan')).toBe(true);
    expect(fs.exists('/nope')).toBe(false);
  });

  it('write persists to localStorage diff', () => {
    fs.write('/home/orkan/notes.txt', 'hello');
    expect(fs.read('/home/orkan/notes.txt')).toBe('hello');

    const fresh = createFS(SNAPSHOT);
    expect(fresh.read('/home/orkan/notes.txt')).toBe('hello');
  });

  it('write rejects to non-writable paths', () => {
    expect(() => fs.write('/etc/orkan.conf', 'x')).toThrow(/read-only/i);
  });

  it('reset clears the diff layer', () => {
    fs.write('/home/orkan/notes.txt', 'hello');
    fs.reset();
    expect(fs.read('/home/orkan/notes.txt')).toContain('a notebook');
  });
});
