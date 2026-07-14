// Hand-authored gallery pieces + auto-loaded ASCII-video works.
//
// Pieces come in three flavours:
//   1. STATIC  — a single ASCII string (`art`)
//   2. ANIMATED — a generator function called at 30fps (`generator`)
//   3. VIDEO   — lazy-loaded JSON of pre-rendered frames (`loader`)
//
// The gallery program decides how to display each based on which field is
// populated. ASCII-video works always come first (alphabetical), then the
// hand-authored ones.

import {
  harborAt4am,
  ropeKnotted,
  theStowaway,
  saltField,
  letterToSari,
  artificialGallery,
} from './gallery-anims';
import { coastalSnapshot, readCoastalMemory } from '../../coast/coastal-memory';

export interface GalleryWork {
  title: string;
  year: string;
  caption: string;
  art?: string;                                 // static piece
  frames?: string[];                            // resolved frames (video work)
  fps?: number;
  generator?: (frame: number) => string;        // procedural animation, 30fps
  isVideo?: boolean;
  loader?: () => Promise<{
    title: string; year: string; caption: string; fps: number; frames: string[];
  }>;
}

// ── ASCII-video works (lazy-loaded chunks) ────────────────────────────────
interface VideoWorkJson {
  title: string;
  year: string;
  caption: string;
  fps: number;
  frames: string[];
}

const VIDEO_LOADERS = import.meta.glob<{ default: VideoWorkJson }>(
  '../../content/works/*.json',
);

function idFromPath(p: string): string {
  const m = p.match(/([^/\\]+)\.json$/);
  return (m ? m[1] : p).toLowerCase();
}

function titleFromId(id: string): string {
  return id.replace(/_/g, ' ');
}

const VIDEO_WORKS: GalleryWork[] = Object.entries(VIDEO_LOADERS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([p, loader]) => {
    const id = idFromPath(p);
    return {
      title: titleFromId(id),
      year: '—',
      caption: '',
      isVideo: true,
      loader: async () => {
        const mod = await loader();
        return mod.default;
      },
    } as GalleryWork;
  });

// ── Hand-authored pieces (animated + a couple of static survivors) ────────
const STATIC_WORKS: GalleryWork[] = [
  {
    title: 'Visitor Plate / Current Session',
    year: 'now',
    caption: 'commands, routes, tide and recovered language. this image belongs only to this visit.',
    generator: (frame: number) => {
      const memory = readCoastalMemory();
      const snapshot = coastalSnapshot(memory);
      const width = 58;
      const height = 24;
      const chars = '  ·.:;+*#';
      const rows = Array.from({ length: height }, () => Array<string>(width).fill(' '));
      const seed = memory.seed ^ memory.commandCount ^ Math.floor(frame / 18);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          let value = (seed ^ Math.imul(col + 3, 73856093) ^ Math.imul(row + 5, 19349663)) >>> 0;
          value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
          const wave = Math.sin(col * .27 + frame * .025 + snapshot.tide * 5) * 0.16;
          const density = (value / 4294967295) * .62 + wave + memory.artifacts.length * .012;
          rows[row][col] = chars[Math.max(0, Math.min(chars.length - 1, Math.floor(density * chars.length)))];
        }
      }
      for (let index = 0; index < memory.footprints.length; index++) {
        const footprint = memory.footprints[index];
        const col = Math.abs(footprint.col * 7 + index * 3) % width;
        const row = Math.abs(footprint.row * 5 + index) % height;
        rows[row][col] = index % 2 ? '′' : '·';
      }
      const phrase = memory.phrases[memory.phrases.length - 1]?.text.toLowerCase() ?? 'nothing entered the water';
      const inscription = phrase.slice(0, width - 6);
      for (let index = 0; index < inscription.length; index++) rows[height - 3][index + 3] = inscription[index];
      return rows.map((row) => row.join('')).join('\n');
    },
  },
  {
    title: 'Harbor at 4am',
    year: '2023',
    caption: 'minimal. waiting for wind.',
    generator: harborAt4am,
  },
  {
    title: 'Rope, Knotted',
    year: '2022',
    caption: 'a bowline, the only knot worth learning.',
    generator: ropeKnotted,
  },
  {
    title: 'The Stowaway',
    year: '2024',
    caption: 'he is in the corner of every photograph you have not seen.',
    generator: theStowaway,
  },
  {
    title: 'Salt Field',
    year: '2023',
    caption: 'the photograph after the photograph.',
    generator: saltField,
  },
  {
    title: 'Letter to Sarı',
    year: '2024',
    caption: 'for the dog who used to chase the cars.',
    generator: letterToSari,
  },
  {
    title: 'Artificial Gallery (floor plan)',
    year: '2024',
    caption: 'three rooms. one visitor.',
    generator: artificialGallery,
  },
];

// Merge static + video-generated works. Video works come first.
export const WORKS: GalleryWork[] = [...VIDEO_WORKS, ...STATIC_WORKS];
