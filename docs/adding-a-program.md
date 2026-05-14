# Adding a program to theOrkan.OS

theOrkan.OS programs are plain TypeScript files. Drop one in the right folder, it registers automatically.

## Scaffold

```bash
pnpm new:program <name> --category=<category> --mode=<mode>
```

Categories: `info game art music util device discovery easter`.
Modes: `inline` (writes to terminal), `panel` (floating panel), `modal` (takes over the screen).

## The Program interface

```ts
import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'my-thing',
  aliases: ['mt'],
  manpage: 'my-thing — one-line description.',
  category: 'util',
  mode: 'inline',
  onCommand: (ctx, argv) => 'hello',
};

export default prog;
```

## The kernel surface (`ctx`)

Programs only touch `ctx`. Never import from `shell`, `fs`, `void`, or `panels` directly.

| `ctx.fs.read(path)` | read a file |
| `ctx.fs.write(path, data)` | write a file (only in writable scope) |
| `ctx.fs.list(path)` | list a directory |
| `ctx.panel.spawn(opts)` | open a floating panel |
| `ctx.void.shine()` / `crackle()` / `whisper(word)` | void reactions |
| `ctx.audio.play(sample, category)` | play a sound |
| `ctx.events.on(name, cb)` / `emit(name, data)` | event bus |
| `ctx.storage.get(key)` / `set(key, value)` | scoped per-program storage |

## Lifecycle by mode

- `inline`: implement `onCommand(ctx, argv): string | void`. The return string is printed.
- `panel`: implement `init(ctx)` to set up; `cleanup(ctx)` when done.
- `modal`: implement `init(ctx)`, `render(ctx)`, `onKey(ctx, key)`, `cleanup(ctx)`.

## Discovery

For your program to be discoverable through hints, add a row to `src/content/threads.json`:

```json
{ "id": "the my-thing", "leads": "run `my-thing`" }
```

If the program should appear in `help`, edit `src/programs/discovery/help.program.ts`.

## Contract tests

`tests/unit/registry.test.ts` validates every registered program. If you forget a required hook for your mode, the test fails. Run:

```bash
pnpm test:once tests/unit/registry.test.ts
```

## Voice

Programs speak in the OS voice. Bone-white minimal pixel literary. Lowercase mostly. No emoji. No exclamation marks unless deliberately ironic. Short.
