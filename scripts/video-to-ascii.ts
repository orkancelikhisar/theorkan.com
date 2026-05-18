// Convert videos in ./videos/ to ASCII frame sequences for the gallery.
//
// Usage:
//   pnpm video:build              # processes everything in ./videos/
//   pnpm video:build foo.mp4      # just one file
//
// Output:
//   src/content/works/<name>.json   { title, year, caption, fps, frames }
//
// Requires `ffmpeg` available on PATH. We pipe each video through
//   ffmpeg -i in -vf "fps=N,scale=WxH,format=gray" out/%04d.pgm
// and then parse the binary P5 PGMs ourselves so we don't pull in an image
// library just for grayscale sampling.

import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';

const VIDEOS_DIR = path.resolve('videos');
const OUT_DIR    = path.resolve('src/content/works');
const TMP_DIR    = path.resolve('.video-build');

const FPS    = 30;    // playback fps in the gallery
const WIDTH  = 80;    // chars per row
const HEIGHT = 30;    // rows per frame
// Hard cap per video. 30fps × 8s = 240 frames. With the gallery's ping-pong
// loop this plays back as 16s before repeating, which is plenty for ambient
// pieces and keeps each JSON under ~750 kB.
const MAX_DURATION_S = 8;
// Brightness ramp, sparse → dense. We're on a dark canvas with bone text, so
// brighter pixels in the source map to denser chars (more visible "white").
const RAMP = ' .,:;~ox+*#%@';

function brightnessChar(b: number): string {
  const idx = Math.min(RAMP.length - 1, Math.floor((b / 255) * RAMP.length));
  return RAMP[idx];
}

interface Pgm { w: number; h: number; pixels: Uint8Array }

function parsePgm(buf: Buffer): Pgm {
  // Header tokens are whitespace-separated ASCII; binary pixel data follows
  // a single whitespace after the maxval.
  let off = 0;
  function readToken(): string {
    while (off < buf.length && /\s/.test(String.fromCharCode(buf[off]))) off++;
    // Skip PGM comments — lines starting with '#'.
    while (off < buf.length && buf[off] === 0x23) {
      while (off < buf.length && buf[off] !== 0x0a) off++;
      while (off < buf.length && /\s/.test(String.fromCharCode(buf[off]))) off++;
    }
    let token = '';
    while (off < buf.length && !/\s/.test(String.fromCharCode(buf[off]))) {
      token += String.fromCharCode(buf[off]);
      off++;
    }
    return token;
  }
  const magic = readToken();
  if (magic !== 'P5') throw new Error(`not a binary PGM (got "${magic}")`);
  const w = parseInt(readToken(), 10);
  const h = parseInt(readToken(), 10);
  parseInt(readToken(), 10);                  // maxval (we assume 8-bit)
  off += 1;                                   // single whitespace after maxval
  const pixels = new Uint8Array(buf.subarray(off, off + w * h));
  return { w, h, pixels };
}

function pgmToAscii({ w, h, pixels }: Pgm): string {
  const lines: string[] = [];
  for (let r = 0; r < h; r++) {
    let line = '';
    for (let c = 0; c < w; c++) line += brightnessChar(pixels[r * w + c]);
    lines.push(line);
  }
  return lines.join('\n');
}

// Read an optional sidecar metadata file next to the video. Format:
//   videos/harbor.mp4
//   videos/harbor.meta.json   { "title": "Harbor", "year": "2023", "caption": "…" }
// If absent, we default to filename → title, year "—", caption "".
function readSidecarMeta(videoPath: string): { title: string; year: string; caption: string } {
  const base = videoPath.replace(/\.[^.]+$/, '');
  const fileName = path.basename(base);
  const candidates = [`${base}.meta.json`, `${base}.json`];
  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        const m = JSON.parse(readFileSync(c, 'utf8'));
        return {
          title:   String(m.title   ?? fileName),
          year:    String(m.year    ?? '—'),
          caption: String(m.caption ?? ''),
        };
      } catch (err) {
        console.warn(`malformed sidecar ${c}: ${(err as Error).message}`);
      }
    }
  }
  return { title: fileName, year: '—', caption: '' };
}

function processVideo(file: string): void {
  const name = path.basename(file, path.extname(file));
  const safeName = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  const tmp = path.join(TMP_DIR, safeName);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  const ff = spawnSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', file,
    '-t', String(MAX_DURATION_S),
    '-vf', `fps=${FPS},scale=${WIDTH}:${HEIGHT}:flags=lanczos,format=gray`,
    '-an',
    path.join(tmp, '%04d.pgm'),
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (ff.status !== 0) {
    console.error(`ffmpeg failed for ${file}`);
    return;
  }

  const frameFiles = readdirSync(tmp).filter((f) => f.endsWith('.pgm')).sort();
  if (frameFiles.length === 0) {
    console.warn(`no frames extracted from ${file}`);
    return;
  }
  const frames: string[] = [];
  for (const f of frameFiles) {
    const buf = readFileSync(path.join(tmp, f));
    frames.push(pgmToAscii(parsePgm(buf)));
  }

  const sidecar = readSidecarMeta(file);
  const meta = {
    title:   sidecar.title,
    year:    sidecar.year,
    caption: sidecar.caption,
    fps:     FPS,
    width:   WIDTH,
    height:  HEIGHT,
    frames,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${safeName}.json`);
  writeFileSync(outPath, JSON.stringify(meta));
  const kb = (Buffer.byteLength(JSON.stringify(meta)) / 1024).toFixed(1);
  console.log(`✓ ${safeName}: ${frames.length} frames, ${kb} kB — ${sidecar.title} (${sidecar.year})`);
}

function main(): void {
  if (!existsSync(VIDEOS_DIR)) {
    console.log(`No ./videos/ directory found. Create it and drop video files in (mp4/webm/mov), then re-run.`);
    process.exit(0);
  }
  const cliArgs = process.argv.slice(2);
  const files = (cliArgs.length ? cliArgs : readdirSync(VIDEOS_DIR))
    .filter((f) => /\.(mp4|webm|mov|m4v)$/i.test(f))
    .map((f) => (path.isAbsolute(f) ? f : path.join(VIDEOS_DIR, f)));

  if (files.length === 0) {
    console.log('No videos found. Drop .mp4 / .webm / .mov files in ./videos/.');
    process.exit(0);
  }
  mkdirSync(TMP_DIR, { recursive: true });
  for (const f of files) processVideo(f);
  console.log(`Done. ${files.length} works processed → ${OUT_DIR}`);
}

main();
