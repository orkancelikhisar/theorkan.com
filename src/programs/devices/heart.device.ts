import type { DeviceModule } from '../../kernel/devices';

const LINES = [
  'thump.',
  'thump. thump.',
  'a slow tick. nothing alarming.',
  'three beats off-pattern.',
  'steady. like a kitchen clock.',
  'too loud. lower yourself.',
  'a long pause, then a small one.',
  'it remembers the song from last week.',
  'fine. fine. fine.',
  'a flutter that is not yours.',
];

const dev: DeviceModule = {
  name: 'heart',
  read: (rng) => (rng() < 0.05 ? 'it skipped.' : LINES[Math.floor(rng() * LINES.length)]),
};

export default dev;
