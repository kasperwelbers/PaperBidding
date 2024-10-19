import { createHash } from "crypto";

export function createUserSecret(projectId: number, email: string) {
  const hash = createHash("sha1");
  const secret = process.env.NEXTAUTH_SECRET;
  hash.update(`${projectId}:${email}:${secret}`);
  return hash.digest("base64url");
}

export function createProjectSecret(projectId: number, secretVersion: number) {
  const hash = createHash("sha1");
  const secret = process.env.NEXTAUTH_SECRET;
  hash.update(`${projectId}:${secretVersion}:${secret}`);
  return hash.digest("base64url");
}
