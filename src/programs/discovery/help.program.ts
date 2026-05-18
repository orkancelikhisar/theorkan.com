import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'help',
  manpage: 'help — the catalogue of known commands.',
  category: 'discovery',
  mode: 'inline',
  onCommand: () => [
    '',
    'theOrkan.OS — commands. type `man <name>` for details on any.',
    '',
    'INFO         whoami   about   projects   contact   man-orkan   cv pdf',
    'GAMES        snake    2048    regatta    life    aquarium',
    'ART          gallery  latent   currency',
    'MUSIC        music ls   music play <name>   music pause / skip / stop',
    'UTILS        cowsay   fortune   figlet   ping   top   ps',
    '             date   uname   uptime   weather   tree   which   whatis   say',
    'DEVICES      cat /dev/heart   /dev/wind   /dev/harbor   /dev/salt   /dev/regret',
    '             eyes   (open the camera; `eyes off` to close)',
    'DISCOVERY    hints   secrets   motd   man <topic>   man -k threads   bbs   demo',
    'SHELL        ls   cd   cat   echo   find   grep   touch   rm   mv   cp',
    '             clear   history   alias   reset   vibe   mute   unmute',
    '',
    'things you have not found yet are still here. some commands',
    'do not announce themselves. type `hints` for the compass.',
    '',
  ].join('\n'),
};

export default prog;
