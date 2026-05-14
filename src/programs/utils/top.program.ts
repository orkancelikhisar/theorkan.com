import type { Program } from '../../kernel/program';

const PROCESSES = [
  '  PID  STATUS    MEM    PROCESS',
  '   1   RUNNING   847M   responsibility',
  '   2   ZOMBIE    3.2M   philosophy',
  '   3   ORPHAN    0.0K   passion',
  '   4   SLEEPING  ? KB   postmodern_dilenci',
  '   5   OBSERVING 12K    stowaway',
  '   6   RUNNING   42K    void.daemon',
  '   7   IDLE      8K     regatta_sim',
  '   8   RUNNING   1.2M   memory.of.her',
  '   9   WAITING   1.0K   answer',
  '  47   RUNNING   ? KB   you',
];

const prog: Program = {
  name: 'top',
  manpage: 'top — joke process list. nothing is really running.',
  category: 'util',
  mode: 'inline',
  onCommand: () => PROCESSES.join('\n'),
};

export default prog;
