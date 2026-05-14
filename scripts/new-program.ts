import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const name = args[0];
const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1] || 'util';
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'inline';

if (!name) {
  console.error('usage: pnpm new:program <name> --category=<info|game|art|music|util|device|discovery|easter> --mode=<inline|panel|modal>');
  process.exit(1);
}

const dir = path.join('src/programs', categoryArg);
fs.mkdirSync(dir, { recursive: true });

const tmpl = `import type { Program } from '../../kernel/program';

const prog: Program = {
  name: '${name}',
  manpage: '${name} — <one-line description>',
  category: '${categoryArg}' as const,
  mode: '${modeArg}' as const,
  onCommand: (_ctx, _argv) => {
    return 'hello from ${name}';
  },
};

export default prog;
`;

const filePath = path.join(dir, `${name}.program.ts`);
if (fs.existsSync(filePath)) {
  console.error(`already exists: ${filePath}`);
  process.exit(1);
}
fs.writeFileSync(filePath, tmpl);
console.log(`created ${filePath}`);
console.log('add a row to src/content/threads.json if this is a discoverable command.');
