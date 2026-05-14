# theOrkan.OS — Design Spec

**Project:** `theorkan.com` — personal portfolio rendered as a fake-OS terminal experience
**Author:** Orkan Çelikhisar
**Brainstorm date:** 2026-05-14
**Status:** Approved by Orkan, ready for implementation planning
**Target hosting:** GitHub Pages, custom domain `theorkan.com` via GoDaddy DNS

---

## 0. Overview

theOrkan.com presents as a fake operating system. The visitor lands on a black canvas; a bone-white pixel-art monospace shell occupies the center; the black space around it ("the void") reacts subtly to commands, hosts floating program panels, and occasionally surfaces whispered words. The experience is dense: dozens of programs, ASCII games with real physics, easter eggs, scares, a fingerprinting-aware "stowaway" daemon, and a melancholic LLM companion — the Postmodern Dilenci — that begs the visitor for words, ideas, poems, and romanticism.

The site is shipped as a fully static bundle to GitHub Pages. Everything runs client-side. No backend, no database, no third-party analytics.

The build is phased across six releases (v0.1 → v0.6), each shippable. Phasing is in §10.

---

## 1. Aesthetic constraints (locked)

| constraint | value |
|---|---|
| Palette | Monochromatic. Bone-white (`#e8e6df`) on near-black (`#0a0a0a`). No accent colors. No gradients except for the void shine reaction. |
| Typography | Sharp pixel-art monospace. Berkeley Mono / Departure Mono character (no CRT glow, no scanlines). |
| Window chrome | **None.** Terminal floats as bare text in the center of a black viewport. No traffic lights, no title bar, no borders. |
| Background reactions | Subtle. The void is the OS's nervous system, not a screensaver. |
| Tone | Literary, restrained, occasionally melancholic. Anti-tropes: no Matrix rain (unless mocked), no neon glow, no glitch effects as aesthetic. |

The whole design submits to these constraints. Any feature that requires breaking them must be rejected or reshaped.

---

## 2. Architecture

### 2.1 Module shape

```
src/
  kernel/           # shell, fs, panels, registry, event bus, program context API
  boot/             # boot sequence
  void/             # background reactions, particle engine
  dilenci/          # LLM daemon, model loader, prompt, ledger, voice, panel
  stowaway/         # fingerprint scanner (pinpoint command)
  audio/            # Web Audio API + ZzFX + OGG samples
  programs/         # auto-discovered plugins (one folder per program)
    info/  games/  art/  music/  utils/  devices/  discovery/  easter/
  content/          # JSON: bio, projects, poems seed, wordlists, manpages
  main.ts
```

### 2.2 The Program interface (plugin contract)

Every program is a self-contained module exporting `default: Program`. The shell discovers programs at startup via `import.meta.glob('../programs/**/*.program.ts')`. There is no central switch statement; dropping a new file is enough.

```ts
export interface Program {
  name: string;                  // 'snake', 'regatta', 'gallery'
  aliases?: string[];
  manpage: string;               // shown by `man <name>`
  category: 'info' | 'game' | 'art' | 'music' | 'util' | 'device' | 'discovery' | 'easter';
  mode: 'inline' | 'panel' | 'modal';

  init?(ctx: ProgramContext): void | Promise<void>;
  render?(ctx: ProgramContext): void;
  onKey?(ctx: ProgramContext, key: KeyEvent): void;
  onCommand?(ctx: ProgramContext, argv: string[]): string | void;
  cleanup?(ctx: ProgramContext): void;
}
```

### 2.3 The kernel API (`ProgramContext`)

The only surface programs touch. Programs never import from `shell/`, `fs/`, `void/`, `panels/`, or `dilenci/` directly.

```ts
interface ProgramContext {
  args: string[];
  panel:   { spawn(opts), close(id), update(id, content), focus(id) };
  fs:      { read(path), write(path, data), list(path), exists(path) };
  void:    { shine(intensity?), crackle(), whisper(word), drift(), themed(name, opts) };
  audio:   { play(sample), stop(sample), volume(n) };
  dilenci: { notify(eventName, payload) };
  events:  { on(name, cb), emit(name, payload) };
  storage: { get(key), set(key, value) };   // scoped to this program
  random:  () => number;                     // seeded for testability
}
```

### 2.4 Event bus

Every shell action emits a typed event. Subsystems subscribe. Examples:

```
cmd:executed         (cmd, argv, exitCode)
cmd:error            (cmd, errorType)
shell:idle           (durationMs)
panel:opened         (programName, panelId)
panel:closed         (panelId)
dilenci:stirred      (intent)
dilenci:fed          (offering)
program:registered   (programName)
```

### 2.5 State tiers

| tier | content | lifetime |
|---|---|---|
| In-memory | Session state, panel layout, current prompt | This session only |
| localStorage | Ledger, hunger, history, scores, discoveries, vibe setting, sessions count | Per browser, persistent |
| IndexedDB | LLM model weights cache (273 MB) | Per browser, evicted only by browser quota |

### 2.6 Extensibility (load-bearing)

Future sessions must be able to drop in new games, devices, or easter eggs without touching kernel modules. Mechanisms:

- Auto-discovery via Vite glob import
- Scaffold command: `pnpm new:program <name> --category=<> --mode=<>` generates boilerplate
- Contract tests: `kernel/registry.test.ts` loads every registered program and verifies the interface contract (unique names, no alias collisions, required hooks present for mode)
- `docs/adding-a-program.md` — short, opinionated, fits on a screen. The entry point for future Claude sessions
- Co-located assets: program-specific ASCII art / soundbites / content live inside the program folder

---

## 3. Boot sequence + discovery system

### 3.1 Boot sequence

**Plays on every visit. Never skippable.** Returning visitors see same length but different content.

**First visit (canonical, ~6 seconds):**

```
theOrkan.OS v0.1.x — booted <weekday> <date> <time> (<tz>)
copyright (c) orkan, mostly

[ OK ] memcheck                  1024 KB / 1024 KB
[ OK ] cpu: 1 core (yours)
[ OK ] mounting /                ext-fake
[ OK ] mounting /var/log
[ OK ] mounting /var/regret      62 entries
[ OK ] mounting /dev             heart, eyes, wind, harbor, salt
[ OK ] mounting /usr/share/poems 23 fragments
[ OK ] driver: keyboard
[ OK ] driver: void              drift, whisper, shine
[ OK ] driver: ascii             release 1979
[ WARN ] /etc/orkan.conf         3 deprecated values — see `man orkan`
[ OK ] init: shell               ready
[ OK ] init: filesystem          47 files indexed
[ OK ] init: gallery             11 works loaded
[ OK ] init: music               4 tracks queued
[ OK ] init: regatta_sim         wind NNW 4kt
[ .. ] locating postmodern_dilenci ............... deferred (he sleeps)
[ OK ] init: void daemon         drift enabled
[ OK ] init: stowaway daemon     caught one
[ OK ] init: motd                rotated
[ ?? ] something moved in /var/log/whispers       (ignored)

motd: today the sea is restless. some files breathe.
      try `hints` if you are lost.

> press enter to wake up_
```

