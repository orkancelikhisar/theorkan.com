import type { Program } from './program';

const modules = import.meta.glob<{ default: Program }>('../programs/**/*.program.ts', { eager: true });

const registry = new Map<string, Program>();
for (const mod of Object.values(modules)) {
  const prog = mod.default;
  if (!prog || !prog.name) continue;
  registry.set(prog.name, prog);
  if (prog.aliases) for (const a of prog.aliases) registry.set(a, prog);
}

export function getRegistry(): Map<string, Program> { return registry; }

export function lookupProgram(name: string): Program | undefined {
  return registry.get(name);
}

export function listPrograms(): Program[] {
  return [...new Set(registry.values())];
}
