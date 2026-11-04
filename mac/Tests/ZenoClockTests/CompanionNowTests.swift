import Foundation
import XCTest

@testable import ZenoClock

// The CompanionNow shape from src/lib/day.ts, the menu bar text and the request. Made-up data only.
final class CompanionNowTests: XCTestCase {
  private func decode(_ json: String) throws -> CompanionNow {
    try JSONDecoder().decode(CompanionNow.self, from: Data(json.utf8))
  }

  private let running = """
    {"state":"ok","step":{"id":"s3","title":"Outline the intro paragraph","minutes":15,
    "startedAt":"2026-11-03T21:00:00.000Z","status":"doing"},"goal":{"title":"PHIL 134 essay 2","done":2,"total":5,
    "due":"2026-11-06"}}
    """

  func testDecodesEveryShape() throws {
    XCTAssertEqual(
      try decode(running),
      .ok(
        step: .init(id: "s3", title: "Outline the intro paragraph", minutes: 15, startedAt: "2026-11-03T21:00:00.000Z", status: .doing),
        goal: .init(title: "PHIL 134 essay 2", done: 2, total: 5, due: "2026-11-06")))
    XCTAssertEqual(
      try decode(#"{"state":"ok","step":{"id":"s4","title":"Draft the intro","minutes":null,"startedAt":null,"status":"todo"},"goal":{"title":"CS 146 lab","done":0,"total":3,"due":null}}"#),
      .ok(step: .init(id: "s4", title: "Draft the intro", minutes: nil, startedAt: nil, status: .todo), goal: .init(title: "CS 146 lab", done: 0, total: 3, due: nil)))
    XCTAssertEqual(try decode(#"{"state":"ok","step":null,"goal":null}"#), .ok(step: nil, goal: nil))
    XCTAssertEqual(try decode(#"{"state":"unauthorized"}"#), .unauthorized)
    XCTAssertEqual(try decode(#"{"state":"error"}"#), .error)
    XCTAssertThrowsError(try decode(#"{"state":"signed-out"}"#), "a state CompanionNow doesn't have")
    XCTAssertThrowsError(try decode(#"{"state":"ok","step":{"id":"s","title":"t","minutes":5,"startedAt":null,"status":"done"},"goal":null}"#), "a done step is never the one to show")
  }

  func testStopwatchMatchesTheWebClock() {
    XCTAssertEqual(stopwatch(0), "0:00")
    XCTAssertEqual(stopwatch(65.9), "1:05")
    XCTAssertEqual(stopwatch(4503), "75:03")
    XCTAssertEqual(stopwatch(-0.7), "0:00", "a start a moment ahead of this Mac's clock")
  }

  func testMenuBarTitle() throws {
    let started = isoDate("2026-11-03T21:00:00.000Z")!
    let answer = try decode(running)
    XCTAssertEqual(menuBarTitle(answer, now: started.addingTimeInterval(751.4)), "12:31 · Outline the intro parag…")
    XCTAssertEqual(menuBarTitle(answer, now: started.addingTimeInterval(-3)), "0:00 · Outline the intro parag…")
    XCTAssertEqual(menuBarTitle(.ok(step: .init(id: "s", title: "Read the prompt", minutes: 5, startedAt: "2026-11-03T21:00:00Z", status: .doing), goal: nil), now: started.addingTimeInterval(61)), "1:01 · Read the prompt", "whole seconds parse too")
    XCTAssertEqual(menuBarTitle(.ok(step: .init(id: "s", title: "Read the prompt", minutes: 5, startedAt: nil, status: .todo), goal: nil), now: started), "Zeno", "a todo step doesn't count")
    XCTAssertEqual(menuBarTitle(.ok(step: .init(id: "s", title: "Read the prompt", minutes: 5, startedAt: "not a date", status: .doing), goal: nil), now: started), "Zeno")
    XCTAssertEqual(menuBarTitle(.ok(step: nil, goal: nil), now: started), "Zeno")
    XCTAssertEqual(menuBarTitle(.unauthorized, now: started), "Zeno")
    XCTAssertEqual(menuBarTitle(nil, now: started), "Zeno")
  }

  func testCut() {
    XCTAssertEqual(cut("List three claims", 24), "List three claims")
    XCTAssertEqual(cut(String(repeating: "a", count: 24), 24), String(repeating: "a", count: 24))
    XCTAssertEqual(cut("Find two quotes for the claim", 24).count, 24)
    XCTAssertEqual(cut("Read the whole chapter on the war", 24), "Read the whole chapter…", "no space before the ellipsis")
  }

  func testRequest() throws {
    let request = companionRequest("POST", "api/companion/done", base: production, token: "zeno_abcdefghijklmnop")
    XCTAssertEqual(request.url?.absoluteString, "https://zeno-sigma-topaz.vercel.app/api/companion/done")
    XCTAssertEqual(request.httpMethod, "POST")
    XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer zeno_abcdefghijklmnop")
    XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
    let local = companionRequest("GET", "api/companion/now", base: URL(string: "http://127.0.0.1:8790/")!, token: "zeno_abcdefghijklmnop")
    XCTAssertEqual(local.url?.absoluteString, "http://127.0.0.1:8790/api/companion/now", "a trailing slash on ZENO_URL")
    XCTAssertEqual(local.httpMethod, "GET")
  }

  func testBaseURL() {
    XCTAssertEqual(baseURL([:]), production)
    XCTAssertEqual(baseURL(["ZENO_URL": "http://127.0.0.1:8790"]).absoluteString, "http://127.0.0.1:8790")
    XCTAssertEqual(baseURL(["ZENO_URL": "127.0.0.1:8790"]), production, "no scheme")
    XCTAssertEqual(baseURL(["ZENO_URL": "file:///tmp"]), production)
  }

  // The calls behind the poll and Done, for real: start a fresh `python3 mac/mock-companion.py`, then
  // ZENO_MOCK=http://127.0.0.1:8790 swift test. Skipped without ZENO_MOCK.
  func testAgainstTheMock() async throws {
    guard let mock = ProcessInfo.processInfo.environment["ZENO_MOCK"].flatMap(URL.init(string:)) else {
      throw XCTSkip("Set ZENO_MOCK to a fresh mock's address.")
    }
    let token = "zeno_mock_token_for_local_tests"
    let now = await fetch(companionRequest("GET", "api/companion/now", base: mock, token: token))
    guard case .ok(let running?, let goal?) = now else { return XCTFail("no running step: \(now)") }
    XCTAssertEqual(running.status, .doing)
    XCTAssertEqual(goal.done, 2)
    XCTAssertTrue(menuBarTitle(now, now: Date()).hasSuffix(" · Outline the intro parag…"))
    XCTAssertGreaterThanOrEqual(Date().timeIntervalSince(isoDate(running.startedAt ?? "")!), 751, "started 12:31 before the mock began")
    let done = await fetch(companionRequest("POST", "api/companion/done", base: mock, token: token))
    guard case .ok(let next?, let after?) = done else { return XCTFail("no next step: \(done)") }
    XCTAssertEqual(next.status, .todo)
    XCTAssertNotEqual(next.id, running.id)
    XCTAssertEqual(after.done, 3)
    XCTAssertEqual(menuBarTitle(done, now: Date()), "Zeno", "nothing runs after Done")
    let refused = await fetch(companionRequest("GET", "api/companion/now", base: mock, token: "zeno_not_the_mock_token"))
    XCTAssertEqual(refused, .unauthorized)
    let unreachable = await fetch(companionRequest("GET", "api/companion/now", base: URL(string: "http://127.0.0.1:9")!, token: token))
    XCTAssertEqual(unreachable, .error, "nothing listens on port 9")
  }

  func testIsToken() {
    XCTAssertTrue(isToken("zeno_" + String(repeating: "Ab3-_", count: 8) + "xyz"))
    XCTAssertTrue(isToken("zeno_mock_token_for_local_tests"))
    XCTAssertFalse(isToken("zeno_short"))
    XCTAssertFalse(isToken("Bearer zeno_abcdefghijklmnopqrst"))
    XCTAssertFalse(isToken("zeno_abcdefghijklmnop\r\nX-Other: 1"), "it becomes an HTTP header")
    XCTAssertFalse(isToken("sk-abcdefghijklmnopqrstuvwxyz"))
  }
}
