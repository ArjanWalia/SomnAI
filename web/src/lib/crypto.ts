/**
 * Password hashing for SomnAI accounts.
 *
 * Passwords are never stored or transmitted in plaintext. We derive a SHA-256
 * hash (salted with the lowercased email) in the browser via Web Crypto, and
 * only the hex digest is written to the Butterbase `users.password_hash` column
 * or the local demo store. The email salt means identical passwords across
 * accounts produce different hashes.
 */
export async function hashPassword(email: string, password: string): Promise<string> {
  const material = `somnai:v1:${email.trim().toLowerCase()}:${password}`;
  const data = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
