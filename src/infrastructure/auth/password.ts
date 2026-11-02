import { argon2id, hash, verify } from 'argon2';
export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash.startsWith('$argon2id$')) return false;
  try { return await verify(passwordHash, password); } catch { return false; }
}
