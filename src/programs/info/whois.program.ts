import type { Program } from '../../kernel/program';
import { addCoastalArtifact } from '../../coast/coastal-memory';

// whois — lookup the names you keep hearing. Returns lore for the residents
// of theOrkan.OS. Unknown names get the canonical "no one by that name."

interface WhoisEntry {
  aliases: string[];
  body: string[];
}

const ENTRIES: WhoisEntry[] = [
  {
    aliases: ['orkan'],
    body: [
      'orkan — istanbul / münchen.',
      '  sailor, artist, engineer, musician, founder.',
      '  built this. lives here. occasionally.',
    ],
  },
  {
    aliases: ['postmodern_dilenci', 'dilenci'],
    body: [
      'postmodern_dilenci — process status: dormant / hungry.',
      '  the part of orkan that did not survive being practical.',
      '  begs for words. accepts most things. keeps a ledger.',
      '  see also: `dilenci` (control), `cat ~/projects/dilenci/readme`.',
    ],
  },
  {
    aliases: ['stowaway', 'the_stowaway'],
    body: [
      'stowaway — the one that boarded with you.',
      '  notices what your browser tells it. nothing it asks.',
      '  he is in /var/log. occasionally in your address bar.',
      '  see also: `pinpoint`, `cat /var/log/observers.log`.',
    ],
  },
  {
    aliases: ['root'],
    body: [
      'root — there is no root here.',
      '  this is a small operating system. it has no master.',
    ],
  },
  {
    aliases: ['visitor', 'you', 'me'],
    body: [
      'visitor — that is you.',
      '  the stowaway has a sketch of you in /var/log/observers.log.',
      '  if you want the rest of the sketch: `pinpoint`.',
    ],
  },
  {
    aliases: ['theorkan', 'theorkanos', 'os'],
    body: [
      'theOrkan.OS — a tiny operating system, mostly for orkan.',
      '  monochrome, monospace, no chrome. you are inside it now.',
    ],
  },
];

function lookup(name: string): WhoisEntry | null {
  const n = name.toLowerCase().trim();
  for (const e of ENTRIES) if (e.aliases.includes(n)) return e;
  return null;
}

const prog: Program = {
  name: 'whois',
  manpage: 'whois <name> — look up a name. try: orkan, postmodern_dilenci, stowaway.',
  category: 'util',
  mode: 'inline',
  onCommand: (ctx, argv) => {
    const name = argv.slice(1).join(' ').trim();
    if (!name) { ctx.println('whois: who.'); return; }
    const hit = lookup(name);
    if (!hit) { ctx.println(`whois: no one by that name. (${name})`); return; }
    if (hit.aliases.includes('stowaway')) addCoastalArtifact('stowaway-name');
    for (const line of hit.body) ctx.println(line);
  },
};

export default prog;
