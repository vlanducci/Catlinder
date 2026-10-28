// // This uses Microsoft Entra ID as the sign-in provider and Prisma to persist user and account records.

// import NextAuth from "next-auth";
// import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
// import { PrismaAdapter } from "@auth/prisma-adapter";
// import { prisma } from "@/lib/prisma";

// export const { handlers, auth, signIn, signOut } = NextAuth({
//   adapter: PrismaAdapter(prisma),
//   providers: [MicrosoftEntraID],
//   session: {
//     strategy: "database",
//   },
// });
