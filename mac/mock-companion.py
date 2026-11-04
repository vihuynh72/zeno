#!/usr/bin/env python3
"""A stand-in for Zeno's companion API, to try the Mac clock without a real account. Made-up data only.

    python3 mac/mock-companion.py [port]                       # default 8790
    ZENO_URL=http://127.0.0.1:8790 swift run --package-path mac

Set the clock's token to zeno_mock_token_for_local_tests. GET /api/companion/now answers with a running step that
started 12:31 ago; POST /api/companion/done finishes it and answers with the next step, as todo. Each request logs one
line: the method, path, status and whether the token matched (never the header itself).
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "zeno_mock_token_for_local_tests"
GOAL = "PHIL 134 essay 2"
STEPS = [
    ("Read the prompt and underline the ask", 5),
    ("List three claims", 10),
    ("Outline the intro paragraph", 15),
    ("Find two quotes for claim one", 15),
    ("Draft the intro", 25),
]
state = {"done": 2, "started": datetime.now(timezone.utc) - timedelta(minutes=12, seconds=31)}


def now_answer():
    done, started = state["done"], state["started"]
    step = None
    if done < len(STEPS):
        title, minutes = STEPS[done]
        step = {
            "id": f"mock-step-{done + 1}",
            "title": title,
            "minutes": minutes,
            "startedAt": started.isoformat(timespec="milliseconds").replace("+00:00", "Z") if started else None,
            "status": "doing" if started else "todo",
        }
    return {"state": "ok", "step": step, "goal": {"title": GOAL, "done": done, "total": len(STEPS), "due": "2026-11-06"}}


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorized(self):
        return self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_GET(self):
        if self.path != "/api/companion/now":
            return self.reply(404, {"state": "error"})
        if not self.authorized():
            return self.reply(401, {"state": "unauthorized"})
        self.reply(200, now_answer())

    def do_POST(self):
        if self.path != "/api/companion/done":
            return self.reply(404, {"state": "error"})
        if not self.authorized():
            return self.reply(401, {"state": "unauthorized"})
        if state["started"]:  # Done finishes the running step; the next one waits as todo.
            state["done"] += 1
            state["started"] = None
        self.reply(200, now_answer())

    def log_request(self, code="-", size="-"):
        auth = "ok" if self.authorized() else ("bad" if "Authorization" in self.headers else "none")
        print(f"{datetime.now():%H:%M:%S} {self.command} {self.path} {code} auth={auth}", flush=True)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    print(f"Mock Zeno companion API on http://127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
