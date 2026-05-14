import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'ps',
  manpage: 'ps — same processes as top.',
  category: 'util',
  mode: 'inline',
  onCommand: () => [
    '  PID  STATUS    MEM    PROCESS',
    '   1   RUNNING   847M   responsibility',
    '   2   ZOMBIE    3.2M   philosophy',
    '   3   ORPHAN    0.0K   passion',
    '   4   SLEEPING  ? KB   postmodern_dilenci',
    '   5   OBSERVING 12K    stowaway',
    '   6   RUNNING   42K    void.daemon',
    '   7   IDLE      8K     regatta_sim',
  ].join('\n'),
};

export default prog;
