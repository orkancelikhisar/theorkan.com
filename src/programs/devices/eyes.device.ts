import type { DeviceModule } from '../../kernel/devices';
import { requestEyesCamera, isEyesActive } from '../../eyes/camera';

const dev: DeviceModule = {
  name: 'eyes',
  read: (env) => {
    if (isEyesActive()) {
      return 'eyes: already watching. type `eyes off` to stop.';
    }
    void requestEyesCamera(env.panel).then((status) => {
      if (status === 'denied') {
        console.warn('[eyes] camera permission denied');
      } else if (status === 'unsupported') {
        console.warn('[eyes] camera not supported in this browser');
      }
    });
    return [
      "eyes: i'd like to see what you see, briefly.",
      '       (allow camera in your browser. nothing is recorded, nothing is sent.)',
      '       type `eyes off` to close.',
    ].join('\n');
  },
};

export default dev;
