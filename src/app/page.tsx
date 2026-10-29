"use client";

import { useSyncExternalStore } from "react";
import AuthButton from "@/components/auth-button";
import BriefCard from "@/components/brief-card";
import CalendarCard from "@/components/calendar-card";
import EmailCard from "@/components/email-card";
import TasksSection from "@/components/tasks-section";
import TalkSection from "@/components/talk-section";

export default function Home() {
  const today = useSyncExternalStore(
    () => () => {},
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    () => "",
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-16">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
            <rect width="34" height="34" rx="9" fill="#111111" />
            <path
              d="M10 11h14l-9.5 12H24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xl font-bold tracking-tight">Zeno</span>
        </div>
        <span className="flex items-center gap-4">
          <span className="hidden text-sm text-neutral-500 sm:inline">{today}</span>
          <AuthButton />
        </span>
      </header>

      <main>
        <BriefCard />

        <CalendarCard />

        <EmailCard />

        <TasksSection />

        <TalkSection />
      </main>
    </div>
  );
}
