import type { DeviceModule } from '../../kernel/devices';
import { coastalSnapshot } from '../../coast/coastal-memory';

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const dev: DeviceModule = {
  name: 'wind',
  read: () => {
    const coast = coastalSnapshot();
    const dir = DIRS[Math.round(coast.windDegrees / 22.5) % DIRS.length];
    return `${dir} ${coast.windSpeed}kt. ${coast.weather} moving through every open program.`;
  },
};

export default dev;
