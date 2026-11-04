// What connected apps bring to the page (Nov 4, src/lib/connect.ts): "From your apps" when adding a goal, and the items
// under "For this goal". Pure, so app-rows.check.ts runs in plain node.
import { APP_NAMES, type App, type AppItem } from "@/lib/connect";
import type { Goal, GoalSource } from "@/lib/day";
import type { CanvasItem } from "@/lib/canvas-store";
import { dueLine, type PanelRow } from "@/components/day-flow";
import { forGoal } from "@/components/goal-match";
import { localDate } from "@/lib/tz";

// An app's item, Canvas's assignments too.
export type FromApp = Omit<AppItem, "app"> & { app: App | "canvas" };

// Canvas's last sync as items, due on the person's own day.
export const canvasItems = (list: CanvasItem[] | null, zone: string): FromApp[] =>
  (list ?? []).map((one) => ({
    app: "canvas",
    id: String(one.id),
    title: one.title.slice(0, 120),
    url: one.url,
    kind: "task",
    due: one.due ? localDate(zone, new Date(one.due)) : null,
    detail: one.course || null,
  }));

const key = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// From your apps: what isn't a goal yet (made from it, or one with the same title), soonest due first, undated last.
export function waiting(items: FromApp[], goals: Goal[]): FromApp[] {
  const made = new Set(goals.flatMap((goal) => (goal.source ? [`${goal.source.app}:${goal.source.id}`] : [])));
  const titles = new Set(goals.map((goal) => key(goal.title)));
  return items
    .filter((item) => !made.has(`${item.app}:${item.id}`) && !titles.has(key(item.title)))
    .sort((a, b) => Number(!a.due) - Number(!b.due) || (a.due ?? "").localeCompare(b.due ?? ""));
}

export const appRow = (item: FromApp, today: string): PanelRow => ({
  title: item.title,
  aside: item.app === "canvas" ? "Canvas" : APP_NAMES[item.app],
  line: item.app === "canvas" ? (item.detail ?? "") : "",
  when: item.due ? dueLine(item.due, today) : "",
});

// "Make it a goal": the item's title, due date and detail as her words, and the item kept on the goal.
export const goalText = (item: FromApp) => [item.title, item.due ? `Due ${item.due}` : "", item.app === "canvas" ? "" : (item.detail ?? "")].filter(Boolean).join("\n");
export const sourceOf = (item: FromApp): GoalSource => ({ app: item.app, id: item.id, url: item.url, title: item.title });

// For this goal: the item it was made from (as the app has it now, else as it was saved), its docs, then other items that
// match it. Canvas has its own card there.
export function goalItems(goal: Goal, items: AppItem[], docs: AppItem[]): AppItem[] {
  const from = goal.source;
  const own: AppItem | null =
    from && from.app !== "canvas"
      ? (items.find((item) => item.app === from.app && item.id === from.id) ?? {
          ...from,
          app: from.app,
          kind: from.app === "gdocs" ? "doc" : "task",
          due: null,
          detail: null,
        })
      : null;
  const rest = items.filter((item) => !(own && item.app === own.app && item.id === own.id));
  // An issue's key ("ENG-15", Jira's "MY_APP-7") says which team, not what it is about, so it never makes a match.
  const all = [...(own ? [own] : []), ...docs, ...forGoal(goal, rest, (item) => `${item.title.replace(/^[A-Z][A-Z0-9_]*-\d+ /, "")} ${item.detail ?? ""}`)];
  return all.filter((item, i) => all.findIndex((one) => one.app === item.app && one.id === item.id) === i);
}
