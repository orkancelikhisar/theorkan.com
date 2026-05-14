import type { Program } from '../../kernel/program';

function moodForDate(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'mild and uncertain';
  if (m >= 5 && m <= 7) return 'hot and unhelpful';
  if (m >= 8 && m <= 10) return 'thin and clear';
  return 'cold and very honest';
}

const prog: Program = {
  name: 'weather',
  manpage: 'weather — i would tell you if you told me where.',
  category: 'util',
  mode: 'inline',
  onCommand: () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return [
      `i don't know where you are. i can guess: ${tz}.`,
      `today: ${moodForDate()}.`,
      'try `cat /dev/wind` for theOrkan weather.',
    ].join('\n');
  },
};

export default prog;
