import type { Program } from '../../kernel/program';
import { getRegistry } from '../../kernel/registry';
import threads from '../../content/threads.json';

const THREAD_MAN: Record<string, string[]> = {
  'the harbor':   ['HARBOR(7)', '', 'a place to come back to. /dev/harbor speaks. so does /home/orkan/projects/regatta.', '', 'SEE ALSO: the regatta, the salt.'],
  'the salt':     ['SALT(7)', '', 'you have it on your hands. /dev/salt. it amplifies whispers for a while.', '', 'SEE ALSO: the harbor, the whisper.'],
  'the regret':   ['REGRET(7)', '', '/dev/regret and /var/regret/. one is a line. the other is a list.'],
  'the regatta':  ['REGATTA(7)', '', 'a sailing race. izmir, july 2024. third place.', 'the game arrives in v0.2. try `regatta`.'],
  'the whisper':  ['WHISPER(7)', '', 'a single word fades into the void edge.', 'type the word as a command. some words answer.'],
  'the cabinet':  ['CABINET(7)', '', 'the dotfiles. ls -la /home/orkan/. one is a ledger.'],
  'the dilenci':  ['DILENCI(7)', '', 'an old project. /home/orkan/projects/dilenci/. read the readme. it will tell you.', '', 'in v0.3 he speaks.'],
  'the wind':     ['WIND(7)', '', '/dev/wind. it shifts. it lies a little.'],
  'the stowaway': ['STOWAWAY(7)', '', 'he is in /var/log/observers.log.', 'he runs `pinpoint`. (arrives v0.3.)'],
  'the poems':    ['POEMS(7)', '', '/usr/share/poems/. mostly empty. he fills it as he is fed.'],
  'the gallery':  ['GALLERY(7)', '', 'arrives v0.4. ascii rederings of orkan\'s works.'],
  'the noticeboard': ['NOTICEBOARD(7)', '', '`bbs`. old messages, kept on purpose.'],
};

const prog: Program = {
  name: 'man',
  manpage: 'man <topic> — manpages. `man -k threads` lists current trails.',
  category: 'discovery',
  mode: 'inline',
  onCommand: (_ctx, argv) => {
    if (argv[1] === '-k' && argv[2] === 'threads') {
      return ['', 'open threads:', '', ...threads.threads.map((t) => `  ${t.id}`), '', 'use `man <thread name>` to follow.', ''].join('\n');
    }
    const topic = argv.slice(1).join(' ').toLowerCase();
    if (!topic) return 'usage: man <topic>   or   man -k threads';
    const lines = THREAD_MAN[topic];
    if (lines) return lines.join('\n');
    const p = getRegistry().get(topic);
    if (p) return `${topic.toUpperCase()}(1)\n\n${p.manpage}`;
    return `man: no entry for ${topic}.`;
  },
};

export default prog;
