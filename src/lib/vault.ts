// The device-only vault (docs/PLAN-NOV.md). Private facts (overall health, sexual orientation, religion, politics,
// immigration status, balances or debts) live only in this browser, per account. They leave it only as
// `private: string[]` in the requests that use them, and Zeno's servers never save them.
// Storage can be missing or throw (private windows, blocked site data): reads fall back to empty, writes are skipped.
import { MEMORY_GROUPS, type MemoryGroup, type PrivateFact } from "@/lib/day";

export type VaultFact = PrivateFact & { id: string; createdAt: string };
type Vault = { facts: VaultFact[]; removed: string[] };

export const VAULT_MAX = 40;
const MAX_CHARS = 200;
const key = (account: string) => `zeno.vault.${account}`;
const isGroup = (group: unknown): group is MemoryGroup => (MEMORY_GROUPS as readonly unknown[]).includes(group);
// The same fact in any case or punctuation.
const factKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function load(account: string): Vault {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account)) ?? "null") as Partial<Vault> | null;
    const facts = (Array.isArray(raw?.facts) ? raw.facts : []).filter(
      (fact): fact is VaultFact =>
        typeof fact?.id === "string" && typeof fact.text === "string" && typeof fact.createdAt === "string" && isGroup(fact.group),
    );
    const removed = (Array.isArray(raw?.removed) ? raw.removed : []).filter((text): text is string => typeof text === "string");
    return { facts, removed };
  } catch {
    return { facts: [], removed: [] };
  }
}

function save(account: string, vault: Vault) {
  try {
    localStorage.setItem(key(account), JSON.stringify(vault));
  } catch {
    // Blocked or full storage: nothing is kept, and nothing goes to the server instead.
  }
}

export function readVault(account: string): VaultFact[] {
  return load(account).facts;
}

// Keeps new facts, newest first, skipping any already kept or removed by the person. Returns the ones added, for
// the "Kept on this device" line.
export function addToVault(account: string, facts: PrivateFact[], now = new Date()): VaultFact[] {
  const vault = load(account);
  const known = new Set([...vault.facts.map((fact) => factKey(fact.text)), ...vault.removed]);
  const added: VaultFact[] = [];
  for (const fact of facts) {
    const text = typeof fact?.text === "string" ? fact.text.trim().slice(0, MAX_CHARS) : "";
    if (!text || !isGroup(fact.group) || known.has(factKey(text))) continue;
    known.add(factKey(text));
    added.push({ id: crypto.randomUUID(), text, group: fact.group, createdAt: now.toISOString() });
  }
  if (added.length > 0) save(account, { facts: [...added, ...vault.facts].slice(0, VAULT_MAX), removed: vault.removed });
  return added;
}

// Forget for good on this device: a later scan that finds the same fact again is skipped.
export function removeFromVault(account: string, id: string) {
  const vault = load(account);
  const fact = vault.facts.find((one) => one.id === id);
  if (!fact) return;
  save(account, { facts: vault.facts.filter((one) => one !== fact), removed: [...vault.removed, factKey(fact.text)].slice(-200) });
}

// Sign out clears this account's private facts, so the next person at a shared computer can't read them.
export function clearVault(account: string) {
  try {
    localStorage.removeItem(key(account));
  } catch {
    // Nothing was readable either.
  }
}

// What a request sends.
export const vaultTexts = (account: string) => readVault(account).map((fact) => fact.text);

// Server side: a request body's `private` field, untrusted. Brackets are removed so a fact can't fake a data label.
export function cleanPrivate(raw: unknown): string[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw : [])
    .map((item) => (typeof item === "string" ? item.replace(/[\p{Cc}<>\s]+/gu, " ").trim().slice(0, MAX_CHARS) : ""))
    .filter((text) => text && !seen.has(factKey(text)) && seen.add(factKey(text)))
    .slice(0, VAULT_MAX);
}
