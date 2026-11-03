import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import {
  googleOAuthCookieName,
  signOutlookOAuthState,
} from "@/lib/outlook-oauth";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.redirect(new URL("/signin", request.url));
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return Response.json(
      { error: "Google authentication configuration is missing" },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const signedState = signOutlookOAuthState({
    userId: session.user.id,
    state,
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const callbackUrl = new URL("/api/google/callback", request.url);
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: callbackUrl.toString(),
    scope:
      "openid email profile https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  const headers = new Headers();
  headers.set("Location", authorization.toString());
  headers.append(
    "Set-Cookie",
    `${googleOAuthCookieName}=${encodeURIComponent(signedState)}; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=600${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}
