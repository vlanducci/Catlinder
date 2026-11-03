import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "microsoft-entra-id",
    },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true,
    },
  });

  return Response.json({
    accountFound: !!account,
    hasAccessToken: !!account?.access_token,
    hasRefreshToken: !!account?.refresh_token,
    expiresAt: account?.expires_at,
    scope: account?.scope,
  });
}