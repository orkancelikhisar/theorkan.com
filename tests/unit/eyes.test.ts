import { describe, it, expect } from 'vitest';
import { quantizeLuminance } from '../../src/eyes/camera';

describe('eyes monochrome quantization', () => {
  it('quantizes black to 0', () => {
    expect(quantizeLuminance(0, 4)).toBe(0);
  });

  it('quantizes white to the top step', () => {
    expect(quantizeLuminance(255, 4)).toBe(3);
  });

  it('quantizes midtones into bands', () => {
    expect(quantizeLuminance(128, 4)).toBeGreaterThanOrEqual(1);
    expect(quantizeLuminance(128, 4)).toBeLessThanOrEqual(2);
  });

  it('respects step count', () => {
    expect(quantizeLuminance(255, 6)).toBe(5);
    expect(quantizeLuminance(0, 6)).toBe(0);
  });
});
