import NextAuth, { DefaultSession } from "next-auth";

// customize session type

declare module "next-auth" {
  interface Session {
    user: {
      canCreateProject: boolean;
      isSuperAdmin: boolean;
    } & DefaultSession["user"];
  }
}
