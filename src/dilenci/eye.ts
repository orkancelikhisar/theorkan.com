// The single visual identity shared by every manifestation of Dilenci.
// Keeping this renderer independent of DOM and canvas lets the same eye
// appear without turning into a logo pasted on top of the work.

export const DILENCI_EYE_WIDTH = 29;
export const DILENCI_EYE_HEIGHT = 9;

const ASPECT_Y = 1.7;
const LID_HALF_W = 12;
const LID_HALF_H_OPEN = 3.6;
const IRIS_R = 2.6;
const PUPIL_R = 0.9;
const MAX_PUPIL_OFFSET_X = 2.4;
const MAX_PUPIL_OFFSET_Y = 1.1;

export interface DilenciEyeState {
  lookX: number;
  lookY: number;
  blink: number;
  dilation: number;
}

export function renderDilenciEye(s: DilenciEyeState): string {
  const lidH = LID_HALF_H_OPEN * Math.max(0.05, 1 - s.blink) * s.dilation;
  const lidW = LID_HALF_W * (0.85 + 0.15 * s.dilation);
  const irisR = IRIS_R * s.dilation;
  const cx = (DILENCI_EYE_WIDTH - 1) / 2;
  const cy = (DILENCI_EYE_HEIGHT - 1) / 2;
  const offX = s.lookX * MAX_PUPIL_OFFSET_X;
  const offY = s.lookY * MAX_PUPIL_OFFSET_Y;

  let out = '';
  for (let r = 0; r < DILENCI_EYE_HEIGHT; r++) {
    for (let c = 0; c < DILENCI_EYE_WIDTH; c++) {
      const dx = c - cx;
      const dyRow = r - cy;
      const dy = dyRow * ASPECT_Y;
      const lidNorm = Math.sqrt((dx / lidW) ** 2 + (dyRow / lidH) ** 2);
      if (lidNorm > 1) { out += ' '; continue; }

      const pdx = dx - offX;
      const pdy = dy - offY * ASPECT_Y;
      const distPupil = Math.sqrt(pdx * pdx + pdy * pdy);
      const distIrisN = distPupil / irisR;
      const nearEdge = lidNorm > 0.9;

      if (distPupil < PUPIL_R) out += '@';
      else if (distIrisN < 1) out += distIrisN < 0.55 ? 'O' : 'o';
      else if (nearEdge) out += dyRow < -0.4 || dyRow > 0.4 ? '_' : '.';
      else out += '.';
    }
    out += '\n';
  }
  return out.replace(/\n$/, '');
}
