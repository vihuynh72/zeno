"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { signIn, signOut } from "next-auth/react";
import type {
  DayResponse,
  Goal,
  Memory,
  MemoryResponse,
  OpeningResponse,
  SaveMemoryResponse,
  Step,
  StepResponse,
  StepStatus,
  TalkResponse,
  Turn,
} from "@/lib/day";
import { listenAuto, type ListenHandlers } from "@/lib/listen";
import { audioContext } from "@/lib/speak";
import { useVoice } from "@/lib/use-voice";
import { dayPart, greeting, nextScreen, openSteps, quickReplies, SETUP, type Screen } from "@/components/day-flow";
import DayView, { type Chip, type Sheet } from "@/components/day-view";

const SIGNED_OUT_LINE = "Zeno helps you start the thing you keep putting off.";
const THINK_FAIL = "I couldn't think that through just now. Try again?";
const SAVE_FAIL = "I couldn't save that just now. Try again?";
const VOICE_NOTE = {
  blocked: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  unsupported: "Voice isn't available in this browser, so typing works for now.",
  network: "Voice couldn't connect just now, so typing works for now.",
};

type Day = Extract<DayResponse, { state: "ok" }>;
type Opening = { text: string; options: string[] };
// What the last visit left in this browser, keyed by whose day it was; the model's opening is for `part` only.
// shortcut: keyed by first name, so two same-named accounts that switch outside Sign in again / Sign out share the saved
// opening and setup state; key it by a hash of the account id (a new /api/day field) if shared browsers matter.
type Saved = { v: 1; who: string | null; part: string; day: Day; opening: Opening | null; setupDone: boolean };

const SAVED_KEY = "zeno:day";

function readSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null") as Saved | null;
    return saved?.v === 1 && saved.day?.state === "ok" && typeof saved.day.opening === "string" ? saved : null;
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

