"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { signIn, signOut } from "next-auth/react";
import type {
  BookResponse,
  CalendarBlock,
  CanvasAssignment,
  CanvasBrief,
  DayResponse,
  EmailDraft,
  FirstPick,
  FreeResponse,
  Goal,
  GoalResponse,
  ImportResponse,
  Memory,
  MemoryResponse,
  OpeningResponse,
  PrivateFact,
  ProfileResponse,
  Progress,
  SaveMemoryResponse,
  Step,
  StepResponse,
  StepStatus,
  TalkResponse,
  Turn,
} from "@/lib/day";
import { canvasBriefs, canvasList, readCanvas, syncCanvas } from "@/lib/canvas-store";
import { listenAuto, type ListenHandlers } from "@/lib/listen";
import { audioContext } from "@/lib/speak";
import { formatTime, localDate } from "@/lib/tz";
import { useVoice } from "@/lib/use-voice";
import { addToVault, readVault, removeFromVault, vaultRemoved, vaultTexts, type VaultFact } from "@/lib/vault";
import {
  asks,
  canvasFor,
  checkinMinute,
  dayPart,
  doneLine,
  draftGoal,
  FOCUS,
  foundLine,
  greeting,
  isDraft,
  isEmailStep,
  isNotes,
  isTomorrow,
  laterBlock,
  laterMinutes,
  nextScreen,
  openingReusable,
  openingSig,
  openSteps,
  pickFits,
  quickReplies,
  replanOnCanvas,
  slotLabel,
  soonEvent,
  stepCard,
  withStatus,
  type Fact,
  type Screen,
} from "@/components/day-flow";
import type { Booking } from "@/components/booking-chip";
import DayView, { type Sheet } from "@/components/day-view";
import { httpsOnly } from "@/components/desk-rows";

const SIGNED_OUT_LINE = "Zeno helps you start the thing you keep putting off.";
const THINK_FAIL = "I couldn't think that through just now. Try again?";
const SAVE_FAIL = "I couldn't save that just now. Try again?";
const WRAP_LINE = "Saved. I'll bring it back next time.";
const READING_LINE = "Reading your calendar and email…";
const PASTE_LINE = "Paste a syllabus, a to-do list or notes. I'll pull out what matters.";
const VOICE_NOTE = {
  blocked: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  unsupported: "Voice isn't available in this browser, so typing works for now.",
  network: "Voice couldn't connect just now, so typing works for now.",
};

type Day = Extract<DayResponse, { state: "ok" }>;
// at and sig: when the model wrote it and the day it was written for (openingSig); missing on openings saved before
// Nov 3, which are asked for again.
type Opening = { text: string; options: string[]; pick: FirstPick | null; at?: string; sig?: string };
// What the last visit left in this browser, kept current after every action; the model's opening is for `part` only.
// It paints before /api/day says whose browser this is, its chips wait for that answer, and its opening and setup
// state carry over only when day.account matches.
// shortcut: first paint trusts it, so a day written as the account switched (an /api/day already in flight, or a switch
// outside this page's Sign in / Sign out) shows until /api/day answers; check a readable cookie set at sign-in to close that.
type Saved = { v: 3; part: string; day: Day; opening: Opening | null; setupDone: boolean };
// One answer on the screen: the first is its big button, the rest links under it.
type Answer = { label: string; run(): void };

const SAVED_KEY = "zeno:day";
const scannedKey = (account: string) => `zeno:scanned:${account}`;
// The day as this browser keeps it: no email snippets (nothing on screen shows them), and no Gmail link, which holds the
// address that the opaque account key keeps out of storage. Both come back with each /api/day.
const toKeep = (day: Day): Day => ({ ...day, emails: [], mailUrl: undefined });
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function readSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null") as Saved | null;
    return saved?.v === 3 && saved.day?.state === "ok" && typeof saved.day.opening === "string" ? saved : null;
  } catch {
    return null;
  }
}

function writeSaved(saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    // Private windows and full storage only lose the instant start.
  }
}

// Per-viewer conveniences (today's scan done); blocked storage just means the defaults.
function readLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The default stays.
  }
}

// Read once per page load, so the first paint and every later render agree.
let boot: { part: string; hour: number; saved: Saved | null } | undefined;
const readBoot = () => (boot ??= { part: dayPart(new Date()), hour: new Date().getHours(), saved: readSaved() });

// Network errors and non-JSON replies (a platform 504 page) come back as { state: "error" }.
async function getJson<T>(url: string, init?: RequestInit): Promise<T | { state: "error" }> {
  try {
    return (await (await fetch(url, init)).json()) as T;
  } catch {
    return { state: "error" };
  }
}

