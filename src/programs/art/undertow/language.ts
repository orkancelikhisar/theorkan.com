// A small procedural writing current. The grammar is intentionally narrow:
// enough variation to keep the water alive, but coherent enough that every
// line still belongs to Undertow's emotional weather.

import { createRng } from './physics';

const SUBJECTS = [
  'the unsent message',
  'a borrowed name',
  'the smaller truth',
  'the empty kitchen',
  'your last question',
  'the harbor light',
  'tuesday',
  'the dog at the wrong door',
  'what i almost said',
  'an old apology',
  'the coat by the door',
  'a voice without its owner',
] as const;

const MOTIONS = [
  'crosses',
  'carries',
  'keeps',
  'waits beneath',
  'drifts past',
  'returns without',
  'forgets',
  'follows',
  'circles',
  'misremembers',
] as const;

const OBJECTS = [
  'the last ferry',
  'a room still warm',
  'the coast of sleep',
  "someone else's weather",
  'the hour after goodbye',
  'a door left open',
  'the light under the kettle',
  'the answer around itself',
  'the harbor without a map',
  'the name we did not use',
  'one quiet Tuesday',
  'the place where we stopped',
] as const;

const TAILS = [
  'after the tide turns',
  'as if nothing happened',
  'until morning misremembers',
  'where the water keeps no record',
  'and calls it timing',
  'but leaves the ending behind',
  'before anyone can answer',
  'while the shore looks away',
] as const;

const FRAGMENTS = [
  'almost home.',
  'not yet.',
  'the smaller truth.',
  'after goodbye.',
  'still moving.',
  'one word lighter.',
  'the other answer.',
  'nothing, returning.',
] as const;

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function compose(rng: () => number, index: number): string {
  if (index % 6 === 5) return pick(FRAGMENTS, rng);
  const subject = pick(SUBJECTS, rng);
  const motion = pick(MOTIONS, rng);
  const object = pick(OBJECTS, rng);
  const tail = pick(TAILS, rng);
  switch (index % 5) {
    case 0: return `${subject} ${motion} ${object}.`;
    case 1: return `somewhere below, ${subject} ${motion} ${object}.`;
    case 2: return `${subject} ${motion} ${object}, ${tail}.`;
    case 3: return `by morning, ${subject} ${motion} ${object}.`;
    default: return `${subject} ${motion} ${object} ${tail}.`;
  }
}

function boundLine(line: string): string {
  if (line.length <= 88) return line;
  const words = line.replace(/[.,]$/, '').split(' ');
  while (words.length > 2 && `${words.join(' ')}.`.length > 88) words.pop();
  return `${words.join(' ')}.`;
}

export interface LanguageCurrent {
  next(): string;
}

export function createLanguageCurrent(seed: number): LanguageCurrent {
  const rng = createRng(seed);
  const recent: string[] = [];
  let index = 0;
  return {
    next(): string {
      let line = '';
      for (let attempt = 0; attempt < 8; attempt++) {
        line = boundLine(compose(rng, index++).replace(/\s+/g, ' ').trim());
        if (!recent.includes(line)) break;
      }
      recent.push(line);
      if (recent.length > 10) recent.shift();
      return line;
    },
  };
}
