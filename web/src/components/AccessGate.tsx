// Site passphrase screen wrapping <App />. NOT a security boundary — see
// "Site access gate" section in LIVE_WEBSITE_PLAN.md. On a static site any
// client-side check is fully readable/bypassable via devtools; this only
// deters a casual visitor who stumbles on the URL with no context.

import { useState, type FormEvent, type ReactNode } from "react";

const STORAGE_KEY = "budget-processor:site-unlocked";

// TODO: set via `await sha256Hex("<the chosen passphrase>")` in a console
// once a real passphrase is picked. Empty = gate disabled (no passphrase
// configured yet), so phase 4 stays testable without one.
const PASSPHRASE_HASH = "";

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export default function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState(false);

  if (!PASSPHRASE_HASH || unlocked) return <>{children}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const hash = await sha256Hex(passphrase);
    if (hash === PASSPHRASE_HASH) {
      setUnlocked(true);
      setError(false);
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // Best effort — just means they're asked again next visit.
      }
    } else {
      setError(true);
    }
  }

  return (
    <div className="access-gate">
      <form onSubmit={handleSubmit} className="access-gate-form">
        <label>Enter passphrase</label>
        <input
          type="password"
          autoComplete="off"
          value={passphrase}
          onChange={(e) => {
            setPassphrase(e.target.value);
            setError(false);
          }}
        />
        {error && <span className="access-gate-error">Incorrect passphrase.</span>}
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}
