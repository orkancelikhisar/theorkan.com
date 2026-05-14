import { describe, it, expect } from 'vitest';
import {
  signedAngleDeg,
  pointOfSailEfficiency,
  optimalSailAngle,
  trimEfficiency,
  targetSpeed,
  type Vec2,
  apparentWind,
} from './physics';

describe('regatta physics', () => {
  describe('signedAngleDeg', () => {
    it('wraps to [-180, 180]', () => {
      expect(signedAngleDeg(190)).toBeCloseTo(-170, 0);
      expect(signedAngleDeg(-190)).toBeCloseTo(170, 0);
      expect(signedAngleDeg(45)).toBeCloseTo(45, 0);
    });
  });

  describe('pointOfSailEfficiency', () => {
    it('is zero in irons (0-30 deg)', () => {
      expect(pointOfSailEfficiency(0)).toBe(0);
      expect(pointOfSailEfficiency(15)).toBe(0);
      expect(pointOfSailEfficiency(29)).toBe(0);
    });
    it('rises through close-hauled (30-45)', () => {
      expect(pointOfSailEfficiency(30)).toBe(0);
      const at45 = pointOfSailEfficiency(45);
      expect(at45).toBeGreaterThan(0.6);
      expect(at45).toBeLessThanOrEqual(0.7);
    });
    it('peaks ~1.0 at beam reach', () => {
      const at90 = pointOfSailEfficiency(90);
      expect(at90).toBeGreaterThan(0.95);
      expect(at90).toBeLessThanOrEqual(1.0);
    });
    it('drops on a run (180)', () => {
      const at180 = pointOfSailEfficiency(180);
      expect(at180).toBeGreaterThan(0.4);
      expect(at180).toBeLessThan(0.7);
    });
    it('symmetric around 0 (absolute angle used)', () => {
      expect(pointOfSailEfficiency(-90)).toBeCloseTo(pointOfSailEfficiency(90), 5);
    });
  });

  describe('optimalSailAngle', () => {
    it('is half the apparent angle, clamped', () => {
      expect(optimalSailAngle(60)).toBeCloseTo(30, 0);
      expect(optimalSailAngle(10)).toBe(10);
      expect(optimalSailAngle(180)).toBe(85);
    });
  });

  describe('trimEfficiency', () => {
    it('peaks at optimal trim', () => {
      expect(trimEfficiency(0, 30, 15)).toBeCloseTo(1.0, 5);
    });
    it('drops linearly with error', () => {
      const e = trimEfficiency(0, 60, 45);
      expect(e).toBeLessThan(1.0);
      expect(e).toBeGreaterThan(0);
    });
    it('luffs if sail too loose', () => {
      // apparent angle 30, sail at 70 = way too loose
      expect(trimEfficiency(0, 30, 70)).toBe(0.2);
    });
  });

  describe('targetSpeed', () => {
    it('zero in irons', () => {
      expect(targetSpeed(6, 15, 7)).toBeCloseTo(0, 5);
    });
    it('caps at hull speed', () => {
      expect(targetSpeed(40, 90, 45)).toBeLessThanOrEqual(7);
    });
  });

  describe('apparentWind', () => {
    it('equals true wind when boat is stationary', () => {
      const wind: Vec2 = { x: 1, y: 0 };
      const boatVel: Vec2 = { x: 0, y: 0 };
      const ap = apparentWind(wind, boatVel);
      expect(ap.x).toBeCloseTo(1, 5);
      expect(ap.y).toBeCloseTo(0, 5);
    });
    it('subtracts boat velocity', () => {
      const wind: Vec2 = { x: 5, y: 0 };
      const boatVel: Vec2 = { x: 3, y: 0 };
      const ap = apparentWind(wind, boatVel);
      expect(ap.x).toBeCloseTo(2, 5);
      expect(ap.y).toBeCloseTo(0, 5);
    });
  });
});
