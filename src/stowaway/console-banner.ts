import { MIDDLE_FINGER_LARGE } from '../content/ascii-fingers';

const STYLE =
  'font-family: monospace; font-size: 13px; ' +
  'color: #e8e6df; background: #0a0a0a; padding: 16px 24px; line-height: 1.3;';

const BANNER = `%c${MIDDLE_FINGER_LARGE}\n\n  you saw nothing.\n  — the stowaway\n`;

export function installConsoleBanner(): void {
  console.log(BANNER, STYLE);
  const _clear = console.clear.bind(console);
  console.clear = () => {
    _clear();
    console.log(BANNER, STYLE);
  };
}
