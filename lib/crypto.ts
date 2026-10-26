// Zero-knowledge E2EE helpers (Web Crypto). Keys never leave the browser.
const enc = new TextEncoder();
const dec = new TextDecoder();
const SALT = enc.encode("romoz-alhaq/e2ee/v1");
const ITERATIONS = 310_000;

export const b64 = {
  to(buf: ArrayBuffer | Uint8Array) {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  },
  from(str: string) {
    const s = atob(str);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  },
};

/** PBKDF2(passcode) -> AES-GCM-256 (non-extractable). */
export async function deriveKey(passcode: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return { cipher_text: b64.to(ct), iv: b64.to(iv) };
}

export async function decryptText(key: CryptoKey, cipher_text: string, iv: string) {
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.from(iv) as BufferSource }, key, b64.from(cipher_text) as BufferSource);
    return dec.decode(pt);
  } catch {
    return "[UNDECRYPTABLE]";
  }
}

/** Audio: output = iv(12) || ciphertext. */
export async function encryptBlob(key: CryptoKey, data: ArrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBlob(key: CryptoKey, data: ArrayBuffer) {
  const u = new Uint8Array(data);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, key, u.slice(12));
}

// Key persisted only in sessionStorage as a non-extractable-incompatible passphrase would be unsafe;
// we keep the passcode in sessionStorage (tab-scoped) and re-derive on load.
const SS = "rah_ck";
export const keyStore = {
  set: (comms: string) => sessionStorage.setItem(SS, comms),
  get: () => sessionStorage.getItem(SS),
  clear: () => sessionStorage.removeItem(SS),
};
