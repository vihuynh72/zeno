// swift-tools-version: 6.0
import PackageDescription

// Zeno Clock, the Mac menu-bar clock: `swift run` for a quick try, ./make-app.sh for "Zeno Clock.app". No dependencies.
let package = Package(
  name: "ZenoClock",
  platforms: [.macOS(.v14)],
  targets: [
    .executableTarget(name: "ZenoClock"),
    .testTarget(name: "ZenoClockTests", dependencies: ["ZenoClock"]),
  ]
)
