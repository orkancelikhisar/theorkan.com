import type { DeviceModule } from '../../kernel/devices';

const LINES = [
  'lights on. one boat returning. nobody waiting.',
  'a smell of diesel and rope. the usual.',
  'cleat 14 is loose again.',
  'someone left a coffee on the dock. cold.',
  'the bell on buoy three is wrong.',
  'a gull. then a long quiet.',
  'water level: ankle-warning, ankle-relief.',
  'a single fender between two boats. holding.',
  'the night watchman is reading.',
  'a small sailboat is also a small house.',
];

const dev: DeviceModule = {
  name: 'harbor',
  read: (rng) => LINES[Math.floor(rng() * LINES.length)],
};

export default dev;
