# Deploying theorkan.com

Hosting: GitHub Pages. Custom domain via GoDaddy DNS.

## One-time setup

1. **Push the repo to GitHub** as a public repo (free Pages requires public on user accounts):

   ```bash
   gh repo create orkan/theorkan.com --public --source=. --remote=origin --push
   ```

2. **Enable GitHub Pages:** Settings → Pages → Source → **GitHub Actions**.

3. **First Actions run** triggers automatically on push to main. Wait for green check.

4. **Add custom domain:** Settings → Pages → Custom domain → `theorkan.com` → save.
   The `CNAME` file at `public/CNAME` is committed already.

5. **GoDaddy DNS** — add five records:

   | Type  | Name | Value |
   |-------|------|-------|
   | A     | @    | 185.199.108.153 |
   | A     | @    | 185.199.109.153 |
   | A     | @    | 185.199.110.153 |
   | A     | @    | 185.199.111.153 |
   | CNAME | www  | orkan.github.io |

6. **Wait for DNS propagation** (10–60 min usually). Check `dnschecker.org`.

7. Once GitHub shows a green check on the domain, tick **Enforce HTTPS**. Let's Encrypt issues automatically.

## After first deploy

- Push to `main` → Actions runs → site updates in ~90 s.
- PR previews are not enabled. Run `pnpm preview` locally before pushing big changes.

## The Doom CV

Before deploying for real, drop the Doom PDF here:

```
public/cv/orkan_cv.pdf
```

Download the latest release of `doompdf` from https://github.com/ading2210/doompdf/releases and rename it.
