import Foundation

// GET /api/companion/now and POST /api/companion/done answer with this: CompanionNow in src/lib/day.ts.
enum CompanionNow: Equatable, Decodable, Sendable {
  case ok(step: Step?, goal: Goal?)
  case unauthorized
  case error

  // The running step, else the current plan's next todo step.
  struct Step: Equatable, Decodable, Sendable {
    enum Status: String, Decodable, Sendable { case doing, todo }
    let id: String
    let title: String
    let minutes: Int?
    let startedAt: String?
    let status: Status
  }

  // The current plan's summary.
  struct Goal: Equatable, Decodable, Sendable {
    let title: String
    let done: Int
    let total: Int
    let due: String?
  }

  private enum Keys: String, CodingKey { case state, step, goal }

  init(from decoder: any Decoder) throws {
    let json = try decoder.container(keyedBy: Keys.self)
    switch try json.decode(String.self, forKey: .state) {
    case "ok":
      self = .ok(step: try json.decodeIfPresent(Step.self, forKey: .step), goal: try json.decodeIfPresent(Goal.self, forKey: .goal))
    case "unauthorized": self = .unauthorized
    case "error": self = .error
    default: throw DecodingError.dataCorruptedError(forKey: .state, in: json, debugDescription: "Unknown state")
    }
  }
}

let production = URL(string: "https://zeno-sigma-topaz.vercel.app")!

// Production, unless ZENO_URL names another Zeno for a local test.
func baseURL(_ environment: [String: String]) -> URL {
  guard let text = environment["ZENO_URL"] else { return production }
  if let url = URL(string: text), url.scheme == "http" || url.scheme == "https", url.host() != nil { return url }
  FileHandle.standardError.write(Data("ZENO_URL is not an http(s) address, so Zeno Clock uses production.\n".utf8))
  return production
}

// A token from Zeno's "Connect an app": zeno_ and base64url, nothing else (it becomes an HTTP header).
func isToken(_ text: String) -> Bool { text.wholeMatch(of: /zeno_[A-Za-z0-9_-]{16,}/) != nil }

// A companion call with the token as a bearer header, never cached.
func companionRequest(_ method: String, _ path: String, base: URL, token: String) -> URLRequest {
  var request = URLRequest(url: base.appending(path: path), cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
  request.httpMethod = method
  request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
  return request
}

// The answer, unauthorized for a bare 401, or error when Zeno can't be reached or answers something else.
func fetch(_ request: URLRequest) async -> CompanionNow {
  guard let (data, response) = try? await URLSession.shared.data(for: request) else { return .error }
  if let answer = try? JSONDecoder().decode(CompanionNow.self, from: data) { return answer }
  return (response as? HTTPURLResponse)?.statusCode == 401 ? .unauthorized : .error
}

// The menu bar text: "12:31 · <step title cut to 24 characters>" while a step runs, counting up from startedAt;
// otherwise "Zeno".
func menuBarTitle(_ answer: CompanionNow?, now: Date) -> String {
  guard case .ok(let step?, _) = answer, step.status == .doing, let started = step.startedAt.flatMap(isoDate) else {
    return "Zeno"
  }
  return "\(stopwatch(now.timeIntervalSince(started))) · \(cut(step.title, 24))"
}

// The Focus stopwatch, M:SS from 0:00 ("75:03" past an hour), as clock() in day-flow.ts.
func stopwatch(_ seconds: TimeInterval) -> String {
  let whole = Int(max(0, seconds))
  return "\(whole / 60):\(String(format: "%02d", whole % 60))"
}

// A title of at most size characters, ending in "…" when it was longer.
func cut(_ text: String, _ size: Int) -> String {
  text.count <= size ? text : text.prefix(size - 1).trimmingCharacters(in: .whitespaces) + "…"
}

// startedAt comes from toISOString() ("2026-11-03T21:04:05.123Z"); whole seconds parse too.
func isoDate(_ text: String) -> Date? {
  (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text)) ?? (try? Date.ISO8601FormatStyle().parse(text))
}
