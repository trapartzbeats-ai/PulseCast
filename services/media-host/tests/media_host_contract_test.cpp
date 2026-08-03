#include "pulsecast/media_host_contract.hpp"

#include <iostream>
#include <string>
#include <vector>

namespace {

int failures = 0;

void Expect(bool condition, const char* message) {
  if (condition) {
    return;
  }
  std::cerr << "FAIL: " << message << '\n';
  ++failures;
}

}  // namespace

int main() {
  using pulsecast::media_host::BuildProbeJson;
  using pulsecast::media_host::IsProbeCommand;
  using pulsecast::media_host::IsRemotePlayCandidate;
  using pulsecast::media_host::IsShutdownCommand;
  using pulsecast::media_host::JsonEscape;
  using pulsecast::media_host::RemotePlayWindow;
  using pulsecast::media_host::WindowBounds;

  Expect(JsonEscape("A\"B\\C\n") == "A\\\"B\\\\C\\n", "JSON escaping");
  Expect(IsRemotePlayCandidate("PS Remote Play", "RemotePlay.exe"), "official title");
  Expect(IsRemotePlayCandidate("Game", "PSRemotePlay.exe"), "official executable");
  Expect(!IsRemotePlayCandidate("Remote Desktop", "mstsc.exe"), "reject unrelated window");
  Expect(
      IsProbeCommand(
          "{\"schema\":\"pulsecast.media-host-command/v1\",\"type\":\"probe\"}"),
      "versioned probe command");
  Expect(IsShutdownCommand("shutdown"), "shutdown command");

  const std::vector<RemotePlayWindow> windows{{
      .window_id = "0x1234",
      .process_id = 42,
      .title = "PS Remote Play",
      .executable_name = "RemotePlay.exe",
      .class_name = "RemotePlayWindow",
      .bounds = WindowBounds{.x = 10, .y = 20, .width = 1280, .height = 720},
  }};
  const auto json = BuildProbeJson(windows, 99);
  Expect(json.find("pulsecast.media-host-probe/v1") != std::string::npos, "probe schema");
  Expect(json.find("MediaHostProcessAdapter/v1") != std::string::npos, "adapter name");
  Expect(json.find("\"proofType\":\"real\"") != std::string::npos, "real discovery");
  Expect(json.find("\"window-capture\",\"proofType\":\"unavailable\"") !=
             std::string::npos,
         "capture remains unavailable");
  Expect(json.find("\"candidateCount\":1") != std::string::npos, "candidate count");

  if (failures == 0) {
    std::cout << "PulseCast Media Host contract tests passed" << std::endl;
  }
  return failures == 0 ? 0 : 1;
}
