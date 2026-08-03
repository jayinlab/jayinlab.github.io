export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
}

const corsHeaders = (origin: string) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
});

const json = (body: unknown, status = 200, origin = '*') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(origin),
    },
  });

const normalizeSlug = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let slug = value.trim();
  if (!slug.startsWith('/')) slug = `/${slug}`;
  if (!slug.endsWith('/')) slug = `${slug}/`;
  if (!/^\/[a-zA-Z0-9/_-]{1,240}\/$/.test(slug)) return null;
  return slug;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://jayinlab.github.io';
    const requestOrigin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, allowedOrigin);
    if (url.pathname !== '/api/claps') return json({ error: 'not_found' }, 404, allowedOrigin);

    if (request.method === 'GET') {
      const slug = normalizeSlug(url.searchParams.get('slug'));
      if (!slug) return json({ error: 'invalid_slug' }, 400, allowedOrigin);

      const row = await env.DB.prepare('SELECT count FROM article_claps WHERE slug = ?')
        .bind(slug)
        .first<{ count: number }>();
      return json({ slug, count: row?.count ?? 0 }, 200, allowedOrigin);
    }

    if (request.method === 'POST') {
      if (requestOrigin && requestOrigin !== allowedOrigin) {
        return json({ error: 'origin_not_allowed' }, 403, allowedOrigin);
      }

      let payload: { slug?: unknown; delta?: unknown };
      try {
        payload = await request.json();
      } catch {
        return json({ error: 'invalid_json' }, 400, allowedOrigin);
      }

      const slug = normalizeSlug(payload.slug);
      const delta = payload.delta === -1 ? -1 : payload.delta === 1 ? 1 : null;
      if (!slug || delta === null) return json({ error: 'invalid_request' }, 400, allowedOrigin);

      await env.DB.prepare(`
        INSERT INTO article_claps (slug, count, updated_at)
        VALUES (?, MAX(?, 0), unixepoch())
        ON CONFLICT(slug) DO UPDATE SET
          count = MAX(article_claps.count + ?, 0),
          updated_at = unixepoch()
      `).bind(slug, delta, delta).run();

      const row = await env.DB.prepare('SELECT count FROM article_claps WHERE slug = ?')
        .bind(slug)
        .first<{ count: number }>();
      return json({ slug, count: row?.count ?? 0 }, 200, allowedOrigin);
    }

    return json({ error: 'method_not_allowed' }, 405, allowedOrigin);
  },
};
