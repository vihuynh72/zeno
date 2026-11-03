"use client";

import type { CanvasAssignment } from "@/lib/day";

// Connect Canvas, opened from the account menu: the school's Canvas address and a personal access token, kept only on
// this device (src/lib/canvas-store.ts syncCanvas). Contract stub (docs/PLAN-NOV2.md); the desk-ui track builds it.
// onSynced runs after Canvas accepted the link (and after a disconnect, with []), so the page can refresh the day.
export default function CanvasSheet({ account, onSynced }: { account: string; onSynced: (assignments: CanvasAssignment[]) => void }) {
  void account;
  void onSynced;
  return null;
}
