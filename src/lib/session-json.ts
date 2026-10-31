import { createHmac } from "node:crypto";

// What browser storage keeps instead of the email: stable per account, and opaque to anyone without the secret.
export const accountKey = (email: string, secret: string) =>
  createHmac("sha256", secret).update(email).digest("hex").slice(0, 16);

// Browser JS can fetch /api/auth/session, so the Google access token is cut here; server auth() never uses this route.
export async function withoutAccessToken(response: Response) {
  const body = await response.clone().json().catch(() => null);
  if (!body?.accessToken) return response;
  delete body.accessToken;
  const headers = new Headers(response.headers);
  headers.delete("content-length"); // the body just got shorter
  return new Response(JSON.stringify(body), { status: response.status, headers });
}
