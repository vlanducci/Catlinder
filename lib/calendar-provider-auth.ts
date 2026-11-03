import { prisma } from "@/lib/prisma";
import { getMicrosoftOAuthConfig } from "@/lib/outlook-oauth";

type ProviderAccount = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
};

type RefreshedTokens = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export class CalendarTokenError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function refreshProviderToken(
  account: ProviderAccount,
  provider: "google" | "outlook"
) {
  if (!account.refresh_token) {
    throw new CalendarTokenError(
      401,
      `${provider === "google" ? "Google" : "Microsoft"} re-authentication required`
    );
  }

  let tokenUrl: string;
  let clientId: string;
  let clientSecret: string;

  if (provider === "google") {
    tokenUrl = "https://oauth2.googleapis.com/token";
    clientId = process.env.AUTH_GOOGLE_ID ?? "";
    clientSecret = process.env.AUTH_GOOGLE_SECRET ?? "";
  } else {
    const config = getMicrosoftOAuthConfig();
    tokenUrl = config.tokenUrl;
    clientId = config.clientId;
    clientSecret = config.clientSecret;
  }

  if (!clientId || !clientSecret) {
    throw new CalendarTokenError(
      500,
      `${provider === "google" ? "Google" : "Microsoft"} authentication configuration is missing`
    );
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new CalendarTokenError(
      401,
      `Unable to refresh ${provider === "google" ? "Google" : "Microsoft"} access token: ${await response.text()}`
    );
  }

  const tokens: RefreshedTokens = await response.json();
  if (!tokens.access_token || !tokens.expires_in) {
    throw new CalendarTokenError(
      401,
      `${provider === "google" ? "Google" : "Microsoft"} did not return a usable access token`
    );
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? account.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
      scope: tokens.scope ?? account.scope,
    },
  });

  return tokens.access_token;
}

export async function getCalendarAccessToken(
  account: ProviderAccount,
  provider: "google" | "outlook",
  forceRefresh = false
) {
  const refreshBuffer = provider === "google" ? 60 : 300;
  if (
    !forceRefresh &&
    account.access_token &&
    account.expires_at &&
    account.expires_at > Math.floor(Date.now() / 1000) + refreshBuffer
  ) {
    return account.access_token;
  }

  return refreshProviderToken(account, provider);
}
