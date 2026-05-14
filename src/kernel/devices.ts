import type { FS } from './fs';
import type { PanelManager } from './panels';

export interface DeviceEnv {
  random(): number;
  panel: PanelManager;
}

export interface DeviceModule {
  name: string;
  read(env: DeviceEnv): string;
}

const modules = import.meta.glob<{ default: DeviceModule }>('../programs/devices/**/*.device.ts', { eager: true });

export function registerAllDevices(fs: FS, panel: PanelManager): void {
  const env: DeviceEnv = { random: Math.random, panel };
  const list = Object.values(modules).map((m) => m.default);
  for (const dev of list) {
    fs.registerDevice(dev.name, () => dev.read(env));
  }
}
