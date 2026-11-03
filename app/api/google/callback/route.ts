import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  googleOAuthCookieName,
  verifyOutlookOAuthState,
} from "@/lib/outlook-oauth";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type GoogleProfile = {
  sub: string;
  email?: string;
  name?: string;
};

function getCookie(request: Request, name: string) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

function redirectWithStatus(request: Request, status: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("google", status);

  const headers = new Headers({
    Location: url.toString(),
  });

  headers.append(
    "Set-Cookie",
    `${googleOAuthCookieName}=; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const state = verifyOutlookOAuthState(
    getCookie(request, googleOAuthCookieName)
  );

  if (
    !session?.user?.id ||
    !state ||
    state.userId !== session.user.id ||
    url.searchParams.get("state") !== state.state
  ) {
    return redirectWithStatus(request, "error");
  }

  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) {
    return redirectWithStatus(request, "error");
  }

  try {
    const clientId = process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Google authentication configuration is missing");
    }

    const callbackUrl = new URL("/api/google/callback", request.url);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl.toString(),
        code_verifier: state.codeVerifier,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      console.error("Google account-link token exchange failed:", await tokenResponse.text());
      return redirectWithStatus(request, "error");
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();
    if (!tokens.access_token || !tokens.expires_in) {
      throw new Error("Google did not return a usable access token");
    }

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      }
    );

    if (!profileResponse.ok) {
      throw new Error(
        `Unable to retrieve Google account profile (${profileResponse.status})`
      );
    }

    const profile: GoogleProfile = await profileResponse.json();
    if (!profile.sub) {
      throw new Error("Google account profile is missing its account ID");
    }

    const existingAccount = await prisma.account.findFirst({
      where: { provider: "google", providerAccountId: profile.sub },
    });

    if (existingAccount && existingAccount.userId !== session.user.id) {
      console.error("Google account is already linked to another user");
      return redirectWithStatus(request, "error");
    }

    const accountData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? existingAccount?.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      scope: tokens.scope ?? existingAccount?.scope,
      token_type: tokens.token_type ?? existingAccount?.token_type,
      id_token: tokens.id_token ?? existingAccount?.id_token,
    };

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: accountData,
      });
    } else {
      await prisma.account.create({
        data: {
          ...accountData,
          userId: session.user.id,
          type: "oauth",
          provider: "google",
          providerAccountId: profile.sub,
        },
      });
    }

    return redirectWithStatus(request, "connected");
  } catch (error) {
    console.error("Unable to link Google account:", error);
    return redirectWithStatus(request, "error");
  }
}
