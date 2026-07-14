import type { DeviceModule } from '../../kernel/devices';
import { lunarTide, moonName } from '../art/undertow/tide';
import { coastalSnapshot } from '../../coast/coastal-memory';

function rememberedLines(): number {
  try {
    const diff = JSON.parse(localStorage.getItem('theorkan.fs.diff') || '{}') as Record<string, { content?: string }>;
    const content = diff['/home/orkan/.dilenci/undertow.txt']?.content ?? '';
    return content.split('\n').filter((line) => line.trim()).length;
  } catch { return 0; }
}

const dev: DeviceModule = {
  name: 'tide',
  read: () => {
    const tide = lunarTide();
    const moon = moonName(tide.phase);
    const light = Math.round(tide.illumination * 100);
    const lines = rememberedLines();
    const coast = coastalSnapshot();
    const memory = lines === 0
      ? 'nothing given to the water yet.'
      : `${lines} sentence${lines === 1 ? '' : 's'} moving below instrument range.`;
    return `${moon} moon, ${light}% lit. tide ${coast.tideName} at ${Math.round(coast.tide * 100)}%.\n${memory}\nsee: \`undertow\`.`;
  },
};

export default dev;
