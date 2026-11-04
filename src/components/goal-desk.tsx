"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { CanvasBrief, Goal, MailResponse, Step } from "@/lib/day";
import { APP_NAMES } from "@/lib/connect";
import type { GoalItem } from "@/components/app-rows";
import BookingChip, { type Booking } from "@/components/booking-chip";
import type { Today } from "@/components/day-view";
import { goalLine, isEmailStep, isResearchStep, realMinutes, slotLabel, splitLater } from "@/components/day-flow";
import { Mail, MailActions } from "@/components/desk";
import { dateLabel, senderName } from "@/components/desk-rows";
import { forGoal, goalEvent } from "@/components/goal-match";
import PrepPack from "@/components/prep-pack";
import { Icon } from "@/components/icons";

// A goal's desk (Vi, Nov 3): the workstation around the step. The page draws the step card and its button between the
// strip and the steps; nothing here writes anything.

// What lies on the desk beside the step: the Canvas prompt and the email a reply plan answers.
// What she said about a step and Zeno's answer, kept on her device (round 3, Nov 4).
export type Note = { you: string; zeno: string };

export type Materials = {
  prompt?: { course: string; text: string; url?: string };
  mail?: { id: string; gmail?: string };
  sourcesOpen?: boolean; // the /preview gallery shows the links already found
  notes?: Record<string, Note[]>; // by step id
  why?: string[]; // Muse's own lines from planning this goal, kept on this device ("Why this plan", round 7)
};

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The title with its due date or rhythm, one bar segment per step, and the caption. Only finished steps fill (in ink);
// the proposed or running one is outlined, never filled, since a red fill read as progress (Nov 3). Progress in view
// keeps the goal close (goal gradient). With onClose, two quiet links beside the caption: Mark done and Remove (Nov 4,
// Vi: "no simple delete goal"), each one tap, never a browser dialog.
type StripProps = { title: string; due?: string | null; rhythm?: string | null; steps: Step[]; marked?: string; caption: string; today: string };
export function GoalStrip(props: StripProps & { onClose?(how: "remove" | "finish"): void }) {
  const { title, steps, marked, caption, today, onClose } = props;
  const when = goalLine({ due: props.due, rhythm: props.rhythm, steps }, today, zone());
  return (
    <section aria-label="Goal">
      {/* The line sits right of a short title and wraps under a long one. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h1 className="line-clamp-2 min-w-0 text-[24px] leading-8 font-bold" title={title}>
          {title}
        </h1>
        {when && <p className="whitespace-nowrap text-ink-2">{when}</p>}
      </div>
      {steps.length > 0 && (
        <>
          <ol className="bar mt-3" aria-hidden="true">
            {steps.map((step) => (
              <li
                key={step.id}
                data-state={step.status === "done" ? "done" : undefined}
                className={step.id === marked && step.status !== "done" ? "outline-2 -outline-offset-2 outline-ink" : undefined}
              />
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-ink-2">{caption}</p>
            {/* 44px tap targets that keep the caption's own line height, so the sticky strip stays as short. */}
            {onClose && (
              <p className="-mx-1 -my-2.5 flex items-center gap-1">
                <button type="button" data-answer onClick={() => onClose("finish")} data-ink className="link gap-1.5">
                  {/* Words alone on a phone, so the pair stays on the caption's line. */}
                  <Icon name="check" className="h-[18px] w-[18px] max-sm:hidden" />
                  Mark done
                </button>
                <span aria-hidden="true">·</span>
                <button type="button" data-answer onClick={() => onClose("remove")} data-ink className="link gap-1.5">
                  <Icon name="trash" className="h-[18px] w-[18px] max-sm:hidden" />
                  Remove
                </button>
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const SAID: Record<Step["status"], string> = { done: "Done", doing: "Now", todo: "To do", skipped: "Skipped" };

// One line per step, ticked in the margin when done (with the minutes it really took); the proposed or running one
// marked. The next 5 open steps show and the rest wait under "N more steps" (Nov 4: not overwhelming). With onPropose, a
// tap on a todo step proposes it.
export function StepsList({ steps, marked, onPropose }: { steps: Step[]; marked?: string; onPropose?(id: string): void }) {
  const [all, setAll] = useState(false);
  const { shown, later } = splitLater(steps, marked);
  return (
    <section aria-labelledby="desk-steps" className="mt-10 w-full max-w-[760px]">
      <h2 id="desk-steps" className="text-[20px] leading-8 font-bold">
        Steps
      </h2>
      <div className="mini steps mt-2">
        <ol className="lines">
          {(all ? steps : shown).map((step) => {
            const now = step.id === marked && step.status !== "done";
            const minutes = step.status === "done" ? realMinutes(step) : step.status === "skipped" ? null : step.minutes;
            const body = (
              <>
                <span className="steps-mark" aria-hidden="true">
                  {step.status === "done" ? "✓" : now ? "▶︎" : ""}
                </span>
                <span className="sr-only">{now && step.status === "todo" ? "Next" : SAID[step.status]}: </span>
                <span className="min-w-0 flex-1">{step.title}</span>
                {step.status === "skipped" ? (
                  <span className="shrink-0">skipped</span>
                ) : minutes ? (
                  <span className="shrink-0 font-mono text-ink-2">{minutes} min</span>
                ) : null}
              </>
            );
            return (
              <li key={step.id} data-status={now ? "now" : step.status}>
                {onPropose && step.status === "todo" && !now ? (
                  <button type="button" className="steps-row" onClick={() => onPropose(step.id)}>
                    {body}
                  </button>
                ) : (
                  <div className="steps-row">{body}</div>
                )}
              </li>
            );
          })}
          {!all && later > 0 && (
            <li>
              <button type="button" className="steps-row text-ink-2" aria-expanded={false} onClick={() => setAll(true)}>
                {later} more {later === 1 ? "step" : "steps"}
              </button>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
const HEAD = "text-[20px] leading-8 font-bold";
const everyMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};

// "For this goal" (Vi, Nov 4: "On the right, everything for that goal: calendar times, related mail, links, files from
// connected apps, your notes"): a laptop's right column, under the desk on a phone and a tablet. Each part shows only
// when it has something, and nothing here writes without a tap. Links are laid out only for a step that reads or looks
// things up; any other step offers "Find help online", searched only on a tap (each search is billed). A reply is hers to
// write: no links for an email step. Key it by the step, so a new step starts with its button again.
type AsideProps = {
  goal: Goal;
  step: Step | null;
  materials?: Materials;
  brief?: CanvasBrief;
  today: Today | null;
  offer?: Booking; // the next free time that fits the step, booked with one tap
  apps?: GoalItem[]; // the goal's own item (an app's, or the page from the web) and docs, then what connected apps have that matches it
  onAddDoc?(url: string): Promise<string>; // "Add a doc": "" once it shows, else the line saying why not
  onBook(): void;
  onUndo(): void;
};
export function GoalAside({ goal, step, materials, brief, today, offer, apps = [], onAddDoc, onBook, onUndo }: AsideProps) {
  const now = useSyncExternalStore(everyMinute, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
  const [links, setLinks] = useState(materials?.sourcesOpen ?? Boolean(step?.prep?.length));
  const { prompt, mail } = materials ?? {};
  // This step's notes, else those of the step finished last, named, so a Done never hides them (round 5).
  const own = step ? (materials?.notes?.[step.id] ?? []) : [];
  const before = own.length
    ? undefined
    : goal.steps
        .filter((one) => one.status === "done" && one.doneAt && (materials?.notes?.[one.id]?.length ?? 0) > 0)
        .sort((a, b) => Date.parse(b.doneAt ?? "") - Date.parse(a.doneAt ?? ""))[0];
  const notes = own.length ? own : before ? (materials?.notes?.[before.id] ?? []) : [];
  // The calendar only once it is connected: the goal's next event, and free time that fits the step (once booked, the
  // offer says so, so its event isn't listed twice).
  const calendar = today?.sources.calendar === "ok";
  const block = offer?.blocks[0];
  const event = calendar && now ? goalEvent(goal, today.events, now) : null;
  const next = event && !(offer?.state === "booked" && block?.start === event.start) ? event : null;
  const slot = calendar && block?.start && block.end ? { start: block.start, end: block.end } : null;
  const related =
    today?.sources.email === "ok" ? forGoal(goal, today.emails.filter((one) => !mail || one.id !== mail.id), (one) => `${one.from} ${one.subject} ${one.snippet}`) : [];
  const items = apps;
  const linkable = step !== null && !isEmailStep(step.title);
  const when = (start: string, end: string) => <span className="font-mono">{slotLabel(start, end, zone(), new Date(now))}</span>;
  // Links and From your apps show only with something in them (round 8: placeholders on every goal); until then Find
  // help online and Add a doc are quiet links at the end.
  const linked = linkable && (links || isResearchStep(step.title));
  const fromApps = Boolean(prompt || items.length > 0);
  const findHelp = linkable && !linked;
  const addDoc = onAddDoc && !fromApps;
  const why = materials?.why ?? [];
  const empty = !next && !slot && !mail && related.length === 0 && !linked && !fromApps && notes.length === 0 && why.length === 0;
  return (
    <aside aria-labelledby="goal-aside" className="aside">
      <h2 id="goal-aside" className="text-[20px] leading-8 font-bold">
        For this goal
      </h2>
      {empty ? (
        !findHelp && !addDoc && <p className="mt-2 text-ink-2">Nothing for this goal yet.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {why.length > 0 && (
            <section className="mini">
              <h3 className={`${HEAD} flex items-center gap-1.5`}>
                <Icon name="sparkle" className="h-[18px] w-[18px]" />
                Why this plan
              </h3>
              <ul className="mt-1 flex flex-col gap-1">
                {why.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </section>
          )}
          {(next || slot) && (
            <section className="mini">
              <h3 className={HEAD}>Calendar</h3>
              {next && (
                <p className="mt-1">
                  {when(next.start, next.end)} {next.title}
                </p>
              )}
              {slot && offer && (
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p>
                    {when(slot.start, slot.end)}
                    {offer.state === "booked" ? "" : " free"}
                  </p>
                  <BookingChip booking={offer} onBook={onBook} onUndo={onUndo} />
                </div>
              )}
            </section>
          )}
          {mail && <MailCard id={mail.id} gmail={mail.gmail} />}
          {today && related.length > 0 && <Mail today={{ ...today, emails: related, unreadEmail: 0 }} />}
          {linked && (
            <section className="mini">
              <h3 className={HEAD}>Links</h3>
              {/* Title in the key: a renamed step drops its links on the server, so the pack starts fresh too. */}
              <PrepPack key={`${step.id}:${step.title}`} step={step} canvas={brief} />
            </section>
          )}
          {fromApps && (
            <section className="mini">
              <h3 className={HEAD}>From your apps</h3>
              {prompt && (
                <div className="mt-1">
                  <p className="font-bold">Canvas{prompt.course ? ` · ${prompt.course}` : ""}</p>
                  {prompt.text && <p>{cut(prompt.text, 220)}</p>}
                  {prompt.url && (
                    <a href={prompt.url} target="_blank" rel="noopener noreferrer" title="Open in Canvas" className="link -ml-1 gap-1.5">
                      Open
                      <Icon name="external" className="h-[18px] w-[18px]" />
                      <span className="sr-only"> in Canvas (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              )}
              {items.map((item) => (
                <p key={`${item.app}:${item.id}`} className="mt-1">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
                    {item.title}
                    <Icon name="external" className="ml-1.5 inline h-[18px] w-[18px] align-[-3px]" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <span className="block text-ink-2">
                    {item.app === "web" ? "From the web" : APP_NAMES[item.app]}
                    {item.due ? ` · due ${dateLabel(item.due, { month: "short", day: "numeric" })}` : ""}
                  </span>
                </p>
              ))}
              {onAddDoc && <AddDoc key={goal.id} onAdd={onAddDoc} />}
            </section>
          )}
          {notes.length > 0 && <NotesCard notes={notes} from={before?.title} />}
        </div>
      )}
      {(findHelp || addDoc) && (
        <div className={`${empty ? "mt-1" : "mt-3"} flex flex-col items-start`}>
          {findHelp && (
            <button type="button" className="link -ml-1 gap-1.5" onClick={() => setLinks(true)}>
              <Icon name="search" />
              Find help
            </button>
          )}
          {addDoc && <AddDoc key={goal.id} onAdd={onAddDoc} />}
        </div>
      )}
    </aside>
  );
}

// "Add a doc" (Nov 4): a Google Doc's link, shared "Anyone with the link", shows under From your apps for this goal.
function AddDoc({ onAdd }: { onAdd(url: string): Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState("");
  if (!open)
    return (
      <button type="button" className="link -ml-1 mt-1 gap-1.5" onClick={() => setOpen(true)}>
        <Icon name="doc" />
        Add doc
      </button>
    );
  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const url = String(new FormData(event.currentTarget).get("doc") ?? "").trim();
        if (busy || !url) return;
        setBusy(true);
        const said = await onAdd(url);
        setBusy(false);
        setWhy(said);
        if (!said) setOpen(false);
      }}
    >
      <label className="flex flex-col">
        <span className="font-bold">Google Doc link</span>
        <input name="doc" required autoFocus inputMode="url" autoComplete="off" spellCheck={false} className="add" placeholder="docs.google.com/document/d/…" />
      </label>
      <div className="flex flex-wrap items-center gap-x-4">
        <button type="submit" aria-disabled={busy} className="pill pill-small pill-ink">
          {busy ? "Opening…" : "Add"}
        </button>
        <button type="button" className="link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <p role="status" className="empty:hidden">
        {why}
      </p>
    </form>
  );
}

// What she said on this step and Zeno's answers, newest last, with Copy: Lucia's questions, Ruth's taps and Maya's
// outline stay after the next reply and a reload (round 3, Nov 4). Kept on this device only.
function NotesCard({ notes, from }: { notes: Note[]; from?: string }) {
  const [copied, setCopied] = useState(false);
  const text = notes.map((note) => `You: ${note.you}\nZeno: ${note.zeno}`).join("\n\n");
  return (
    <article className="mini">
      <div className="flex items-start justify-between gap-2">
        <h3 className={HEAD}>{from ? `Your notes from "${from.replace(/[.!?]+$/, "")}"` : "Your notes"}</h3>
        <button
          type="button"
          className="icon-btn"
          aria-label={copied ? "Copied" : "Copy notes"}
          title={copied ? "Copied" : "Copy"}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));
          }}
        >
          <Icon name={copied ? "check" : "copy"} />
        </button>
      </div>
      <ul className="mt-1 flex flex-col gap-3">
        {notes.map((note, i) => (
          <li key={i}>
            <p className="text-ink-2">You: {note.you}</p>
            <p className="whitespace-pre-line">{note.zeno}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

// The email a reply plan answers, read in full from her own inbox (GET /api/mail/[id]). Its words stay in this card's
// state only: never stored, logged or sent to the model.
function MailCard({ id, gmail }: { id: string; gmail?: string }) {
  const [mail, setMail] = useState<MailResponse | null>(null);
  useEffect(() => {
    let live = true;
    void fetch(`/api/mail/${encodeURIComponent(id)}`)
      .then((response) => response.json() as Promise<MailResponse>)
      .catch((): MailResponse => ({ state: "error" }))
      .then((res) => {
        if (live) setMail(res);
      });
    return () => {
      live = false;
    };
  }, [id]);
  const open = gmail && (
    <a href={gmail} target="_blank" rel="noopener noreferrer" title="Open in Gmail" className="link -ml-1 gap-1.5">
      Gmail
      <Icon name="external" className="h-[18px] w-[18px]" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
  return (
    <article className="mini" aria-busy={!mail}>
      <h3 className={HEAD}>The email</h3>
      {!mail ? (
        <p className="mt-1 text-ink-2">Opening the email…</p>
      ) : mail.state !== "ok" ? (
        <>
          <p className="mt-1">Couldn&apos;t open it.</p>
          {open}
        </>
      ) : (
        <>
          <p className="mt-1 font-bold">{mail.subject}</p>
          <p className="text-ink-2">{senderName(mail.from)}</p>
          <div className="mail-text mt-2" tabIndex={0} aria-label="The email's text">
            {mail.text}
          </div>
          {/* Its reply drafted on a tap (Nov 4), and Open in Gmail. */}
          <div className="mt-2">
            <MailActions
              mail={{ id, from: mail.from, subject: mail.subject, snippet: "", unread: false, asks: true }}
              line=""
              text={mail.text}
              gmail={gmail?.split("#")[0]}
            />
          </div>
        </>
      )}
    </article>
  );
}
