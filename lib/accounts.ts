"use client";
// Member accounts live in this browser only (no backend). Passwords are salted PBKDF2 hashes.
const KEY = "rah:accounts";
interface Account {
  salt: string;
  hash: string;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 150_000 }, key, 256);
  return b64(new Uint8Array(bits));
}

function load(): Record<string, Account> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export const hasAccount = (codename: string) => codename in load();

export async function register(codename: string, password: string) {
  const all = load();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  all[codename] = { salt: b64(salt), hash: await derive(password, salt) };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export async function verify(codename: string, password: string) {
  const acc = load()[codename];
  if (!acc) return false;
  const salt = Uint8Array.from(atob(acc.salt), (c) => c.charCodeAt(0));
  return (await derive(password, salt)) === acc.hash;
}
