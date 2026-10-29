// Browser JS can fetch /api/auth/session, so the Google access token is cut here; server auth() never uses this route.
export async function withoutAccessToken(response: Response) {
  const body = await response.clone().json().catch(() => null);
  if (!body?.accessToken) return response;
  delete body.accessToken;
  const headers = new Headers(response.headers);
  headers.delete("content-length"); // the body just got shorter
  return new Response(JSON.stringify(body), { status: response.status, headers });
}
