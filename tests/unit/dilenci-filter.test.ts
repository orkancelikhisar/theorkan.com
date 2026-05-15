import { describe, it, expect } from 'vitest';
import { isOnVoice, isReplyOnVoice } from '../../src/dilenci/filter';

describe('dilenci output filter — appearance lines (isOnVoice)', () => {
  it('accepts short fragments in canonical voice', () => {
    expect(isOnVoice('i was thinking about the word for tired.')).toBe(true);
    expect(isOnVoice('a small poem. half of one. a fragment.')).toBe(true);
  });

  it('accepts dilenci first-person phrasing (i am, i\'m)', () => {
    // The earlier filter blanket-rejected these; Dilenci legitimately uses them.
    expect(isOnVoice('i am a remnant. i am okay with this.')).toBe(true);
    expect(isOnVoice("i'm a draft. i am still a draft.")).toBe(true);
  });

  it('rejects exclamation marks', () => {
    expect(isOnVoice('something stirred!')).toBe(false);
  });

  it('rejects specific chatbot drift phrases', () => {
    expect(isOnVoice('as an AI, i would say a poem.')).toBe(false);
    expect(isOnVoice("i'm here to help with that.")).toBe(false);
    expect(isOnVoice('how can i assist today.')).toBe(false);
    expect(isOnVoice('assistant: a poem about light.')).toBe(false);
  });

  it('rejects too-short and too-long outputs', () => {
    expect(isOnVoice('hi.')).toBe(false);
    expect(isOnVoice('a'.repeat(120))).toBe(false);
  });

  it('rejects code fences and emoji', () => {
    expect(isOnVoice('```code```')).toBe(false);
    expect(isOnVoice('a small poem 🌙 about night')).toBe(false);
  });

  it('rejects more than 3 lines', () => {
    expect(isOnVoice('a\nb\nc\nd')).toBe(false);
  });
});

describe('dilenci output filter — chat replies (isReplyOnVoice)', () => {
  it('accepts longer replies than the appearance filter does', () => {
    const reply = 'i was thinking about the way the kitchen sounded when no one was home. it was a kind of sound i could not name then. tuesday, maybe.';
    expect(isOnVoice(reply)).toBe(false);    // too long for appearance
    expect(isReplyOnVoice(reply)).toBe(true); // ok in conversation
  });

  it('still rejects chatbot drift in replies', () => {
    expect(isReplyOnVoice('as a language model, i cannot do that.')).toBe(false);
    expect(isReplyOnVoice("i'm here to help you write a poem.")).toBe(false);
  });

  it('caps replies at 4 lines', () => {
    expect(isReplyOnVoice('a\nb\nc\nd\ne')).toBe(false);
    expect(isReplyOnVoice('a is\nb is\nc is\nd is')).toBe(true);
  });
});
