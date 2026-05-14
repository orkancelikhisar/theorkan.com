import type { Program } from '../../kernel/program';

const RESPONSES: Record<string, string> = {
  happiness:    'PING happiness: request timed out.',
  istanbul:     'PING istanbul: reachable, 12ms, smells like the bazaar.',
  'google.com': 'PING google.com: reachable, 9ms. they can see you. (try `pinpoint`)',
  localhost:    'PING localhost: 0ms. you are home.',
  god:          'PING god: no answer. retry?',
  yourself:     'PING yourself: 1 packet sent, 1 lost.',
};

const prog: Program = {
  name: 'ping',
  manpage: 'ping <host> — most hosts do not answer.',
  category: 'util',
  mode: 'inline',
  onCommand: (_ctx, argv) => {
    const host = (argv[1] || '').toLowerCase();
    if (!host) return 'ping: usage: ping <host>';
    return RESPONSES[host] || `PING ${host}: no route to that host.`;
  },
};

export default prog;
