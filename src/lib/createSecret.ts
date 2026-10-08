import { createHash } from "crypto";

export function createUserSecret(projectId: number, email: string) {
  const hash = createHash("sha1");
  const secret = process.env.BETTER_AUTH_SECRET;
  // without a secret, bidding links could be guessed from the email address
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  hash.update(`${projectId}:${email}:${secret}`);
  return hash.digest("base64url");
}

// export function createInviteSecret(expireDate: Date) {
//   const hash = createHash("sha1");
//   const secret = process.env.BETTER_AUTH_SECRET;
//   hash.update(`${projectId}:${secretVersion}:${secret}`);
//   return hash.digest("base64url");
// }
