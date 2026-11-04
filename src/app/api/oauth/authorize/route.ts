import { getPublicOrigin } from "mcp-handler";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { askOf, consentOk, makeCode } from "@/lib/oauth";
import { timeZoneFrom } from "@/lib/tz";

const say = (text: string, status: number) => new Response(text, { status, headers: { "Cache-Control": "no-store" } });

// Allow or Cancel on /oauth/authorize. The request is checked again, the CSRF check must be this person's, and only then
// does Zeno send them back to the app: with a code after Allow, with access_denied after Cancel, always with state and iss.
export async function POST(request: Request) {
  let form: Record<string, unknown>;
  try {
    form = Object.fromEntries(await request.formData());
  } catch {
    return say("Zeno couldn't read that. Go back to the app and connect again.", 400);
  }
  try {
    const ask = await askOf(form);
    if (typeof ask === "string") return say("This link to Zeno isn't valid. Go back to the app and connect again.", 400);
    const email = (await auth())?.user?.email;
    if (!email || !consentOk(form.check, email, ask)) return say("This page expired. Go back to the app and connect again.", 403);
    const back = new URL(ask.redirectUri);
    if (form.decision === "allow") {
      back.searchParams.set("code", await makeCode(ask, email, timeZoneFrom((await cookies()).get("tz")?.value)));
    } else {
      back.searchParams.set("error", "access_denied");
    }
    if (ask.state !== null) back.searchParams.set("state", ask.state);
    back.searchParams.set("iss", getPublicOrigin(request));
    return new Response(null, { status: 303, headers: { Location: back.href, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("OAuth authorize failed:", error instanceof Error ? error.message.slice(0, 120) : "unknown");
    return say("Zeno couldn't connect the app just now. Go back and try again.", 500);
  }
}
