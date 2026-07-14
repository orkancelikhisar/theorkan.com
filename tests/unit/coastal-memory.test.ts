import { describe, expect, it } from 'vitest';
import {
  addCoastalArtifact,
  beginCoastalSession,
  coastalSnapshot,
  freshCoastalMemory,
  readCoastalMemory,
  recordCoastalCommand,
  recordCoastalFootprint,
  recordCoastalFrequency,
  recordCoastalPhrase,
  restoreCoastalMemory,
} from '../../src/coast/coastal-memory';

describe('coastal memory', () => {
  it('starts a persistent session and safely restores malformed state', () => {
    beginCoastalSession(1_000);
    expect(readCoastalMemory(1_000).sessionCount).toBe(1);
    expect(restoreCoastalMemory({ seed: 'bad', phrases: [null] }, 2_000).phrases).toEqual([]);
  });

  it('collects terminal residue, phrases, frequencies, artifacts, and footprints', () => {
    recordCoastalCommand('echo this sentence should remain in the harbor', 1_000);
    recordCoastalPhrase('a line beneath the water', 'undertow', true, 2_000);
    recordCoastalFrequency('88.9 / lower sideband', 3_000);
    addCoastalArtifact('studio-image', 4_000);
    recordCoastalFootprint(12, 9, 5_000);
    const memory = readCoastalMemory(5_000);
    expect(memory.commandCount).toBe(1);
    expect(memory.phrases.map((phrase) => phrase.text)).toContain('a line beneath the water');
    expect(memory.artifacts).toContain('rescued-line');
    expect(memory.artifacts).toContain('radio-frequency');
    expect(memory.footprints).toEqual([{ col: 12, row: 9, at: 5_000 }]);
  });

  it('derives stable tide, weather, wind, and lighthouse values', () => {
    const memory = freshCoastalMemory(10_000);
    const first = coastalSnapshot(memory, 42_000);
    const second = coastalSnapshot(memory, 42_000);
    expect(first).toEqual(second);
    expect(first.tide).toBeGreaterThanOrEqual(0);
    expect(first.tide).toBeLessThanOrEqual(1);
    expect(first.windDegrees).toBeGreaterThanOrEqual(0);
    expect(first.windDegrees).toBeLessThanOrEqual(360);
  });

  it('only readies departure when all five intangible artifacts exist', () => {
    for (const artifact of ['rescued-line', 'radio-frequency', 'undertow-line', 'studio-image']) {
      addCoastalArtifact(artifact);
    }
    expect(coastalSnapshot().departureReady).toBe(false);
    addCoastalArtifact('stowaway-name');
    expect(coastalSnapshot().departureReady).toBe(true);
  });
});
