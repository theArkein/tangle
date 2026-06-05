import { Env } from "../index";
import { signJwt, verifyJwt } from "./jwt";

export async function authenticate(
  request: Request,
  env: Env
): Promise<{ playerId: string } | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const sessionMatch = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  if (!sessionMatch || !sessionMatch[1]) return null;

  const token = sessionMatch[1];
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || typeof payload["sub"] !== "string") return null;

  return { playerId: payload["sub"] };
}

export async function createSessionCookie(
  playerId: string,
  env: Env
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDays = 30 * 24 * 60 * 60;

  const token = await signJwt(
    { sub: playerId, exp: now + thirtyDays },
    env.JWT_SECRET
  );

  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${thirtyDays}`;
}
