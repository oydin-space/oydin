# Oydin for developers: docs site

Plain static HTML/CSS, no build step and no JS. Open `index.html` locally, or serve the folder.

Pages: `index` (quickstart), `auth`, `public-api`, `webhooks`, `rest-handler`, `mcp`. Shared styles in `style.css`, brand mark in `logo.svg` (white six-petal flower on #FFD62C).

## Deploy to docs.oydin.sayfi.uz

1. DNS: add an `A`/`AAAA` record for `docs.oydin.sayfi.uz` pointing at the same host as `oydin.sayfi.uz`.
2. Serve this directory as static files. With the existing Caddy, add a site block (not done here):

   ```
   docs.oydin.sayfi.uz {
       root * /srv/docs-site
       encode zstd gzip
       file_server
   }
   ```

3. Mount the folder read-only into the Caddy container, e.g. `./docs-site:/srv/docs-site:ro` in compose, then reload Caddy. Caddy obtains the TLS certificate automatically.
4. Check: `curl -I https://docs.oydin.sayfi.uz/` returns 200, and every page in the sidebar opens.

Updating docs = edit the HTML and redeploy/sync the folder; no restart needed because Caddy reads files on each request.
