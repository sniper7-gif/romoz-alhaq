// Keys kept on a duress wipe: they hold no operational data and keep the UI looking untouched.
const KEEP = new Set(["rah:lang", "rah:disguise"]);

/** Removes chats, reports, missions, alerts, intel and the encrypted vault from this browser. */
export function wipeSensitiveData() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("rah:") && !KEEP.has(k)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    /* storage blocked: nothing persisted to wipe */
  }
}