const post = <T,>(url: string, body: unknown) =>
  getJson<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function patchStep(id: string, status: StepStatus) {
  return getJson<StepResponse>(`/api/steps/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// The device's private facts and Canvas briefs ride in the body (never the URL) and only for the account they belong to.
const fetchOpening = (account: string | null) =>
  post<OpeningResponse>("/api/day/opening", { private: account ? vaultTexts(account) : [], canvas: account ? canvasBriefs(account) : [] });

// Browsers play sound before any tap only for sites the person uses often (or after a tap); otherwise the context stays suspended.
async function audioAllowed() {
  if (navigator.userActivation?.hasBeenActive) return true;
  try {
    const context = audioContext();
    await Promise.race([context.resume(), wait(300)]);
    return context.state === "running";
  } catch {
    return false;
  }
}

// Zeno's spoken lines end without opening the mic until the person chooses to talk.
async function micClosed(handlers: ListenHandlers) {
  handlers.onError?.("no-speech");
  return { stop() {}, pause() {}, resume() {} };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const noStore = () => () => {};

// One booking chip per step (by its id), or per proposed to-do or deadline.
const blockKey = (block: CalendarBlock) => block.stepId ?? `${block.kind}:${block.title}:${block.start ?? block.date}`;
const offerLabel = (block: CalendarBlock) =>
  block.start && block.end
    ? `Book ${slotLabel(block.start, block.end, zone())}?`
    : `Add “${block.title}” on ${new Date(`${block.date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}?`;
// Only a Gmail compose window opens from Open in Gmail.
const gmailDraft = (draft: EmailDraft | null | undefined) => (typeof draft?.url === "string" && draft.url.startsWith("https://mail.google.com/") ? draft : null);
// "15 min" on the screen is said as "15 minutes".
const spoken = (line: string) => line.replace(/(\d) min$/, "$1 minutes");

export default function GuidedDay() {
  // null on the server and while hydrating; then this browser's saved day, if any.
  const booted = useSyncExternalStore(noStore, readBoot, () => null);
  // Set when /api/day fails: the account was never checked, so the saved day (maybe another account's) stops showing.
  const [savedDropped, setSavedDropped] = useState(false);
  const saved = savedDropped ? null : booted?.saved ?? null;
  const same = saved && saved.part === booted?.part ? saved : null;
  // /api/day answered: until then a saved card paints, but its chips (maybe stale) wait.
  const [fresh, setFresh] = useState(false);

  // Each piece below starts from the saved day until something newer sets it.
  const [screenSet, setScreen] = useState<Screen | null>(null);
  const [lineSet, setLine] = useState<string | null>(null);
  const [optionsSet, setOptions] = useState<string[] | null>(null);
  const [daySet, setDay] = useState<Day | null>(null);
  const [goalSet, setGoal] = useState<Goal | null | undefined>(undefined);
  const [pickSet, setPick] = useState<FirstPick | null | undefined>(undefined);
  const [progressSet, setProgress] = useState<Progress | null>(null);
  // Setup waits for /api/day to say the person is still new, so a tap on a saved setup card is never undone.
  const screen = screenSet ?? (saved && (!saved.day.isNew || saved.setupDone) ? "ready" : null);
  const line =
    lineSet ?? (same ? same.opening?.text ?? same.day.opening : booted ? greeting(booted.hour, saved?.day.firstName ?? null) : "");
  const options = optionsSet ?? (same ? quickReplies(same.opening?.options ?? same.day.options) : []);
  const day = daySet ?? same?.day ?? null;
  const goal = goalSet === undefined ? saved?.day.goal ?? null : goalSet;
  const pick = pickSet === undefined ? (same && pickFits(same.opening?.pick, same.day.goal) ? same.opening?.pick ?? null : null) : pickSet;
  const progress = progressSet ?? day?.progress ?? null;

  const [heard, setHeard] = useState("");
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [memories, setMemories] = useState<Memory[] | "loading" | "error">("loading");
  const [device, setDevice] = useState<VaultFact[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [leaving, setLeaving] = useState<Step | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [hear, setHear] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null); // an email Zeno wrote, offered as Open in Gmail
  const [sources, setSources] = useState<{ canvas?: CanvasBrief } | null>(null); // Focus shows its step's sources
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [offerKeys, setOfferKeys] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [learned, setLearned] = useState<PrivateFact[]>([]); // what first sign-in's scan learned, private facts too
  const [scanning, setScanning] = useState(false);
  const [canvasOn, setCanvasOn] = useState(false); // Canvas is linked on this device for this account
  const [quietLine, setQuietLine] = useState(""); // the Focus line Zeno set quietly, muted while it is the one showing
  const history = useRef<Turn[]>([]);
  const cache = useRef<Saved | null>(null);
  const tapped = useRef(false); // the turn in flight came from a chip, not the type box
  const moved = useRef(false); // the person has taken a turn since the opening was shown
  const spoke = useRef(false); // the opening has been said (or offered with Hear Zeno)
  const talking = useRef(false); // hands-free: the person tapped Talk, so Zeno listens after each question it says
  const nextOpening = useRef<Promise<OpeningResponse | { state: "error" }> | null>(null);
  const saves = useRef<Promise<unknown>[]>([]); // the first scan and pasted notes still being saved
  const starting = useRef<Promise<Goal | null> | null>(null); // a plan from the first card still being saved
  const booking = useRef(new Set<string>()); // booking chips with a request in flight, so a double tap books once
  const bookedLine = useRef<string | null>(null); // the talk offer whose booking replaced Zeno's line
  const replied = useRef<string[]>([]); // the last talk turn's quick replies, which came with its booking offers
  const warned = useRef(new Set<string>()); // events already given a heads-up
  const answered = useRef(""); // Zeno's answer to something said in Focus, which no quiet line covers
  const cardAt = useRef(0); // when the card last changed, so the second tap of a double tap can't answer the next one
  useEffect(() => {
    cardAt.current = performance.now();
  }, [screen, pasting]);
  // The voice hook calls onUserTurn later, so it reads the screen, goal and phase from here, not a stale render.
  const latest = useRef({ screen, goal, line, progress });
  useEffect(() => {
    latest.current = { screen, goal, line, progress };
  });

  // Auth.js sends failed sign-ins back to "/?error=...".
  const signInFailed = useSyncExternalStore(noStore, () => new URLSearchParams(window.location.search).has("error"), () => false);

  const voice = useVoice(
    {
      onUserTurn,
      listenAfter: (said) => talking.current && asks(said),
      // A listen that heard nothing ends hands-free, so a later question never reopens the mic without a tap.
      onSilence: () => (talking.current = false),
    },
    { listen: (handlers, opts) => (talking.current ? listenAuto(handlers, opts) : micClosed(handlers)) },
  );

  // Another tab signed out or loaded another account: this tab must not write its day back over that.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SAVED_KEY && event.key !== null) return;
      if (readSaved()?.day.account !== cache.current?.day.account) cache.current = null;
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // The account whose vault and saved day this page may use: only once /api/day said so.
  const account = () => cache.current?.day.account ?? null;

  function store(patch: Partial<Saved>) {
    if (!cache.current) return;
    cache.current = { ...cache.current, ...patch };
    writeSaved(cache.current);
  }

  // The day an opening is asked for: the plan and this device's Canvas list (openingSig). Refs only, like account(), so
  // effects can call it.
  function daySig() {
    const mine = cache.current?.day.account;
    return openingSig(latest.current.goal, mine ? canvasList(mine) : null);
  }

  // A model opening is saved with when it came and the day it was asked for, so a reload soon after shows it again
  // without asking the model.
  function keepOpening(text: string, options: string[], pick: FirstPick | null, sig: string) {
    store({ opening: { text, options, pick, at: new Date().toISOString(), sig } });
  }

  // After a talk turn or a Memory change the saved opening may be wrong: a reload still paints it, but asks again.
  function expireOpening() {
    if (cache.current?.opening) store({ opening: { ...cache.current.opening, at: undefined } });
  }

  // A Focus line that is only shown, muted, never said (Vi, Nov 3: check-ins "even quieter").
  function quiet(text: string) {
    setLine(text);
    setQuietLine(text);
  }

  // Every change to the plan or the streak goes to the saved day too, so a reload paints what is true now.
  function changeGoal(next: Goal | null) {
    setGoal(next);
    latest.current.goal = next;
    if (cache.current && !isDraft(next)) store({ day: { ...cache.current.day, goal: next } });
  }

  function changeProgress(next: Progress) {
    setProgress(next);
    latest.current.progress = next;
    if (cache.current) store({ day: { ...cache.current.day, progress: next, streak: next.streak } });
  }

  function changePick(next: FirstPick | null) {
    setPick(next);
    if (cache.current?.opening) store({ opening: { ...cache.current.opening, pick: next } });
  }

  // Private facts go to this device only (never to /api/memory), silently like every memory (Vi, Nov 2); returns the
  // ones newly kept.
  function keep(facts: PrivateFact[] | undefined): VaultFact[] {
    const mine = account();
    if (!mine || !Array.isArray(facts) || facts.length === 0) return [];
    return addToVault(mine, facts);
  }

  // Declared before onDay, which calls this and startScan: React's lint rejects a function used above its declaration.
  function showSignedOut() {
    writeSaved(null);
    cache.current = null;
    setCanvasOn(false);
    voice.stop();
    talking.current = false;
    setTyping(false);
    setSheet(null);
    setHear(false);
    setPick(null);
    setDraft(null);
    setOfferKeys([]);
    setBookings({});
    setLine(SIGNED_OUT_LINE);
    setScreen("signed-out");
  }

  // No questions (Vi, Nov 2): the card says Zeno is reading calendar and email while the profile scan runs (about 15 s),
  // then one line says what it learned.
  function startScan(mine: string) {
    setScanning(true);
    // The server gives the model up to 45 s (a first scan writes for ~15 s); past 50 s the card stops waiting, what it
    // learns still saves, and the line catches up.
    setTimeout(() => setScanning(false), 50_000);
    const scan = post<ProfileResponse>("/api/profile/scan", { first: true, private: vaultTexts(mine), removed: vaultRemoved(mine) }).then((res) => {
      setScanning(false);
      if (res.state === "signed-out") return showSignedOut();
      // Like the daily scan: a failed one is tried again on the next open today.
      if (res.state === "ok" || res.state === "no-access") writeLocal(scannedKey(mine), localDate(zone()));
      if (res.state === "ok") setLearned([...(res.learned ?? []), ...keep(res.private)]);
    });
    saves.current.push(scan);
    // Asked for once the scan settles, so the first card's opening is written with what it learned.
    nextOpening.current = scan.then(() => fetchOpening(mine));
  }

  // Returns whether the model's opening should follow.
  const onDay = useEffectEvent((data: DayResponse | { state: "error" }) => {
    if (data.state === "signed-out") {
      showSignedOut();
      return false;
    }
    setFresh(true);
    if (data.state !== "ok") {
      // Whatever the person already did stays, but the saved day gives way to the plain greeting; there's still a way to start.
      setSavedDropped(true);
      setScreen((set) => set ?? "ready");
      return false;
    }
    // Another account's saved day is dropped here: overwritten, its opening and setup state not carried over.
    const prior = saved?.day.account === data.account ? saved : null;
    const kept = prior && prior.part === booted?.part ? prior.opening : null;
    cache.current = { v: 3, part: booted?.part ?? "", day: toKeep(data), opening: kept, setupDone: prior?.setupDone ?? false };
    writeSaved(cache.current);
    setDay(data);
    setCanvasOn(Boolean(readCanvas(data.account)));
    if (!prior) setPick(null);
    else if (!moved.current) setPick(pickFits(kept?.pick, data.goal) ? kept?.pick ?? null : null);
    if (moved.current) return false;
    setGoal(data.goal);
    // An opening that already arrived is checked against this day, not the saved one, before the next render.
    latest.current.goal = data.goal;
    if (data.isNew === true && !prior?.setupDone) {
      setScreen("setup");
      startScan(data.account);
      return false;
    }
    setScreen("ready");
    latest.current.screen = "ready";
    // A saved model line for this part of the day stays until the new one lands; otherwise the quick line shows now.
    if (!kept) {
      setLine(data.opening);
      setOptions(quickReplies(data.options));
    }
    // The first open of the day (not the first run) re-reads calendar and email quietly; what it learns saves silently.
    const today = localDate(zone());
    if (readLocal(scannedKey(data.account)) !== today) {
      setTimeout(() => {
        void post<ProfileResponse>("/api/profile/scan", { private: vaultTexts(data.account), removed: vaultRemoved(data.account) }).then((res) => {
          // A failed scan is tried again on the next open today.
          if (res.state === "ok" || res.state === "no-access") writeLocal(scannedKey(data.account), today);
          if (res.state === "ok") keep(res.private);
        });
      }, 1500);
    }
    return true;
  });

  // Swaps the model's line and pick in (unless the person moved on or Zeno is mid-sentence) and says it once. `sig` is
  // the day it was asked for, saved with it; a saved opening shown again (null) stays saved as it was, with its first time.
  const onOpening = useEffectEvent((res: OpeningResponse | { state: "error" }, allowed: boolean, sig: string | null) => {
    const ok = res.state === "ok" && typeof res.opening === "string" && res.opening.trim() !== "";
    // Without a new model line, a saved one (maybe hours old) is dropped, never said: today's rule line stands in.
    if (!ok) store({ opening: null });
    if (moved.current || latest.current.screen !== "ready") return;
    // cache.current.day is this load's /api/day, even before the render that sets `day`.
    const text = ok ? res.opening.trim() : (cache.current?.day.opening ?? line);
    const next = quickReplies(ok ? res.options : cache.current?.day.options);
    const card = ok && pickFits(res.pick, latest.current.goal) ? res.pick : null;
    if (ok && sig !== null) keepOpening(text, next, card, sig);
    setLine(text);
    setOptions(next);
    setPick(card);
    if (spoke.current || voice.muted) return;
    spoke.current = true;
    // Never over another line (a heads-up) or the person: Hear Zeno offers it instead.
    if (allowed && voice.phase === "idle" && !typing) void voice.speak(text);
    else setHear(true);
  });

  // The day read again after a Canvas sync replaced its deadlines: for this account only, and nothing else moves.
  function takeDay(data: DayResponse | { state: "error" }) {
    if (data.state !== "ok" || data.account !== account()) return;
    store({ day: toKeep(data) });
    setDay(data);
  }
  const dayAgain = useEffectEvent(takeDay);

  useEffect(() => {
    let live = true;
    const { saved, part } = readBoot();
    const allowed = audioAllowed();
    // Someone who was here before gets the model's opening asked for at once; anyone else once the day says who they are.
    // The early ask carries no private facts or Canvas (the saved day may be another account's until /api/day answers),
    // so an account with either asks again below and this one would be thrown away. A recent saved opening may still
    // fit, which /api/day decides.
    const recent = saved?.part === part ? saved.opening : null;
    const asksEarly =
      saved &&
      (!saved.day.isNew || saved.setupDone) &&
      !readCanvas(saved.day.account) &&
      vaultTexts(saved.day.account).length === 0 &&
      !(recent?.sig && openingReusable(recent, recent.sig, Date.now(), saved.day.events));
    const early = asksEarly ? fetchOpening(null) : null;
    void getJson<DayResponse>("/api/day").then(async (data) => {
      if (!live || !onDay(data) || data.state !== "ok") return;
      const mine = data.account;
      // Canvas linked here is read again first, so the opening knows its assignments, but never waited on past 4 s. A sync
      // that worked replaced the Canvas deadlines, so Today reads the day again (the opening is still asked for once).
      const canvas = readCanvas(mine) ? syncCanvas(mine) : null;
      void canvas?.then(async (read) => {
        setCanvasOn(Boolean(readCanvas(mine)));
        const again = read?.state === "ok" ? await getJson<DayResponse>("/api/day") : null;
        if (live && again) dayAgain(again);
      });
      if (canvas) await Promise.race([canvas, wait(4000)]);
      if (!live) return;
      // The day as this sync left it. onDay kept this account's opening for this part of the day: it shows again if it
      // was written for that day.
      const sig = daySig();
      const kept = cache.current?.opening;
      if (kept && openingReusable(kept, sig, Date.now(), data.events)) {
        const ok = await allowed;
        if (live) onOpening({ state: "ok", opening: kept.text, options: kept.options, pick: kept.pick }, ok, null);
        return;
      }
      // The early opening stands only for this account, and only when it has no private facts or Canvas briefs to add.
      const reuse = early && saved?.day.account === mine && !canvas && vaultTexts(mine).length === 0 ? early : null;
      const [res, ok] = await Promise.all([reuse ?? fetchOpening(mine), allowed]);
      if (live) onOpening(res, ok, sig);
    });
    return () => {
      live = false;
    };
  }, []);

  // After setup, the opening written with what was just learned (asked for once the setup saves settled).
  const [wantOpening, setWantOpening] = useState(0);
  useEffect(() => {
    if (!wantOpening) return;
    let live = true;
    const opening = nextOpening.current ?? Promise.allSettled(saves.current).then(() => fetchOpening(account()));
    void Promise.all([opening, audioAllowed()]).then(([res, ok]) => {
      if (live) onOpening(res, ok, daySig());
    });
    return () => {
      live = false;
    };
  }, [wantOpening]);

  function remember(turns: Turn[]) {
    history.current = [...history.current, ...turns].slice(-12);
  }

  // Zeno says a line it chose itself (a template, no model wait); hands-free listens after it only if it asks.
  function speakLine(text: string) {
    if (!voice.muted) void voice.speak(text);
  }

  async function onUserTurn(text: string): Promise<string | null> {
    const fromChip = tapped.current;
    tapped.current = false;
    const before = latest.current;
    // The card's opening is what the person is answering.
    if ((before.screen === "ready" || before.screen === "wrap") && before.line && history.current.at(-1)?.content !== before.line) {
      remember([{ role: "assistant", content: before.line }]);
    }
    moved.current = true;
    expireOpening();
    // Answering the opening is picking one thing, so the card moves on at once.
    if (before.screen === "ready" || before.screen === "wrap") setScreen("talk");
    if (fromChip) setTyping(false);
    setHear(false);
    setNote(null);
    setLine("");
    setOptions([]);
    setOfferKeys([]);
    setDraft(null);
    setCelebrate(false);
    setHeard(text);
    const mine = account();
    const res = await post<TalkResponse>("/api/talk", {
      message: text,
      history: history.current,
      // This page shows and books proposals.
      proposals: true,
      private: mine ? vaultTexts(mine) : [],
      canvas: mine ? canvasBriefs(mine) : [],
    });
    setHeard("");
    if (res.state === "signed-out") {
      showSignedOut();
      return null;
    }
    if (res.state !== "ok" || typeof res.reply !== "string") {
      setLine(THINK_FAIL);
      return THINK_FAIL;
    }
    remember([
      { role: "user", content: text },
      { role: "assistant", content: res.reply },
    ]);
    // What the turn remembered stays quiet (Vi, Nov 2): it shows in Memory, and private facts only on this device.
    keep(res.private);
    // shortcut: a step already on the calendar is not offered again (booking it would double-book); add "Move to …?" if people ask.
    const proposal = (Array.isArray(res.proposal) ? res.proposal : []).filter(
      (block) => !block.stepId || !res.goal?.steps.some((step) => step.id === block.stepId && step.scheduledAt),
    );
    for (const block of proposal) offer(blockKey(block), [block], offerLabel(block));
    setOfferKeys(proposal.map(blockKey));
    if (res.progress) changeProgress(res.progress);
    const now = latest.current;
    const next = nextScreen(now.screen ?? "ready", res.actions ?? [], res.goal);
    const done = now.screen === "focus" && next === "checkin" ? openSteps(now.goal)[0] : undefined;
    // After a Done, said or tapped, Zeno says what is next.
    const said = next === "checkin" ? doneLine(res.goal) : res.reply;
    if (now.screen === "focus" && next === "focus") answered.current = said;
    if (next === "checkin") setCelebrate(Boolean(res.progress));
    // A step's timer and its sources end with its focus, so a new step never opens on the last one's search.
    if (next !== "focus" || openSteps(res.goal)[0]?.id !== openSteps(now.goal)[0]?.id) {
      setTimer(null);
      setSources(null);
    }
    // A plan made or changed here is the card now: its first step, ready to start.
    if (next === "ready") changePick(stepCard(res.goal));
    if (done) {
      // Said "done" out loud: same stamp as the Done button, so the card and its answers wait for it too.
      setStamping(true);
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        changeGoal(res.goal);
        fileAway(done, said);
      }, 400);
    } else {
      changeGoal(res.goal);
      setLine(said);
      setScreen(next);
    }
    const drafted = gmailDraft(res.draft);
    setDraft(drafted);
    // A draft, the card and the screen after Done have their own answers.
    replied.current = !drafted && (next === "talk" || next === "focus") ? quickReplies(res.options, proposal.length > 0) : [];
    setOptions(replied.current);
    // The hook says it; hands-free listens again after a question.
    return spoken(said);
  }

  // The finished card slides onto the pile while the next card rises with Zeno's line.
  function fileAway(step: Step, nextLine: string) {
    setStamping(false);
    setLeaving(step);
    setLine(nextLine);
    setScreen("checkin");
    setTimeout(() => setLeaving(null), 300);
  }

  // A plan saved from the first card may still be on its way; its draft step stands for the saved one.
  async function realStep(step: Step): Promise<Step | null> {
    if (!step.id.startsWith("draft-")) return step;
    const saved = await starting.current;
    return saved?.steps[Number(step.id.slice(6))] ?? null;
  }

  function failStart(res: { state: string }, before: Goal | null, back: Screen) {
    if (res.state === "signed-out") return showSignedOut();
    changeGoal(before);
    setTimer(null);
    setScreen(back);
    setLine(SAVE_FAIL);
  }

  // The stopwatch runs at the tap, with a calm line under the card and nothing said.
  function enterFocus() {
    setOptions([]);
    setOfferKeys([]);
    setDraft(null);
    setSources(null);
    setCelebrate(false);
    setScreen("focus");
    quiet(FOCUS.calm);
  }

  // The card's Start: an existing step starts; a new plan is saved and started in one request.
  function startPick(card: FirstPick) {
    const before = goal;
    const minutes = card.steps[0].minutes;
    moved.current = true;
    voice.stop();
    setTimer(minutes);
    if (card.stepId) {
      const stepId = card.stepId;
      if (goal?.steps.some((step) => step.id === stepId)) changeGoal(withStatus(goal, stepId, "doing", new Date()));
      enterFocus();
      starting.current = patchStep(stepId, "doing").then((res) => {
        if (res.state === "ok") changeGoal(res.goal);
        else failStart(res, before, "ready");
        return res.state === "ok" ? res.goal : null;
      });
      return;
    }
    changeGoal(draftGoal(card, new Date()));
    enterFocus();
    starting.current = savePick(card, before);
  }

  // POST /api/goal; a due date that passed since the card was shown gets the fresh card instead.
  async function savePick(card: FirstPick, before: Goal | null) {
    const res = await post<GoalResponse>("/api/goal", { title: card.goal, due: card.due, steps: card.steps, start: true });
    if (res.state === "ok") {
      changeGoal(res.goal);
      return res.goal;
    }
    if (res.state === "bad-request") {
      changeGoal(before);
      setTimer(null);
      await refreshOpening();
      return null;
    }
    failStart(res, before, "ready");
    return null;
  }

  // A fresh first card: today's quick line at once, then the model's opening and pick, said aloud, unless the person
  // moved on meanwhile.
  async function refreshOpening() {
    moved.current = false;
    setScreen("ready");
    setLine(cache.current?.day.opening ?? line);
    setOptions(quickReplies(cache.current?.day.options));
    setPick(null);
    const sig = daySig();
    const res = await fetchOpening(account());
    if (res.state !== "ok" || moved.current) return;
    const card = pickFits(res.pick, latest.current.goal) ? res.pick : null;
    keepOpening(res.opening, quickReplies(res.options), card, sig);
    setLine(res.opening);
    setOptions(quickReplies(res.options));
    setPick(card);
    speakLine(res.opening);
  }

  async function finishStep(step: Step) {
    setStamping(true);
    setBusy(true);
    const real = await realStep(step);
    const [res] = await Promise.all([real ? patchStep(real.id, "done") : Promise.resolve({ state: "error" as const }), wait(400)]);
    setBusy(false);
    if (res.state !== "ok") {
      setStamping(false);
      if (res.state === "signed-out") return showSignedOut();
      setLine(SAVE_FAIL);
      return;
    }
    changeGoal(res.goal);
    changePick(null);
    if (res.progress) changeProgress(res.progress);
    setTimer(null);
    setSources(null);
    setDraft(null);
    setOptions([]);
    setCelebrate(Boolean(res.progress));
    // The stamp, then what is next, with Keep going.
    const said = doneLine(res.goal);
    fileAway(step, said);
    speakLine(spoken(said));
  }

  async function startStep(step: Step) {
    const before = goal;
    const back = screen ?? "ready";
    setTimer(null);
    if (goal) changeGoal(withStatus(goal, step.id, "doing", new Date()));
    enterFocus();
    const real = await realStep(step);
    if (!real) return failStart({ state: "error" }, before, back);
    const res = await patchStep(real.id, "doing");
    if (res.state === "ok") changeGoal(res.goal);
    else failStart(res, before, back);
  }

  // Words a chip says for the person; onUserTurn sees the flag.
  function tap(text: string) {
    tapped.current = true;
    void voice.submit(text);
  }

  // "Stop for now" and "That's enough today": the step stays open, so the next opening brings it back. A plan with an
  // hour or more left gets one block tomorrow offered (Vi, Nov 2); its button shows only once free time answers, so
  // nothing moves under a tap.
  function stopForNow() {
    voice.stop();
    setTyping(false);
    setOptions([]);
    setDraft(null);
    setCelebrate(false);
    setTimer(null);
    setSources(null);
    setScreen("wrap");
    setLine(WRAP_LINE);
    speakLine(WRAP_LINE);
    const plan = isDraft(goal) ? null : goal;
    const minutes = day?.calendarWrite === "ok" ? laterMinutes(plan) : 0;
    const first = openSteps(plan)[0];
    if (!plan || !minutes || !first) return setOfferKeys([]);
    // Its own key, and an earlier unbooked one goes, so no old offer stands in while free time loads (a booked one
    // means the step is scheduled, so this is never reached).
    const key = `later:${first.id}`;
    setBookings((all) => Object.fromEntries(Object.entries(all).filter(([one]) => one !== key)));
    setOfferKeys([key]);
    const free = post<FreeResponse>("/api/calendar/free", { minutes, days: 2 });
    void Promise.race([free, wait(5000).then(() => ({ state: "error" as const }))]).then((res) => {
      if (res.state === "signed-out") return showSignedOut();
      if (latest.current.screen !== "wrap") return;
      const block = res.state === "ok" ? laterBlock(plan, minutes, res.slots, zone()) : null;
      if (block) offer(key, [block], offerLabel(block));
      else setOfferKeys([]);
    });
  }

  // Back to my day, No thanks, or done with a draft: the home card holds the saved place, with its Start, never a
  // vague "Let's start" or no button at all (live, Nov 2); a finished plan gets a fresh pick, as Pick the next thing does.
  function goHome(said = "Nice work today.") {
    setOfferKeys([]);
    setDraft(null);
    setTyping(false);
    const card = stepCard(goal);
    if (!card) return void refreshOpening();
    setOptions([]);
    changePick(card);
    setLine(said);
    setScreen("ready");
  }

  function talk() {
    if (!voice.supported) {
      setNote(VOICE_NOTE.unsupported);
      setTyping(true);
    } else if (voice.phase === "idle") {
      talking.current = true;
      setTyping(false);
      setHear(false);
      voice.start();
    } else if (voice.phase === "speaking") {
      talking.current = true;
      voice.interrupt();
    } else if (!voice.finish()) {
      // Done talking sends what was heard (hands-free carries on); with nothing heard, tapping stop ends hands-free.
      talking.current = false;
      voice.stop();
    }
  }

  // Hands-free: any tap that isn't an answer or Talk itself is done talking, like Talk: words heard go at once; with none
  // it stops listening (and hands-free with it).
  const { stop: stopVoice, finish: finishVoice } = voice;
  useEffect(() => {
    if (voice.phase !== "listening") return;
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-answer], [data-talk]")) return;
      if (finishVoice()) return;
      talking.current = false;
      stopVoice();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [voice.phase, stopVoice, finishVoice]);

  // ---------- Calendar ----------
  function offer(key: string, blocks: CalendarBlock[], label: string) {
    setBookings((all) => (all[key] && (all[key].state === "busy" || all[key].state === "booked") ? all : { ...all, [key]: { key, blocks, label, state: "offer" } }));
  }

  // A booked step carries its time (and event) on the card at once; an undone one loses it.
  function linkSteps(blocks: CalendarBlock[], booked: boolean) {
    const current = latest.current.goal;
    if (!current) return;
    const byStep = new Map(blocks.filter((block) => block.stepId).map((block) => [block.stepId, block]));
    if (byStep.size === 0) return;
    changeGoal({
      ...current,
      steps: current.steps.map((step) => {
        const block = byStep.get(step.id);
        return block ? { ...step, scheduledAt: booked ? block.start ?? null : null, eventId: booked ? block.eventId ?? null : null } : step;
      }),
    });
  }

  async function book(key: string) {
    const entry = bookings[key];
    if (!entry || booking.current.has(key) || entry.state === "busy" || entry.state === "booked") return;
    booking.current.add(key);
    setBookings((all) => ({ ...all, [key]: { ...entry, state: "busy" } }));
    const res = await post<BookResponse>("/api/calendar/book", { blocks: entry.blocks });
    booking.current.delete(key);
    if (res.state === "signed-out") return showSignedOut();
    if (res.state !== "ok" || !Array.isArray(res.booked) || res.booked.length === 0) {
      setBookings((all) => ({ ...all, [key]: { ...entry, state: "failed" } }));
      if (res.state === "needs-permission" && cache.current) {
        store({ day: { ...cache.current.day, calendarWrite: "needs-permission" } });
        // The day on screen, not the stored copy, which has no emails or Gmail link.
        setDay((shown) => shown && { ...shown, calendarWrite: "needs-permission" });
      }
      return;
    }
    // Only what Google confirmed counts as booked.
    setBookings((all) => ({ ...all, [key]: { ...entry, blocks: res.booked, state: "booked" } }));
    linkSteps(res.booked, true);
    const said = res.booked[0].start && isTomorrow(res.booked[0].start, zone()) ? "Booked. Tomorrow's streak is planned." : "Booked. It's on your calendar.";
    if (latest.current.screen === "wrap") {
      setLine(said);
      speakLine(said);
    } else if (offerKeys.includes(key) && options === replied.current) {
      // Booking a turn's offer answers its question, so the quick replies that came with it go (a newer question's
      // stay), and so does the question itself.
      setOptions((shown) => (shown === options ? [] : shown));
      setLine(said);
      bookedLine.current = key;
    }
  }

  async function unbook(key: string) {
    const entry = bookings[key];
    if (!entry || entry.state !== "booked" || booking.current.has(key)) return;
    booking.current.add(key);
    const ids = entry.blocks.flatMap((block) => (block.eventId ? [block.eventId] : []));
    const results = await Promise.all(ids.map((id) => getJson<BookResponse>(`/api/calendar/book/${encodeURIComponent(id)}`, { method: "DELETE" })));
    booking.current.delete(key);
    if (results.some((res) => res.state === "signed-out")) return showSignedOut();
    if (results.some((res) => res.state !== "ok")) {
      setNote("I couldn't undo that just now. Try again?");
      return;
    }
    setBookings((all) => ({ ...all, [key]: { ...entry, blocks: entry.blocks.map((block) => ({ ...block, eventId: undefined })), state: "offer" } }));
    linkSteps(entry.blocks, false);
    // The offer is back, so the line no longer says Booked.
    if (latest.current.screen === "wrap") setLine(WRAP_LINE);
    else if (bookedLine.current === key) setLine("Okay, it's off your calendar.");
  }

  // ---------- Focus: one quiet check-in and a welcome back; heads-ups ----------
  const focusStep = screen === "focus" ? openSteps(goal)[0] ?? null : null;
  const focusMinutes = timer ?? focusStep?.minutes ?? null;
  const moment = focusMinutes ? checkinMinute(focusMinutes, day?.pace) : null;
  // A quiet line never covers a question and its answers, a draft, the person talking, or Zeno's answer to them in Focus
  // (the tip after Stuck? stays while they use it).
  const hush = useEffectEvent((text: string) => {
    if (latest.current.screen !== "focus" || options.length > 0 || draft || voice.phase === "listening" || voice.phase === "thinking") return;
    if (line && line === answered.current) return;
    quiet(text);
  });
  // The check-in's minute is over: the calm line again, if the check-in is still what shows.
  const unhush = useEffectEvent((text: string) => {
    if (line === text && quietLine === text) quiet(FOCUS.calm);
  });
  useEffect(() => {
    if (!focusStep?.startedAt || !moment) return;
    const at = Date.parse(focusStep.startedAt) + moment * 60_000;
    // One moment per step, shown for its minute and never late (a laptop asleep through it); after it the clock just
    // keeps counting, however long the step runs.
    if (!(at > Date.now())) return;
    const checkin = FOCUS.checkin(moment);
    const show = setTimeout(() => {
      if (Date.now() < at + 60_000) hush(checkin);
    }, at - Date.now());
    const hide = setTimeout(() => unhush(checkin), at + 60_000 - Date.now());
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [focusStep?.id, focusStep?.startedAt, moment]);
  // Page Visibility only (no permission, no idle detection): back after a minute or more away, the card says how long
  // this step has run.
  const welcomeBack = useEffectEvent(() => {
    if (focusStep?.startedAt && !Number.isNaN(Date.parse(focusStep.startedAt))) hush(FOCUS.back(focusStep.startedAt, Date.now()));
  });
  const focusing = screen === "focus";
  useEffect(() => {
    if (!focusing) return;
    let hiddenAt = NaN;
    const onChange = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (Date.now() - hiddenAt >= 60_000) welcomeBack();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [focusing]);

  // A heads-up before an event is only spoken (Vi, Nov 2): once, never over the person talking, nothing when muted. In
  // Focus nothing is said (Vi, Nov 3: "I don't want any alarm"), so there it is a quiet line, with the time, which stays true.
  const headsUp = useEffectEvent(() => {
    const keyOf = (event: { title: string; start: string }) => `${event.title}@${event.start}`;
    const soon = soonEvent((day?.events ?? []).filter((event) => !warned.current.has(keyOf(event))), Date.now());
    if (!soon) return;
    warned.current.add(keyOf(soon));
    const minutes = Math.max(1, Math.round((Date.parse(soon.start) - Date.now()) / 60_000));
    if (screen === "focus") hush(`Heads up, ${soon.title} at ${formatTime(soon.start, zone())}.`);
    else if (voice.phase === "idle" || voice.phase === "speaking") speakLine(`Heads up, ${soon.title} in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`);
  });
  const watching = screen !== null && screen !== "signed-out" && screen !== "setup";
  useEffect(() => {
    if (!watching) return;
    const first = setTimeout(headsUp, 2000);
    const every = setInterval(headsUp, 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [watching]);

  // ---------- First sign-in ----------
  // Pasted notes become memories (POST /api/import only saves since Nov 2); the first card's opening waits for them.
  function savePaste(text: string) {
    saves.current.push(
      post<ImportResponse>("/api/import", { text }).then((res) => {
        if (res.state === "signed-out") return showSignedOut();
        if (res.state === "ok") keep(res.private);
        else setNote("I couldn't save your notes just now. You can add them in Memory.");
      }),
    );
    nextOpening.current = null;
    finishSetup();
  }

  function finishSetup() {
    store({ setupDone: true });
    moved.current = false;
    setPasting(false);
    setOfferKeys([]);
    setScreen("ready");
    setLine(day?.opening || greeting(new Date().getHours(), day?.firstName ?? null));
    setOptions(quickReplies(day?.options));
    setPick(null);
    setWantOpening((n) => n + 1);
  }

  // ---------- Memory ----------
  function openSheet(next: Sheet) {
    setSheet(next);
    setNote(null);
    if (next === "memory") {
      const mine = account();
      setDevice(mine ? readVault(mine) : []);
      void loadMemories();
    }
  }

  async function loadMemories() {
    setMemories((list) => (Array.isArray(list) ? list : "loading"));
    const res = await getJson<MemoryResponse>("/api/memory");
    if (res.state === "signed-out") return showSignedOut();
    setMemories(res.state === "ok" ? res.memories : "error");
  }

  // DELETE /api/memory/[id]; says so when it fails. Returns whether it is gone.
  async function forgetMemory(id: string) {
    const before = memories;
    setNote(null);
    setMemories((list) => (Array.isArray(list) ? list.filter((m) => m.id !== id) : list));
    const res = await getJson<{ state: string }>(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.state === "signed-out") {
      showSignedOut();
      return false;
    }
    if (res.state !== "ok") {
      setMemories(before);
      setNote("I couldn't forget that just now. Try again?");
      return false;
    }
    return true;
  }

  function forget(fact: Fact) {
    expireOpening();
    if (!fact.device) return void forgetMemory(fact.id);
    const mine = account();
    if (!mine) return;
    removeFromVault(mine, fact.id);
    setDevice(readVault(mine));
  }

  // One line is one memory, notes are read like pasted notes. The routes sort them: a private fact comes back in
  // `private`, unsaved, for this device; a never-list one is "not-kept". Returns false when the save failed and trying
  // again could work, so the box gives the text back.
  async function addMemory(text: string): Promise<boolean> {
    const notes = isNotes(text);
    setNote(notes ? "Reading your notes…" : null);
    const res = notes ? await post<ImportResponse>("/api/import", { text }) : await post<SaveMemoryResponse>("/api/memory", { text });
    if (res.state === "signed-out") showSignedOut();
    else if (res.state === "not-kept") setNote("Zeno never keeps that kind of thing, so it isn't saved.");
    else if (res.state !== "ok" || !Array.isArray(res.memories)) {
      setNote(SAVE_FAIL);
      return false;
    } else {
      expireOpening();
      setNote(null);
      setMemories(res.memories);
      const mine = account();
      if (mine && keep(res.private).length > 0) setDevice(readVault(mine));
    }
    return true;
  }

  // ---------- Canvas ----------
  // Linked or unlinked in its sheet: the day (its deadlines) is read again, and the home card re-plans at once after a
  // Disconnect or a Connect that found work due.
  async function canvasSynced(assignments: CanvasAssignment[]) {
    const mine = account();
    if (!mine) return;
    const linked = Boolean(readCanvas(mine));
    setCanvasOn(linked);
    nextOpening.current = null;
    const data = await getJson<DayResponse>("/api/day");
    if (data.state === "signed-out") return showSignedOut();
    takeDay(data);
    if (replanOnCanvas(latest.current.screen, linked, assignments)) await refreshOpening();
  }

  // ---------- The screen's answers ----------
  const name = day?.firstName ?? saved?.day.firstName;
  const setupLine = scanning ? READING_LINE : pasting ? PASTE_LINE : foundLine(learned);
  const offers = offerKeys.flatMap((key) => (bookings[key] ? [bookings[key]] : []));
  const step = openSteps(goal)[0];
  // The assignment in this device's Canvas list that the focus plan is for, offered as a link; nothing opens on its own.
  const canvasUrl = focusStep && daySet ? httpsOnly(canvasFor(goal, canvasList(daySet.account) ?? [])?.url) : undefined;

  // Every screen has one big button (the first answer) and small links for the rest (Vi, Nov 2).
  function screenAnswers(): Answer[] {
    const say = (label: string, run: () => void): Answer => ({ label, run });
    const replies = options.map((option) => say(option, () => tap(option)));
    // "Something else": talk if this browser can listen, otherwise type.
    const other = say("Something else", () => (voice.supported ? talk() : setTyping(true)));
    if (screen === "signed-out") return [say("Sign in with Google", () => void signIn("google", { redirectTo: "/" }))];
    if (screen === "setup") {
      if (scanning) return [];
      if (pasting) return [say("Skip", finishSetup)];
      return [say("Start my day", finishSetup), say("Paste notes", () => setPasting(true)), say("See what I learned", () => openSheet("memory"))];
    }
    if (draft) {
      return [
        say("Open in Gmail", () => {
          window.open(draft.url, "_blank", "noopener,noreferrer");
          goHome("Your draft is open in Gmail.");
        }),
        say("Not now", () => goHome("Okay, not now.")),
      ];
    }
    if (screen === "ready") {
      // A saved card paints at once, but its answers wait for /api/day.
      if (!fresh) return [];
      if (pick) return [say(`Start · ${pick.steps[0].minutes} min`, () => startPick(pick)), other];
      return options.length ? [...replies, other] : [say("Let's start", () => tap("Let's start."))];
    }
    if (screen === "talk") {
      // An offer with no replies left beside it (they went with a booking that was then undone) still has a way home.
      if (options.length) return [...replies, other];
      if (offers.some((one) => one.state !== "booked")) return [say("No thanks", () => goHome()), other];
      // A booked offer answered Zeno's question, so one way home (live, Nov 2: it was a dead end); a plain question
      // still waits for Talk or Type.
      return offers.length ? [say("Back to my day", () => goHome())] : [];
    }
    if (screen === "focus" && step) {
      const done = say("Done", () => void finishStep(step));
      const stop = say("Stop for now", stopForNow);
      // A question Zeno asked during focus leads with its answers; Done stays one tap away.
      if (options.length) return [...replies, done, stop];
      const extra = isEmailStep(step.title)
        ? [say("Draft it in Gmail", () => tap(`Draft the email for: ${step.title}`))]
        : sources || isDraft(goal)
          ? []
          : [say("Sources", () => setSources({ canvas: canvasFor(goal, canvasBriefs(account() ?? "")) }))];
      return [done, say("Stuck?", () => tap(`I'm stuck on: ${step.title}.`)), stop, ...extra];
    }
    if (screen === "checkin") {
      const next = step ? say("Keep going", () => void startStep(step)) : say("Pick the next thing", () => void refreshOpening());
      return [next, say("That's enough today", stopForNow)];
    }
    if (screen === "wrap") {
      // While free time is asked for, nothing shows, so no button changes under a tap.
      const wrapOffer = offerKeys.length ? bookings[offerKeys[0]] : undefined;
      if (offerKeys.length && !wrapOffer) return [];
      return [say(wrapOffer && wrapOffer.state !== "booked" ? "No thanks" : "Back to my day", () => goHome())];
    }
    return [];
  }
  // Render reads only the labels: the runs touch refs, but only chip() calls them, on a tap, which the rule can't tell.
  // eslint-disable-next-line react-hooks/refs
  const answers = screenAnswers();

  function chip(i: number) {
    if (performance.now() - cardAt.current < 400) return;
    answers[i]?.run();
  }

  return (
    <DayView
      screen={screen}
      line={screen === "setup" ? setupLine : line}
      you={voice.phase === "listening" ? voice.partial : heard}
      goal={goal}
      today={
        day && { events: day.events, emails: day.emails, unreadEmail: day.unreadEmail, sources: day.sources, free: day.free, deadlines: day.deadlines, mailUrl: day.mailUrl }
      }
      memories={memories}
      sheet={sheet}
      typing={typing && screen !== "setup"}
      stamping={stamping}
      leaving={leaving}
      note={voice.error ? VOICE_NOTE[voice.error] : note}
      signInFailed={signInFailed}
      busy={busy || voice.phase === "thinking"}
      chips={answers.map((one) => one.label)}
      pasting={screen === "setup" && pasting}
      hear={hear && screen === "ready"}
      progress={progress}
      pick={pick}
      celebrate={celebrate}
      bookings={bookings}
      offers={offers}
      timer={timer}
      quiet={line === quietLine}
      canvasUrl={canvasUrl}
      sources={sources !== null}
      brief={sources?.canvas}
      device={device}
      account={screen && screen !== "signed-out" ? (name?.trim()[0]?.toUpperCase() ?? "") : null}
      canvas={daySet ? { account: daySet.account, linked: canvasOn } : null}
      calendarAsk={day?.calendarWrite === "needs-permission"}
      voice={voice}
      on={{
        chip,
        hear() {
          setHear(false);
          void voice.speak(line);
        },
        paste: savePaste,
        talk,
        type() {
          // Typing ends hands-free, so the mic never opens over the box.
          talking.current = false;
          if (voice.phase === "listening") voice.stop();
          setTyping(true);
        },
        closeTyping: () => setTyping(false),
        send: (text) => void voice.submit(text),
        sheet: openSheet,
        forget,
        add: addMemory,
        retryMemory: () => void loadMemories(),
        book: (key) => void book(key),
        unbook: (key) => void unbook(key),
        mute: () => voice.setMuted(!voice.muted),
        signIn() {
          // The chooser may pick another account, so this one's day must not paint for it.
          writeSaved(null);
          cache.current = null;
          void signIn("google", { redirectTo: "/" });
        },
        signOut() {
          // The next person at a shared computer must not read anyone's private facts or Canvas link, even before
          // /api/day said whose browser this is (keys as in src/lib/vault.ts and src/lib/canvas-store.ts).
          try {
            for (const key of Object.keys(localStorage)) if (/^zeno\.(vault|canvas)\./.test(key)) localStorage.removeItem(key);
          } catch {
            // Unreadable storage holds nothing to clear.
          }
          writeSaved(null);
          cache.current = null;
          void signOut({ redirectTo: "/" });
        },
        canvasSynced: (assignments) => void canvasSynced(assignments),
      }}
    />
  );
}
