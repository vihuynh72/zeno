"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { signIn, signOut } from "next-auth/react";
import type {
  ActivateRequest,
  AddGoalRequest,
  BookResponse,
  CalendarBlock,
  CanvasAssignment,
  DayEmail,
  DayResponse,
  Deadline,
  EmailDraft,
  FreeResponse,
  Goal,
  GoalResponse,
  ImportResponse,
  Memory,
  MemoryResponse,
  NextStepsRequest,
  OpeningResponse,
  PlanRequest,
  PrivateFact,
  ProfileResponse,
  Progress,
  SaveMemoryResponse,
  SnapRequest,
  Step,
  StepResponse,
  StepStatus,
  TalkResponse,
  Turn,
} from "@/lib/day";
import { canvasBriefs, canvasList, readCanvas, syncCanvas } from "@/lib/canvas-store";
import { listenAuto, type ListenHandlers } from "@/lib/listen";
import { audioContext, playDone, wakeAudio } from "@/lib/speak";
import { formatTime, localDate } from "@/lib/tz";
import { useVoice, type VoiceError } from "@/lib/use-voice";
import { addToVault, readVault, removeFromVault, vaultRemoved, vaultTexts, type VaultFact } from "@/lib/vault";
import {
  addedStep,
  addHeard,
  asks,
  asksBig,
  canvasFor,
  checkinMinute,
  dayPart,
  doneLine,
  extraReplies,
  FOCUS,
  foundLine,
  greeting,
  isEmailStep,
  isNotes,
  isTomorrow,
  keepClock,
  laterBlock,
  laterMinutes,
  mailPlan,
  nextFewLine,
  nextProposal,
  nextScreen,
  openingReusable,
  openingSig,
  openPlans,
  openSteps,
  panelSuggestions,
  proposedStep,
  quickReplies,
  replanOnCanvas,
  runningStep,
  sameTitle,
  slotLabel,
  soonEvent,
  spoken,
  stoppedLine,
  suggestionRow,
  todayLine,
  untilNext,
  withStatus,
  type Fact,
  type Screen,
} from "@/components/day-flow";
import type { Booking } from "@/components/booking-chip";
import DayView, { useToday, type Sheet, type View } from "@/components/day-view";
import { httpsOnly } from "@/components/desk-rows";

const SIGNED_OUT_LINE = "Zeno helps you start the thing you keep putting off.";
const THINK_FAIL = "I couldn't think that through just now. Try again?";
const SAVE_FAIL = "I couldn't save that just now. Try again?";
const OPEN_FAIL = "Couldn't open that. Try again.";
const SNAP_FAIL = "I couldn't find a to-do list in that photo.";
// The goals panel and the front door (Nov 4): a plan from the person's words, the line for no goal yet, and the
// first run's line when there was nothing to read, which never apologizes.
const ADD_FAIL = "I couldn't make that plan just now. Try again?";
const NO_GOAL = "I couldn't find a goal in that. Try one thing you want to get done.";
const FRONT_DOOR = "Tell me a goal. I'll break it into small steps and stay with you while you do them.";
const NOTHING_YET = "Nothing to read yet, so let's start with what you want to do.";
const NEXT_FAIL = "I couldn't plan your next few just now. Try again?";
// This browser can't open the file (an iPhone HEIC photo in Chrome): say so, never that the photo holds nothing.
const PHOTO_UNREADABLE = "I can't open that kind of photo here. Try a screenshot or a JPEG.";
const WRAP_LINE = "Saved. I'll bring it back next time.";
const READING_LINE = "Reading your calendar and email…";
const PASTE_LINE = "Paste a syllabus, a to-do list or notes. I'll pull out what matters.";
const VOICE_NOTE = {
  blocked: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  unsupported: "Voice isn't available in this browser, so typing works for now.",
  network: "Voice couldn't connect just now, so typing works for now.",
};

type Day = Extract<DayResponse, { state: "ok" }>;
// at and sig: when the model wrote it and the day it was written for (openingSig).
type Opening = { text: string; options: string[]; at?: string; sig?: string };
// What the last visit left in this browser, kept current after every action; the model's opening is for `part` only.
// It paints before /api/day says whose browser this is, its answers wait for that answer, and its opening and setup
// state carry over only when day.account matches. Version 4 (Nov 3): the home greets by itself, so an opening saved
// before, which began with its own greeting, never paints there.
// shortcut: first paint trusts it, so a day written as the account switched (an /api/day already in flight, or a switch
// outside this page's Sign in / Sign out) shows until /api/day answers; check a readable cookie set at sign-in to close that.
type Saved = { v: 4; part: string; day: Day; opening: Opening | null; setupDone: boolean };
// One answer on the screen: the first is its big button, the rest links under it.
type Answer = { label: string; run(): void };
// A goal's desk while its plan is made (a deadline's steps, an email's reply): its title, due date and the card's line.
type Planning = { title: string; due: string | null; line: string };

const SAVED_KEY = "zeno:day";
const scannedKey = (account: string) => `zeno:scanned:${account}`;
const heardKey = (account: string) => `zeno:heard:${account}`;
// Which plan answers which email, { [goalId]: emailId }: ids only, never the email's words (Vi, Nov 3).
const mailKey = (account: string) => `zeno:mailgoal:${account}`;
// The day as this browser keeps it: no email snippets, and no Gmail link, which holds the address that the opaque account
// key keeps out of storage. Both come back with each /api/day.
const toKeep = (day: Day): Day => ({ ...day, emails: [], mailUrl: undefined });
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
// The plans with `goal` as it is now: in its place, or first when it is new.
const upsert = (goals: Goal[], goal: Goal) => (goals.some((one) => one.id === goal.id) ? goals.map((one) => (one.id === goal.id ? goal : one)) : [goal, ...goals]);
// Stuck?'s taps say exactly what they want (Nov 4: the piece goes before the step, which stays, and nothing else moves).
const smallerText = (step: Step) =>
  `Make "${step.title}" smaller: add a first piece of 2 to 5 minutes right before it, keep "${step.title}" after it, and change no other step.`;
const showText = (step: Step) => `Show me how to do "${step.title}": the very first move, or one short example. Don't change my steps.`;

function readSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null") as Saved | null;
    return saved?.v === 4 && saved.day?.state === "ok" && typeof saved.day.opening === "string" ? saved : null;
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

// The pattern memory ids this browser's openings already named (nothing private), so the server never names one twice.
function readHeard(account: string): string[] {
  try {
    return addHeard([], JSON.parse(readLocal(heardKey(account)) ?? "[]"));
  } catch {
    return [];
  }
}

