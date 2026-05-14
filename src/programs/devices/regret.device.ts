import type { DeviceModule } from '../../kernel/devices';

const LINES = [
  'a phone call i did not return.',
  'the things i did not write.',
  'the answer i had ready, never asked.',
  'a tuesday i lied about being tired.',
  'a song i refused to learn.',
  "the friend who waited and i didn't come.",
  'one too few thank-yous, that whole year.',
  'the harbor i should have stayed in.',
  'a name i forgot in front of its owner.',
];

const dev: DeviceModule = {
  name: 'regret',
  read: (env) => LINES[Math.floor(env.random() * LINES.length)],
};

export default dev;
