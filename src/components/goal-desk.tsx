"use client";

import { useEffect, useState } from "react";
import type { CanvasBrief, MailResponse, Step } from "@/lib/day";
import { goalLine, isEmailStep, isResearchStep, realMinutes, splitLater } from "@/components/day-flow";
import { senderName } from "@/components/desk-rows";
import PrepPack from "@/components/prep-pack";

// A goal's desk (Vi, Nov 3): the workstation around the step. The page draws the step card and its button between the
// strip and the steps; nothing here writes anything.

// What lies on the desk beside the step: the Canvas prompt, where she stopped, and the email a reply plan answers.
export type Materials = {
  prompt?: { course: string; text: string; url?: string };
  stopped?: string | null;
  mail?: { id: string; gmail?: string };
  sourcesOpen?: boolean; // the /preview gallery shows the links already found
};

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The title with its due date or rhythm, one bar segment per step, and the caption. Only finished steps fill (in ink);
// the proposed or running one is outlined, never filled, since a red fill read as progress (Nov 3). Progress in view
// keeps the goal close (goal gradient).
export function GoalStrip(props: { title: string; due?: string | null; rhythm?: string | null; steps: Step[]; marked?: string; caption: string; today: string }) {
  const { title, steps, marked, caption, today } = props;
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
          <p className="mt-2 text-ink-2">{caption}</p>
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

// "For this step" (Nov 4): each material a small card. Helpful links are laid out only for a step that reads or looks
// things up; any other step offers them with a small "Find help online". They are searched only on a tap (each search is
// billed), unless found before (key this by the step, so a new step starts with its button again). A reply is hers to
// write: no links for an email step.
export function DeskMaterials({ materials, step, brief }: { materials?: Materials; step: Step | null; brief?: CanvasBrief }) {
  const [links, setLinks] = useState(materials?.sourcesOpen ?? Boolean(step?.prep?.length));
  const { prompt, stopped, mail } = materials ?? {};
  const linkable = step !== null && !isEmailStep(step.title);
  const card = linkable && (links || isResearchStep(step.title));
  const find = linkable && !card && (
    <button type="button" className="link -ml-1" onClick={() => setLinks(true)}>
      Find help online
    </button>
  );
  if (!mail && !prompt && !stopped && !card) return find ? <div className="mt-6 w-full max-w-[760px]">{find}</div> : null;
  return (
    <section aria-labelledby="desk-materials" className="mt-10 w-full max-w-[760px]">
      <h2 id="desk-materials" className="text-[20px] leading-8 font-bold">
        For this step
      </h2>
      {/* One column of whole cards on a phone: a card never runs past the screen's edge (live, Nov 3). */}
      <div className="mt-2 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        {mail && <MailCard id={mail.id} gmail={mail.gmail} />}
        {prompt && (
          <article className="mini">
            <h3 className="font-bold text-ink-2">The prompt{prompt.course ? ` · ${prompt.course}` : ""}</h3>
            {prompt.text && <p className="mt-1">{cut(prompt.text, 220)}</p>}
            {prompt.url && (
              <a href={prompt.url} target="_blank" rel="noopener noreferrer" className="link -ml-1">
                Open in Canvas<span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </article>
        )}
        {stopped && (
          <article className="mini">
            <h3 className="font-bold text-ink-2">Where you stopped</h3>
            <p className="mt-1">{stopped}</p>
          </article>
        )}
        {card &&
          (links ? (
            <article className="mini">
              <h3 className="font-bold text-ink-2">Helpful links</h3>
              {/* Title in the key: a renamed step drops its links on the server, so the pack starts fresh too. */}
              <PrepPack key={`${step.id}:${step.title}`} step={step} canvas={brief} />
            </article>
          ) : (
            <button type="button" className="mini tool" onClick={() => setLinks(true)}>
              Find helpful links
            </button>
          ))}
      </div>
      {find && <div className="mt-2">{find}</div>}
    </section>
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
    <a href={gmail} target="_blank" rel="noopener noreferrer" className="link -ml-1">
      Open in Gmail<span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
  return (
    <article className="mini sm:col-span-2" aria-busy={!mail}>
      <h3 className="font-bold text-ink-2">The email</h3>
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
          {open}
        </>
      )}
    </article>
  );
}
