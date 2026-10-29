"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import type { CalendarEvent } from "@/lib/calendar";

type State =
  | "loading"
  | "signed-out"
  | "reauth"
  | "no-calendar-access"
  | "not-enabled"
  | "error"
  | "ok";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function CalendarCard() {
  const [state, setState] = useState<State>("loading");
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/calendar/today")
      .then(async (response) => {
        const data = (await response.json()) as {
          state: State;
          events: CalendarEvent[];
        };
        if (!active) return;
        setState(data.state);
        setEvents(data.events ?? []);
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold tracking-tight">Today on your calendar</h2>
      <div className="mt-3 rounded-2xl border border-neutral-200 p-5">
        {state === "loading" && <p>Reading your calendar...</p>}
        {state === "signed-out" && (
          <p>
            Sign in with Google above and this will show your real events for today. Until
            then, nothing here is made up.
          </p>
        )}
        {state === "reauth" && (
          <>
            <p>Your Google connection expired.</p>
            <button
              onClick={() => signIn("google", { redirectTo: "/" })}
              className="mt-3 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
            >
              Reconnect Google
            </button>
          </>
        )}
        {state === "no-calendar-access" && (
          <p>
            You are signed in, but calendar access is missing. Sign out and sign in again so
            Google can ask for calendar permission.
          </p>
        )}
        {state === "not-enabled" && (
          <p>
            Google can see your account, but the Calendar API is not switched on for this
            project yet. In Google Cloud Console, open APIs and Services, then Library, search
            Google Calendar API, and press Enable. Then refresh this page.
          </p>
        )}
        {state === "error" && (
          <p>Google Calendar did not answer. Your goals below still work. Try again later.</p>
        )}
        {state === "ok" && events.length === 0 && (
          <p>No events today. The day is open, which makes it a good goal day.</p>
        )}
        {state === "ok" && events.length > 0 && (
          <ul className="divide-y divide-neutral-200">
            {events.map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="font-medium">{event.title}</span>
                <span className="shrink-0 text-sm text-neutral-500">
                  {event.allDay ? "All day" : `${formatTime(event.start)} - ${formatTime(event.end)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
