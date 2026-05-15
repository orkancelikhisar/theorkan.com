# theorkan.com

```
....................../´¯/)
....................,/¯../
.................../..../
............./´¯/'...'/´¯¯`·¸
........../'/.../..../......./¨¯\
........('(...´...´.... ¯~/'...')
.........\.................'...../
..........''...\.......... _.·´
............\..............(
..............\.............\...
```

congratulations. you're persistent.

the source is yours. read freely.

— orkan

---

## what is this

A personal website rendered as a fake operating system. Bone-white pixel-art monospace,
a terminal at the center of a black void, programs, games, easter eggs, and a small
LLM ghost that begs for poems.

Built with TypeScript + Vite. Static-deployed to GitHub Pages.

## dev

```bash
pnpm install
pnpm dev               # vite HMR
pnpm test              # vitest watch
pnpm test:e2e          # playwright
pnpm build             # production build to dist/
pnpm new:program <name> --category=<game|util|...> --mode=<inline|panel|modal>
```

## adding a program

See `docs/adding-a-program.md`.

## spec

See `docs/superpowers/specs/2026-05-14-theorkan-os-design.md` for the design contract.
