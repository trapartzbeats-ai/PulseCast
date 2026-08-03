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
  using pulsecast::media_host::BuildCaptureJson;
  using pulsecast::media_host::CaptureSnapshot;
  using pulsecast::media_host::CaptureState;
  using pulsecast::media_host::ExtractCommandString;
  using pulsecast::media_host::IsCaptureStartCommand;
  using pulsecast::media_host::IsPreviewAttachCommand;
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
  const std::string start_command =
      "{\"schema\":\"pulsecast.media-host-command/v1\","
      "\"type\":\"capture-start\",\"windowId\":\"0x1234\"}";
  Expect(IsCaptureStartCommand(start_command), "versioned capture start command");
  Expect(ExtractCommandString(start_command, "windowId") == "0x1234", "extract window ID");
  const std::string preview_command =
      "{\"schema\":\"pulsecast.media-host-command/v1\","
      "\"type\":\"preview-attach\",\"parentWindowId\":\"0x5678\","
      "\"x\":10,\"y\":20,\"width\":640,\"height\":360}";
  Expect(IsPreviewAttachCommand(preview_command), "versioned preview attach command");
  Expect(
      pulsecast::media_host::ExtractCommandInteger(preview_command, "width") == 640,
      "extract preview width");

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
  Expect(json.find("\"window-capture\",\"proofType\":\"real\"") !=
             std::string::npos,
         "real Windows Graphics Capture implementation");
  Expect(json.find("\"candidateCount\":1") != std::string::npos, "candidate count");
  const auto active_capture = BuildCaptureJson(CaptureSnapshot{
      .state = CaptureState::active,
      .window_id = "0x1234",
      .frame_count = 12,
      .width = 1280,
      .height = 720,
      .last_frame_monotonic_ms = 99,
  });
  Expect(active_capture.find("\"proofType\":\"real\"") != std::string::npos, "real frames");
  Expect(active_capture.find("\"frameCount\":12") != std::string::npos, "frame telemetry");
  Expect(
      active_capture.find("\"preview\":{\"proofType\":\"unavailable\"") !=
          std::string::npos,
      "preview unavailable before presentation");

  if (failures == 0) {
    std::cout << "PulseCast Media Host contract tests passed" << std::endl;
  }
  return failures == 0 ? 0 : 1;
}
