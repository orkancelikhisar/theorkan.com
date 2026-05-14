import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'cv',
  manpage: 'cv pdf — download orkan_cv.pdf. (it is a real pdf. you can open it.)',
  category: 'info',
  mode: 'inline',
  onCommand: (_ctx, argv) => {
    if (argv[1] !== 'pdf') {
      return 'usage: cv pdf';
    }
    const a = document.createElement('a');
    a.href = './cv/orkan_cv.pdf';
    a.download = 'orkan_cv.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloading orkan_cv.pdf ... open it.';
  },
};

export default prog;