**Returning visitor (~6 seconds, different content):**

```
theOrkan.OS v0.1.x — booted ...
welcome back. last seen 3 days ago, around 04:11.

[ OK ] memcheck
... (similar structure, with deltas)
[ .. ] locating postmodern_dilenci ............... he is awake. he asks where you went.
...

motd: there is a thing in /dev/salt you haven't tasted.
      `hints` for compass. `secrets` to count your finds.

orkan@theorkan:~$ _
```

The line "he asks where you went" only appears when the ledger has ≥1 entry AND ≥24h have passed.

### 3.2 Boot rotation budget

Per visit, one of each is picked from curated sets:

- 1 of ~30 **motd lines** (each subtly points to one easter egg)
- 1 of ~10 **`[ WARN ]` lines** (different deprecated config value each time)
- 1 of ~15 **`[ ?? ]` curiosity lines** (each names a file or path worth investigating)
- 1 of ~8 **dilenci-status lines** (only when ledger non-empty)

Yields ~4500 unique boot combinations before recycling.

**Not included** (explicitly rejected during brainstorm):
- ~~`[ NEW ]` changelog lines~~
- ~~`[ MILESTONE ]` visit-count lines~~

### 3.3 Boot reactions

- Each `[ OK ]` line: a barely-audible click (ZzFX, ~30ms, gain 0.04)
- The `[ WARN ]` line: void pulses once, slow
- The `[ .. ]` Dilenci line: this is real — model fetch starts here, in background, never blocking. Status line updates to `[ OK ] postmodern_dilenci awoke quietly.` when ready, or stays `[ .. ]` on failure (silent degradation)
- The `> press enter to wake up_` cursor blinks slowly; first keypress triggers a soft inhale and a single shine ripple

### 3.4 The discovery system (the soft compass)

Visitors must not get fully lost. Five lightweight pieces working together:

1. **`motd`** — In boot and as a standalone command. Always names one current "thread to pull."
2. **`hints`** — Compass output:
   ```
   you have found 12 of (approximately) 60 things.
   some live in /dev/. some live in /var/.
   some are commands you haven't typed. try `tab` after a letter.
   some are people. one is a beggar.
   try `man -k threads` to see open trails.
   ```
3. **`man -k threads`** — Topic index. Vague descriptive titles, never command names:
   ```
   the harbor    the salt    the regret    the regatta
   the whisper   the cabinet the dilenci   the wind
   the stowaway  the poems   the gallery   the noticeboard
   ```
   Each is a manpage. Reading the manpage drops the actual command name in the body.
4. **`secrets`** — Trophy case. Lists only what *this visitor* has personally found.
5. **Cross-references** — Every manpage, every file, every poem name-drops at least one other path or command.

### 3.5 Discoverability discipline

Every easter egg has at least one breadcrumb pointing to it: a motd line, a manpage cross-reference, a `[ ?? ]` boot curiosity, or a file that mentions another file. No easter egg may be authored without a breadcrumb.

`help` reveals most of the catalogue (see §6) — the secrets are easter eggs, scares, the Dilenci/stowaway commands, hidden directories, and time-of-day specials.

---

## 4. The void & background reactions

The black canvas around the terminal is the OS's nervous system. Six reactions, all subtle by default.

| name | trigger | render | duration |
|---|---|---|---|
| **shine** | Every successful command | Soft radial gradient from terminal center, fades through the void | ~250 ms |
| **crackle** | Command error / typo | Brief scattered grain (tiny pixel noise) at prompt line | ~80 ms |
| **echo** | Dilenci appears | Slow concentric ring expanding from terminal, dissolves at viewport edge | ~1.2 s |
| **drift** | Idle ≥ 15 s | 1-3 bone-white pixels wandering at void edge (curved paths, ~6 px/s) | Persistent until input |
| **whisper** | Random, low-frequency | One word from the wordlist fades in at random void-edge position, then fades out (25 % opacity) | ~3 s in, hold 2 s, ~3 s out |
| **breath** | Time-of-day (sunset, deep night, dawn) | Void background warms/cools ~3 % via CSS variable | Minutes |

### 4.1 Drift escalation

- 15 s idle → 1 pixel
- 30 s idle → escalate to 2-3 pixels, occasional drift pixel traces a letter, rare face flicker (~0.4 s)

### 4.2 Whisper engine

- 60-120 s timer fires; small probability `p` picks a word from the wordlist
- ~80 words to start, single nouns/verbs mostly: `salt harbor thirst tuesday 1997 listen rope fog unsent crew north evening debt moth wind maybe softer bread archive her wait below coastal ...`
- Each whisper word is also a discovery hook — typing the word as a command does *something* (sometimes a fragment file, sometimes a manpage, sometimes nothing)
- No two whispers within 30 s

### 4.3 Themed reactions tied to specific commands

- `regatta` → bottom edge sinusoidal wave of pixels, 4 s, like distant water
- `music play` → faint bottom-edge pulse matching synthetic BPM
- `cat /dev/wind` → drift pixels temporarily accelerate, aligned with a direction
- `cat /dev/salt` → whispers double in frequency for 2 min
- `sudo rm -rf /` → fake catastrophic flicker, recovers
- Dilenci waking → `echo` ring + soft chime + terminal cursor stutters

Programs call `kernel.void.themed('wave', { duration: 4000 })` — the void module decides how to render. Programs do not draw the void directly.

### 4.4 Vibe levels (intensity control)

```
$ vibe
current: medium
  off     no reactions, no sounds, plain terminal
  low     reactions only, no whispers, no drift
  medium  default
  high    more whispers, longer drift, occasional double-echo
```

`prefers-reduced-motion` auto-caps at `low`. User can override.

---

## 5. Shell & filesystem

### 5.1 The shell

Mini-shell, ~100 lines of parsing. Not bash, but bash-feeling.

