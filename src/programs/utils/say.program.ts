import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'say',
  manpage: 'say <text> — speak aloud. browser must support SpeechSynthesis.',
  category: 'util',
  mode: 'inline',
  onCommand: (_ctx, argv) => {
    const text = argv.slice(1).join(' ').trim();
    if (!text) return 'say: nothing to say.';
    if (!('speechSynthesis' in window)) return 'say: this browser has no voice.';
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 0.7;
    u.volume = 0.6;
    window.speechSynthesis.speak(u);
    return `(saying: "${text}")`;
  },
};

export default prog;
