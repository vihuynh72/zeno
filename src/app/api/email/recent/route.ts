import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRecentEmail, GmailError } from "@/lib/gmail";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ state: "signed-out", emails: [] }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json({ state: "no-email-access", emails: [] }, { status: 403 });
  }

  try {
    const emails = await getRecentEmail(session.accessToken);
    return NextResponse.json({ state: "ok", emails });
  } catch (error) {
    console.error("Email read failed:", error);
    if (error instanceof GmailError) {
      if (error.body.includes("accessNotConfigured") || error.body.includes("has not been used")) {
        return NextResponse.json({ state: "not-enabled", emails: [] });
      }
      if (
        error.status === 403 &&
        (error.body.includes("insufficientPermissions") || error.body.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT"))
      ) {
        return NextResponse.json({ state: "no-email-access", emails: [] });
      }
    }
    return NextResponse.json({ state: "error", emails: [] }, { status: 502 });
  }
}
