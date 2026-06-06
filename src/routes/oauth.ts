import type { Env } from "../index";
import { authenticate } from "../auth/middleware";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const STATE_TTL_SECONDS = 300;

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function callbackUrl(request: Request): string {
  const url = new URL(request.url);
  url.pathname = "/api/auth/google/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const state = generateState();
  await env.KV.put(`oauth_state:${state}`, session.playerId, {
    expirationTtl: STATE_TTL_SECONDS,
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return Response.redirect(`${GOOGLE_AUTH_URL}?${params}`, 302);
}

export async function handleGoogleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (url.searchParams.get("error") || !code || !state) {
    return Response.redirect(`${origin}/?oauth_error=cancelled`, 302);
  }

  // Verify and consume the state token
  const playerId = await env.KV.get(`oauth_state:${state}`);
  if (!playerId) {
    return Response.redirect(`${origin}/?oauth_error=invalid_state`, 302);
  }
  await env.KV.delete(`oauth_state:${state}`);

  // Exchange authorisation code for access token
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(request),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return Response.redirect(`${origin}/?oauth_error=token_failed`, 302);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Fetch Google user profile
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return Response.redirect(`${origin}/?oauth_error=userinfo_failed`, 302);
  }

  const { sub } = (await userRes.json()) as { sub: string };
  const providerValue = `google:${sub}`;

  // Reject if this Google identity is already linked to a different player
  const conflict = await env.DB.prepare(
    "SELECT id FROM players WHERE linked_oauth_provider = ? AND id != ?"
  )
    .bind(providerValue, playerId)
    .first<{ id: string }>();

  if (conflict) {
    return Response.redirect(`${origin}/?oauth_error=already_linked`, 302);
  }

  await env.DB.prepare(
    "UPDATE players SET linked_oauth_provider = ? WHERE id = ?"
  )
    .bind(providerValue, playerId)
    .run();

  return Response.redirect(`${origin}/?oauth_linked=1`, 302);
}
