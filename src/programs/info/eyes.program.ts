import type { Program, ProgramContext } from '../../kernel/program';
import { closeEyes, isEyesActive } from '../../eyes/camera';

const prog: Program = {
  name: 'eyes',
  manpage: 'eyes [off] — open/close the camera panel. local-only.',
  category: 'info',
  mode: 'inline',
  onCommand: (ctx: ProgramContext, argv: string[]) => {
    const sub = argv[1];
    if (sub === 'off') {
      if (!isEyesActive()) return 'eyes: nothing open.';
      closeEyes();
      return 'eyes: closed.';
    }
    ctx.events.emit('eyes:open', null);
    return 'eyes: opening...';
  },
};

export default prog;
