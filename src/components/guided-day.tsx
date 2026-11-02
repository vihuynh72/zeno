"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { signIn, signOut } from "next-auth/react";
import type {
  BookResponse,
  CalendarBlock,
  DayResponse,
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
import { listenAuto, type ListenHandlers } from "@/lib/listen";
import { audioContext } from "@/lib/speak";
import { formatTime, localDate } from "@/lib/tz";
import { useVoice } from "@/lib/use-voice";
import { addToVault, clearVault, readVault, removeFromVault, vaultTexts, type VaultFact } from "@/lib/vault";
import {
  asks,
  CHECKINS,
  dayPart,
  doneLine,
  draftGoal,
  greeting,
  isDraft,
  isTomorrow,
  laterBlock,
  nextScreen,
  openSteps,
  pickFits,
  planBlocks,
  quickReplies,
  SETUP,
  slotLabel,
  soonEvent,
  withStatus,
  type Fact,
  type Screen,
} from "@/components/day-flow";
import type { Booking } from "@/components/booking-chip";
import DayView, { type Chip, type Sheet } from "@/components/day-view";
import type { Quiet } from "@/components/noted-line";

const SIGNED_OUT_LINE = "Zeno helps you start the thing you keep putting off.";
const THINK_FAIL = "I couldn't think that through just now. Try again?";
const SAVE_FAIL = "I couldn't save that just now. Try again?";
const VOICE_NOTE = {
  blocked: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  unsupported: "Voice isn't available in this browser, so typing works for now.",
  network: "Voice couldn't connect just now, so typing works for now.",
};

type Day = Extract<DayResponse, { state: "ok" }>;
type Opening = { text: string; options: string[]; pick: FirstPick | null };
// What the last visit left in this browser, kept current after every action; the model's opening is for `part` only.
// It paints before /api/day says whose browser this is, its chips wait for that answer, and its opening and setup
// state carry over only when day.account matches.
// shortcut: first paint trusts it, so a day written as the account switched (an /api/day already in flight, or a switch
// outside this page's Sign in / Sign out) shows until /api/day answers; check a readable cookie set at sign-in to close that.
type Saved = { v: 3; part: string; day: Day; opening: Opening | null; setupDone: boolean };

const SAVED_KEY = "zeno:day";
const CHECKINS_KEY = "zeno:checkins";
const scannedKey = (account: string) => `zeno:scanned:${account}`;
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

// Per-viewer conveniences (check-ins muted, today's scan done); blocked storage just means the defaults.
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
let boot: { part: string; hour: number; saved: Saved | null; checkins: boolean } | undefined;
const readBoot = () =>
  (boot ??= { part: dayPart(new Date()), hour: new Date().getHours(), saved: readSaved(), checkins: readLocal(CHECKINS_KEY) !== "off" });

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

// The device's private facts ride in the body (never the URL) and only for the account they belong to.
const fetchOpening = (account: string | null) => post<OpeningResponse>("/api/day/opening", { private: account ? vaultTexts(account) : [] });

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
const asFact = (memory: Memory): Fact => ({ id: memory.id, text: memory.text, group: memory.group, device: false });
const asDeviceFact = (fact: VaultFact): Fact => ({ id: fact.id, text: fact.text, group: fact.group, device: true });

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
  const [checkinsSet, setCheckins] = useState<boolean | null>(null);
  // Setup waits for /api/day to say the person is still new, so a tap on a saved setup card is never undone.
  const screen = screenSet ?? (saved && (!saved.day.isNew || saved.setupDone) ? "ready" : null);
  const line =
    lineSet ?? (same ? same.opening?.text ?? same.day.opening : booted ? greeting(booted.hour, saved?.day.firstName ?? null) : "");
  const options = optionsSet ?? (same ? quickReplies(same.opening?.options ?? same.day.options) : []);
  const day = daySet ?? same?.day ?? null;
  const goal = goalSet === undefined ? saved?.day.goal ?? null : goalSet;
  const pick = pickSet === undefined ? (same && pickFits(same.opening?.pick, same.day.goal) ? same.opening?.pick ?? null : null) : pickSet;
  const progress = progressSet ?? day?.progress ?? null;
  const checkinsOn = checkinsSet ?? booted?.checkins ?? true;

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
  const [quiet, setQuiet] = useState<Quiet[]>([]);
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [offerKeys, setOfferKeys] = useState<string[]>([]);
  const [setupAt, setSetupAt] = useState(0);
  const [pasting, setPasting] = useState(false);
  const [learned, setLearned] = useState<Memory[]>([]);
  const [setupDevice, setSetupDevice] = useState<VaultFact[]>([]);
  const [scanning, setScanning] = useState(false);
  const [unsaved, setUnsaved] = useState(0); // setup answers and pasted notes that failed to save
  const [reading, setReading] = useState(0);
  const history = useRef<Turn[]>([]);
  const cache = useRef<Saved | null>(null);
  const tapped = useRef(false); // the turn in flight came from a chip, not the type box
  const moved = useRef(false); // the person has taken a turn since the opening was shown
  const spoke = useRef(false); // the opening has been said (or offered with Hear Zeno)
  const talking = useRef(false); // hands-free: the person tapped Talk, so Zeno listens after each question it says
  const nextOpening = useRef<Promise<OpeningResponse | { state: "error" }> | null>(null);
  const saves = useRef<Promise<unknown>[]>([]); // setup answers and pasted notes still being saved
  const starting = useRef<Promise<Goal | null> | null>(null); // a plan from the first card still being saved
  const booking = useRef(new Set<string>()); // booking chips with a request in flight, so a double tap books once
  const slotsAsked = useRef(""); // the plan whose free time was asked for
  const warned = useRef(new Set<string>()); // events already given a heads-up
  const cardAt = useRef(0); // when the card last changed, so the second tap of a double tap can't answer the next one
  useEffect(() => {
    cardAt.current = performance.now();
  }, [screen, setupAt, pasting]);
  // The voice hook calls onUserTurn later, so it reads the screen, goal and phase from here, not a stale render.
  const latest = useRef({ screen, goal, line, progress });
  useEffect(() => {
    latest.current = { screen, goal, line, progress };
  });

  // Auth.js sends failed sign-ins back to "/?error=...".
  const signInFailed = useSyncExternalStore(noStore, () => new URLSearchParams(window.location.search).has("error"), () => false);

  const voice = useVoice(
    { onUserTurn, listenAfter: (said) => talking.current && asks(said) },
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

  // ---------- Quiet lines: Noted, Kept on this device, heads-ups ----------
  function sayQuiet(entry: Quiet) {
    setQuiet((list) => [...list.filter((one) => one.key !== entry.key), entry].slice(-3));
  }
  const dropQuiet = (key: string) => setQuiet((list) => list.filter((one) => one.key !== key));

  function noted(memory: { id: string; text: string }) {
    const key = `m:${memory.id}`;
    sayQuiet({
      key,
      text: `Noted: ${memory.text}`,
      undo() {
        dropQuiet(key);
        void forgetMemory(memory.id);
      },
    });
  }

  // Private facts go to this device only (never to /api/memory); returns the ones newly kept.
  function keep(facts: PrivateFact[] | undefined, say = true): VaultFact[] {
    const mine = account();
    if (!mine || !Array.isArray(facts) || facts.length === 0) return [];
    const added = addToVault(mine, facts);
    if (say) {
      for (const fact of added) {
        const key = `v:${fact.id}`;
        sayQuiet({
          key,
          text: `Kept on this device: ${fact.text}`,
          undo() {
            dropQuiet(key);
            removeFromVault(mine, fact.id);
            setDevice(readVault(mine));
          },
        });
      }
    }
    return added;
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
    // Email snippets stay out of storage; nothing on screen shows them.
    cache.current = { v: 3, part: booted?.part ?? "", day: { ...data, emails: [] }, opening: kept, setupDone: prior?.setupDone ?? false };
    writeSaved(cache.current);
    setDay(data);
    if (!prior) setPick(null);
    else if (!moved.current) setPick(pickFits(kept?.pick, data.goal) ? kept?.pick ?? null : null);
    if (moved.current) return false;
    setGoal(data.goal);
    if (data.isNew === true && !prior?.setupDone) {
      setScreen("setup");
      startScan(data.account);
      return false;
    }
    setScreen("ready");
    // A saved model line for this part of the day stays until the new one lands; otherwise the quick line shows now.
    if (!kept) {
      setLine(data.opening);
      setOptions(quickReplies(data.options));
    }
    // The first open of the day (not the first run) re-reads calendar and email quietly; new facts show as Noted lines.
    const today = localDate(zone());
    if (readLocal(scannedKey(data.account)) !== today) {
      writeLocal(scannedKey(data.account), today);
      setTimeout(() => {
        void post<ProfileResponse>("/api/profile/scan", { private: vaultTexts(data.account) }).then((res) => {
          if (res.state !== "ok") return;
          for (const memory of res.learned ?? []) noted(memory);
          keep(res.private);
        });
      }, 1500);
    }
    return true;
  });

  // Swaps the model's line and pick in (unless the person moved on or Zeno is mid-sentence) and says it once.
  const onOpening = useEffectEvent((res: OpeningResponse | { state: "error" }, allowed: boolean) => {
    const ok = res.state === "ok" && typeof res.opening === "string" && res.opening.trim() !== "";
    // Without a new model line, a saved one (maybe hours old) is dropped, never said: today's rule line stands in.
    if (!ok) store({ opening: null });
    if (moved.current || latest.current.screen !== "ready" || voice.phase !== "idle" || typing) return;
    // cache.current.day is this load's /api/day, even before the render that sets `day`.
    const text = ok ? res.opening.trim() : (cache.current?.day.opening ?? line);
    const next = quickReplies(ok ? res.options : cache.current?.day.options);
    const card = ok && pickFits(res.pick, latest.current.goal) ? res.pick : null;
    if (ok) store({ opening: { text, options: next, pick: card } });
    setLine(text);
    setOptions(next);
    setPick(card);
    if (spoke.current || voice.muted) return;
    spoke.current = true;
    if (allowed) void voice.speak(text);
    else setHear(true);
  });

  useEffect(() => {
    let live = true;
    const { saved } = readBoot();
    const allowed = audioAllowed();
    // Someone who was here before gets the model's opening asked for at once; anyone else once the day says who they are.
    const early = saved && (!saved.day.isNew || saved.setupDone) ? fetchOpening(saved.day.account) : null;
    void getJson<DayResponse>("/api/day").then(async (data) => {
      if (!live || !onDay(data)) return;
      // An opening asked for with another account's private facts is never shown.
      const mine = data.state === "ok" && early && saved?.day.account === data.account ? early : null;
      const [res, ok] = await Promise.all([mine ?? fetchOpening(data.state === "ok" ? data.account : null), allowed]);
      if (live) onOpening(res, ok);
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
    const opening = nextOpening.current ?? fetchOpening(cache.current?.day.account ?? null);
    void Promise.all([opening, audioAllowed()]).then(([res, ok]) => {
      if (live) onOpening(res, ok);
    });
    return () => {
      live = false;
    };
  }, [wantOpening]);

  function showSignedOut() {
    writeSaved(null);
    cache.current = null;
    voice.stop();
    talking.current = false;
    setTyping(false);
    setSheet(null);
    setHear(false);
    setPick(null);
    setQuiet([]);
    setLine(SIGNED_OUT_LINE);
    setScreen("signed-out");
  }

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
    // Answering the opening is picking one thing, so the card and the progress row move on at once.
    if (before.screen === "ready" || before.screen === "wrap") setScreen("talk");
    if (fromChip) setTyping(false);
    setHear(false);
    setNote(null);
    setLine("");
    setOptions([]);
    setOfferKeys([]);
    setCelebrate(false);
    setHeard(text);
    const mine = account();
    const res = await post<TalkResponse>("/api/talk", {
      message: text,
      history: history.current,
      // This page shows and books proposals.
      proposals: true,
      private: mine ? vaultTexts(mine) : [],
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
    keep(res.private);
    for (const action of res.actions ?? []) {
      if (action.type === "remembered" && action.memoryId) noted({ id: action.memoryId, text: action.label });
    }
    const proposal = Array.isArray(res.proposal) ? res.proposal : [];
    for (const block of proposal) offer(blockKey(block), [block], offerLabel(block));
    setOfferKeys(proposal.map(blockKey));
    if (res.progress) changeProgress(res.progress);
    const now = latest.current;
    const next = nextScreen(now.screen ?? "ready", res.actions ?? [], res.goal);
    const done = now.screen === "focus" && next === "checkin" ? openSteps(now.goal)[0] : undefined;
    if (next === "checkin") setCelebrate(Boolean(res.progress));
    if (next !== "focus") setTimer(null);
    if (done) {
      // Said "done" out loud: same stamp as the Done button, so the card and pills wait for it too.
      setStamping(true);
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        changeGoal(res.goal);
        fileAway(done, res.reply);
      }, 400);
    } else {
      changeGoal(res.goal);
      setLine(res.reply);
      setScreen(next);
    }
    setOptions(quickReplies(res.options));
    // The hook says the reply; hands-free listens again after a question.
    return res.reply;
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

  // The timer runs at the tap; Zeno's start line follows without waiting on the save.
  function enterFocus(minutes: number | null) {
    setOptions([]);
    setOfferKeys([]);
    setCelebrate(false);
    setScreen("focus");
    const said = CHECKINS.start(minutes ?? 0);
    setLine(minutes ? said : "");
    if (minutes && checkinsOn) speakLine(said);
  }

  // The first card's Start: an existing step starts; a new plan is saved and started in one request.
  function startPick(card: FirstPick) {
    const before = goal;
    const minutes = card.steps[0].minutes;
    moved.current = true;
    voice.stop();
    setTimer(minutes);
    if (card.stepId) {
      const stepId = card.stepId;
      if (goal?.steps.some((step) => step.id === stepId)) changeGoal(withStatus(goal, stepId, "doing", new Date()));
      enterFocus(minutes);
      starting.current = patchStep(stepId, "doing").then((res) => {
        if (res.state === "ok") changeGoal(res.goal);
        else failStart(res, before, "ready");
        return res.state === "ok" ? res.goal : null;
      });
      return;
    }
    changeGoal(draftGoal(card, true, new Date()));
    enterFocus(minutes);
    starting.current = savePick(card, true, before);
  }

  // POST /api/goal; a due date that passed since the card was shown gets the fresh card instead.
  async function savePick(card: FirstPick, start: boolean, before: Goal | null) {
    const res = await post<GoalResponse>("/api/goal", { title: card.goal, due: card.due, steps: card.steps, start });
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

  async function refreshOpening() {
    moved.current = false;
    setScreen("ready");
    setLine(cache.current?.day.opening ?? line);
    setPick(null);
    const res = await fetchOpening(account());
    if (res.state !== "ok") return;
    const card = pickFits(res.pick, latest.current.goal) ? res.pick : null;
    store({ opening: { text: res.opening, options: quickReplies(res.options), pick: card } });
    setLine(res.opening);
    setOptions(quickReplies(res.options));
    setPick(card);
  }

  // "See the plan": the steps at once; a new plan is saved behind them, so Start and booking use real steps.
  function seePlan(card: FirstPick) {
    moved.current = true;
    const said = `Here's the plan. The first step takes ${card.steps[0].minutes} minutes.`;
    setScreen("plan");
    setLine(said);
    setOptions([]);
    speakLine(said);
    if (card.stepId) return;
    const before = goal;
    changeGoal(draftGoal(card, false, new Date()));
    starting.current = savePick(card, false, before);
  }

  async function finishStep(step: Step) {
    setStamping(true);
    setBusy(true);
    const before = progress;
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
    if (res.learned) noted(res.learned);
    setTimer(null);
    setCelebrate(Boolean(res.progress));
    // The stamp, then straight to the next step's card: no question.
    const said = doneLine(before, res.progress, openSteps(res.goal).length > 0);
    fileAway(step, said);
    speakLine(said);
  }

  async function startStep(step: Step) {
    const before = goal;
    const back = screen ?? "plan";
    setTimer(null);
    if (goal) changeGoal(withStatus(goal, step.id, "doing", new Date()));
    enterFocus(step.minutes);
    const real = await realStep(step);
    if (!real) return failStart({ state: "error" }, before, back);
    const res = await patchStep(real.id, "doing");
    if (res.state === "ok") changeGoal(res.goal);
    else failStart(res, before, back);
  }

  // Words a chip or pill says for the person; onUserTurn sees the flag.
  function tap(text: string) {
    tapped.current = true;
    void voice.submit(text);
  }

  // A question from Zeno that wants an answer: said aloud, then listened for if the person is talking, else typed.
  function ask(question: string) {
    remember([{ role: "assistant", content: question }]);
    setNote(null);
    setOptions([]);
    setLine(question);
    if (!voice.muted) void voice.speak(question);
    if (!talking.current || !voice.supported || voice.muted) setTyping(true);
  }

  // "Stop for now": a short wrap-up, and the next step offered for tomorrow with one tap.
  function stopForNow() {
    voice.stop();
    setTyping(false);
    setOptions([]);
    setCelebrate(false);
    setTimer(null);
    setScreen("wrap");
    const next = isDraft(goal) ? undefined : openSteps(goal)[0];
    const write = day?.calendarWrite;
    if (!next || write === "no-access" || !write) {
      setOfferKeys([]);
      const said = "Good place to stop. See you tomorrow.";
      setLine(said);
      return speakLine(said);
    }
    if (bookings[next.id]?.state === "booked" || next.scheduledAt) {
      setOfferKeys([]);
      const said = "Good place to stop. The next step is already on your calendar.";
      setLine(said);
      return speakLine(said);
    }
    const said = `Good place to stop. Want me to put “${next.title}” on your calendar?`;
    setLine(said);
    speakLine(said);
    setOfferKeys([next.id]);
    if (write !== "ok") return;
    void post<FreeResponse>("/api/calendar/free", { minutes: next.minutes ?? 10, days: 2 }).then((res) => {
      if (res.state === "signed-out") return showSignedOut();
      const block = res.state === "ok" ? laterBlock(next, res.slots, zone()) : null;
      if (block) offer(next.id, [block], offerLabel(block));
      else setLine("Good place to stop. I couldn't find a free time for the next step, so it's on your plan for tomorrow.");
    });
  }

  function wrapDone() {
    setOfferKeys([]);
    setOptions([]);
    changePick(null);
    setLine("Nice work today.");
    setScreen("ready");
  }

  function primary() {
    if (performance.now() - cardAt.current < 400) return;
    const step = openSteps(goal)[0];
    if (screen === "signed-out") void signIn("google", { redirectTo: "/" });
    else if (screen === "plan" && step) void startStep(step);
    else if (screen === "focus" && step) void finishStep(step);
    else if (screen === "checkin" && step) void startStep(step);
    else if (screen === "checkin") {
      setScreen("talk");
      setCelebrate(false);
      ask("What's the next thing you want to start?");
    }
  }

  function secondary() {
    if (performance.now() - cardAt.current < 400) return;
    const step = openSteps(goal)[0];
    if (screen === "plan") ask("What should change?");
    else if (screen === "focus" && step) tap(`I'm stuck on: ${step.title}.`);
    else if (screen === "checkin") stopForNow();
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
    } else {
      // Tapping stop ends hands-free until the next Talk.
      talking.current = false;
      voice.stop();
    }
  }

  // Hands-free: any tap that isn't an answer or Talk itself stops listening (and hands-free with it).
  const stopVoice = voice.stop;
  useEffect(() => {
    if (voice.phase !== "listening") return;
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-answer], [data-talk]")) return;
      talking.current = false;
      stopVoice();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [voice.phase, stopVoice]);

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
        setDay({ ...cache.current.day, calendarWrite: "needs-permission" });
      }
      return;
    }
    // Only what Google confirmed counts as booked.
    setBookings((all) => ({ ...all, [key]: { ...entry, blocks: res.booked, state: "booked" } }));
    linkSteps(res.booked, true);
    if (key === "import") {
      sayQuiet({ key: "import", text: `Added ${res.booked.length} to your Zeno calendar.` });
      // A booked to-do lives on the calendar now, so its "To do:" memory is gone.
      void getJson<MemoryResponse>("/api/memory").then((list) => {
        if (list.state === "ok") setLearned(list.memories);
      });
    } else if (latest.current.screen === "wrap") {
      const said = res.booked[0].start && isTomorrow(res.booked[0].start, zone()) ? "Booked. Tomorrow's streak is planned." : "Booked. It's on your calendar.";
      setLine(said);
      speakLine(said);
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
    if (key === "import") dropQuiet("import");
  }

  // The plan's booking chips: free time for each step not yet booked, asked for once per plan.
  const loadSlots = useEffectEvent(() => {
    if (screen !== "plan" || !goal || isDraft(goal) || day?.calendarWrite !== "ok") return;
    const shown = openSteps(goal).slice(0, 4);
    const ask = `${goal.id}:${shown.map((step) => step.id).join(",")}`;
    if (shown.length === 0 || slotsAsked.current === ask) return;
    slotsAsked.current = ask;
    const minutes = Math.min(...shown.map((step) => step.minutes ?? 10));
    void post<FreeResponse>("/api/calendar/free", { minutes, days: 2 }).then((res) => {
      if (res.state !== "ok") return;
      for (const block of planBlocks(shown, res.slots)) offer(block.stepId ?? blockKey(block), [block], offerLabel(block));
    });
  });
  useEffect(() => {
    loadSlots();
  }, [screen, goal]);

  // ---------- Focus check-ins and heads-ups ----------
  const focusStep = screen === "focus" ? openSteps(goal)[0] ?? null : null;
  const focusMinutes = timer ?? focusStep?.minutes ?? null;
  const checkin = useEffectEvent((kind: "half" | "end") => {
    if (latest.current.screen !== "focus") return;
    const said = CHECKINS[kind];
    setLine(said);
    if (checkinsOn && voice.phase === "idle") speakLine(said);
  });
  useEffect(() => {
    if (!focusStep?.startedAt || !focusMinutes) return;
    const started = Date.parse(focusStep.startedAt);
    const timers = (["half", "end"] as const).flatMap((kind) => {
      const delay = started + focusMinutes * 60_000 * (kind === "half" ? 0.5 : 1) - Date.now();
      // A check-in that already passed (a reload mid-focus) is not said late.
      return delay > 0 ? [setTimeout(() => checkin(kind), delay)] : [];
    });
    return () => timers.forEach(clearTimeout);
  }, [focusStep?.id, focusStep?.startedAt, focusMinutes]);

  const headsUp = useEffectEvent(() => {
    const soon = soonEvent(day?.events ?? [], Date.now());
    if (!soon) return;
    const key = `${soon.title}@${soon.start}`;
    if (warned.current.has(key)) return;
    warned.current.add(key);
    const minutes = Math.max(1, Math.round((Date.parse(soon.start) - Date.now()) / 60_000));
    sayQuiet({ key: `w:${key}`, text: `Heads up: ${soon.title} at ${formatTime(soon.start, zone())}.` });
    // Said once, never over the person talking.
    if (voice.phase === "idle" || voice.phase === "speaking") speakLine(`Heads up, ${soon.title} in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`);
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

  // ---------- First-run setup ----------
  // The profile scan (4-10 s) runs while the person answers the cards; its facts join the summary.
  function startScan(mine: string) {
    writeLocal(scannedKey(mine), localDate(zone()));
    setScanning(true);
    void post<ProfileResponse>("/api/profile/scan", { first: true, private: vaultTexts(mine) }).then((res) => {
      setScanning(false);
      if (res.state === "signed-out") return showSignedOut();
      if (res.state !== "ok") return;
      const found = res.learned ?? [];
      setLearned((list) => [...list.filter((m) => !found.some((n) => n.id === m.id)), ...found]);
      const added = keep(res.private, false);
      setSetupDevice((list) => [...added, ...list]);
    });
  }

  function learn(res: SaveMemoryResponse | ImportResponse | { state: "error" }) {
    if (res.state === "signed-out") return showSignedOut();
    if (res.state !== "ok" || !Array.isArray(res.memories)) return setUnsaved((n) => n + 1);
    setLearned((list) => [...list.filter((m) => !res.memories.some((n) => n.id === m.id)), ...res.memories]);
  }

  function nextSetupCard() {
    setPasting(false);
    setSetupAt(setupAt + 1);
    // The opening waits for every answer and pasted note to be saved, so it can use what was just shared.
    if (setupAt + 1 === SETUP.length) {
      nextOpening.current = Promise.allSettled(saves.current).then(() => fetchOpening(account()));
    }
  }

  function answerSetup(i: number) {
    if (setupAt === SETUP.length) return finishSetup();
    if (setupAt === 0 && i === 1) return finishSetup();
    if (setupAt === SETUP.length - 1 && i === 0 && !pasting) return setPasting(true);
    const memory = pasting ? null : SETUP[setupAt].answers[i]?.[1];
    if (memory) saves.current.push(post<SaveMemoryResponse>("/api/memory", { text: memory }).then(learn));
    nextSetupCard();
  }

  function savePaste(text: string) {
    setReading((n) => n + 1);
    saves.current.push(
      post<ImportResponse>("/api/import", { text }).then((res) => {
        setReading((n) => n - 1);
        learn(res);
        if (res.state !== "ok") return;
        const added = keep(res.private, false);
        setSetupDevice((list) => [...added, ...list]);
        // Only offered when Zeno may write to its calendar; one tap books the whole batch.
        const proposal = Array.isArray(res.proposal) ? res.proposal : [];
        if (proposal.length > 0) {
          offer("import", proposal, `Add ${proposal.length === 1 ? "this" : `these ${proposal.length}`} to your calendar?`);
          setOfferKeys(["import"]);
        }
      }),
    );
    nextSetupCard();
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

  async function removeFact(fact: Fact) {
    const mine = account();
    if (fact.device) {
      if (mine) removeFromVault(mine, fact.id);
      setSetupDevice((list) => list.filter((one) => one.id !== fact.id));
      if (mine) setDevice(readVault(mine));
      return;
    }
    const before = learned;
    setLearned((list) => list.filter((m) => m.id !== fact.id));
    if (!(await forgetMemory(fact.id))) setLearned(before);
  }

  // ---------- Memory ----------
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
    if (!fact.device) return void forgetMemory(fact.id);
    const mine = account();
    if (!mine) return;
    removeFromVault(mine, fact.id);
    setDevice(readVault(mine));
  }

  async function addMemory(text: string) {
    setNote(null);
    const res = await post<SaveMemoryResponse>("/api/memory", { text });
    if (res.state === "signed-out") return showSignedOut();
    if (res.state === "ok" && Array.isArray(res.memories)) setMemories(res.memories);
    else setNote(SAVE_FAIL);
  }

  // ---------- Chips ----------
  const setupCard = SETUP[setupAt];
  const name = day?.firstName ?? saved?.day.firstName;
  const setupFacts = [...learned].sort((a, b) => Number(a.source === "you") - Number(b.source === "you"));
  const summary: Fact[] = [
    ...setupFacts.filter((m) => m.source !== "you").map(asFact),
    ...setupDevice.map(asDeviceFact),
    ...setupFacts.filter((m) => m.source === "you").map(asFact),
  ];
  const stillReading = [...(scanning ? ["Reading your calendar and email…"] : []), ...(reading ? ["Reading your notes…"] : [])];
  const setupLine =
    setupAt === 0
      ? `Hi${name ? ` ${name}` : ""}. ${setupCard.ask}`
      : setupCard
        ? setupCard.ask
        : summary.length || stillReading.length
          ? "Here's what I learned."
          : "All set. Tell me more anytime.";
  const setupNote = unsaved
    ? `I couldn't save ${unsaved} of your answers. Tell me again anytime.`
    : "Tap × to remove anything. You can change this anytime in Memory.";
  const startChip = (minutes: number) => `Start · ${minutes} min`;
  const chips: Chip[] =
    screen === "setup"
      ? !setupCard
        ? [{ label: "Start my day", tone: "ink" }]
        : pasting
          ? [{ label: "Skip", tone: "quiet" }]
          : setupCard.answers.map(([label], i) => ({
              label,
              tone: setupCard.answers.length === 2 ? (i === 0 ? "ink" : "quiet") : undefined,
            }))
      : screen === "ready"
        ? !fresh
          ? []
          : pick
            ? [{ label: startChip(pick.steps[0].minutes), tone: "ink" }, { label: "See the plan" }, { label: "Something else", tone: "quiet" }]
            : options.length
              ? [...options.map((label) => ({ label })), { label: "Something else", tone: "quiet" }]
              : [{ label: "Let's start", tone: "ink" }]
        : screen === "talk" && options.length
          ? [...options.map((label) => ({ label })), { label: "Something else", tone: "quiet" }]
          : screen === "wrap"
            ? offerKeys.length || day?.calendarWrite === "needs-permission"
              ? [{ label: "Not now", tone: "quiet" }]
              : []
            : (screen === "focus" || screen === "plan" || screen === "checkin") && options.length
              ? options.map((label) => ({ label }))
              : [];

  function chip(i: number) {
    if (performance.now() - cardAt.current < 400) return;
    if (screen === "setup") return answerSetup(pasting ? 1 : i);
    if (screen === "ready" && pick) {
      if (i === 0) return startPick(pick);
      if (i === 1) return seePlan(pick);
    } else if (screen === "wrap") {
      return wrapDone();
    } else if (options[i]) {
      return tap(options[i]);
    } else if (screen === "ready" && !options.length) {
      return tap("Let's start.");
    }
    // "Something else": talk if this browser can listen, otherwise type.
    if (voice.supported) talk();
    else setTyping(true);
  }

  const shownSteps = new Set(screen === "plan" ? openSteps(goal).slice(0, 4).map((step) => step.id) : []);
  const offers = offerKeys.flatMap((key) => {
    const entry = bookings[key];
    return entry && !shownSteps.has(entry.blocks[0]?.stepId ?? "") ? [entry] : [];
  });

  return (
    <DayView
      screen={screen}
      line={screen === "setup" ? setupLine : line}
      you={voice.phase === "listening" ? voice.partial : heard}
      goal={goal}
      today={day && { events: day.events, emails: day.emails, unreadEmail: day.unreadEmail, sources: day.sources }}
      memories={memories}
      sheet={sheet}
      typing={typing && screen !== "setup"}
      stamping={stamping}
      leaving={leaving}
      note={voice.error ? VOICE_NOTE[voice.error] : screen === "setup" && !setupCard ? setupNote : note}
      signInFailed={signInFailed}
      busy={busy || voice.phase === "thinking"}
      chips={chips}
      dots={screen === "setup" ? { at: setupAt, of: SETUP.length } : null}
      list={screen === "setup" && !setupCard ? summary : null}
      reading={screen === "setup" && !setupCard ? stillReading : []}
      pasting={screen === "setup" && pasting}
      hear={hear && screen === "ready"}
      progress={progress}
      pick={pick}
      celebrate={celebrate}
      quiet={screen === "setup" ? quiet.filter((one) => one.key === "import") : quiet}
      bookings={bookings}
      offers={offers}
      calendarAsk={day?.calendarWrite === "needs-permission"}
      timer={timer}
      device={device}
      account={screen && screen !== "signed-out" ? (name?.trim()[0]?.toUpperCase() ?? "") : null}
      checkins={screen === "focus" ? checkinsOn : null}
      voice={voice}
      on={{
        primary,
        secondary,
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
        sheet(next) {
          setSheet(next);
          setNote(null);
          if (next === "memory") {
            const mine = account();
            setDevice(mine ? readVault(mine) : []);
            void loadMemories();
          }
        },
        forget,
        remove: (fact) => void removeFact(fact),
        add: (text) => void addMemory(text),
        retryMemory: () => void loadMemories(),
        book: (key) => void book(key),
        unbook: (key) => void unbook(key),
        checkins() {
          const next = !checkinsOn;
          setCheckins(next);
          writeLocal(CHECKINS_KEY, next ? "on" : "off");
          if (!next && voice.phase === "speaking") voice.stop();
        },
        mute: () => voice.setMuted(!voice.muted),
        signIn() {
          // The chooser may pick another account, so this one's day must not paint for it.
          writeSaved(null);
          cache.current = null;
          void signIn("google", { redirectTo: "/" });
        },
        signOut() {
          // The next person at a shared computer must not read this one's private facts.
          const mine = account();
          if (mine) clearVault(mine);
          writeSaved(null);
          cache.current = null;
          void signOut({ redirectTo: "/" });
        },
      }}
    />
  );
}