function readMailGoals(account: string): Record<string, string> {
  try {
    const map: unknown = JSON.parse(readLocal(mailKey(account)) ?? "{}");
    if (!map || typeof map !== "object" || Array.isArray(map)) return {};
    return Object.fromEntries(Object.entries(map).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

// Read once per page load, so the first paint and every later render agree.
let boot: { part: string; hour: number; saved: Saved | null; at: number } | undefined;
const readBoot = () => (boot ??= { part: dayPart(new Date()), hour: new Date().getHours(), saved: readSaved(), at: Date.now() });

// Network errors and non-JSON replies (a platform 504 page, a route not deployed yet) come back as { state: "error" }.
async function getJson<T>(url: string, init?: RequestInit): Promise<T | { state: "error" }> {
  try {
    return (await (await fetch(url, init)).json()) as T;
  } catch {
    return { state: "error" };
  }
}

const post = <T,>(url: string, body: unknown) =>
  getJson<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// A photo for /api/goal/snap, shrunk here: a JPEG at quality 0.8 whose longest side is 1600 px at most, drawn on white
// (a screenshot's see-through parts would turn black). Throws when the browser can't read the file (HEIC in Chrome).
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

function patchStep(id: string, status: StepStatus) {
  return getJson<StepResponse>(`/api/steps/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// The device's private facts and Canvas briefs ride in the body (never the URL) and only for the account they belong to;
// the early ask, made before that is known, sends only the saved day's heard ids.
const fetchOpening = (account: string | null, heardBy = account) =>
  post<OpeningResponse>("/api/day/opening", {
    private: account ? vaultTexts(account) : [],
    canvas: account ? canvasBriefs(account) : [],
    heard: heardBy ? readHeard(heardBy) : [],
  });

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

export default function GuidedDay() {
  // null on the server and while hydrating; then this browser's saved day, if any.
  const booted = useSyncExternalStore(noStore, readBoot, () => null);
  // Set when /api/day fails: the account was never checked, so the saved day (maybe another account's) stops showing.
  const [savedDropped, setSavedDropped] = useState(false);
  const saved = savedDropped ? null : booted?.saved ?? null;
  const same = saved && saved.part === booted?.part ? saved : null;
  // /api/day answered: until then a saved day paints, but its answers (maybe stale) wait.
  const [fresh, setFresh] = useState(false);
  // A step still running in the saved day paints in Focus on its desk at once; /api/day says whether it still runs.
  const resumed = Boolean(saved && booted && (!saved.day.isNew || saved.setupDone) && runningStep(saved.day.goal, booted.at));

  // Each piece below starts from the saved day until something newer sets it.
  const [screenSet, setScreen] = useState<Screen | null>(null);
  const [viewSet, setView] = useState<View | null>(null);
  const [lineSet, setLine] = useState<string | null>(null);
  const [optionsSet, setOptions] = useState<string[] | null>(null);
  const [daySet, setDay] = useState<Day | null>(null);
  const [goalSet, setGoal] = useState<Goal | null | undefined>(undefined);
  const [goalsSet, setGoals] = useState<Goal[] | null>(null);
  const [progressSet, setProgress] = useState<Progress | null>(null);
  // Setup waits for /api/day to say the person is still new, so a tap on a saved setup card is never undone.
  const screen = screenSet ?? (saved && (!saved.day.isNew || saved.setupDone) ? (resumed ? "focus" : "ready") : null);
  const view = viewSet ?? (resumed ? "desk" : "home");
  const line = lineSet ?? (screen === "focus" ? FOCUS.calm : same ? same.opening?.text ?? same.day.opening : "");
  // Only a talk turn's quick replies (Nov 4): the opening's options ("Plan tomorrow") never show, and a saved one never
  // leaks into Focus after a reload.
  const options = optionsSet ?? [];
  const day = daySet ?? same?.day ?? null;
  // Plans and deadlines don't change with the part of the day, so a saved day's paint the home from any part of it.
  const base = day ?? saved?.day ?? null;
  const goal = goalSet === undefined ? saved?.day.goal ?? null : goalSet;
  // Every open plan; days saved before Nov 3 have none, and the current plan stands for them (homeChoices).
  const goals = goalsSet ?? base?.goals ?? [];
  const progress = progressSet ?? day?.progress ?? null;
  const name = day?.firstName ?? saved?.day.firstName ?? null;
  // The home's hello, by the hour the page opened (as dayPart is).
  const hello = booted ? greeting(booted.hour, name) : "";

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
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [offerKeys, setOfferKeys] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [learned, setLearned] = useState<PrivateFact[]>([]); // what first sign-in's scan learned, private facts too
  const [scanning, setScanning] = useState(false);
  const [canvasOn, setCanvasOn] = useState(false); // Canvas is linked on this device for this account
  const [quietLine, setQuietLine] = useState<string>(FOCUS.calm); // the Focus line Zeno set quietly, muted while it shows
  const [proposedId, setProposedId] = useState<string | null>(null); // the step she tapped on the desk ("Another step")
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [stuck, setStuck] = useState(false); // Stuck? in Focus: a smaller step, the first move or another goal, no question
  const [rollingId, setRollingId] = useState<string | null>(null); // a goal that keeps going whose next few are being planned
  const [mailGoals, setMailGoals] = useState<Record<string, string>>({});
  const [addWords, setAddWords] = useState<string | null>(null); // words whose plan couldn't be made, back in the box
  const today = useToday();
  // The goals panel (Nov 4): every open plan, and as Suggestions the deadlines and asking email with no plan yet.
  const plans = openPlans(goal, goals);
  const choices = panelSuggestions(plans, base?.deadlines ?? [], day?.emails ?? [], today, Object.values(mailGoals));
  const proposed = proposedStep(goal, proposedId);
  // Focus and the screen after Done are always on the desk; the card and talk are while its plan is made or has a step
  // open; otherwise the home.
  const onDesk = screen === "focus" || screen === "checkin" || (view === "desk" && (planning !== null || proposed !== null));
  // No open plan: the home is the front door, whose line says what Zeno does (Nov 4: never "your goals are below").
  const frontDoor = screen === "ready" && !onDesk && plans.length === 0;
  const history = useRef<Turn[]>([]);
  const cache = useRef<Saved | null>(null);
  const tapped = useRef<string | null>(null); // the turn in flight came from a chip, not the type box: the words it shows
  // Goals whose next few are being planned, by id: a second tap (or Done then the goal again) waits for the same answer.
  const rolls = useRef(new Map<string, Promise<GoalResponse | { state: "error" }>>());
  const moved = useRef(false); // the person has taken a turn (or opened a desk) since the opening was shown
  const spoke = useRef(false); // the opening has been said (or offered with Hear Zeno)
  const talking = useRef(false); // hands-free: the person tapped Talk, so Zeno listens after each question it says
  const nextOpening = useRef<Promise<OpeningResponse | { state: "error" }> | null>(null);
  const saves = useRef<Promise<unknown>[]>([]); // the first scan and pasted notes still being saved
  const opened = useRef(0); // the latest desk asked for: a slower answer for an earlier one never moves the screen
  const making = useRef(new Set<string>()); // deadlines and emails whose plan is being made: a second tap waits for it
  const wrapLine = useRef(WRAP_LINE); // the line after Stop for now, with today's steps
  const booking = useRef(new Set<string>()); // booking chips with a request in flight, so a double tap books once
  const bookedLine = useRef<string | null>(null); // the talk offer whose booking replaced Zeno's line
  const replied = useRef<string[]>([]); // the last talk turn's quick replies, which came with its booking offers
  const warned = useRef(new Set<string>()); // events already given a heads-up
  const answered = useRef(""); // Zeno's answer to something said in Focus, which no quiet line covers
  const cardAt = useRef(0); // when the card last changed, so the second tap of a double tap can't answer the next one
  useEffect(() => {
    cardAt.current = performance.now();
  }, [screen, pasting, view, stuck]);
  // The voice hook calls onUserTurn later, so it reads the screen, goal and phase from here, not a stale render.
  const shown: View = onDesk ? "desk" : "home";
  const latest = useRef({ screen, view: shown, goal, goals, line, progress, choices, chosen: proposedId });
  useEffect(() => {
    latest.current = { screen, view: shown, goal, goals, line, progress, choices, chosen: proposedId };
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

  // A voice error opens the text box, the way that still works, and says why once: the next thing she does clears the
  // note (Nov 4: it sat on every screen, even in Memory). Talk's slashed mic keeps showing a blocked one.
  const [voiceError, setVoiceError] = useState<VoiceError>(null);
  if (voice.error !== voiceError) {
    setVoiceError(voice.error);
    if (voice.error) {
      setTyping(true);
      setNote(VOICE_NOTE[voice.error]);
    }
  }
  // What the home shows is what it says: with no open plan, the front door's line.
  const homeLine = (text: string) => (openPlans(latest.current.goal, latest.current.goals).length === 0 ? FRONT_DOOR : text);

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
  // without asking the model. The pattern it names (noticed) is heard from now on, so no later opening names it again.
  function keepOpening(text: string, options: string[], sig: string, noticed: unknown) {
    store({ opening: { text, options, at: new Date().toISOString(), sig } });
    const mine = account();
    if (mine && Array.isArray(noticed) && noticed.length > 0) writeLocal(heardKey(mine), JSON.stringify(addHeard(readHeard(mine), noticed)));
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

  // Every change to the plan or the streak goes to the saved day too, so a reload paints what is true now. The plan
  // also takes its place among the open plans, so the home and the Desk show it as it is now. A running step keeps its
  // clock (keepClock).
  function changeGoal(plan: Goal | null) {
    const next = keepClock(latest.current.goal, plan);
    setGoal(next);
    latest.current.goal = next;
    const list = next ? upsert(latest.current.goals, next) : latest.current.goals;
    if (next) {
      setGoals(list);
      latest.current.goals = list;
    }
    if (cache.current) store({ day: { ...cache.current.day, goal: next, goals: list } });
  }

  // A save's answer for a plan the page may have moved on from: the current plan is replaced, any other is kept as it
  // is now without becoming current.
  function takeGoal(next: Goal) {
    if (latest.current.goal?.id === next.id) return changeGoal(next);
    const list = upsert(latest.current.goals, next);
    setGoals(list);
    latest.current.goals = list;
    if (cache.current) store({ day: { ...cache.current.day, goals: list } });
  }

  // A plan saved new after she moved on is the server's current one, so it is here too, unless she opened another desk.
  function takeNew(next: Goal) {
    if (latest.current.view !== "desk") return changeGoal(next);
    takeGoal(next);
    // Saving it made it the server's current plan, so the desk on screen is made current again: Talk, Start and Done
    // always act on the plan she sees (found in review, Nov 3). While another plan is still being made, that one becomes
    // current as it is saved, or keepCurrent puts the page's back when it fails (two goals added in a row, Nov 4).
    const shown = latest.current.goal;
    if (shown && shown.id !== next.id && making.current.size === 0) keepCurrent();
  }

  // The page's current plan made the server's current one again, so Talk acts on the plan she sees.
  function keepCurrent() {
    const shown = latest.current.goal;
    if (shown) void post<GoalResponse>("/api/goal/activate", { id: shown.id } satisfies ActivateRequest);
  }

  function changeProgress(next: Progress) {
    setProgress(next);
    latest.current.progress = next;
    if (cache.current) store({ day: { ...cache.current.day, progress: next, streak: next.streak } });
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
    setDraft(null);
    setPlanning(null);
    setStuck(false);
    setOfferKeys([]);
    setBookings({});
    setView("home");
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
    // Asked for once the scan settles, so the home's opening is written with what it learned.
    nextOpening.current = scan.then(() => fetchOpening(mine));
  }

  // Returns whether the model's opening should follow. `now` is when /api/day answered.
  const onDay = useEffectEvent((data: DayResponse | { state: "error" }, now: number) => {
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
    // A running step's clock carried on here before a reload (Make it smaller) keeps its start (keepClock).
    const plan = keepClock(prior?.day.goal ?? null, data.goal);
    cache.current = { v: 4, part: booted?.part ?? "", day: toKeep({ ...data, goal: plan }), opening: kept, setupDone: prior?.setupDone ?? false };
    writeSaved(cache.current);
    setDay(data);
    setCanvasOn(Boolean(readCanvas(data.account)));
    setMailGoals(readMailGoals(data.account));
    if (moved.current) return false;
    setGoal(plan);
    setGoals(null);
    // An opening that already arrived is checked against this day, not the saved one, before the next render.
    latest.current.goal = plan;
    latest.current.goals = data.goals ?? [];
    if (data.isNew === true && !prior?.setupDone) {
      setView("home");
      setScreen("setup");
      startScan(data.account);
      return false;
    }
    // A step still running goes straight to Focus on its desk, with only Focus's own answers (live, Nov 3: the saved
    // home's "Add a goal" became its big button); otherwise the home.
    if (runningStep(plan, now)) {
      setView("desk");
      setScreen("focus");
      latest.current.screen = "focus";
      setOptions([]);
      quiet(FOCUS.calm);
    } else {
      setView("home");
      setScreen("ready");
      latest.current.screen = "ready";
      // A saved model line for this part of the day stays until the new one lands; otherwise the quick line shows now.
      if (!kept) setLine(data.opening);
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

  // Swaps the model's line in (unless the person moved on or Zeno is mid-sentence) and says it once, after the home's
  // hello. `sig` is the day it was asked for, saved with it; a saved opening shown again (null) stays saved as it was,
  // with its first time.
  const onOpening = useEffectEvent((res: OpeningResponse | { state: "error" }, allowed: boolean, sig: string | null) => {
    const ok = res.state === "ok" && typeof res.opening === "string" && res.opening.trim() !== "";
    // Without a new model line, a saved one (maybe hours old) is dropped, never said: today's rule line stands in.
    if (!ok) store({ opening: null });
    if (moved.current || latest.current.screen !== "ready" || latest.current.view !== "home") return;
    // cache.current.day is this load's /api/day, even before the render that sets `day`.
    const text = ok ? res.opening.trim() : (cache.current?.day.opening ?? line);
    if (ok && sig !== null) keepOpening(text, quickReplies(res.options), sig, res.noticed);
    setLine(text);
    if (spoke.current || voice.muted) return;
    spoke.current = true;
    // Never over another line (a heads-up) or the person: Hear Zeno offers it instead.
    if (allowed && voice.phase === "idle" && !typing) void voice.speak(`${hello} ${homeLine(text)}`);
    else setHear(true);
  });

  // The day read again after a Canvas sync replaced its deadlines: for this account only, and nothing else moves.
  function takeDay(data: DayResponse | { state: "error" }) {
    if (data.state !== "ok" || data.account !== account()) return;
    store({ day: toKeep(data) });
    setDay(data);
  }
  const dayAgain = useEffectEvent(takeDay);

  // Plans the server has and this page doesn't yet join the list, and nothing else moves.
  function joinGoals(data: DayResponse | { state: "error" }) {
    if (data.state !== "ok" || data.account !== account()) return;
    for (const plan of data.goals ?? []) if (!latest.current.goals.some((one) => one.id === plan.id)) takeGoal(plan);
  }

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
    const early = asksEarly ? fetchOpening(null, saved.day.account) : null;
    void getJson<DayResponse>("/api/day").then(async (data) => {
      if (!live || !onDay(data, Date.now()) || data.state !== "ok") return;
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
        if (live) onOpening({ state: "ok", opening: kept.text, options: kept.options, pick: null }, ok, null);
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

  // After a Done (or a skip said in Focus): what is next and, when today's calendar knows, the free time before the next
  // event.
  function afterDone(next: Goal | null, skipped = false) {
    const known = cache.current?.day ?? day;
    // new Date(), as withStatus takes it: the compiler's purity lint reads onUserTurn (given to useVoice) as render code.
    const until = openSteps(next).length > 0 && known ? untilNext(known.events, known.free ?? [], new Date().getTime()) : null;
    return until ? `${doneLine(next, skipped)} ${until}` : doneLine(next, skipped);
  }

  async function onUserTurn(text: string): Promise<string | null> {
    const fromChip = tapped.current !== null;
    const theirs = tapped.current ?? text;
    tapped.current = null;
    const before = latest.current;
    // The card's opening is what the person is answering.
    if ((before.screen === "ready" || before.screen === "wrap") && before.line && history.current.at(-1)?.content !== before.line) {
      remember([{ role: "assistant", content: before.line }]);
    }
    moved.current = true;
    expireOpening();
    // Answering the opening is picking one thing, so the card moves on at once; a goal's desk keeps its step card, and
    // Zeno's answer comes under it (Nov 4).
    if ((before.screen === "ready" && before.view !== "desk") || before.screen === "wrap") setScreen("talk");
    if (fromChip) setTyping(false);
    setHear(false);
    setNote(null);
    setLine("");
    setOptions([]);
    setOfferKeys([]);
    setDraft(null);
    setCelebrate(false);
    setHeard(theirs);
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
    const changed = (res.actions ?? []).some((one) => one.type === "goal-set" || one.type === "roadmap-changed");
    const next = nextScreen(now.screen ?? "ready", res.actions ?? [], res.goal, now.screen === "ready" && now.view === "desk");
    const done = now.screen === "focus" && next === "checkin" ? openSteps(now.goal)[0] : undefined;
    // A skip said in Focus leaves it this way too, so only a step really marked done gets the stamp, the sound and "Nice".
    const status = done ? res.goal?.steps.find((one) => one.id === done.id)?.status : undefined;
    // After a Done, said or tapped, Zeno says what is next.
    const said = next === "checkin" ? afterDone(res.goal, status === "skipped") : res.reply;
    if (now.screen === "focus" && next === "focus") answered.current = said;
    if (next === "checkin") setCelebrate(Boolean(res.progress));
    // A step's timer ends with its focus.
    if (next !== "focus" || openSteps(res.goal)[0]?.id !== openSteps(now.goal)[0]?.id) setTimer(null);
    // A plan made or changed here opens its desk; a step started here runs on it. Next is then the first step the change
    // added or reworded when she had picked a step, else the first open step, as the goals list and a reload name it too
    // (Nov 4: one Next everywhere). Make it smaller in Focus needs nothing here: the server's add_step puts the running
    // clock on the new first piece, so Focus carries on with it.
    if (next === "ready" || next === "focus") {
      setView("desk");
      if (now.view !== "desk") setAddWords(null);
    }
    if (next === "ready" && changed) {
      setStuck(false);
      setProposedId(now.chosen !== null ? addedStep(now.goal, res.goal) : null);
    }
    // Goals Zeno saved for later (several named at once, or one named mid-step) join the list now, not at the next load:
    // the turn's answer carries only the current one (found in review, Nov 4).
    if ((res.actions ?? []).some((one) => one.type === "goal-set" && one.label !== res.goal?.title)) void getJson<DayResponse>("/api/day").then(joinGoals);
    if (done) {
      // Said "done" out loud: same stamp and sound as the Done button, so the card and its answers wait for it too.
      if (status === "done") {
        setStamping(true);
        if (!voice.muted) playDone();
      }
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        changeGoal(res.goal);
        setProposedId(null);
        setStuck(false);
        fileAway(status === "done" ? done : null, said);
        void rollOn(res.goal);
      }, 400);
    } else {
      changeGoal(res.goal);
      setLine(said);
      setScreen(next);
      // A goal that keeps going plans its next few after its last session, said done on the desk too (review, Nov 4).
      if (next === "checkin") void rollOn(res.goal);
    }
    const drafted = gmailDraft(res.draft);
    setDraft(drafted);
    // A draft and the screen after Done have their own answers; everywhere else a question's answers show (Nov 4).
    replied.current = !drafted && next !== "checkin" ? quickReplies(res.options, proposal.length > 0) : [];
    setOptions(replied.current);
    // The hook says it; hands-free listens again after a question.
    return spoken(said);
  }

  // The finished card slides onto the pile while the next card rises with Zeno's line; a skipped one (null) never does.
  function fileAway(step: Step | null, nextLine: string) {
    setStamping(false);
    setLeaving(step);
    setLine(nextLine);
    setScreen("checkin");
    setTimeout(() => setLeaving(null), 300);
  }

  function failStart(res: { state: string }, before: Goal | null, back: Screen) {
    if (res.state === "signed-out") return showSignedOut();
    changeGoal(before);
    setTimer(null);
    setScreen(back);
    setNote(SAVE_FAIL);
  }

  // The stopwatch runs at the tap, with a calm line under the card and nothing said.
  function enterFocus() {
    setOptions([]);
    setOfferKeys([]);
    setDraft(null);
    setCelebrate(false);
    setStuck(false);
    setNote(null);
    setView("desk");
    setScreen("focus");
    quiet(FOCUS.calm);
  }

  // The step running in Focus goes back to todo, as Stop for now does, before she leaves it (Switch goal, the home,
  // another plan, Something smaller); resolves with the save's answer, or null when nothing was running.
  function letGo(): Promise<StepResponse | { state: "error" } | null> {
    const plan = latest.current.goal;
    const step = latest.current.screen === "focus" ? openSteps(plan)[0] : undefined;
    setTimer(null);
    if (!plan || step?.status !== "doing") return Promise.resolve(null);
    changeGoal(withStatus(plan, step.id, "todo", new Date()));
    return patchStep(step.id, "todo").then((res) => {
      if (res.state === "ok") takeGoal(res.goal);
      else if (res.state === "signed-out") showSignedOut();
      return res;
    });
  }

  async function finishStep(step: Step) {
    if (!voice.muted) wakeAudio();
    setStamping(true);
    setBusy(true);
    const [res] = await Promise.all([patchStep(step.id, "done"), wait(400)]);
    setBusy(false);
    if (res.state !== "ok") {
      setStamping(false);
      if (res.state === "signed-out") return showSignedOut();
      setLine(SAVE_FAIL);
      return;
    }
    if (!voice.muted) playDone();
    changeGoal(res.goal);
    setProposedId(null);
    setStuck(false);
    if (res.progress) changeProgress(res.progress);
    setTimer(null);
    setDraft(null);
    setOptions([]);
    setCelebrate(Boolean(res.progress));
    // The stamp, then what is next, with Keep going.
    const said = afterDone(res.goal);
    fileAway(step, said);
    speakLine(spoken(said));
    void rollOn(res.goal);
  }

  // A goal that keeps going (rhythm) plans its next few once no session is left (Nov 4, POST /api/goal/next, which never
  // changes the current plan): after its last Done, where the screen after it says what they are (or that it couldn't,
  // with Plan my next few to try again), or as its desk opens (`ticket`), which shows them being planned.
  async function rollOn(plan: Goal | null, ticket?: number) {
    if (!plan?.rhythm || openSteps(plan).length > 0) return;
    if (ticket) setPlanning({ title: plan.title, due: plan.due ?? null, line: "Planning your next few…" });
    const asked = rolls.current.get(plan.id);
    const call = asked ?? post<GoalResponse>("/api/goal/next", { id: plan.id } satisfies NextStepsRequest);
    if (!asked) {
      rolls.current.set(plan.id, call);
      setRollingId(plan.id);
    }
    const res = await call;
    if (!asked) {
      rolls.current.delete(plan.id);
      setRollingId((id) => (id === plan.id ? null : id));
      if (res.state === "ok") takeGoal(res.goal);
    }
    if (res.state === "signed-out") return showSignedOut();
    if (ticket) {
      if (ticket !== opened.current) return;
      setPlanning(null);
      if (res.state !== "ok") {
        goHome();
        setNote(NEXT_FAIL);
      }
      return;
    }
    if (latest.current.screen !== "checkin" || latest.current.goal?.id !== plan.id) return;
    setLine(res.state === "ok" ? nextFewLine(plan, res.goal) : "Nice. I couldn't plan your next few just now.");
  }

  async function startStep(step: Step) {
    const before = goal;
    const back = screen ?? "ready";
    moved.current = true;
    setTimer(null);
    if (goal) changeGoal(withStatus(goal, step.id, "doing", new Date()));
    enterFocus();
    const res = await patchStep(step.id, "doing");
    if (res.state === "ok") takeGoal(res.goal);
    else failStart(res, before, back);
  }

  // Words a chip says for the person; onUserTurn shows `label` as theirs.
  function tap(text: string, label = text) {
    tapped.current = label;
    void voice.submit(text);
  }

  // "Stop for now" and "That's enough today": the step goes back to todo and stays open, so the home brings it back. A
  // plan with an hour or more left gets one block tomorrow offered (Vi, Nov 2); its button shows only once free time
  // answers, so nothing moves under a tap. The line says what today held, when anything was finished.
  function stopForNow() {
    voice.stop();
    void letGo();
    setTyping(false);
    setOptions([]);
    setDraft(null);
    setCelebrate(false);
    setStuck(false);
    setScreen("wrap");
    // shortcut: counts the plans this page holds; one finished before a reload has left day.goals (open plans only), so
    // its steps drop out. Have /api/day send today's done steps if the count must be exact.
    const done = todayLine([latest.current.goal, ...latest.current.goals], zone(), new Date());
    wrapLine.current = done ? `${WRAP_LINE} ${done}` : WRAP_LINE;
    setLine(wrapLine.current);
    speakLine(spoken(wrapLine.current));
    const plan = latest.current.goal;
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

  // The home: the hello and the goals (Vi, Nov 3). The current plan stays current. `said` replaces Zeno's line for a
  // moment ("Your draft is open in Gmail."); otherwise the day's opening is back.
  function goHome(said?: string) {
    opened.current += 1;
    setOfferKeys([]);
    setDraft(null);
    setTyping(false);
    setStuck(false);
    setPlanning(null);
    setCelebrate(false);
    setNote(null);
    setView("home");
    setScreen("ready");
    latest.current.view = "home";
    latest.current.screen = "ready";
    setLine(said ?? cache.current?.opening?.text ?? cache.current?.day.opening ?? line);
    setOptions([]);
  }

  // The mark, "← Goals" and Switch goal: a step running in Focus goes back to todo first.
  function leaveForHome() {
    void letGo();
    goHome();
  }

  // ---------- A goal's desk (Vi, Nov 3: she picks the goal, Zeno picks the step) ----------
  // Opening a desk is choosing, so a late opening line never moves the screen, and Zeno stops talking.
  function openDesk(): number {
    void letGo();
    moved.current = true;
    voice.stop();
    talking.current = false;
    setNote(null);
    setTyping(false);
    setStuck(false);
    setDraft(null);
    setOfferKeys([]);
    setOptions([]);
    setCelebrate(false);
    setHear(false);
    setProposedId(null);
    setAddWords(null);
    // The home's line never sits under a desk's step card.
    setLine("");
    setView("desk");
    setScreen("ready");
    latest.current.view = "desk";
    latest.current.screen = "ready";
    return ++opened.current;
  }

  // A plan's desk shows at once from the day's plans; it becomes the current plan (the old one is paused, not lost).
  async function openPlan(target: Goal) {
    // Back to the plan she is working on (its Desk row, deadline or email): Focus and its stopwatch keep going.
    const { goal: now, screen: on } = latest.current;
    if (target.id === now?.id && (on === "focus" || on === "checkin")) return;
    const ticket = openDesk();
    const before = latest.current.goal;
    setPlanning(null);
    changeGoal(target);
    // A goal that keeps going with no session left plans its next few as its desk opens (Nov 4).
    void rollOn(target, ticket);
    if (before?.id === target.id) return;
    setBusy(true);
    const res = await post<GoalResponse>("/api/goal/activate", { id: target.id } satisfies ActivateRequest);
    setBusy(false);
    if (res.state === "signed-out") return showSignedOut();
    if (res.state === "ok") return takeGoal(res.goal);
    // Not saved: the old plan is still the current one.
    if (latest.current.goal?.id === target.id) changeGoal(before);
    if (ticket !== opened.current) return;
    goHome();
    setNote(OPEN_FAIL);
  }

  // A deadline with no plan yet: Muse breaks it into small steps (the only new model call, with its Canvas assignment's
  // instructions when this device has them), and that plan becomes the current one. A deadline an open plan covers
  // opens that plan.
  async function planDeadline(deadline: Deadline) {
    const covered = openPlans(latest.current.goal, latest.current.goals).find((plan) => sameTitle(plan.title, deadline.title));
    if (covered) return openPlan(covered);
    const key = `deadline:${deadline.title.toLowerCase()}`;
    if (making.current.has(key)) return;
    making.current.add(key);
    const ticket = openDesk();
    const mine = account();
    const canvas = mine ? canvasFor({ id: "", title: deadline.title, steps: [] }, canvasBriefs(mine)) : undefined;
    const due = deadline.date >= localDate(zone()) ? deadline.date : null;
    setPlanning({ title: deadline.title, due, line: "Breaking it into steps…" });
    const res = await post<GoalResponse>("/api/goal/plan", { title: deadline.title, due, ...(canvas ? { canvas } : {}) } satisfies PlanRequest);
    making.current.delete(key);
    if (res.state === "signed-out") return showSignedOut();
    if (ticket !== opened.current) {
      if (res.state === "ok") takeNew(res.goal);
      return;
    }
    setPlanning(null);
    if (res.state === "ok") return changeGoal(res.goal);
    goHome();
    keepCurrent();
    setNote(OPEN_FAIL);
  }

  // An email that asks something: a plan with one 2-minute reply (plain words when the API refuses its sender or
  // subject), its email remembered by id for the desk. One that already has an open plan opens it.
  async function answerMail(email: DayEmail) {
    const known = Object.entries(mailGoals).find(([, id]) => id === email.id)?.[0];
    const plan = known ? openPlans(latest.current.goal, latest.current.goals).find((one) => one.id === known) : undefined;
    if (plan) return openPlan(plan);
    const key = `mail:${email.id ?? email.subject}`;
    if (making.current.has(key)) return;
    making.current.add(key);
    const ticket = openDesk();
    const words = mailPlan(email);
    setPlanning({ title: words.title, due: null, line: "Getting it ready…" });
    let res = await post<GoalResponse>("/api/goal", words);
    if (res.state === "bad-request") res = await post<GoalResponse>("/api/goal", mailPlan(null));
    making.current.delete(key);
    if (res.state === "signed-out") return showSignedOut();
    const mine = account();
    if (res.state === "ok" && email.id && mine) {
      const map = { ...readMailGoals(mine), [res.goal.id]: email.id };
      writeLocal(mailKey(mine), JSON.stringify(Object.fromEntries(Object.entries(map).slice(-50))));
      setMailGoals(map);
    }
    if (ticket !== opened.current) {
      if (res.state === "ok") takeNew(res.goal);
      return;
    }
    setPlanning(null);
    if (res.state === "ok") return changeGoal(res.goal);
    goHome();
    keepCurrent();
    setNote(OPEN_FAIL);
  }

  // "+ Add a goal" and the front door (Nov 4): her words go to Muse as they are (POST /api/goal/add), with no talk turn,
  // and stay on the desk until it answers. More goals from the same words join the panel. A plan that couldn't be made
  // sends her home with her words back in the box.
  async function addGoal(text: string) {
    const words = text.trim();
    const key = `add:${words.toLowerCase()}`;
    if (!words || making.current.has(key)) return;
    making.current.add(key);
    const ticket = openDesk();
    const shown = words.length > 160 ? words.slice(0, 160).trimEnd() : words.replace(/[.!?…\s]+$/, "");
    setPlanning({ title: "New goal", due: null, line: `Planning: ${shown}…` });
    const res = await post<GoalResponse>("/api/goal/add", { text: words } satisfies AddGoalRequest);
    making.current.delete(key);
    if (res.state === "signed-out") return showSignedOut();
    // Only whole plans join the panel: a bad entry must never take the page down.
    const others = res.state === "ok" && Array.isArray(res.others) ? res.others.filter((one) => typeof one?.id === "string" && Array.isArray(one.steps)) : [];
    for (const other of others) takeGoal(other);
    if (ticket !== opened.current) {
      if (res.state === "ok") takeNew(res.goal);
      else setAddWords(words);
      return;
    }
    setPlanning(null);
    if (res.state === "ok") {
      changeGoal(res.goal);
      // More goals from the same words are in the list now, and the line says so (live, Nov 4: one just appeared there).
      const titles = others.map((one) => one.title.replace(/[.!?]+$/, ""));
      if (titles.length > 0) setLine(`Also added to your goals: ${titles.join(" and ")}.`);
      return;
    }
    goHome();
    keepCurrent();
    setAddWords(words);
    setNote(res.state === "bad-request" ? NO_GOAL : ADD_FAIL);
  }

  // "Add from a photo" (Vi, Nov 3 night): Muse Spark reads a photo or screenshot of an assignment once, and its plan
  // opens as a deadline's does. The desk says it is reading at once; the photo is shrunk here and never kept.
  async function snapAssignment(photo: File) {
    if (making.current.has("snap")) return;
    making.current.add("snap");
    const ticket = openDesk();
    setPlanning({ title: "New goal", due: null, line: "Reading your photo…" });
    const image = await shrinkPhoto(photo).catch(() => null);
    const res = image ? await post<GoalResponse>("/api/goal/snap", { image } satisfies SnapRequest) : ({ state: "unreadable" } as const);
    making.current.delete("snap");
    if (res.state === "signed-out") return showSignedOut();
    if (ticket !== opened.current) {
      if (res.state === "ok") takeNew(res.goal);
      return;
    }
    setPlanning(null);
    if (res.state === "ok") return changeGoal(res.goal);
    goHome();
    keepCurrent();
    setNote(res.state === "unreadable" ? PHOTO_UNREADABLE : res.state === "bad-request" ? SNAP_FAIL : OPEN_FAIL);
  }

  // Stuck? in Focus, "Make it smaller" (Nov 4): Zeno adds a 2-5 minute first piece before the step (add_step), and the
  // server moves the running clock onto it, so Focus carries on with the piece and its time so far. If Zeno adds
  // nothing, the step simply runs on.
  function smallerNow(step: Step) {
    setStuck(false);
    tap(smallerText(step), "Make it smaller");
  }

  // Stuck? in Focus, "Show me how": Zeno's first move or an example shows under the card, and the clock runs on.
  function showMe(step: Step) {
    setStuck(false);
    tap(showText(step), "Show me how");
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

  // The keyboard and "Something else": the text box, never the mic (Nov 4). Typing ends hands-free, so the mic never
  // opens over the box.
  function openTyping() {
    talking.current = false;
    if (voice.phase === "listening") voice.stop();
    setTyping(true);
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
    if (latest.current.screen === "wrap") setLine(wrapLine.current);
    else if (bookedLine.current === key) setLine("Okay, it's off your calendar.");
  }

  // ---------- Focus: one quiet check-in and a welcome back; heads-ups ----------
  const focusStep = screen === "focus" ? openSteps(goal)[0] ?? null : null;
  const focusMinutes = timer ?? focusStep?.minutes ?? null;
  const moment = focusMinutes ? checkinMinute(focusMinutes, day?.pace) : null;
  // A quiet line never covers a question and its answers, a draft, the person talking, or Zeno's answer to them in Focus.
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
  // Pasted notes become memories (POST /api/import only saves since Nov 2); the home's opening waits for them.
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

  // Start: the home, with the opening written from what the scan learned.
  function finishSetup() {
    store({ setupDone: true });
    moved.current = false;
    setPasting(false);
    setOfferKeys([]);
    setView("home");
    setScreen("ready");
    setLine(day?.opening ?? "");
    setWantOpening((n) => n + 1);
    // The scan saved what it found (its deadlines too) after /api/day answered, so the home reads the day again, Canvas
    // first when it is linked here; else the first home lists no deadlines until a reload (found in review, Nov 3).
    const mine = account();
    if (!mine) return;
    void (readCanvas(mine) ? syncCanvas(mine) : Promise.resolve(null))
      .then(() => getJson<DayResponse>("/api/day"))
      .then((again) => takeDay(again));
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
  // Linked or unlinked in its sheet: the day (its deadlines, so the home's options) is read again, and the home's line
  // is written again at once after a Disconnect or a Connect that found work due.
  async function canvasSynced(assignments: CanvasAssignment[]) {
    const mine = account();
    if (!mine) return;
    const linked = Boolean(readCanvas(mine));
    setCanvasOn(linked);
    nextOpening.current = null;
    const data = await getJson<DayResponse>("/api/day");
    if (data.state === "signed-out") return showSignedOut();
    takeDay(data);
    if (latest.current.view === "home" && replanOnCanvas(latest.current.screen, linked, assignments)) await refreshOpening();
  }

  // A fresh home line: today's quick line at once, then the model's opening, said aloud, unless the person moved on.
  async function refreshOpening() {
    moved.current = false;
    setScreen("ready");
    setLine(cache.current?.day.opening ?? line);
    const sig = daySig();
    const res = await fetchOpening(account());
    if (res.state !== "ok" || moved.current) return;
    keepOpening(res.opening, quickReplies(res.options), sig, res.noticed);
    setLine(res.opening);
    speakLine(homeLine(res.opening));
  }

  // ---------- The screen's answers ----------
  const setupLine = scanning ? READING_LINE : pasting ? PASTE_LINE : learned.length > 0 ? foundLine(learned) : NOTHING_YET;
  const offers = offerKeys.flatMap((key) => (bookings[key] ? [bookings[key]] : []));
  const step = openSteps(goal)[0];
  // The desk's materials read this device's Canvas list only once /api/day said whose it is.
  const mine = daySet?.account;
  const brief = useMemo(() => (onDesk && mine ? canvasFor(goal, canvasBriefs(mine)) : undefined), [onDesk, mine, goal]);
  const assignment = onDesk && mine ? canvasFor(goal, canvasList(mine) ?? []) : undefined;
  const mailId = goal ? mailGoals[goal.id] : undefined;
  const gmail = httpsOnly(day?.mailUrl);

  // Every screen has one big button (the first answer) and small links for the rest (Vi, Nov 2).
  function screenAnswers(): Answer[] {
    const say = (label: string, run: () => void): Answer => ({ label, run });
    const replies = options.map((option) => say(option, () => tap(option)));
    // "Something else" opens the text box; only Talk opens the mic (Nov 4).
    const other = say("Something else", openTyping);
    if (screen === "signed-out") return [say("Sign in with Google", () => void signIn("google", { redirectTo: "/" }))];
    if (screen === "setup") {
      if (scanning) return [];
      if (pasting) return [say("Skip", finishSetup)];
      const learnedSome = learned.length > 0 ? [say("See what I learned", () => openSheet("memory"))] : [];
      return [say("Start", finishSetup), say("Paste notes", () => setPasting(true)), ...learnedSome];
    }
    if (draft) {
      // A draft written in Focus leaves her in Focus: she sends it from Gmail, then taps Done. One written on a goal's
      // desk leaves her on it, with the line under its step.
      const back = (said: string) => {
        const { screen: on, view } = latest.current;
        if (on !== "focus" && !(on === "ready" && view === "desk")) return goHome(said);
        setDraft(null);
        setOptions([]);
        if (on === "focus") quiet(said);
        else setLine(said);
      };
      return [
        say("Open in Gmail", () => {
          window.open(draft.url, "_blank", "noopener,noreferrer");
          back("Your draft is open in Gmail.");
        }),
        say("Not now", () => back("Okay, not now.")),
      ];
    }
    // Zeno's answers to what it just said, on a step's screen only when they add something (Nov 4: never a second Start,
    // Done or Stop for now).
    const asked = extraReplies(options, asksBig(line, screen === "focus")).map((option) => say(option, () => tap(option)));
    if (screen === "ready" && onDesk) {
      // Saved answers wait for /api/day; a plan being made has no Start yet.
      if (!fresh || planning || !proposed) return [];
      const start = proposed;
      return [
        say(start.minutes ? `Start · ${start.minutes} min` : "Start", () => void startStep(start)),
        ...asked,
        say("Something smaller", () => tap(smallerText(start), "Something smaller")),
        ...(asked.length === 0 && openSteps(goal).length > 1 ? [say("Another step", () => setProposedId(nextProposal(goal, start.id)))] : []),
      ];
    }
    // The home's actions are the goals panel and the front door (Nov 4), never a model option such as "Plan tomorrow".
    if (screen === "ready") return [];
    if (screen === "talk") {
      // An offer with no replies left beside it (they went with a booking that was then undone) still has a way home.
      if (options.length) return [...replies, other];
      if (offers.some((one) => one.state !== "booked")) return [say("No thanks", () => goHome()), other];
      // A booked offer answered Zeno's question, so one way home (live, Nov 2: it was a dead end); a plain question
      // still waits for Talk or the keyboard.
      return offers.length ? [say("Back to my goals", () => goHome())] : [];
    }
    if (screen === "focus" && step) {
      if (!fresh) return [];
      // The big button is always Done (Nov 4); Zeno's answers, when they add something, lead the links under it.
      const done = say("Done", () => void finishStep(step));
      const stop = say("Stop for now", stopForNow);
      // Stuck? asks nothing (Vi, Nov 3): a smaller first piece on the same clock, the first move, or another goal.
      if (stuck) return [done, say("Make it smaller", () => smallerNow(step)), say("Show me how", () => showMe(step)), say("Switch goal", leaveForHome), stop];
      const extra = isEmailStep(step.title) ? [say("Draft it in Gmail", () => tap(`Draft the email for: ${step.title}`, "Draft it in Gmail"))] : [];
      return [done, ...asked, say("Stuck?", () => setStuck(true)), stop, ...extra];
    }
    if (screen === "checkin") {
      const home = say("Back to my goals", () => goHome());
      const enough = say("That's enough today", stopForNow);
      // A goal that keeps going rests after a session: the next is for another day (live, Nov 3: Sam was pushed into a
      // second run). With its steps all done, its next few are being planned, or Plan my next few tries again.
      if (goal?.rhythm) {
        if (step) return [home, say("Keep going", () => void startStep(step)), enough];
        return rollingId === goal.id ? [home, enough] : [say("Plan my next few", () => void rollOn(goal)), home, enough];
      }
      if (step) return [say("Keep going", () => void startStep(step)), say("Switch goal", () => goHome()), enough];
      return [home, enough];
    }
    if (screen === "wrap") {
      // While free time is asked for, nothing shows, so no button changes under a tap.
      const wrapOffer = offerKeys.length ? bookings[offerKeys[0]] : undefined;
      if (offerKeys.length && !wrapOffer) return [];
      return [say(wrapOffer && wrapOffer.state !== "booked" ? "No thanks" : "Back to my goals", () => goHome())];
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

  // A suggestion: a deadline's new plan or an email's reply (the panel's rows as this render drew them).
  function choose(i: number) {
    const choice = latest.current.choices[i];
    if (!choice || !fresh || busy || performance.now() - cardAt.current < 400) return;
    if (choice.kind === "plan") void openPlan(choice.goal);
    else if (choice.kind === "deadline") void planDeadline(choice.deadline);
    else void answerMail(choice.email);
  }

  return (
    <DayView
      screen={screen}
      view={shown}
      hello={hello}
      line={screen === "setup" ? setupLine : frontDoor ? FRONT_DOOR : line}
      you={voice.phase === "listening" ? voice.partial : heard}
      goal={goal}
      goals={plans}
      suggestions={choices.map((choice) => suggestionRow(choice, today))}
      addWords={addWords}
      planning={onDesk ? planning : null}
      proposed={proposed}
      materials={
        onDesk && goal && !planning
          ? {
              prompt: brief || assignment ? { course: brief?.course ?? assignment?.course ?? "", text: brief?.instructions ?? "", url: httpsOnly(assignment?.url) } : undefined,
              stopped: stoppedLine(goal, zone(), today),
              mail: mailId ? { id: mailId, gmail: gmail && `${gmail}#inbox/${encodeURIComponent(mailId)}` } : undefined,
            }
          : undefined
      }
      today={
        day && {
          events: day.events,
          emails: day.emails,
          unreadEmail: day.unreadEmail,
          sources: day.sources,
          free: day.free,
          deadlines: day.deadlines,
          mailUrl: day.mailUrl,
          doneThisWeek: day.doneThisWeek,
        }
      }
      held={goals}
      memories={memories}
      sheet={sheet}
      typing={typing && screen !== "setup"}
      stamping={stamping}
      leaving={leaving}
      note={note}
      signInFailed={signInFailed}
      busy={busy || voice.phase === "thinking" || (screen === "ready" && !fresh)}
      chips={answers.map((one) => one.label)}
      pasting={screen === "setup" && pasting}
      // Not on the front door: its line is fixed text, and the link would push a phone's view off its top.
      hear={hear && screen === "ready" && !onDesk && !frontDoor}
      progress={progress}
      celebrate={celebrate}
      bookings={bookings}
      offers={offers}
      timer={timer}
      quiet={line === quietLine}
      brief={brief}
      device={device}
      account={screen && screen !== "signed-out" ? (name?.trim()[0]?.toUpperCase() ?? "") : null}
      canvas={daySet ? { account: daySet.account, linked: canvasOn } : null}
      calendarAsk={day?.calendarWrite === "needs-permission"}
      voice={voice}
      on={{
        chip,
        choose,
        // Before /api/day answers, the words wait in the box (as every other action waits for it).
        addGoal: (text) => (fresh ? void addGoal(text) : setAddWords(text)),
        closeAdd() {
          setAddWords(null);
          setNote(null);
        },
        snap(photo) {
          if (fresh) void snapAssignment(photo);
        },
        home: leaveForHome,
        propose: (stepId) => setProposedId(stepId),
        hear() {
          setHear(false);
          void voice.speak(`${hello} ${line}`);
        },
        paste: savePaste,
        talk,
        type: openTyping,
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
        // The goals panel's rows and the Desk's working cards (Vi, Nov 3): each closes the Desk, then opens its desk.
        openGoal(goalId) {
          setSheet(null);
          const plan = openPlans(goal, goals).find((one) => one.id === goalId);
          if (plan && fresh) void openPlan(plan);
        },
        openDeadline(deadline) {
          setSheet(null);
          if (fresh) void planDeadline(deadline);
        },
        reply(email) {
          setSheet(null);
          if (fresh) void answerMail(email);
        },
      }}
    />
  );
}
