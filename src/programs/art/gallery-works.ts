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
