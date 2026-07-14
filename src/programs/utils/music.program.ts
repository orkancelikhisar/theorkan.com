import '../../music/music.css';
import type { Program, ProgramContext } from '../../kernel/program';
import { createMusicEngine, type MusicAPI } from '../../music/engine';
import { createMusicPanel, type MusicPanelAPI } from '../../music/panel';
import { TRACKS } from '../../music/tracks';
import { recordCoastalFrequency } from '../../coast/coastal-memory';

// Lazy module-level singletons so all `music` invocations share state across
// the session. The engine creates the AudioContext on first play.
let engine: MusicAPI | null = null;
let panel: MusicPanelAPI | null = null;

function trackFrequency(name: string): string {
  let hash = 0;
  for (const char of name) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `${(87.5 + (hash % 160) / 10).toFixed(1)} MHz / lower sideband`;
}

function ensure(): { engine: MusicAPI; panel: MusicPanelAPI } {
  if (!engine) engine = createMusicEngine(TRACKS);
  if (!panel) panel = createMusicPanel(engine, document.body);
  return { engine, panel };
}

const prog: Program = {
  name: 'music',
  manpage: 'music — orkan\'s ambient pieces.\n  music ls         list tracks\n  music play [name]  start a track (default: first one)\n  music pause      pause current\n  music resume     resume after pause\n  music prev       previous track\n  music skip       next track\n  music restart    restart the current track\n  music stop       stop and close the panel',
  category: 'music',
  mode: 'inline',
  onCommand: (ctx: ProgramContext, argv: string[]) => {
    const { engine, panel } = ensure();
    const sub = (argv[1] ?? '').toLowerCase();

    if (!sub || sub === 'ls') {
      ctx.println('');
      ctx.println('  tracks:');
      const cur = engine.current();
      for (const t of engine.list()) {
        const mark = cur && cur.track.name === t.name ? '▶' : ' ';
        const dur = `${Math.floor(t.duration_s / 60)}:${String(t.duration_s % 60).padStart(2, '0')}`;
        ctx.println(`  ${mark}  ${t.name.padEnd(20)} ${dur}    ${t.caption ?? ''}`);
      }
      ctx.println('');
      ctx.println('  music play <name>   start a track');
      ctx.println('');
      return;
    }

    if (sub === 'play') {
      const name = argv.slice(2).join(' ').trim() || undefined;
      const track = engine.play(name);
      if (!track) { ctx.println(`music: no track "${name ?? ''}". try \`music ls\`.`); return; }
      panel.open();
      const frequency = trackFrequency(track.name);
      recordCoastalFrequency(frequency);
      ctx.println(`music: ${track.title}.`);
      ctx.println(`radio: ${frequency}.`);
      return;
    }
    if (sub === 'pause') {
      if (!engine.current()) { ctx.println('music: nothing playing.'); return; }
      engine.pause();
      ctx.println('music: paused.');
      return;
    }
    if (sub === 'resume' || sub === 'unpause') {
      if (!engine.current()) { ctx.println('music: nothing playing.'); return; }
      engine.resume();
      ctx.println('music: resumed.');
      return;
    }
    if (sub === 'skip' || sub === 'next') {
      if (!engine.current()) { ctx.println('music: nothing playing.'); return; }
      engine.skip();
      const c = engine.current();
      if (c) ctx.println(`music: ${c.track.title}.`);
      return;
    }
    if (sub === 'prev' || sub === 'previous') {
      if (!engine.current()) { ctx.println('music: nothing playing.'); return; }
      engine.prev();
      const c = engine.current();
      if (c) ctx.println(`music: ${c.track.title}.`);
      return;
    }
    if (sub === 'restart' || sub === 'rewind') {
      if (!engine.current()) { ctx.println('music: nothing playing.'); return; }
      engine.restart();
      ctx.println('music: restarted.');
      return;
    }
    if (sub === 'stop') {
      engine.stop();
      panel.close();
      ctx.println('music: stopped.');
      return;
    }

    ctx.println(`music: unknown subcommand "${sub}". try \`music ls\`.`);
  },
};

export default prog;
