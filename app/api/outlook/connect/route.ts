import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import {
  getMicrosoftOAuthConfig,
  outlookOAuthCookieName,
  signOutlookOAuthState,
} from "@/lib/outlook-oauth";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.redirect(new URL("/signin", request.url));
  }

  try {
    const { authorizationUrl, clientId } = getMicrosoftOAuthConfig();
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const signedState = signOutlookOAuthState({
      userId: session.user.id,
      state,
      codeVerifier,
      expiresAt,
    });
    const callbackUrl = new URL("/api/outlook/callback", request.url);
    const authorization = new URL(authorizationUrl);

    authorization.search = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: callbackUrl.toString(),
      response_mode: "query",
      scope:
        "openid profile email User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared offline_access",
      state,
      prompt: "select_account",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();

    const response = Response.redirect(authorization);
    response.headers.append(
      "Set-Cookie",
      `${outlookOAuthCookieName}=${encodeURIComponent(signedState)}; Path=/api/outlook; HttpOnly; SameSite=Lax; Max-Age=600${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`
    );

    return response;
  } catch (error) {
    console.error("Unable to start Outlook account linking:", error);
    return Response.json(
      { error: "Unable to connect another Microsoft account" },
      { status: 500 }
    );
  }
}
