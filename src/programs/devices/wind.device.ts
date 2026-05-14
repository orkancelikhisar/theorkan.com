import type { DeviceModule } from '../../kernel/devices';

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const dev: DeviceModule = {
  name: 'wind',
  read: (rng) => {
    const dir = DIRS[Math.floor(rng() * DIRS.length)];
    const kt = Math.floor(3 + rng() * 9);
    return `${dir} ${kt}kt. light shift expected in 20 minutes.`;
  },
};

export default dev;
