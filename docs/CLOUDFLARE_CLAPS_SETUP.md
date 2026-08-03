# Cloudflare anonymous clap setup

Repository-side preparation is complete. When Cloudflare access is available:

1. Open **Workers & Pages → Create → Worker** and create `jayinlab-claps`.
2. Open **Storage & Databases → D1 SQL Database → Create** and create `jayinlab-claps`.
3. In the Worker settings, add a D1 binding:
   - Variable name: `DB`
   - Database: `jayinlab-claps`
4. Add a text variable:
   - Name: `ALLOWED_ORIGIN`
   - Value: `https://jayinlab.github.io`
5. In the D1 console, run `worker/migrations/0001_create_claps.sql`.
6. Replace the Worker editor content with `worker/src/index.ts` and deploy.
7. Copy the generated `https://...workers.dev` URL.
8. In `hugo.toml`, set:

```toml
[params]
  description = 'jayinlab blog (Hugo)'
  clapApiBase = 'https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev'
```

9. Push the Hugo change and let GitHub Pages redeploy.

## Verification

- `GET /health` should return `{ "ok": true }`.
- Open a post in the `gpu-fun-facts` series.
- The count should load from D1.
- A browser can add up to 10 claps per article; its own count is stored in localStorage.

## Notes

- D1 stores only the shared total.
- localStorage is a convenience limit, not strong abuse prevention.
- The feature remains disabled until `clapApiBase` is configured.