export default function GuidedDay() {
  // null on the server and while hydrating; then this browser's saved day, if any.
  const booted = useSyncExternalStore(noStore, readBoot, () => null);
  const saved = booted?.saved ?? null;
  const same = saved && saved.part === booted?.part ? saved : null;

  // Each piece below starts from the saved day until something newer sets it.
  const [screenSet, setScreen] = useState<Screen | null>(null);
  const [lineSet, setLine] = useState<string | null>(null);
  const [optionsSet, setOptions] = useState<string[] | null>(null);
  const [daySet, setDay] = useState<Day | null>(null);
  const [goalSet, setGoal] = useState<Goal | null | undefined>(undefined);
  // Setup waits for /api/day to say the person is still new, so a tap on a saved setup card is never undone.
  const screen = screenSet ?? (saved && (!saved.day.isNew || saved.setupDone) ? "ready" : null);
  const line =
    lineSet ?? (same ? same.opening?.text ?? same.day.opening : booted ? greeting(booted.hour, saved?.day.firstName ?? null) : "");
  const options = optionsSet ?? (same ? quickReplies(same.opening?.options ?? same.day.options) : []);
  const day = daySet ?? same?.day ?? null;
  const goal = goalSet === undefined ? saved?.day.goal ?? null : goalSet;

  const [heard, setHeard] = useState("");
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [memories, setMemories] = useState<Memory[] | "loading" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [leaving, setLeaving] = useState<Step | null>(null);
  const [hear, setHear] = useState(false);
  const [setupAt, setSetupAt] = useState(0);
  const [pasting, setPasting] = useState(false);
  const [learned, setLearned] = useState<Memory[]>([]);
  const [reading, setReading] = useState(0);
  const history = useRef<Turn[]>([]);
  const cache = useRef<Saved | null>(null);
  const tapped = useRef(false); // the turn in flight came from a chip, not the type box
  const moved = useRef(false); // the person has taken a turn since the opening was shown
  const spoke = useRef(false); // the opening has been said (or offered with Hear Zeno)
  const talking = useRef(false); // the person chose to talk, so Zeno listens after it speaks
  const nextOpening = useRef<Promise<OpeningResponse | { state: "error" }> | null>(null);
  const saves = useRef<Promise<unknown>[]>([]); // setup answers and pasted notes still being saved
  // The voice hook calls onUserTurn later, so it reads the screen, goal and phase from here, not a stale render.
  const latest = useRef({ screen, goal, line, thinking: false });
  useEffect(() => {
    latest.current = { screen, goal, line, thinking: voice.phase === "thinking" };
  });

  // Auth.js sends failed sign-ins back to "/?error=...".
  const signInFailed = useSyncExternalStore(noStore, () => new URLSearchParams(window.location.search).has("error"), () => false);

  const voice = useVoice(
    { onUserTurn },
    { listen: (handlers, opts) => (talking.current ? listenAuto(handlers, opts) : micClosed(handlers)) },
  );

  function store(patch: Partial<Saved>) {
    if (!cache.current) return;
    cache.current = { ...cache.current, ...patch };
    writeSaved(cache.current);
  }

  // Returns whether the model's opening should follow.
  const onDay = useEffectEvent((data: DayResponse | { state: "error" }) => {
    if (data.state === "signed-out") {
      showSignedOut();
      return false;
    }
    if (data.state !== "ok") {
      // Whatever already shows (the saved day or the greeting) stays; there's still a way to start.
      if (!screen) setScreen("ready");
      return false;
    }
    const prior = saved?.who === data.firstName ? saved : null;
    const kept = prior && prior.part === booted?.part ? prior.opening : null;
    // Email snippets stay out of storage; nothing on screen shows them.
    cache.current = { v: 1, who: data.firstName, part: booted?.part ?? "", day: { ...data, emails: [] }, opening: kept, setupDone: prior?.setupDone ?? false };
    writeSaved(cache.current);
    setDay(data);
    if (moved.current) return false;
    setGoal(data.goal);
    if (data.isNew === true && !prior?.setupDone) {
      setScreen("setup");
      return false;
    }
    setScreen("ready");
    // A saved model line for this part of the day stays until the new one lands; otherwise the quick line shows now.
    if (!kept) {
      setLine(data.opening);
      setOptions(quickReplies(data.options));
    }
    return true;
  });

  // Swaps the model's line in (unless the person moved on or Zeno is mid-sentence) and says it once.
  const onOpening = useEffectEvent((res: OpeningResponse | { state: "error" }, allowed: boolean) => {
    if (moved.current || screen !== "ready" || voice.phase !== "idle" || typing) return;
    const ok = res.state === "ok" && typeof res.opening === "string" && res.opening.trim() !== "";
    const text = ok ? res.opening.trim() : line;
    if (ok) {
      const next = quickReplies(res.options);
      store({ opening: { text, options: next } });
      setLine(text);
      setOptions(next);
    }
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
    const early = saved && (!saved.day.isNew || saved.setupDone) ? getJson<OpeningResponse>("/api/day/opening") : null;
    void getJson<DayResponse>("/api/day").then(async (data) => {
      if (!live || !onDay(data)) return;
      const [res, ok] = await Promise.all([early ?? getJson<OpeningResponse>("/api/day/opening"), allowed]);
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
    const opening = nextOpening.current ?? getJson<OpeningResponse>("/api/day/opening");
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
    setTyping(false);
    setSheet(null);
    setHear(false);
    setLine(SIGNED_OUT_LINE);
    setScreen("signed-out");
  }

  function remember(turns: Turn[]) {
    history.current = [...history.current, ...turns].slice(-12);
  }

  async function onUserTurn(text: string): Promise<string | null> {
    const fromChip = tapped.current;
    tapped.current = false;
    const before = latest.current;
    // The card's opening is what the person is answering.
    if (before.screen === "ready" && before.line && history.current.at(-1)?.content !== before.line) {
      remember([{ role: "assistant", content: before.line }]);
    }
    moved.current = true;
    // Answering the opening is picking one thing, so the card and the progress row move on at once.
    if (before.screen === "ready") setScreen("talk");
    if (fromChip) setTyping(false);
    setHear(false);
    setNote(null);
    setLine("");
    setOptions([]);
    setHeard(text);
    const res = await post<TalkResponse>("/api/talk", { message: text, history: history.current });
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
    const now = latest.current;
    const next = nextScreen(now.screen ?? "ready", res.actions ?? [], res.goal);
    const done = now.screen === "focus" && next === "checkin" ? openSteps(now.goal)[0] : undefined;
    if (done) {
      // Said "done" out loud: same stamp as the Done button, so the card and pills wait for it too.
      setStamping(true);
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setGoal(res.goal);
        fileAway(done, res.reply);
      }, 400);
    } else {
      setGoal(res.goal);
      setLine(res.reply);
      setScreen(next);
    }
    setOptions(quickReplies(res.options));
    // The hook says the reply; it listens again only after a spoken turn.
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

  async function finishStep(step: Step) {
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
    setGoal(res.goal);
    fileAway(step, "");
    tap(`I finished: ${step.title}.`);
  }

  async function startStep(step: Step) {
    setBusy(true);
    const res = await patchStep(step.id, "doing");
    setBusy(false);
    if (res.state === "ok") {
      setGoal(res.goal);
      setLine("");
      setScreen("focus");
    } else if (res.state === "signed-out") {
      showSignedOut();
    } else {
      setLine(SAVE_FAIL);
    }
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

  function primary() {
    const step = openSteps(goal)[0];
    if (screen === "signed-out") void signIn("google", { redirectTo: "/" });
    else if (screen === "plan" && step) void startStep(step);
    else if (screen === "focus" && step) void finishStep(step);
    else if (screen === "checkin" && step) void startStep(step);
    else if (screen === "checkin") {
      setScreen("talk");
      ask("What's the next thing you want to start?");
    }
  }

  function secondary() {
    const step = openSteps(goal)[0];
    if (screen === "plan") ask("What should change?");
    else if (screen === "focus" && step) tap(`I'm stuck on: ${step.title}.`);
    else if (screen === "checkin") {
      voice.stop();
      setTyping(false);
      setOptions([]);
      setLine("Nice work today.");
      setScreen("ready");
    }
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
      voice.stop();
    }
  }

  // ---------- First-run setup ----------
  function learn(res: SaveMemoryResponse | { state: "error" }) {
    if (res.state === "signed-out") return showSignedOut();
    if (res.state !== "ok" || !Array.isArray(res.memories)) return;
    setLearned((list) => [...list.filter((m) => !res.memories.some((n) => n.id === m.id)), ...res.memories]);
  }

  function nextSetupCard() {
    setPasting(false);
    setSetupAt(setupAt + 1);
    // The opening waits for every answer and pasted note to be saved, so it can use what was just shared.
    if (setupAt + 1 === SETUP.length) {
      nextOpening.current = Promise.allSettled(saves.current).then(() => getJson<OpeningResponse>("/api/day/opening"));
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
      post<SaveMemoryResponse>("/api/import", { text }).then((res) => {
        setReading((n) => n - 1);
        learn(res);
      }),
    );
    nextSetupCard();
  }

  function finishSetup() {
    store({ setupDone: true });
    moved.current = false;
    setPasting(false);
    setScreen("ready");
    setLine(day?.opening || greeting(new Date().getHours(), day?.firstName ?? null));
    setOptions(quickReplies(day?.options));
    setWantOpening((n) => n + 1);
  }

  // ---------- Chips ----------
  const setupCard = SETUP[setupAt];
  const name = day?.firstName ?? saved?.day.firstName;
  const setupLine =
    setupAt === 0
      ? `Hi${name ? ` ${name}` : ""}. ${setupCard.ask}`
      : setupCard
        ? setupCard.ask
        : learned.length || reading
          ? "Here's what I'll remember."
          : "All set. Tell me more anytime.";
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
        ? options.length
          ? [...options.map((label) => ({ label })), { label: "Something else", tone: "quiet" }]
          : [{ label: "Let's start", tone: "ink" }]
        : screen === "talk" && options.length
          ? [...options.map((label) => ({ label })), { label: "Something else", tone: "quiet" }]
          : [];

  function chip(i: number) {
    if (screen === "setup") return answerSetup(pasting ? 1 : i);
    if (options[i]) return tap(options[i]);
    if (screen === "ready" && !options.length) return tap("Let's start.");
    // "Something else": talk if this browser can listen, otherwise type.
    if (voice.supported) talk();
    else setTyping(true);
  }

  async function loadMemories() {
    setMemories("loading");
    const res = await getJson<MemoryResponse>("/api/memory");
    if (res.state === "signed-out") return showSignedOut();
    setMemories(res.state === "ok" ? res.memories : "error");
  }

  async function forget(id: string) {
    const before = memories;
    setNote(null);
    setMemories((list) => (Array.isArray(list) ? list.filter((m) => m.id !== id) : list));
    const res = await getJson<{ state: string }>(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.state === "signed-out") return showSignedOut();
    if (res.state !== "ok") {
      setMemories(before);
      setNote("I couldn't forget that just now. Try again?");
    }
  }

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
      note={voice.error ? VOICE_NOTE[voice.error] : screen === "setup" && !setupCard ? "You can change this anytime in Memory." : note}
      signInFailed={signInFailed}
      busy={busy || voice.phase === "thinking"}
      chips={chips}
      dots={screen === "setup" ? { at: setupAt, of: SETUP.length } : null}
      list={screen === "setup" && !setupCard ? [...learned.map((m) => m.text), ...(reading ? ["Reading your notes…"] : [])] : null}
      pasting={screen === "setup" && pasting}
      hear={hear && screen === "ready"}
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
          if (voice.phase === "listening") voice.stop();
          setTyping(true);
        },
        closeTyping: () => setTyping(false),
        send: (text) => void voice.submit(text),
        sheet(next) {
          setSheet(next);
          setNote(null);
          if (next === "memory") void loadMemories();
        },
        forget: (id) => void forget(id),
        retryMemory: () => void loadMemories(),
        mute: () => voice.setMuted(!voice.muted),
        signIn() {
          // The chooser may pick another account, so this one's day must not paint for it.
          writeSaved(null);
          cache.current = null;
          void signIn("google", { redirectTo: "/" });
        },
        signOut() {
          writeSaved(null);
          cache.current = null;
          void signOut({ redirectTo: "/" });
        },
      }}
    />
  );
}
