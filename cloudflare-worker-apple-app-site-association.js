// Cloudflare Worker to serve apple-app-site-association
// Deploy this to ducat.app/.well-known/apple-app-site-association

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only handle the apple-app-site-association path
    if (url.pathname === '/.well-known/apple-app-site-association' ||
        url.pathname === '/apple-app-site-association') {

      const association = {
        "webcredentials": {
          "apps": [
            "Q8HU4KXHK4.com.anonymous.SimpleWallet"
          ]
        }
      };

      return new Response(JSON.stringify(association, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // For other paths, return 404 or pass through to origin
    return new Response('Not Found', { status: 404 });
  }
}
