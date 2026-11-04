"use client";

import { useEffect } from "react";
import { connectKey, type App } from "@/lib/connect";

// The token in the hash (#token=…) is kept in this browser for this account, the hash is cleared so the token never
// sits in history, and the page goes home, where Your apps says it is connected. No token (she said no): home as it was.
export default function KeepToken({ app, account }: { app: App; account: string }) {
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token")?.trim();
    history.replaceState(null, "", window.location.pathname);
    try {
      if (token) localStorage.setItem(connectKey(app, account), token);
    } catch {
      // Storage blocked: nothing kept, and Your apps offers Connect again.
    }
    window.location.replace(token ? `/?connected=${app}` : "/");
  }, [app, account]);
  return null;
}
