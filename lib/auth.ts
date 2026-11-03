// This uses Microsoft Entra ID as the sign-in provider and Prisma to persist user and account records.

import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  debug: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope:
            "openid profile email User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared offline_access",
          prompt: "consent",
        },
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  events: {
    async signIn({ account }) {
      if (
        !account ||
        !["microsoft-entra-id", "google"].includes(account.provider)
      ) {
        return;
      }

      await prisma.account.updateMany({
        where: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
        data: {
          access_token: account.access_token ?? undefined,
          refresh_token: account.refresh_token ?? undefined,
          expires_at: account.expires_at ?? undefined,
          scope: account.scope ?? undefined,
          token_type: account.token_type ?? undefined,
          id_token: account.id_token ?? undefined,
          session_state:
            typeof account.session_state === "string"
              ? account.session_state
              : undefined,
        },
      });
    },
  },
});