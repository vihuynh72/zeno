"use client";

import { useEffect, useState } from "react";

type Task = { id: string; title: string; done: boolean };
type Mode = "loading" | "saved" | "local";

const SAMPLE_TASKS: Task[] = [
  { id: "sample-1", title: "Write the first paragraph of the essay", done: false },
  { id: "sample-2", title: "Reply to the two emails waiting since yesterday", done: false },
  { id: "sample-3", title: "Book the study room for Thursday", done: true },
];

export default function TasksSection() {
  const [mode, setMode] = useState<Mode>("loading");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/tasks")
      .then(async (response) => {
        const data = (await response.json()) as { state: string; tasks: Task[] };
        if (!active) return;
        if (data.state === "ok") {
          setMode("saved");
          setTasks(data.tasks ?? []);
        } else {
          setMode("local");
          setTasks(SAMPLE_TASKS);
        }
      })
      .catch(() => {
        if (active) {
          setMode("local");
          setTasks(SAMPLE_TASKS);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    if (mode === "saved") {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await response.json()) as { task?: Task };
      if (data.task) setTasks((prev) => [...prev, data.task as Task]);
    } else {
      setTasks((prev) => [...prev, { id: `local-${Date.now()}`, title, done: false }]);
    }
  }

  async function toggle(task: Task) {
    const next = { ...task, done: !task.done };
    setTasks((prev) => prev.map((item) => (item.id === task.id ? next : item)));
    if (mode === "saved") {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: next.done }),
      });
    }
  }

  async function remove(task: Task) {
    setTasks((prev) => prev.filter((item) => item.id !== task.id));
    if (mode === "saved") {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold tracking-tight">Today&apos;s goals</h2>
      {mode === "local" && (
        <p className="mt-1 text-sm text-neutral-500">
          Sample goals on this page only. Sign in and connect the database and your goals
          will save to your account.
        </p>
      )}
      {mode === "saved" && (
        <p className="mt-1 text-sm text-neutral-500">Saved to your account.</p>
      )}
      {mode === "loading" ? (
        <p className="mt-3">Loading your goals...</p>
      ) : (
        <>
          {tasks.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-neutral-200 p-5">
              No goals yet. Add the first one below. Small is good.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggle(task)}
                    className="h-5 w-5 shrink-0 accent-black"
                    aria-label={`Mark done: ${task.title}`}
                  />
                  <span className={`w-full ${task.done ? "text-neutral-500 line-through" : ""}`}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => remove(task)}
                    className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    aria-label={`Remove: ${task.title}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && addTask()}
              placeholder="Add a goal for today"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-black"
            />
            <button
              onClick={addTask}
              className="shrink-0 rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black active:scale-[0.98]"
            >
              Add
            </button>
          </div>
        </>
      )}
    </section>
  );
}
