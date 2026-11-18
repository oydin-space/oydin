# Google sign-in

Server-side OAuth 2 code flow (PKCE + nonce). Enabled only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

## Steps

1. Google Cloud Console → **APIs & Services → OAuth consent screen**. Choose External, fill app name and support email, add the domain `oydin.space`.
2. Scopes: the code requests exactly `openid email profile` (non-sensitive, no verification review needed). Add them if the screen asks. While the app is in *Testing*, add your Google accounts as test users; publish it for everyone.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorised redirect URIs** — exactly (the backend builds it with `request.build_absolute_uri("/api/auth/google/callback/")`):

   ```
   https://oydin.space/api/auth/google/callback/
   ```

   The trailing slash matters. No JavaScript origins are needed.
5. On the server, append to `~/oydin/.env` (stays `chmod 600`):

   ```
   GOOGLE_CLIENT_ID=<client id from Google>
   GOOGLE_CLIENT_SECRET=<client secret from Google>
   ```
6. Restart:

   ```
   cd ~/oydin && docker compose up -d
   ```
7. Verify:

   ```
   curl https://oydin.space/api/auth/providers/
   ```

   The JSON must contain `"google": true`. Then open the site and click "Sign in with Google"; the flow starts at `/api/auth/google/start/` and ends at `/app`.

The callback URL host comes from the request (`SECURE_PROXY_SSL_HEADER` trusts `X-Forwarded-Proto`), so the proxy must pass the original host and `https`.

## Troubleshooting

- `503 google_not_configured` on `/api/auth/google/start/` — one of the two vars is empty or the container was not recreated; re-run `docker compose up -d` and check `providers`.
- Google page shows `redirect_uri_mismatch` — the URI in step 4 differs (scheme, host, path, trailing slash).
- Redirect to `/?auth_error=invalid_state` — session cookie lost or flow expired; retry from the start (cookies must be allowed).
- `auth_error=access_denied` — user cancelled, or Google returned no `code`.
- `auth_error=google_unavailable` — the token or tokeninfo request to Google failed/timed out (10 s).
- `auth_error=invalid_token` — id_token failed the audience, issuer, expiry or nonce check; confirm the client ID matches the one in `.env`.
- `auth_error=email_not_verified` — the Google account has no verified email.
- `auth_error=forbidden` — staff/superuser accounts cannot sign in through the public flows.
