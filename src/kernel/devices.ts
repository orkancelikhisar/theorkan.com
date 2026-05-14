import type { FS } from './fs';

export interface DeviceModule {
  name: string;
  read(rng: () => number): string;
}

const modules = import.meta.glob<{ default: DeviceModule }>('../programs/devices/**/*.device.ts', { eager: true });

export function registerAllDevices(fs: FS): void {
  const list = Object.values(modules).map((m) => m.default);
  for (const dev of list) {
    fs.registerDevice(dev.name, () => dev.read(Math.random));
  }
}
