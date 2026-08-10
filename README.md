# Warpkey

Press a key, warp to the thing you always click.

A Chrome extension for binding site-specific keyboard shortcuts to buttons,
links, and fields you use every day - recorded by example, no config files
to hand-edit.

- Open the popup on a site, click **Record**, then click the thing you want
  a shortcut for, then press the key to bind it.
- Anywhere on that site, press `` ` `` then the bound key to fire it.

See `docs/design.md` for how it works and `docs/feasibility.md` for what it
does and doesn't handle well.

## Development

```
npm install
npm run dev     # Vite dev server with HMR
npm run build   # production build to dist/
```

Load `dist/` as an unpacked extension via `chrome://extensions` → Developer Mode.
