import AppKit
import Security
import SwiftUI

// Zeno Clock: the running step in the Mac menu bar, from Zeno's companion API (docs/PLAN-NOV3-APPS.md, section 5).
@main
struct ZenoClockApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
  @State private var companion: Companion

  init() {
    // `ZenoClock --set-token` saves a token read from stdin, for a scripted setup and the mock test; an empty line
    // removes it.
    if CommandLine.arguments.dropFirst().first == "--set-token" {
      let token = (readLine() ?? "").trimmingCharacters(in: .whitespaces)
      guard token.isEmpty || isToken(token) else { exit(2) }
      exit(Keychain.save(token, for: baseURL(ProcessInfo.processInfo.environment)) ? 0 : 1)
    }
    _companion = State(initialValue: Companion())
  }

  var body: some Scene {
    MenuBarExtra {
      ClockMenu(companion: companion)
    } label: {
      Text(menuBarTitle(companion.answer, now: companion.now)).monospacedDigit()
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  // No Dock icon, even from `swift run` (the app bundle also sets LSUIElement).
  func applicationDidFinishLaunching(_ notification: Notification) { NSApp.setActivationPolicy(.accessory) }

  // Closing the token window leaves the clock in the menu bar.
  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

// What the menu shows. It asks Zeno every 10 s and when the menu opens; the label ticks every second on its own.
@MainActor @Observable
final class Companion {
  private(set) var answer: CompanionNow?
  private(set) var offline = false
  private(set) var hasToken: Bool
  private(set) var now = Date()
  let base = baseURL(ProcessInfo.processInfo.environment)
  @ObservationIgnored private var token: String?
  @ObservationIgnored private var latest = 0
  @ObservationIgnored private var inFlight = 0
  @ObservationIgnored private var tokenWindow: NSWindow?

  init() {
    token = Keychain.read(for: base)
    hasToken = token != nil
    // Common modes, so the clock keeps ticking while the menu is open.
    let tick = Timer(timeInterval: 1, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.now = Date() } }
    RunLoop.main.add(tick, forMode: .common)
    _ = NotificationCenter.default.addObserver(forName: NSMenu.didBeginTrackingNotification, object: nil, queue: .main) {
      [weak self] _ in MainActor.assumeIsolated { self?.refresh() }
    }
    Task {
      if token == nil { showTokenWindow() }
      while true {
        refresh()
        try? await Task.sleep(for: .seconds(10))
      }
    }
  }

  func refresh() {
    if inFlight == 0 { call("GET", "api/companion/now") }
  }

  func done() { call("POST", "api/companion/done") }

  // The newest call wins, so a poll that left before Done never paints the finished step back.
  private func call(_ method: String, _ path: String) {
    guard let token else { return }
    latest += 1
    let mine = latest
    inFlight += 1
    Task {
      let result = await fetch(companionRequest(method, path, base: base, token: token))
      inFlight -= 1
      guard mine == latest else { return }
      if result == .error { offline = true } else { answer = result; offline = false }
    }
  }

  func setToken(_ value: String) -> Bool {
    guard Keychain.save(value, for: base) else { return false }
    token = value
    hasToken = true
    answer = nil
    offline = false
    tokenWindow?.close()
    call("GET", "api/companion/now")
    return true
  }

  func showTokenWindow() {
    tokenWindow?.close()
    let window = NSWindow(contentViewController: NSHostingController(rootView: TokenView(companion: self)))
    window.title = "Zeno token"
    window.styleMask = [.titled, .closable]
    window.isReleasedWhenClosed = false
    window.center()
    tokenWindow = window
    NSApp.activate()
    window.makeKeyAndOrderFront(nil)
    window.orderFrontRegardless()
  }
}

// The menu: the step and its goal, Done while a step runs, then Open Zeno, Set token… and Quit.
struct ClockMenu: View {
  let companion: Companion

  var body: some View {
    if !companion.hasToken {
      Text("Not connected yet.")
    } else if case .ok(let step, let goal)? = companion.answer {
      if let step { Text(step.status == .doing ? step.title : "Next: \(step.title)\(step.minutes.map { " · \($0) min" } ?? "")") }
      if let goal { Text("\(goal.title) · \(goal.done) of \(goal.total) done") }
      if step == nil && goal == nil { Text("No plan yet. Pick a goal in Zeno.") }
      if step?.status == .doing { Button("Done") { companion.done() } }
    } else if companion.answer == .unauthorized {
      Text("This token doesn't work. Make a new one in Zeno.")
    } else if !companion.offline {
      Text("Connecting…")
    }
    if companion.offline { Text("Can't reach Zeno. Trying again.") }
    Divider()
    Button("Open Zeno") { NSWorkspace.shared.open(companion.base) }
    Button("Set token…") { companion.showTokenWindow() }
    Divider()
    Button("Quit") { NSApp.terminate(nil) }.keyboardShortcut("q")
  }
}

// Set token…: a secure field for the token from Zeno's "Connect an app". It goes straight to the Keychain.
struct TokenView: View {
  let companion: Companion
  @State private var token = ""
  @State private var failed = false
  private var trimmed: String { token.trimmingCharacters(in: .whitespacesAndNewlines) }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Paste your Zeno token").font(.headline)
      Text("Make one in Zeno: the account menu, then Connect an app.")
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
      SecureField("zeno_…", text: $token).onSubmit(save)
      if failed { Text("Couldn't save it to the Keychain. Try again.").foregroundStyle(.secondary) }
      HStack {
        Spacer()
        Button("Cancel") { NSApp.keyWindow?.close() }.keyboardShortcut(.cancelAction)
        Button("Save", action: save).keyboardShortcut(.defaultAction).disabled(!isToken(trimmed))
      }
    }
    .padding(20)
    .frame(width: 360)
  }

  private func save() {
    guard isToken(trimmed) else { return }
    failed = !companion.setToken(trimmed)
  }
}

// The token lives in the login Keychain, one item per Zeno address, and is never printed.
enum Keychain {
  private static func item(_ base: URL) -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "Zeno Clock", kSecAttrAccount as String: base.absoluteString]
  }

  static func read(for base: URL) -> String? {
    var query = item(base)
    query[kSecReturnData as String] = true
    var data: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &data) == errSecSuccess, let data = data as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  // Replaces the token; an empty one only removes it.
  static func save(_ token: String, for base: URL) -> Bool {
    SecItemDelete(item(base) as CFDictionary)
    guard !token.isEmpty else { return true }
    var query = item(base)
    query[kSecValueData as String] = Data(token.utf8)
    return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
  }
}