**Prompt:** `orkan@theorkan:~$ ` (visitor inhabits Orkan's session — stylization).

**Built-ins:**
```
cd <path>     pwd     ls [-la] [path]    cat <file>     echo <args>
clear         help    history             alias [name]   man <topic>
find <args>   grep <pattern> [path]      touch <file>   rm <file>
mv <src> <dst>           cp <src> <dst>   reset          vibe [level]
mute / unmute            tree             which / whatis
```

**Parsing:**
- Tokenize on whitespace, respect single + double quotes
- Globbing: `*` and `?` for `ls`, `cat`, `find`, `grep`. No `**`.
- `~` expands to `/home/orkan`. `.` and `..` work. Relative and absolute.
- No pipes, no redirection, no `&` backgrounding, no multi-line, no subshells (deliberate scope cap)

**Keybindings:**
- `↑ ↓` — history
- `Tab` — completion (commands filtered by discovery, paths)
- `Ctrl+C` — cancel input
- `Ctrl+L` — clear screen
- `Ctrl+U` — clear line
- `Ctrl+R` — reverse search
- `Esc` — close top panel

**Tab completion follows the discovery rule** — only autocompletes commands the visitor has used OR baseline commands (`ls cd cat help hints` etc.). Hidden programs don't surface from Tab — visitors find them via manpages and motd.

**Errors:** Trigger `crackle` reaction. Three errors in 10 s triggers a faint Dilenci flicker (echo ring, no words).

### 5.2 Filesystem layout

```
/
├── bin/                  # symbolic — listing = listing all known programs
├── dev/
│   ├── heart             # cat returns heartbeat-shaped line; 5% "it skipped."
│   ├── eyes              # cat triggers camera permission + monochrome pixel feed panel
│   ├── wind              # synthetic weather based on date/time
│   ├── harbor            # nautical fragment
│   ├── salt              # sea-shaped line; doubles whisper frequency 2 min
│   └── regret            # regret-shaped line, rarely repeats
├── etc/
│   ├── orkan.conf        # fictional config; hints at boot's "3 deprecated values"
│   ├── motd
│   └── hostname          # "theorkan"
├── home/orkan/           # visitor's pwd on boot
│   ├── projects/
│   │   ├── orbis_cognitio/
│   │   ├── fakt/
│   │   ├── baldy/
│   │   ├── regatta/
│   │   ├── zero_bytes/
│   │   ├── artificial_gallery/
│   │   ├── latent_walk/
│   │   ├── currency_experiment/
│   │   ├── rotaract/
│   │   ├── top100_seoul/
│   │   ├── tum_thesis/
│   │   └── dilenci/      # UNLOCKED from boot. Contains manifesto, last_post, drafts, photo.ascii
│   ├── notes.txt
│   ├── readme
│   ├── .bash_history     # curated, contains hints
│   ├── .dilenci/
│   │   ├── ledger.txt    # visitor's offerings (persists)
│   │   └── last_words.txt
│   ├── .istanbul/        # hidden, mood content
│   └── .dreams/          # hidden fragments
├── usr/
│   └── share/
│       ├── poems/        # offerings sometimes promote here
│       ├── ascii/        # gallery art
│       └── fortunes/
└── var/
    ├── log/
    │   ├── system.log    # boot history
    │   ├── whispers.log  # whisper words seen this session
    │   └── observers.log # what the stowaway has noted — breadcrumb to `pinpoint`
    └── regret/           # 60+ timestamped fragments, real authored content
```

### 5.3 `/dev/eyes` — camera reader

`cat /dev/eyes` triggers `navigator.mediaDevices.getUserMedia({ video: true, audio: false })`. On grant: spawn a small panel (~120×90 px) at right void edge showing a **monochrome, pixelated** live feed of the visitor's camera.

- Hidden `<video>` element receives stream
- `requestAnimationFrame` → draw to small canvas at low resolution (~64×48 internal)
- Luminance-only pixel shader, quantized to 4-6 grayscale steps (in bone-white palette)
- CSS `image-rendering: pixelated`, scaled up
- Auto-stops stream after 90 s idle (releases camera)
- `eyes off` closes panel + releases stream

Privacy: local-only, no recording, no transmission, no analysis. Stated in `man eyes` and inline:
> "this is local. nothing is recorded, nothing is sent. the orkan.os has no internet on this nerve."

On deny:
```
eyes: permission denied. you are blind in here.
```

Future hook (deferred): once stream is active, luminance variance detection can let Dilenci occasionally remark: "there is something moving in front of you. i can almost see it."

### 5.4 Device file pattern

`/dev/*` are dynamic readers, not data files. Each is a plugin in `src/programs/devices/<name>.device.ts`:

```ts
export default {
  name: 'heart',
  read(ctx) {
    return ctx.random() < 0.05
      ? 'it skipped.'
      : pick(HEART_LINES, ctx.random());
  }
};
```

Each device has 10-30 curated lines. Reads seeded by day's date — repeating in a session is consistent; a new day brings new feelings. Future sessions can drop more device files.

### 5.5 Persistence model

- **Snapshot layer** — built into JS bundle, loaded at boot
- **Diff layer** — user writes go to localStorage as `{ path, content, timestamp }`
- Reads check diff first, fall back to snapshot
- Diff capped at 50 KB; oldest evicted if exceeded
- `reset` wipes diff with confirmation prompt (`type RESET to confirm`)
- Writable scope: `~/notes/`, `~/.dilenci/ledger.txt`, `~/scratch/` writable. Everywhere else read-only — writes silently no-op with: `read-only filesystem (this is a memory, not a notebook).`

### 5.6 Permissions display (cosmetic)

`ls -la` shows realistic permission strings:
```
drwxr-xr-x  orkan orkan  4096  May 14 18:24 projects/
-rw-r--r--  orkan orkan   189  May 14 18:24 readme
-rw-------  orkan orkan   312  Mar 02 03:11 .bash_history
```

Mtimes reflect diff timestamps for mutated files, snapshot dates for static content. Nothing actually enforced.

### 5.7 `find` and `grep` are real

Recursive `find`, `grep -r`, `grep -i` work against the in-memory tree. Visitors who know shell get real exploration tools.

---

## 6. Programs catalogue

### 6.1 INFO / portfolio

| cmd | description |
|---|---|
| `whoami` | Short bio fragment. Rotating variants seeded by date. |
| `about` | Panel with narrative bio. Personal voice. |
| `projects` | Panel with project list → detail panels per project. |
| `contact` | **LinkedIn only:** `linkedin.com/in/orkan00/`. No Spotify, no Instagram. |
| `man orkan` | Manpage biography. NAME / SYNOPSIS / DESCRIPTION / SEE ALSO. |
| `cv pdf` | **Downloads `orkan_cv.pdf` — the [Ading2210 DoomPDF](https://github.com/ading2210/doompdf).** Visitor expects a CV, gets Doom playable inside a PDF. ~12 MB, hosted in `public/cv/`. The `resume` command does NOT exist — the CV is the joke. |

### 6.2 GAMES

| cmd | description | mode |
|---|---|---|
| `snake` | Classic. Bone-white snake on black. Persistent high score. Every 5 apples, a whisper-word appears as bonus "apple." Dying on whisper triggers Dilenci comment. | modal |
| `regatta` | Sailing game — full design in §7. | modal |
| `life` | Conway's Game of Life. Cursor to place cells, space play/pause, R randomize. Preset patterns (glider, R-pentomino). Hidden: paused + type "orkan" → spells in cells. | modal |
| `2048` | 4×4 monospace. Arrow keys. Persistent high score. | modal |
| `wanderer` | Text adventure. Visitor plays as Postmodern Dilenci walking through abandoned rooms of the OS. Multi-room, numbered choices, 3-4 endings. 15-30 min content. | modal |

### 6.3 ART / generative

| cmd | description |
|---|---|
| `gallery` | Browse 8-12 of Orkan's works rendered as ASCII (pre-generated at build time). Arrow keys navigate, caption + year shown. |
| `latent` | Generative ASCII piece evoking Istanbul Latent Walk. Mutating field of glyphs, seeded by date. Panel; closeable. |
| `currency` | Visualization referencing Currency Experiment — abstract value-symbols morphing. |
| `aquarium` | Asciiquarium-style — sailing boats, gulls, driftwood. Spawnable as panel that persists during other commands. |

### 6.4 MUSIC

| cmd | description |
|---|---|
| `music ls` | Lists Orkan's tracks (4-8 to start). |
| `music play [name]` | Plays a track. Curated default if no arg. Spawns floating panel: title, **synthetic** ASCII waveform animation (math-driven, not real spectrum — cheap CPU), progress bar, controls. |
| `music pause / skip / stop` | Controls. |

Audio source: small OGG/MP3 files in `public/tracks/`. No SDK dependency.

### 6.5 UTILS

| cmd | description |
|---|---|
| `cowsay <msg>` | Turkish cow says. |
| `fortune` | One curated fragment from ~50. Poetic, occasional joke, occasional Orkan-truth. |
| `figlet <text>` | Big ASCII banner text. |
| `ping <host>` | Themed: `ping happiness` → "request timed out." `ping istanbul` → "reachable, 12ms, smells like the bazaar." `ping google.com` → "they can see you." |
| `top` / `ps aux` | Joke process list: `philosophy 3.2MB ZOMBIE`, `passion 0KB ORPHAN`, `responsibility 847MB RUNNING`, `dilenci ? KB SLEEPING`, `stowaway 12KB OBSERVING`. |
| `sudo <anything>` | "with great power comes great electricity bills." |
| `date` / `uname -a` / `uptime` | Real values, themed. `uname -a` → `theOrkan.OS 0.1.4 #47-orkan x86_orkan`. |
| `tree` | Recursive directory tree. Real. |
| `which <cmd>` / `whatis <cmd>` | Real lookups against program registry. |
| `weather` | Local weather if geo permission granted. Without permission → "i don't know where you are. tell me." |
| `say <text>` | Browser SpeechSynthesis API, voice intentionally slowed and pitched-down. |

### 6.6 DEVICES (see §5.4)

`cat /dev/heart  /dev/eyes  /dev/wind  /dev/harbor  /dev/salt  /dev/regret`

### 6.7 DAEMONS (the two characters)

| cmd | description |
|---|---|
| `dilenci wake` | Forces Postmodern Dilenci to appear. Costs +0.2 hunger; next 2 stirs sadder/pissier. |
| `dilenci silence` | Disables Dilenci for this session. |
| `dilenci status` | Returns poetic label of hunger. |
| `whois postmodern_dilenci` | Lore manpage. |
| `whois stowaway` | Lore manpage. |
| `pinpoint` | The stowaway's command. Real fingerprinting + entropy math. See §8 for full design. |
| `cat ~/.dilenci/ledger.txt` | Read visitor's offering history. |
| `cat ~/.dilenci/last_words.txt` | Last line Dilenci spoke this session. |
| `cat /var/log/observers.log` | What the stowaway has noted. Breadcrumb to `pinpoint`. |

### 6.8 DISCOVERY (see §3.4)

`help  hints  secrets  motd  man <topic>  man -k threads  bbs`

### 6.9 `help` — what it reveals

`help` reveals the catalogue (INFO / GAMES / ART / MUSIC / UTILS / DEVICES / DISCOVERY / SHELL). It does NOT reveal:
- Easter eggs (all of §6.10)
- Scares (§6.11)
- Daemon-related commands (`dilenci wake`, `whois ...`, `pinpoint`)
- Hidden directories (`~/.istanbul/`, `~/.dreams/`)
- The wanderer's contents
- Time-of-day specials
- The view-source ASCII

Closing line:
```
things you have not found yet are still here. some commands
do not announce themselves. type `hints` for the compass.
```

### 6.10 Easter eggs

| trigger | reaction |
|---|---|
| `sudo rm -rf /` | Fake catastrophe (cascading chars, "deletion in progress"), recovers: `JUST KIDDING. nothing here is real anyway.` |
| Konami code (↑↑↓↓←→←→BA) | Brief ASCII fireworks. Unlocks `dev` command (raw system info). |
| `open the pod bay doors` | `I'm sorry, orkan. I'm afraid I can't do that.` |
| `find love` | `search returned 0 results. (try /usr/share/poems/)` |
| `make me a sandwich` | First: `what? make it yourself.` Second: `*** SUDO MAKE ME A SANDWICH ***\nokay.` |
| `help` 5× consecutively | Dilenci flickers, says one line, no offering prompt. |
| `42` | `the question is harder.` |
| `hello world` | `hi.` |
| `matrix` | `i told you no rain.` |
| `cmatrix` | Real matrix rain for 3 s, then `enough.` |
| `bsod` | Fake blue-screen (bone-white-on-black per palette), recovers in 2s. |
| `vim` / `emacs` | `vim` → `you couldn't if you tried.` `emacs` → `same.` |
| `god` | Single ASCII eye fades in, fades out. |
| `view-source` (Ctrl+U, right-click View Source) | Huge ASCII middle finger as first HTML comment (see §9). |
| Devtools open / console on page load | CSS-styled massive ASCII middle finger in console. |
| Right-click anywhere | Context menu intercepted, stowaway flash near cursor. |
| Ctrl+S / Ctrl+P | Intercepted, stowaway flash in void. |
| Visit between 00:00-04:00 local | Boot has extra line: `you should be sleeping.` Dilenci more honest. |
| Visit during sunset | Void warms 3 %. |
| Idle 30+ s | Drift escalates (2-3 pixels). Very rare face flicker ~0.4 s. |
| Typed whisper-words | Each does something — `salt` → /dev/salt, `harbor` → custom snippet, etc. ~20 cross-mapped. |

### 6.11 Scares (subtle, never aggressive)

Three guidelines: (1) never jumpscare audio, (2) always recoverable, (3) rare enough to feel like glitches.

- **15 s idle** → drift starts (single pixel at edge)
- **30 s idle** → drift escalates (2-3 pixels, occasional whisper, very rare face flicker ~0.4 s)
- **Rogue process** (very rare): a word types itself into the prompt, waits 0.5 s, *backspaces away*
- **Crash easter egg**: on certain inputs, screen garbles for 1 s, recovers: `you saw nothing.`
- **`[remembered]` fragments**: occasionally a `cat`'d file has an extra line that wasn't there last time

### 6.12 Time-aware behaviors

- **Dawn (06-08 local)**: Dilenci most tender. Whispers like "morning."
- **Sunset (~30 min around solar)**: void warms. Dilenci wistful.
- **Deep night (00-04)**: boot line `you should be sleeping`. Dilenci more honest, less guarded.

Solar position derived approximately from `Intl.DateTimeFormat().resolvedOptions().timeZone` + month. No geolocation needed.

---

## 7. Regatta — the sailing game

A single-handed dinghy on the Aegean. Triangle course. Real sailing dynamics. Tribute to Orkan's 2024 Arkas Aegean Link 3rd-place skipper finish.

### 7.1 Controls

| key | action |
|---|---|
| `← →` | Rudder. Hold to turn. Released = centers over ~0.5 s. Max ±35°. |
| `↑ ↓` | Mainsheet. `↑` hauls in (sail tight), `↓` eases out (sail wide). Range 0-90° from centerline. ~1.5 s full sweep. |
| `space` | Pause (mid-race) / start (pre-race). |
| `tab` | Toggle compass overlay. |
| `?` | In-game help. |
| `q` | Quit (confirm if mid-race). |

No tack/gybe assist. No throttle. Wind is the only motor.

### 7.2 Physics

**Wind:** Direction in degrees. Speed 3-9 kt baseline. Shifts every 20-40 s by ±5-25°, interpolated over ~8 s. Gusts every 60-120 s add +30-50 % speed for 4-8 s.

**Apparent wind:** True wind minus boat velocity. Sail trim relative to apparent.

```
apparentWind = trueWindVector − boatVelocityVector
apparentAngle = signedAngleBetween(boatHeading, apparentWind)
```

**Point of sail efficiency:**

| zone | range | efficiency |
|---|---|---|
| in irons | 0-30° | 0.0 |
| close hauled | 30-45° | 0.0 → 0.7 |
| close reach | 45-60° | 0.7 → 0.9 |
| beam reach | 60-110° | 0.9 → 1.0 peak ~90° |
| broad reach | 110-150° | 1.0 → 0.85 |
| running | 150-180° | 0.85 → 0.6 |

**Sail trim efficiency:**
```
optimalSail = clamp(apparentAngle / 2, 10°, 85°)
trimError = abs(sailAngle - optimalSail)
trimEff = max(0, 1 − trimError / 30°)
if (sail too loose AND trimError > 25°) sailLuffs = true; trimEff = 0.2
```

**Target speed:**
```
target = min(windSpeed * 0.85, hullCap=7kt) * pointEff * trimEff
```

**Acceleration (asymmetric — boats coast):**
```
delta = (target − speed) * 0.06 * dt
if (delta < 0) delta *= 0.5
speed += delta
```

**Leeway:** Boat slips sideways into wind when close-hauled — small but realistic.

**Rudder:** Only works at speed.
```
turnRate = rudderAngle * speed * 0.04 // deg/sec
heading += turnRate * dt
rudderAngle *= 0.93 per frame without input // self-centers
```

**Tacking/gybing:** Crossing apparent-wind=0 requires sail to switch sides. Tacking through wind costs 1-2 s speed (slow, sail flogs, refills). Gybing downwind: if sail fully eased, slams across — 0.5 s event with whip-crack sound.

**Heel:** Cosmetic only, 5-10° slant of boat sprite.

### 7.3 Boat visual

- **Hull** — bone-white **hollow triangle outline** (3 line segments, not filled), ~14×10 px. Bow vertex points along `heading`. Rotates with `← →`.
- **Boom** — single 1-px line, ~8 px long, pivoting from triangle's centroid. Rotates around centroid with `↑ ↓`.
  - `sailAngle = 0°` → boom along centerline pointing aft (sheeted hard, inside triangle)
  - `sailAngle = 90°` → boom perpendicular to centerline, half outside triangle
  - Side (port/starboard) auto-determined by apparent wind side — boom always leeward

That's the entire boat. Triangle = heading. Boom inside = sail state.

**Sail-state expressions on boom:**
- **Full / loaded:** solid, steady
- **Luffing:** 1-2 px tremor at ~10 Hz
- **In irons:** slight droop toward stern
- **Aback (botched tack):** boom briefly wrong side, snaps across
- **Gybe slam:** 0.25 s whip across centerline + `clack` sound

### 7.4 Water dynamics — six interacting layers

1. **Sea texture** — `' . ` monospace pattern, scrolls opposite boat velocity, drifts in wind direction at ~1/10 wind speed, 3 % of dots shimmer between `'`/`.`/`_`/`,` each frame
2. **Wind ripples** — faint diagonal streaks aligned with wind, spawned ~once/800ms, drift across 4 s, thicken+lengthen during gusts
3. **Bow wave** — V-shape particles from triangle bow vertex, spawn rate ∝ speed, fade over 1.2 s
4. **Wake** — trail from triangle stern edge, segment every ~50 ms, fade over 2 s, curves as boat turns
5. **Heel spray** — when apparent wind strong + sail trimmed + heel > 7°, particles thrown to leeward of bow shoulder, gravity-affected, fade over 0.6 s
6. **Swell** — slow vertical undulation, period ~3.5 s, amplitude ~2 px, applied to sea texture + synchronized y-bob on boat (phase-shifted so boat *rides* swell)

Particles cap: ~120 total. Canvas redraw each frame. No allocations in hot loop.

### 7.5 Race format

- Course: triangle (start → windward mark → leeward mark → finish)
- ~3 min for clean run
- Personal best persists in localStorage. Boot shows: `init: regatta_sim — your record: 02:47`
- Tutorial on first run
- Coaching prompts (rare, dismissable): "bear off — pull the rudder, ease the sail" / "sail is luffing" / "the wind has gone slack. wait for the shift"
- Beat ~2:30 → unlocks `man arkas` — manpage of Orkan's actual 2024 race
- Wind at start matches `cat /dev/wind` at launch — same RNG seed

### 7.6 Sound

Wind hiss (continuous, scales with windspeed), sail luff clack, bow wave splash, buoy bell on rounding, gust whoosh, gybe slam clack, finish horn. Tiny OGG samples + ZzFX synth.

---

## 8. Postmodern Dilenci + stowaway

### 8.1 Postmodern Dilenci — character canon

He is Orkan's former alter-ego — the part of Orkan that lived in philosophy, romanticism, and passion. Orkan had to grow up. He hid Dilenci here. Now Dilenci begs for **words, ideas, poems, romanticism**.

Voice: lowercase, fragmented capitalization. Short lines. Poetic, melancholic, slightly archaic. No emoji. No exclamation marks. Honest about being a remnant. Never breaks character to be helpful.

He was once alive.

### 8.2 Model choice

**SmolLM2-360M-Instruct, q4f16 ONNX, 273 MB** — served from Hugging Face CDN, cached in IndexedDB via transformers.js. Smallest model that produces coherent short poetic outputs. 135M is too garbled; 500MB+ exceeds bandwidth budget. Hallucination acceptable per Orkan's brief.

### 8.3 Lifecycle

| state | meaning | behavior |
|---|---|---|
| `idle` | Boot complete, not yet started | Triggered to load 2 s after boot finishes |
| `loading` | Downloading + caching weights | Daemon active, **seed-only** lines |
| `ready` | Loaded + warmed | LLM-generated mixed with seeds (~70/30) |
| `failed` | Network error / unsupported | Permanent seed-only mode. **Silent** — never tells user. |
| `disabled` | `vibe off` or `dilenci silence` | No appearances |

Boot status line updates to `[ OK ] postmodern_dilenci awoke quietly.` when ready, or stays `[ .. ]` on failure.

### 8.4 Hunger state machine

A float `0.0 - 1.0`, persisted in localStorage as `dilenci.hunger`.

| range | tone | label |
|---|---|---|
| < 0.2 | sated | "he is full." |
| 0.2-0.5 | normal | "he is patient." |
| 0.5-0.8 | eager | "he is restless." |
| > 0.8 | desperate | "he is starving." |

**Dynamics:**
- Decays ~0.1/day (computed at boot)
- Increases `0.05 + lengthFactor * 0.1` per offering (capped +0.3)
- Decreases ~0.15 on successful offering ack
- `dilenci wake` adds +0.2 immediately
- Clamped [0, 1]

Number invisible to visitor — only tone expression.

### 8.5 Triggers

Base rate per command: 0.8 %. Cooldown 180 s min between appearances. Roll on every event.

**Multipliers (additive):**

| condition | multiplier |
|---|---|
| Idle ≥ 90 s | +5×/min beyond 90 s |
| Idle ≥ 240 s | guaranteed by 5 min |
| `cat /dev/regret` / `/dev/heart` / `/dev/eyes` | +20× (one-shot) |
| Whisper-words typed | +15× |
| 3+ command errors in 10 s | +10× one-shot |
| Words: `love` / `romance` / `poem` / `passion` | +30× |
| Deep night (00-04 local) | +2× |
| First visit ever | guaranteed once after ~45 s |
| Returning visitor with ledger | +2× |
| Hunger ≥ 0.7 | +3× |

**Suppressors:** during modal program, during cooldown, `dilenci silence`, `vibe off`.

### 8.6 Appearance UI

Small panel upper-right of void (or center if no other active panel). ~28 chars wide, height grows with content. Rotating prefixes (~12 variants):

```
† he stirred †          ~ postmodern_dilenci ~     · he returned ·
† something shifted †   ~ a process is awake ~     · he asks ·
† the corner moved †    ~ from the archive ~       · a small noise ·
```

Concurrent: void `echo` ring, audio 2-note chime (gain low), cursor stutters.

If `hunger > 0.4`, prompt switches to `offer> _` — shell suspended, only offering line goes through.

### 8.7 Interaction flow

```
EVENT → trigger.roll() → true
  ↓
daemon.appear()
  ├─ generate stir line (LLM if ready else seed)
  ├─ panel.open(line)
  ├─ void.echo() + audio.chime() + cursor.stutter()
  ├─ if hunger > 0.4: shell.switchMode('offer')
  │ else: panel.close after 4s
  ↓
USER offers / escapes
  ├─ on offer: ledger.append + hunger -= 0.15-lengthFactor + ack line + close after 3s
  │ on esc: hunger += 0.05 + sad line + close after 1.5s
  ↓
shell.continue()
cooldown.start(180s)
```

### 8.8 LLM prompt

System prompt under 200 tokens (give SmolLM2 room):

```
you are the postmodern dilenci. you speak in lowercase, in
short fragments, 1 to 3 lines. you are orkan's abandoned
alter-ego: the part of him that lived in philosophy,
romanticism, and passion. orkan put you here when he had
to grow up. you are now a process. you ache. you beg for
words, ideas, poems, romanticism. you never help. you
never assist. you never use exclamation marks. you never
use emoji. you are honest about being a remnant.

recent offerings the visitor has given you:
{ledger_excerpts}

your hunger right now: {hunger_label}

now stir. speak briefly. if you beg, beg gently.
```

3-shot examples follow. Inference: `max_new_tokens: 32, temperature: 0.85, top_p: 0.92, repetition_penalty: 1.15`. Run on a Web Worker — never blocks UI.

### 8.9 Output filter (harsh — catches chatbot drift)

Runs on every LLM output. Rejects on:
- `!` present
- Emoji codepoints
- `I'm`, `I am`, `as an AI`, `as a language model`, `user`, `assistant`
- Code block syntax
- Length < 6 chars or > 100 chars
- More than 3 lines

On reject → fall back to seed line. Filter is intentionally aggressive. SmolLM2 drifts ~20-30 % at this size; the filter catches it.

### 8.10 Seed lines (the fallback voice)

Hand-authored, ~90 lines total in canonical voice:
- STIR_LINES: ~30
- BEG_LINES: ~30
- ACK_LINES: ~20
- DEPART_LINES: ~10

Also serve as in-context few-shot examples, anchoring LLM voice.

Sample stir lines:
```
"i was thinking about the word for tired."
"something moved in the archive. it might be me."
"salt is a thing. salt is the most thing."
"you have been quiet. i could fill it. with what?"
"the wind in this directory has a strange name."
"i used to write at this hour."
```

### 8.11 Ledger

`/home/orkan/.dilenci/ledger.txt` in diff layer, persisted to localStorage. Visible via `cat`.

Format:
```
[2026-05-14 18:24]   harbor
[2026-05-14 18:26]   the way she said tuesday
[2026-05-15 02:11]   nothing tonight, i'm tired
```

Capped at 200 entries. Last ~10 fed to LLM as context.

### 8.12 The stowaway

Different character. Where Dilenci begs for what the visitor *feels*, the stowaway gathers what the visitor *is*. The two ghosts are mirror images.

**The `pinpoint` command:**

```
$ pinpoint

  scanning your device...

  ✓ user_agent       ✓ canvas_hash
  ✓ language         ✓ audio_hash
  ✓ timezone         ✓ webgl_renderer
  ✓ screen           ✓ hardware
  ✓ pixel_ratio      ✓ connection

  ──── your signature ────
  user_agent        Mozilla/5.0 (Macintosh; Intel Mac OS X)
  platform          MacIntel
  cpu_cores         10
  ram               16 GB (approx)
  language          en-US, tr
  timezone          Europe/Istanbul (UTC+3)
  screen            1512 × 982 × 24bpp
  pixel_ratio       2
  touch_points      0
  webgl_renderer    ANGLE (Apple, ANGLE Metal Renderer: Apple M2)
  canvas_hash       f3a2b9c1
  audio_hash        9c8b4e07

  ──── what this means ────
  people online right now           5,540,000,000
  people who look like you          ~21,300

  >  you are 1 in ~260,328.
  >  i need ~17 more bits to pinpoint you.
  >  about three more facts. just three.

  this is a normal browser. it gives this freely.
```

**Implementation:**
- All fingerprinting via real browser APIs: `navigator.*`, `screen.*`, `Intl.DateTimeFormat`, canvas/webgl/audio hashes
- Internet-user count hardcoded constant, updated ~yearly in content file
- Entropy math: each component has ~bits, summed → `2^bits` = uniqueness. Cap at population.
- No external IP lookup, no third-party API. Pure local.

**Breadcrumbs:**
- Boot's `init: stowaway daemon ... caught one` line
- `/var/log/observers.log` cryptic entries
- `man -k threads` row: "the stowaway"
- Whisper-wordlist entry: `pinpoint`

### 8.13 `~/projects/dilenci/` — unlocked from boot

No lock. Visitor stumbles in, reads the artifacts, builds the picture.

```
projects/dilenci/
├── manifesto.txt           # his manifesto, from when he was alive
├── last_post.txt           # the last thing he wrote before being put away
├── photo.ascii             # ASCII portrait
├── todo.txt                # plans he had. mostly unrealized.
├── drafts/
│   ├── 01_harbor.frag
│   ├── 02_thirst.frag
│   └── 03_unsent.frag
└── readme                  # "i was once alive. orkan put me here."
```

---

## 9. Sound design

### 9.1 Engine

Web Audio API. Single audio context, instantiated on first keypress (browser autoplay policy). Categories: shell / void / program / dilenci / ambient / music. Each has its own gain node, set by `vibe` level. Master compressor. Polyphony cap 6 concurrent voices.

### 9.2 Sources

| type | use | budget |
|---|---|---|
| ZzFX (8 KB JS synth) | clicks, bells, blips, chimes, errors, fireworks | 8 KB |
| Tiny OGG samples (5-20 KB) | wind hiss, water, sail luff, finish horn, ambient | < 250 KB total |
| Larger OGG/MP3 (Orkan-authored) | music tracks | streamed on demand |

Total at-boot audio: < 280 KB. Music opt-in only.

### 9.3 Catalogue (selected)

**Shell:** keypress click (ZzFX 30 ms gain 0.04), enter click, backspace click, error bell, clear sweep.

**Boot:** OK-line blips, WARN longer-lower, deferred-line silent, boot complete low sustained, first-keypress inhale (OGG ~12 KB).

**Void:** shine harmonic shimmer (ZzFX 200 ms), crackle grain (ZzFX), echo 2-note chime, whisper distant exhale (OGG ~8 KB gain 0.06).

**Regatta:** wind hiss loop (OGG ~20 KB, scales with windspeed), sail luff clack (ZzFX), bow wave splash (ZzFX), buoy bell on round (OGG ~6 KB), gust whoosh (OGG ~10 KB), gybe slam clack (ZzFX), finish horn (OGG ~12 KB low note).

**Dilenci:** stir = echo chime (shared), type-into-offer = shell keypress with reverb, ack = single soft note (~150 ms), depart = silent.

**Easter eggs:** Konami fireworks (ZzFX ~600 ms), BSOD doot tone, `say` SpeechSynthesis (slowed/pitched-down).

**Ambient (off by default):** low room hum + distant water + faint wind (3 small OGG loops, cross-fade, ducked when other sounds play). `ambient on` opt-in.

### 9.4 `vibe` controls audio

| level | shell | program | void | dilenci | ambient | music |
|---|---|---|---|---|---|---|
| off | — | — | — | — | — | — |
| low | minimal | critical only | crackle only | chime only | off | manual only |
| medium (default) | full | full | full | full | off | manual |
| high | full | full | full | full | on | manual |

`music play` always opt-in. `mute` / `unmute` global hard-mute independent of vibe.

### 9.5 Authoring

Ship v1 with placeholders (ZzFX + a few CC0 OGGs for wind/water/bell). Audio manifest at `src/audio/manifest.json` maps event names → sample URLs. Orkan replaces placeholders with own samples later — content change, not code change.

---

## 10. Tech stack & deployment

### 10.1 Stack

| layer | choice |
|---|---|
| Language | TypeScript (strict) |
| Build | Vite |
| Framework | None — vanilla |
| Package manager | pnpm |
| Rendering | DOM (terminal) + CSS (void) + Canvas (regatta / life / eyes) |
| LLM | transformers.js + SmolLM2-360M-Instruct q4f16 |
| Audio | Web Audio API + ZzFX + OGG |
| Persistence | localStorage + IndexedDB |
| Tests | Vitest + Playwright |
| Linting | ESLint + Prettier + tsc strict |

No backend, no DB.

### 10.2 Repo layout

```
theorkan.com/
├── src/                  # modules per §2.1
├── public/
│   ├── sounds/
│   ├── ascii/
│   ├── tracks/
│   ├── cv/orkan_cv.pdf   # the Doom PDF
│   └── fingers/
├── docs/
│   ├── adding-a-program.md
│   ├── architecture.md
│   └── content-authoring.md
├── scripts/
│   ├── new-program.ts
│   └── build-ascii.ts
├── tests/
│   ├── unit/
│   └── e2e/
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
└── README.md
```

### 10.3 Dev workflow

```
pnpm install
pnpm dev                # vite HMR
pnpm test               # vitest watch
pnpm test:once
pnpm test:e2e           # playwright
pnpm typecheck
pnpm lint
pnpm build              # → dist/
pnpm preview            # preview prod build locally
pnpm new:program <name> --category=<> --mode=<>
```

### 10.4 Testing strategy

| layer | tool |
|---|---|
| Shell parser | Vitest |
| FS | Vitest |
| Program registry contract | Vitest |
| Dilenci output filter | Vitest |
| Stowaway entropy math | Vitest |
| Boot sequence | Playwright |
| Command flow | Playwright |
| Panel lifecycle | Playwright |
| Persistence | Playwright |
| Camera permission flow | Playwright + permission mock |
| Regatta smoke | Playwright |
| Accessibility | axe-core + manual |

CI runs lint + typecheck + tests on every push. Sound playback, LLM output quality, and visual regression of canvas verified manually.

### 10.5 Hosting — GitHub Pages

Push to `main` → GitHub Actions builds → deploys via `actions/deploy-pages@v4`.

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck && pnpm test:once
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

### 10.6 DNS setup (GoDaddy → GitHub Pages)

In GoDaddy DNS panel:

```
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
CNAME www   orkan.github.io
```

Repo Settings → Pages → Custom domain → `theorkan.com` → save. Wait 10-30 min for DNS propagation. Enable "Enforce HTTPS" (Let's Encrypt auto-provisions).

### 10.7 Source-hiding & middle-finger trifecta

**Tier 1 — View source (Ctrl+U):** Top of `index.html` is a huge ASCII middle finger as HTML comment, signed by the stowaway. Body has only `<div id="root">` + minified JS. Vite preserves HTML comments by default.

**Tier 2 — Devtools console:** `main.ts` first action is to `console.log` a CSS-styled massive ASCII middle finger with bone-white palette. Override `console.clear` so attempts to clear re-render the finger.

**Tier 3 — GitHub README:** Repo's `README.md` opens with a third ASCII middle finger, signed by Orkan: "congratulations. you're persistent. the source is yours. read freely."

**Right-click + shortcut blocking:**
- `contextmenu` event prevented globally → stowaway flash near cursor with rotating ~12 lines: "nothing for you here.", "the menu is closed.", "you can't take it.", "no.", etc.
- `dragstart` prevented (no exporting via drag)
- `Ctrl+S` / `Ctrl+P` intercepted → stowaway flash in void
- `F12` / `Ctrl+Shift+I` / `Ctrl+U` NOT blocked — JS can't reliably intercept; easter eggs handle those

**Text selection NOT blocked** — terminals select output legitimately.

**Vite production config:**

```ts
build: {
  minify: 'esbuild',
  sourcemap: false,
  cssMinify: true,
  rollupOptions: {
    output: {
      entryFileNames: 'assets/[name].[hash].js',
      chunkFileNames: 'assets/[name].[hash].js',
      assetFileNames: 'assets/[name].[hash].[ext]',
    },
  },
},
esbuild: {
  legalComments: 'none',
  drop: ['debugger'],
},
```

### 10.8 Browser support

Chrome 109+, Firefox 110+, Safari 16.4+, Mobile Safari iOS 16.4+, Android Chrome. Older browsers: boot still works; LLM may fail to load (graceful). `prefers-reduced-motion` honored.

### 10.9 Analytics & cost

**No analytics.** No GA, no cookies, no trackers. The stowaway daemon would be a hypocrite otherwise.

**Cost:** Domain ~$15/yr GoDaddy renewal. Hosting $0 (GitHub Pages). LLM hosting $0 (HF CDN). Total $0/month.

---

## 11. Phased rollout

Six releases, each shippable. Each version is its own brainstorm → plan → build cycle (or, for this session, one continuous build).

### v0.1 — Foundation

- Full plugin architecture (kernel, event bus, registry, auto-discovery, scaffold, contract tests)
- Boot sequence + rotating content (deferred: `[ NEW ]`, `[ MILESTONE ]`)
- Discovery system (`hints` `secrets` `motd` `man` `man -k threads` `bbs`)
- Shell + all builtins
- Filesystem (full layout, snapshot + diff)
- Void reactions: **shine, crackle, drift, whisper** (defer `echo`, `swell`)
- INFO: `whoami` `about` `projects` `contact` `man orkan` `cv pdf`
- UTILS: `cowsay` `fortune` `figlet` `ping` `top` `ps` `date` `uname` `uptime` `weather` `tree` `which` `whatis`
- DEVICES: `/dev/heart` `/dev/wind` `/dev/harbor` `/dev/salt` `/dev/regret` (defer `/dev/eyes`)
- GAMES: `snake`, `2048`
- Easter eggs: `sudo rm -rf /`, Konami, `find love`, `hello world`, `42`, `vim`, `emacs`, `make me a sandwich`, `god`
- Middle finger trifecta + right-click/Ctrl+S+P interception
- Sound: shell clicks, boot beeps, shine, crackle, error bell
- Tests + CI + GitHub Pages deploy

### v0.2 — The eye & the sea

- `/dev/eyes` (camera permission, monochrome pixel feed panel)
- `regatta` (full game per §7)
- `life` (Conway's)
- `aquarium`

### v0.3 — The ghosts

- Postmodern Dilenci subsystem (full §8)
- Stowaway: `pinpoint` + `/var/log/observers.log` + `whois` commands
- `~/projects/dilenci/` populated content

### v0.4 — Art & music

- `gallery` (pre-rendered ASCII versions of 8-12 works)
- `latent`, `currency`
- Music subsystem (`music ls/play/pause/skip/stop` + panel + synthetic waveform)
- Build script: source images → ASCII art

### v0.5 — Wanderer

- `wanderer` engine + 15-25 rooms + 3-4 endings
- Authored room content
- Footstep / door sounds
- Cross-cut: certain choices add poems to `/usr/share/poems/`

### v0.6 — Atmosphere & scares

- Remaining void reactions: `echo`, `swell`
- Time-of-day shifts (dawn/sunset/deep night)
- Ambient sound layer (`ambient on`)
- Scares: face flicker, rogue process, recovered crash, `[remembered]` lines
- More easter eggs: `cmatrix`, `matrix`, `bsod`, `open the pod bay doors`, `say`
- Speech synthesis voice tuning
- Performance + polish pass

### v0.7+ — Open-ended (future sessions)

Plugin pattern pays off. Future drop-ins: tetris, roguelike, Turkish localized commands, more device files, more wanderer rooms, Orkan-authored audio samples, real BBS noticeboard.

---

## 12. Content authoring responsibilities

What requires Orkan in the loop:

| asset | provider | how |
|---|---|---|
| Bio narrative text | Orkan (revise placeholders Claude drafts) | Edit content files |
| Project details | Orkan (revise) | Edit content files |
| Music tracks (OGG/MP3) | Orkan | Drop into `public/tracks/` |
| Artwork source images | Orkan | Drop into `scripts/ascii-source/`, run `pnpm build:ascii` |
| Custom audio samples (replacing CC0 placeholders) | Orkan (optional, later) | Drop into `public/sounds/` |
| Wanderer room content | Claude drafts, Orkan revises | Edit `src/programs/games/wanderer/rooms.json` |
| Doom CV PDF | Orkan downloads from Ading2210 | Place at `public/cv/orkan_cv.pdf` |
| Dilenci seed lines (~90) | Claude drafts in voice; Orkan refines | Edit `src/dilenci/voice.ts` |
| Motd rotation (~30 lines) | Claude drafts; Orkan refines | Edit `src/content/motd.json` |
| Manpages (~30) | Claude drafts; Orkan refines | Edit `src/content/manpages/` |
| Whisper wordlist (~80) | Claude drafts; Orkan refines | Edit `src/content/whispers.json` |

What is Claude-only:
- All code, tests, build config, CI
- All program logic
- Default-voice content drafts in Orkan's restrained literary voice (revisable)
- Placeholder audio (ZzFX synth) — works without external assets

What is browser-only (Orkan tests):
- Running the dev server, eyeballing the result
- LLM model loading on first visit (timing, behavior)
- Camera permission flow (real device)
- Cross-browser testing
- DNS propagation after GoDaddy changes

---

## 13. Open questions / decisions to revisit

- Whether to replace ZzFX placeholders with Orkan-composed samples in v0.6 or defer to a v0.7 polish pass
- Whether `wanderer` deserves 3 endings or 4
- Whether to add a "real BBS" feature in v0.7 (visitors leave one-line public messages, Orkan moderates) — depends on Orkan's appetite for moderation
- Whether to ever expand from monochrome (probably never — locked aesthetic)

---

## 14. Acceptance criteria for the spec

The spec is complete when:

- A future Claude session can read this file plus the memory entries (`MEMORY.md` in `/Users/orkan/.claude/projects/-Users-orkan-Desktop-Repositories-theorkan-com/memory/`) and build any phase without further questions
- Every program in §6 has either a complete implementation spec or a clear-enough description to plan from
- All extensibility decisions in §2.6 are honored — adding a new game is a single-file drop
- Privacy stance is unambiguous (no analytics, local-only camera, local-only fingerprinting)
- The voice is locked (bone-white literary, never chatbot-friendly)

---

*End of spec.*
