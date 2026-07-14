export type DecorationAtlas = 'rooms-a' | 'rooms-b';

export interface RoomDecoration {
  id: string;
  roomId: 'kitchen' | 'window' | 'studio' | 'alley' | 'radio' | 'empty';
  name: string;
  prompt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  atlas: DecorationAtlas;
  quadrant: 0 | 1 | 2 | 3;
  observations: string[];
}

export const ROOM_DECORATIONS: RoomDecoration[] = [
  {
    id: 'kitchen-counter', roomId: 'kitchen', name: 'the cold counter',
    prompt: 'inspect the cold counter', x: 17, y: 14, w: 2, h: 2,
    atlas: 'rooms-a', quadrant: 0,
    observations: [
      'the kettle remembers heat better than you do.\nthe peach has one soft place where a thumb waited.',
      'the knife points nowhere.\nthe yellow bowl makes the rest of the room look asleep.',
      'tea has darkened in the glass.\nno surface here will admit how long it has been morning.',
    ],
  },
  {
    id: 'window-bosphorus', roomId: 'window', name: 'the rain window',
    prompt: 'look through the rain window', x: 37, y: 13, w: 2, h: 2,
    atlas: 'rooms-a', quadrant: 1,
    observations: [
      'the Bosphorus holds the moon in pieces.\na chair faces it with the patience of furniture.',
      'rain keeps choosing the same routes down the glass.\none light across the water refuses to go out.',
      'a gull crosses its own reflection.\nfor a second the window opens without moving.',
    ],
  },
  {
    id: 'studio-easel', roomId: 'studio', name: 'the unfinished work',
    prompt: 'examine the unfinished work', x: 46, y: 14, w: 2, h: 2,
    atlas: 'rooms-a', quadrant: 2,
    observations: [
      'the canvas has been corrected until only the corrections remain.',
      'ink has entered the grain of the floor.\nthe open drawer contains every color except the needed one.',
      'the stool is warm.\nthe room offers no explanation for this.',
    ],
  },
  {
    id: 'alley-remains', roomId: 'alley', name: 'the chalk and line',
    prompt: 'read what the rain kept', x: 24, y: 28, w: 2, h: 2,
    atlas: 'rooms-a', quadrant: 3,
    observations: [
      'the chalk says BEKLE.\nthe rain has translated everything else.',
      'a length of line has been coiled around an absence.\nthe enamel cup is chipped where a mouth would meet it.',
      'water enters the drain carrying a small blue light.\nyou cannot find its source.',
    ],
  },
  {
    id: 'radio-console', roomId: 'radio', name: 'the impossible receiver',
    prompt: 'listen to the impossible receiver', x: 39, y: 28, w: 2, h: 2,
    atlas: 'rooms-b', quadrant: 0,
    observations: [
      'eight cables leave the receiver.\nthe ninth sound has no cable.',
      'the tubes glow with the color of remembered rooms.\nthe needle trembles below zero.',
      'inside the headphones: harbor static, a spoon in a glass, someone almost saying your name.',
    ],
  },
  {
    id: 'empty-evidence', roomId: 'empty', name: 'the remaining evidence',
    prompt: 'inventory the remaining evidence', x: 49, y: 27, w: 2, h: 2,
    atlas: 'rooms-b', quadrant: 1,
    observations: [
      'the photograph shows a boat after everyone has left it.\nthe cabinet drawer marked nothing is locked.',
      'the chair has moved closer to the file cabinet.\nyou are certain it was not there before.',
      'the suitcase is lighter than an empty suitcase should be.\nsomething inside it keeps the fluorescent rhythm.',
    ],
  },
];

export function decorationAt(col: number, row: number): RoomDecoration | null {
  return ROOM_DECORATIONS.find((decoration) => (
    col >= decoration.x && col < decoration.x + decoration.w
    && row >= decoration.y && row < decoration.y + decoration.h
  )) ?? null;
}
