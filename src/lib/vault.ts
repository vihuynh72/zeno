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
// The same fact in any case or punctuation (as src/lib/goals.ts factKey).
const factKey = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const FILLER = new Set(
  "a an the at on in of to for and or with by from as is are be has have had every each this that their they them about".split(" "),
);
const DATE_WORD = /^(\d.*|am|pm|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|noon|midnight)$/;

function words(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !FILLER.has(word))
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
}

// A reworded known fact ("Bio lab on Wednesdays at 2 PM" for "Has bio lab every Wednesday at 2pm"). A different
// day, date or time is a different fact, so those words must match exactly, and one fact's other words must all be in
// the other's: "with Jess" and "with Omar" are two facts. A rare near-duplicate costs less than a lost fact.
// Here, not in profile.ts, because the browser's vault uses it too.
export function sameFact(a: string, b: string): boolean {
  if (factKey(a) === factKey(b)) return true;
  const split = (text: string) => {
    const all = [...new Set(words(text))];
    return { dates: all.filter((word) => DATE_WORD.test(word)).sort().join(" "), rest: all.filter((word) => !DATE_WORD.test(word)) };
  };
  const x = split(a);
  const y = split(b);
  if (x.dates !== y.dates || !x.rest.length || !y.rest.length) return false;
  const [small, big] = x.rest.length <= y.rest.length ? [x.rest, y.rest] : [y.rest, x.rest];
  return small.every((word) => big.includes(word));
}

// A health condition's name (Vi, Nov 2: "Doctor check-in Nov 3", not "ADHD check-in"). Kept nowhere, not even on the
// device: src/lib/profile.ts factVerdict puts it on the never-list, and this vault drops one saved before that rule.
export const CONDITION =
  /\b(adhd|autis\w*|asperger'?s|anxiety|panic attacks?|depress\w*|bipolar|ocd|ptsd|anorexi\w*|bulimi\w*|insomnia|migraines?|asthma|diabet\w*|epilep\w*|seizures?|fibromyalgia|crohn'?s|celiac|covid|cancer|disorders?|concussion|sleep apnea|lupus|dyslex\w*|dyspraxi\w*|dyscalcul\w*|arthritis|ibs|pcos|endometriosis|sickle cell|multiple sclerosis|allerg\w*|alcoholics anonymous|narcotics anonymous|(aa|na) meetings?|(goes|go|going|went) to (aa|na))\b/i;

function load(account: string): Vault {
  try {
    const raw = JSON.parse(localStorage.getItem(key(account)) ?? "null") as Partial<Vault> | null;
    const facts = (Array.isArray(raw?.facts) ? raw.facts : []).filter(
      (fact): fact is VaultFact =>
        typeof fact?.id === "string" &&
        typeof fact.text === "string" &&
        typeof fact.createdAt === "string" &&
        isGroup(fact.group) &&
        !CONDITION.test(fact.text),
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

// Keeps new facts, newest first, skipping any already kept or removed by the person, even reworded (a scan rewords
// the same calendar event every day). Returns the ones added, for the "Kept on this device" line.
export function addToVault(account: string, facts: PrivateFact[], now = new Date()): VaultFact[] {
  const vault = load(account);
  const known = [...vault.facts.map((fact) => fact.text), ...vault.removed];
  const added: VaultFact[] = [];
  for (const fact of facts) {
    const text = typeof fact?.text === "string" ? fact.text.trim().slice(0, MAX_CHARS) : "";
    if (!text || !isGroup(fact.group) || CONDITION.test(text) || known.some((other) => sameFact(other, text))) continue;
    known.push(text);
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
// What the person removed here, for the profile scan's body (`removed`), so a scan never finds one again.
export const vaultRemoved = (account: string) => load(account).removed.slice(-VAULT_MAX);

// Server side: a request body's `private` field, untrusted. Brackets are removed so a fact can't fake a data label.
export function cleanPrivate(raw: unknown): string[] {
  const seen = new Set<string>();
  return (Array.isArray(raw) ? raw : [])
    .map((item) => (typeof item === "string" ? item.replace(/[\p{Cc}<>\s]+/gu, " ").trim().slice(0, MAX_CHARS) : ""))
    .filter((text) => text && !seen.has(factKey(text)) && seen.add(factKey(text)))
    .slice(0, VAULT_MAX);
}
