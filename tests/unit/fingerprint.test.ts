import { describe, it, expect } from 'vitest';
import { estimateBits, POPULATION_ONLINE, type Signature } from '../../src/stowaway/fingerprint';

const PLACEHOLDER = '—';

function fullSignature(): Signature {
  return {
    user_agent:     'Mozilla/5.0 something',
    platform:       'MacIntel',
    cpu_cores:      '10',
    ram:            '16 GB (approx)',
    language:       'en-US, tr',
    timezone:       'Europe/Istanbul (UTC+3)',
    screen:         '1512 × 982 × 24bpp',
    pixel_ratio:    '2',
    touch_points:   '0',
    webgl_renderer: 'Apple M2',
    canvas_hash:    'deadbeef',
    audio_hash:     'beefdead',
    connection:     '4g',
  };
}

describe('fingerprint entropy estimation', () => {
  it('a full signature lands in the realistic range (15-23 bits)', () => {
    const bits = estimateBits(fullSignature());
    expect(bits).toBeGreaterThanOrEqual(15);
    expect(bits).toBeLessThanOrEqual(23);
  });

  it('missing components subtract from bits', () => {
    const full = fullSignature();
    const partial: Signature = { ...full, canvas_hash: PLACEHOLDER, audio_hash: PLACEHOLDER, webgl_renderer: PLACEHOLDER };
    expect(estimateBits(partial)).toBeLessThan(estimateBits(full));
  });

  it('an empty signature still returns at least 1 bit (avoids divide-by-zero downstream)', () => {
    const empty = Object.fromEntries(
      (Object.keys(fullSignature()) as (keyof Signature)[]).map((k) => [k, PLACEHOLDER]),
    ) as unknown as Signature;
    expect(estimateBits(empty)).toBeGreaterThanOrEqual(1);
  });

  it('population constant is in the billions (reasonable real-world)', () => {
    expect(POPULATION_ONLINE).toBeGreaterThan(1_000_000_000);
    expect(POPULATION_ONLINE).toBeLessThan(10_000_000_000);
  });
});
