import { createHmac, timingSafeEqual } from "node:crypto";

export const outlookOAuthCookieName = "catlinder-outlook-oauth";
export const googleOAuthCookieName = "catlinder-google-oauth";

export type OutlookOAuthState = {
  userId: string;
  state: string;
  codeVerifier: string;
  expiresAt: number;
};

function getOAuthSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET must be configured for Outlook account linking");
  }

  return secret;
}

export function signOutlookOAuthState(payload: OutlookOAuthState) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = createHmac("sha256", getOAuthSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyOutlookOAuthState(
  signedState: string | undefined
): OutlookOAuthState | null {
  if (!signedState) return null;

  const [encodedPayload, providedSignature] = signedState.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = createHmac("sha256", getOAuthSecret())
    .update(encodedPayload)
    .digest();

  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const payload: OutlookOAuthState = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );

    if (
      typeof payload.userId !== "string" ||
      typeof payload.state !== "string" ||
      typeof payload.codeVerifier !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getMicrosoftOAuthConfig() {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!issuer || !clientId || !clientSecret) {
    throw new Error("Microsoft authentication configuration is missing");
  }

  const issuerUrl = new URL(issuer);
  const tenantPath = issuerUrl.pathname
    .replace(/\/v2\.0\/?$/, "")
    .replace(/\/$/, "");
  const authority = `${issuerUrl.origin}${tenantPath.replace(/\/[^/]+$/, "")}/common`;

  return {
    clientId,
    clientSecret,
    authorizationUrl: `${authority}/oauth2/v2.0/authorize`,
    tokenUrl: `${authority}/oauth2/v2.0/token`,
  };
}
