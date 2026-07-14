// Place catalog: vignettes + optional crossovers. Geography lives in
// walk-map.ts now; this file is just the prose/lore + program hooks.
//
// Each place has 5 vignette variants; the wanderer's visit counter cycles
// through them. A place may declare one crossover: a program to dispatch
// (with optional argv) when the wanderer steps on its trigger tile.

export interface PlaceCrossover {
  command: string;
  argv?: string[];
  hint: string;             // shown in the prose strip when the trigger is nearby
}

export interface Place {
  id: string;
  title: string;
  vignettes: string[];
  crossover?: PlaceCrossover;
}

export const PLACES: Record<string, Place> = {
  harbor: {
    id: 'harbor',
    title: 'the harbor',
    vignettes: [
      'you are at the harbor.\nthe water is the same as it was.\nthe boat is tied.',
      'you are at the harbor.\nfour o’clock has been here longer than you have.',
      'you are at the harbor.\nsomeone in a galley is making tea. it isn’t you.',
      'you are at the harbor.\nwind from the south. you can stay or you can go.',
      'you are at the harbor.\nnobody arrives and nobody leaves. this is the trick.',
    ],
  },

  kitchen: {
    id: 'kitchen',
    title: 'the kitchen',
    vignettes: [
      'you are in the kitchen.\nthe back door is open. the bowl is still where the dog left it.',
      'you are in the kitchen.\nthe kettle is cool to the touch. nothing is on.',
      'you are in the kitchen.\non the counter: a knife, a peach, a yellow bowl.',
      'you are in the kitchen.\ntuesday smells like rain even when it isn’t raining.',
      'you are in the kitchen.\nshe was here this morning. she wasn’t.',
    ],
  },

  studio: {
    id: 'studio',
    title: 'the studio',
    vignettes: [
      'you are in the studio.\npaper everywhere. nothing is finished.',
      'you are in the studio.\nthere is a chair that nobody has ever sat in.',
      'you are in the studio.\na piece is hung crooked. it has been crooked for years.',
      'you are in the studio.\nit smells like ink and a window left ajar.',
      'you are in the studio.\nbehind the door, someone is going through the drawers.\nit might be you.',
    ],
    crossover: { command: 'gallery', hint: 'a doorway labelled "gallery". step in.' },
  },

  radio: {
    id: 'radio',
    title: 'the radio room',
    vignettes: [
      'you are in the radio room.\na hum from a tube nobody changed.',
      'you are in the radio room.\neight cables. seven of them go somewhere.',
      'you are in the radio room.\nthe speaker is warm. nothing is playing.',
      'you are in the radio room.\ntuned to a station that has been off the air since 2009.',
      'you are in the radio room.\nlisten — it’s at the bottom of the hum.',
    ],
    crossover: { command: 'music', hint: 'the dial is on. turn it.' },
  },

  alley: {
    id: 'alley',
    title: 'the alley',
    vignettes: [
      'you are in the alley.\nit is narrower than you remember.',
      'you are in the alley.\nsomeone has chalked something on the wall in turkish.',
      'you are in the alley.\nwet. the rain finished an hour ago.',
      'you are in the alley.\na man you don’t know is asking for a line.\nyou don’t have one to give.',
      'you are in the alley.\nhe is here. or he isn’t. you can’t always tell.',
    ],
    crossover: { command: 'dilenci', argv: ['wake'], hint: 'he is here. offer him a line.' },
  },

  window: {
    id: 'window',
    title: 'the window',
    vignettes: [
      'you are at the window.\nthe city is on. someone in a far building is awake.',
      'you are at the window.\nthe bosphorus, blue at this hour, dark on the istanbul side.',
      'you are at the window.\nyou’ve stood here for longer than you intended.',
      'you are at the window.\na gull. then nothing. then another gull.',
      'you are at the window.\nyou are inside, but the window is asking.',
    ],
  },

  shore: {
    id: 'shore',
    title: 'the shore',
    vignettes: [
      'you are at the shore.\nbetween the water and the land, neither.',
      'you are at the shore.\na fishing boat. green. moves an inch.',
      'you are at the shore.\nsalt on your lip without remembering.',
      'you are at the shore.\nlow tide. the line of weed where the water was.',
      'you are at the shore.\nsmall bird, larger bird, no bird.',
    ],
    crossover: { command: 'undertow', hint: 'the water is moving the wrong way. step in.' },
  },

  field: {
    id: 'field',
    title: 'the salt field',
    vignettes: [
      'you are in the salt field.\nlow tide. every stone is dry.',
      'you are in the salt field.\ncrystals where the boot was.',
      'you are in the salt field.\nthe sky is white and ordinary.',
      'you are in the salt field.\nquiet in the way that a room is quiet.',
      'you are in the salt field.\na long time ago a man walked across this\nand didn’t come back.',
    ],
  },

  boat: {
    id: 'boat',
    title: 'the boat, offshore',
    vignettes: [
      'you are on the boat.\nthe harbor is the size of your thumbnail.',
      'you are on the boat.\nnobody is in the cabin. you don’t go in.',
      'you are on the boat.\nwind from the south. it’ll be wind from the west by evening.',
      'you are on the boat.\nsomewhere on board, a bowline is holding.',
      'you are on the boat.\nyou have everything you need.\nnothing is for you.',
    ],
  },

  empty: {
    id: 'empty',
    title: 'the empty room',
    vignettes: [
      'you are in the empty room.\nit isn’t empty. it’s nearly empty.',
      'you are in the empty room.\nin the corner: him.\nyou didn’t see him.',
      'you are in the empty room.\nthe photograph on the wall has someone in it\nyou don’t recognize.',
      'you are in the empty room.\nfluorescent. that hum that is also a thought.',
      'you are in the empty room.\nhe was here. he is always here.\nyou keep forgetting.',
    ],
    crossover: { command: 'whois', argv: ['stowaway'], hint: 'the file cabinet has a tag. read it.' },
  },
};

// Pure vignette selector — given visit count, return the variant.
export function vignetteAt(placeId: string, visitCount: number): string {
  const place = PLACES[placeId];
  if (!place) return '';
  const safe = Math.max(1, visitCount);
  return place.vignettes[(safe - 1) % place.vignettes.length];
}
