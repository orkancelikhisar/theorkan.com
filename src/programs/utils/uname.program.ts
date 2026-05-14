import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'uname',
  manpage: 'uname [-a] — system info, themed.',
  category: 'util',
  mode: 'inline',
  onCommand: (_ctx, argv) => {
    if (argv.includes('-a')) {
      return 'theOrkan.OS 0.1.0 #47-orkan x86_orkan unknown unknown theOrkan/Linux';
    }
    return 'theOrkan.OS';
  },
};

export default prog;
