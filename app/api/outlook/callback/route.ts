import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getMicrosoftOAuthConfig,
  outlookOAuthCookieName,
  verifyOutlookOAuthState,
} from "@/lib/outlook-oauth";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type MicrosoftProfile = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
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
  url.searchParams.set("outlook", status);
  const response = Response.redirect(url);
  response.headers.append(
    "Set-Cookie",
    `${outlookOAuthCookieName}=; Path=/api/outlook; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`
  );
  return response;
}

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const statePayload = verifyOutlookOAuthState(
    getCookie(request, outlookOAuthCookieName)
  );

  if (
    !session?.user?.id ||
    !statePayload ||
    statePayload.userId !== session.user.id ||
    url.searchParams.get("state") !== statePayload.state
  ) {
    return redirectWithStatus(request, "error");
  }

  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) {
    return redirectWithStatus(request, "error");
  }

  try {
    const { clientId, clientSecret, tokenUrl } = getMicrosoftOAuthConfig();
    const callbackUrl = new URL("/api/outlook/callback", request.url);
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl.toString(),
        code_verifier: statePayload.codeVerifier,
        scope:
          "openid profile email User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared offline_access",
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      console.error(
        "Microsoft account-link token exchange failed:",
        await tokenResponse.text()
      );
      return redirectWithStatus(request, "error");
    }

    const tokens: MicrosoftTokenResponse = await tokenResponse.json();
    if (!tokens.access_token || !tokens.expires_in) {
      throw new Error("Microsoft did not return a usable access token");
    }

    const profileResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      }
    );

    if (!profileResponse.ok) {
      throw new Error(
        `Unable to retrieve Microsoft account profile (${profileResponse.status})`
      );
    }

    const profile: MicrosoftProfile = await profileResponse.json();
    const existingAccount = await prisma.account.findFirst({
      where: {
        provider: "microsoft-entra-id",
        providerAccountId: profile.id,
      },
    });

    if (existingAccount && existingAccount.userId !== session.user.id) {
      console.error("Microsoft account is already linked to another user");
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
          provider: "microsoft-entra-id",
          providerAccountId: profile.id,
        },
      });
    }

    return redirectWithStatus(request, "connected");
  } catch (error) {
    console.error("Unable to link Outlook account:", error);
    return redirectWithStatus(request, "error");
  }
}
