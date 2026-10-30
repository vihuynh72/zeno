"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { signIn, signOut } from "next-auth/react";
import type { DayResponse, Goal, Memory, MemoryResponse, Step, StepResponse, StepStatus, TalkResponse, Turn } from "@/lib/day";
import { useVoice } from "@/lib/use-voice";
import { greeting, nextScreen, openSteps, type Screen } from "@/components/day-flow";
import DayView, { type Sheet } from "@/components/day-view";

const SIGNED_OUT_LINE = "Zeno helps you start the thing you keep putting off.";
const LOCAL_OPENING = "I couldn't read your calendar just now, but we can still start. Want to pick one thing?";
const THINK_FAIL = "I couldn't think that through just now. Try again?";
const SAVE_FAIL = "I couldn't save that just now. Try again?";
const VOICE_NOTE = {
  blocked: "Your microphone is blocked, so typing works for now. To talk, allow the microphone from the icon in your browser's address bar.",
  unsupported: "Voice isn't available in this browser, so typing works for now.",
  network: "Voice couldn't connect just now, so typing works for now.",
};

// Network errors and non-JSON replies (a platform 504 page) come back as { state: "error" }.
async function getJson<T>(url: string, init?: RequestInit): Promise<T | { state: "error" }> {
  try {
    return (await (await fetch(url, init)).json()) as T;
  } catch {
    return { state: "error" };
  }
}

