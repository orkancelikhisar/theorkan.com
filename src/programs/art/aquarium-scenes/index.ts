import { boatsScene } from './boats';
import { starfieldScene } from './starfield';
import { rainScene } from './rain';
import { waveformScene } from './waveform';
import type { Scene } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENES: Record<string, Scene<any>> = {
  boats: boatsScene,
  starfield: starfieldScene,
  rain: rainScene,
  waveform: waveformScene,
};

export const DEFAULT_SCENE = 'boats';

export type { Scene, SceneContext } from './types';
