export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiKey = request.headers.get("X-API-Key");
    
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // Authenticate request
    if (apiKey !== env.API_KEY) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // GET State
    if (request.method === "GET" && url.pathname === "/api/state") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT value FROM app_state WHERE key = 'pave_state'"
        ).all();
        
        const state = results && results[0] ? results[0].value : null;
        return new Response(JSON.stringify({ data: state }), {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
    }

    // PUT State
    if (request.method === "PUT" && url.pathname === "/api/state") {
      try {
        const body = await request.json();
        if (!body || !body.data) {
          return new Response("Bad Request", { status: 400, headers: corsHeaders });
        }

        // Upsert state in D1 SQLite
        await env.DB.prepare(
          "INSERT INTO app_state (key, value, updated_at) VALUES ('pave_state', ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
        ).bind(body.data, Date.now()).run();

        // Trigger Pusher Broadcast
        if (env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET && env.PUSHER_CLUSTER) {
          try {
            await triggerPusherEvent(env, "pave-channel", "state-updated", { updated_at: Date.now() });
          } catch (err) {
            console.error("Pusher trigger failed:", err);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};

// Pusher REST API Client using Web Crypto API (Standard in Workers)
async function triggerPusherEvent(env, channel, event, data) {
  const appId = env.PUSHER_APP_ID;
  const key = env.PUSHER_KEY;
  const secret = env.PUSHER_SECRET;
  const cluster = env.PUSHER_CLUSTER;

  const path = `/apps/${appId}/events`;
  const body = JSON.stringify({
    name: event,
    channels: [channel],
    data: JSON.stringify(data)
  });

  const bodyMd5 = await md5(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
  
  const signData = `POST\n${path}\n${params}`;
  const signature = await hmacSha256(secret, signData);

  const url = `https://api-${cluster}.pusher.com${path}?${params}&auth_signature=${signature}`;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body
  });
}

async function md5(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(keyStr, dataStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyStr),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataStr));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}
