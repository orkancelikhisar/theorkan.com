# Deploying theorkan.com

The default workflow at `.github/workflows/deploy.yml` uses GitHub's official
Pages action (`actions/deploy-pages`). It builds the site on push to `main`
and publishes it to `theorkan.com`.

## What is, and isn't, in the public build

The privacy boundary is **source code vs. shipped site**, not "private vs.
public information":

* **Anything in `dist/` is public.** That's the whole point of a website. The
  minified JS bundle, the CSS, the LLM worker, all of `public/`, and the
  ASCII frames from `public/works/` ship to whoever loads the page.
* The **source repository** can be private without changing what's served.
  Visitors only ever see `dist/`. They don't see commit messages, branch
  names, issues, drafts, or files outside the build.

Concretely, the public build today contains:

* `bio.json` fragments (the lines `whoami` rotates through) — already
  curated public info.
* The contact program's LinkedIn URL.
* The portfolio entries in `projects.json` (now reduced to "sailor, captain,
  skipper" instead of specific results).
* The ASCII art works in `src/programs/art/gallery-works.ts`.
* Any video frames generated under `src/content/works/` by `pnpm video:build`.

There are **no API keys, tokens, or environment variables** in the codebase.
The Dilenci LLM weights and the ONNX runtime are fetched from the public HF
CDN, not from your repo.

If you want to add anything truly secret later (a private API endpoint,
say), keep it server-side — never in client code.

## Privacy options

### Option A — Public repo (current state)

GitHub Pages free tier serves directly from a public repo. The deploy
workflow at `deploy.yml` runs as-is. Source is visible to anyone.

### Option B — Private repo + GitHub Pro

GitHub Pages on private repos requires Pro ($4/mo at time of writing) or
Team/Enterprise. With either, the existing `deploy.yml` keeps working — no
code changes needed. Source is hidden; the deployed site stays the same.

This is the literal "hybrid" — private source, public site.

### Option C — Private repo + a non-GitHub host

GitHub Pages declines to serve from private repos on free accounts.
Alternatives that work with private GitHub repos for free:

* **Cloudflare Pages** — connect GitHub, pick the repo, build command
  `pnpm build`, output dir `dist/`. Point your domain at the CF DNS.
* **Netlify** or **Vercel** — same idea, free tier.

If you go this route, you can keep `deploy.yml` for redundancy or delete it.

### Option D — Private source repo + public artifacts repo

Source lives in private `theorkan.com`. A second public repo
(e.g. `theorkan.com-pages`) holds only the built `dist/`. CI in the private
repo force-pushes `dist/` to the public one, where GitHub Pages serves it
for free.

This requires a separate workflow and a deploy key/PAT. It works but adds
moving parts. I'd recommend Option B or C over this.

## Recommendation

If you want the simplest path and don't mind the small fee, **Option B** is
the cleanest. If you'd rather not pay, **Option C with Cloudflare Pages**
gives the same outcome at no cost. Either way, the audit above stands —
nothing in the build needs to be redacted.
