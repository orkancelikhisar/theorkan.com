# theOrkan.OS — architecture (quick reference)

```
┌──────────────┐    events     ┌──────────────┐
│   shell      │──────────────▶│    void      │
│  (parser,    │               │  (shine,     │
│   history)   │               │   whisper)   │
└──────┬───────┘               └──────────────┘
       │
       │  ProgramContext
       ▼
┌──────────────┐    events     ┌──────────────┐
│  programs    │──────────────▶│    audio     │
│  (plugins)   │               │  (zzfx, ogg) │
└──────┬───────┘               └──────────────┘
       │
       ▼
┌──────────────┐
│  virtual fs  │
│ snapshot +   │
│ localStorage │
└──────────────┘
```

## Module responsibilities

- `kernel/`: stable. shell, fs, registry, parser, events, idle. Programs do not import this directly.
- `programs/`: user-space plugins. Each is a Program with category and mode.
- `void/`: background reactions. Subscribes to events.
- `audio/`: sound engine. Categories + vibe levels.
- `boot/`: boot sequence + content rotation.
- `stowaway/`: source-hiding + right-click flash.
- `content/`: JSON content — bio, projects, motd, manpages, fortunes, etc.

## Key contracts

| contract | enforced where |
|---|---|
| Programs only touch `ProgramContext` | code review |
| Program names are unique | `tests/unit/registry.test.ts` |
| modal mode requires render+onKey | `tests/unit/registry.test.ts` |
| File writes only in writable scope | `src/kernel/fs.ts` `isWritable()` |
| Vibe levels mute categories | `src/audio/audio.ts` `CATEGORY_VIBE` |

## State

| storage | what |
|---|---|
| localStorage | shell history, ledger, scores, discoveries, vibe, mute, last visit |
| sessionStorage | session start, transient flags |
| IndexedDB | LLM weights (v0.3) |

## Voice

The OS voice is the rule. Bone-white pixel-art monochrome. No glow. No emoji. Short sentences. Lowercase preference. Restrained.
