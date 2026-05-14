import type { Program } from '../../kernel/program';

const TOTAL_THINGS = 60;

const prog: Program = {
  name: 'hints',
  manpage: 'hints — a soft compass for visitors who feel lost.',
  category: 'discovery',
  mode: 'inline',
  onCommand: () => {
    const found = (() => {
      try { return JSON.parse(localStorage.getItem('theorkan.discoveries') || '[]').length; }
      catch { return 0; }
    })();
    return [
      '',
      `you have found ${found} of (approximately) ${TOTAL_THINGS} things.`,
      '',
      'some live in /dev/. some live in /var/ — especially /var/regret and /var/log.',
      "some are commands you haven't typed. try `tab` after a letter.",
      'some are people. one is a beggar.',
      'some are silent. some sing.',
      '',
      'try `man -k threads` to see open trails.',
      '',
    ].join('\n');
  },
};

export default prog;
