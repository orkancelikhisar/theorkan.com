import { describe, it, expect } from 'vitest';
import { isOnVoice } from '../../src/dilenci/filter';

describe('dilenci output filter', () => {
  it('accepts short fragments in canonical voice', () => {
    expect(isOnVoice('i was thinking about the word for tired.')).toBe(true);
    expect(isOnVoice('a small poem. half of one. a fragment.')).toBe(true);
  });

  it('rejects exclamation marks', () => {
    expect(isOnVoice('something stirred!')).toBe(false);
  });

  it('rejects chatbot drift phrases', () => {
    expect(isOnVoice("i'm a helpful assistant.")).toBe(false);
    expect(isOnVoice('as an AI, i would say a poem.')).toBe(false);
    expect(isOnVoice('assistant: a poem about light.')).toBe(false);
  });

  it('rejects too-short and too-long outputs', () => {
    expect(isOnVoice('hi.')).toBe(false);
    expect(isOnVoice('a'.repeat(120))).toBe(false);
  });

  it('rejects code fences', () => {
    expect(isOnVoice('```code```')).toBe(false);
  });

  it('rejects emoji', () => {
    expect(isOnVoice('a small poem 🌙 about night')).toBe(false);
  });

  it('rejects more than 3 lines', () => {
    expect(isOnVoice('a\nb\nc\nd')).toBe(false);
  });
});
