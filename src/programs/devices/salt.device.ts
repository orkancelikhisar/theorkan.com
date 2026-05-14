import type { DeviceModule } from '../../kernel/devices';

const LINES = [
  'on the hand. on the lip. on the keys.',
  'salt remembers what water forgets.',
  'a fine layer on the foredeck.',
  'in the corners of every shoe i own.',
  'the pier rail tastes like the wind.',
  'it gets in everything. it gets in.',
  'whisper frequency: doubled. salt does that.',
];

const dev: DeviceModule = {
  name: 'salt',
  read: (env) => {
    globalThis.__theorkan_whisper_boost = Date.now() + 120_000;
    return LINES[Math.floor(env.random() * LINES.length)];
  },
};

export default dev;
