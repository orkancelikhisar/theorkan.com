import type { Program } from '../../kernel/program';
import projects from '../../content/projects.json';

const prog: Program = {
  name: 'projects',
  manpage: "projects — list orkan's projects with year and type.",
  category: 'info',
  mode: 'inline',
  onCommand: () => {
    const rows = projects.map((p) =>
      `${p.year.padEnd(10)} ${p.type.padEnd(36)} ${p.name}\n           ${p.desc}`,
    );
    return ['', ...rows, ''].join('\n');
  },
};

export default prog;