function patchStep(id: string, status: StepStatus) {
  return getJson<StepResponse>(`/api/steps/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const noStore = () => () => {};

export default function GuidedDay() {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [day, setDay] = useState<Extract<DayResponse, { state: "ok" }> | null>(null);
  const [line, setLine] = useState("One moment, I'm looking at your day.");
  const [heard, setHeard] = useState("");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [memories, setMemories] = useState<Memory[] | "loading" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [leaving, setLeaving] = useState<Step | null>(null);
  const history = useRef<Turn[]>([]);
  const tapped = useRef(false);
  // The voice hook calls onUserTurn later, so it reads the screen, goal and phase from here, not a stale render.
  const latest = useRef({ screen, goal, thinking: false });
  useEffect(() => {
    latest.current = { screen, goal, thinking: voice.phase === "thinking" };
  });

  // Auth.js sends failed sign-ins back to "/?error=...".
  const signInFailed = useSyncExternalStore(noStore, () => new URLSearchParams(window.location.search).has("error"), () => false);

  const voice = useVoice({ onUserTurn });

  useEffect(() => {
    let live = true;
    getJson<DayResponse>("/api/day").then((data) => {
      if (!live) return;
      if (data.state === "signed-out") {
        setLine(SIGNED_OUT_LINE);
        setScreen("signed-out");
        return;
      }
      if (data.state === "ok") {
        setDay(data);
        setGoal(data.goal);
      }
      setLine(greeting(new Date().getHours(), data.state === "ok" ? data.firstName : null));
      setScreen("ready");
    });
    return () => {
      live = false;
    };
  }, []);

  function showSignedOut() {
    voice.stop();
    setTyping(false);
    setSheet(null);
    setLine(SIGNED_OUT_LINE);
    setScreen("signed-out");
  }

  function remember(turns: Turn[]) {
    history.current = [...history.current, ...turns].slice(-12);
  }

  async function onUserTurn(text: string, how: "voice" | "typed"): Promise<string | null> {
    const fromPill = tapped.current;
    tapped.current = false;
    setTyping(false);
    setNote(null);
    setLine("");
    setHeard(text);
    const res = await getJson<TalkResponse>("/api/talk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history.current }),
    });
    setHeard("");
    if (res.state === "signed-out") {
      showSignedOut();
      return null;
    }
    if (res.state !== "ok" || typeof res.reply !== "string") {
      setLine(THINK_FAIL);
      setScreen((s) => (s === "ready" || s === "brief" ? "talk" : s));
      return THINK_FAIL;
    }
    remember([
      { role: "user", content: text },
      { role: "assistant", content: res.reply },
    ]);
    const before = latest.current;
    const next = nextScreen(before.screen ?? "ready", res.actions ?? [], res.goal);
    const done = before.screen === "focus" && next === "checkin" ? openSteps(before.goal)[0] : undefined;
    if (done) {
      // Said "done" out loud: same stamp as the Done button, so the card and pills wait for it too.
      setStamping(true);
      setBusy(true);
      setTimeout(() => {
        setBusy(false);
        setGoal(res.goal);
        fileAway(done, res.reply);
      }, 600);
    } else {
      setGoal(res.goal);
      setLine(res.reply);
      setScreen(next);
    }
    // A pill answers like speech, so Zeno says the reply and then listens (submit() alone won't), unless stopped meanwhile.
    if (fromPill && voice.supported && !voice.muted) {
      if (before.thinking) void voice.speak(res.reply);
      return null;
    }
    // Someone typing keeps the box (and keyboard focus) while the conversation goes on.
    if (how === "typed" && next === "talk") setTyping(true);
    return res.reply;
  }

  // The finished card slides onto the pile while the next card rises with Zeno's line.
  function fileAway(step: Step, nextLine: string) {
    setStamping(false);
    setLeaving(step);
    setLine(nextLine);
    setScreen("checkin");
    setTimeout(() => setLeaving(null), 700);
  }

  async function finishStep(step: Step) {
    setStamping(true);
    setBusy(true);
    const [res] = await Promise.all([patchStep(step.id, "done"), wait(600)]);
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

  // Words a pill says for the person; onUserTurn sees the flag.
  function tap(text: string) {
    tapped.current = true;
    void voice.submit(text);
  }

  // A question from Zeno that wants an answer: said aloud and then listened for, or typed when voice can't.
  function ask(question: string) {
    remember([{ role: "assistant", content: question }]);
    setNote(null);
    setLine(question);
    if (voice.supported && !voice.muted) void voice.speak(question);
    else setTyping(true);
  }

  function startDay() {
    const opening = day?.opening || LOCAL_OPENING;
    history.current = [{ role: "assistant", content: opening }];
    setNote(null);
    setLine(opening);
    setScreen("brief");
    // The tap is the gesture that lets the browser play Zeno's voice.
    void voice.speak(opening);
  }

  function primary() {
    const step = openSteps(goal)[0];
    if (screen === "signed-out") void signIn("google", { redirectTo: "/" });
    else if (screen === "ready") startDay();
    else if (screen === "brief") {
      setScreen("talk");
      tap("Yes, let's start.");
    } else if (screen === "plan" && step) void startStep(step);
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
    else if (screen === "brief" || screen === "checkin") {
      voice.stop();
      setTyping(false);
      setLine(screen === "brief" ? "No problem. I'm here when you're ready." : "Nice work today.");
      setScreen("ready");
    }
  }

  function talk() {
    if (!voice.supported) {
      setNote(VOICE_NOTE.unsupported);
      setTyping(true);
    } else if (voice.phase === "idle") {
      setTyping(false);
      voice.start();
    } else if (voice.phase === "speaking") {
      voice.interrupt();
    } else {
      voice.stop();
    }
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
      line={line}
      you={voice.phase === "listening" ? voice.partial : heard}
      goal={goal}
      today={day && { events: day.events, unreadEmail: day.unreadEmail, sources: day.sources }}
      memories={memories}
      sheet={sheet}
      typing={typing}
      stamping={stamping}
      leaving={leaving}
      note={voice.error ? VOICE_NOTE[voice.error] : note}
      signInFailed={signInFailed}
      busy={busy || voice.phase === "thinking"}
      voice={voice}
      on={{
        primary,
        secondary,
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
        signIn: () => void signIn("google", { redirectTo: "/" }),
        signOut: () => void signOut({ redirectTo: "/" }),
      }}
    />
  );
}
