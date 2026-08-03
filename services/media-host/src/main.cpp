#include "pulsecast/media_host_contract.hpp"
#include "pulsecast/window_capture.hpp"
#include "pulsecast/window_discovery.hpp"

#include <windows.h>

#include <algorithm>
#include <iostream>
#include <string>
#include <winrt/base.h>

namespace {

std::string Probe(const pulsecast::media_host::WindowCapture& capture) {
  return pulsecast::media_host::BuildProbeJson(
      pulsecast::media_host::DiscoverRemotePlayWindows(),
      GetCurrentProcessId(),
      capture.Snapshot());
}

int Serve() {
  pulsecast::media_host::WindowCapture capture;
  std::string input;
  while (std::getline(std::cin, input)) {
    if (pulsecast::media_host::IsProbeCommand(input)) {
      std::cout << Probe(capture) << std::endl;
      continue;
    }
    if (pulsecast::media_host::IsCaptureStartCommand(input)) {
      const auto window_id = pulsecast::media_host::ExtractCommandString(input, "windowId");
      const auto candidates = pulsecast::media_host::DiscoverRemotePlayWindows();
      const auto selected = std::find_if(
          candidates.begin(), candidates.end(), [&window_id](const auto& candidate) {
            return candidate.window_id == window_id;
          });
      if (selected == candidates.end()) {
        std::cout << "{\"schema\":\"pulsecast.media-host-error/v1\","
                     "\"code\":\"WINDOW_NOT_FOUND\","
                     "\"message\":\"The selected PS Remote Play window is unavailable.\"}"
                  << std::endl;
      } else {
        std::cout << pulsecast::media_host::BuildCaptureJson(capture.Start(*selected))
                  << std::endl;
      }
      continue;
    }
    if (pulsecast::media_host::IsCaptureStatusCommand(input)) {
      std::cout << pulsecast::media_host::BuildCaptureJson(capture.Snapshot()) << std::endl;
      continue;
    }
    if (pulsecast::media_host::IsCaptureStopCommand(input)) {
      std::cout << pulsecast::media_host::BuildCaptureJson(capture.Stop()) << std::endl;
      continue;
    }
    if (pulsecast::media_host::IsShutdownCommand(input)) {
      capture.Stop();
      std::cout << "{\"schema\":\"pulsecast.media-host-event/v1\","
                   "\"type\":\"shutdown-complete\"}"
                << std::endl;
      return 0;
    }
    std::cout << "{\"schema\":\"pulsecast.media-host-error/v1\","
                 "\"code\":\"COMMAND_UNSUPPORTED\","
                 "\"message\":\"Only probe and shutdown are available in Gate 1 discovery.\"}"
              << std::endl;
  }
  return 0;
}

}  // namespace

int main(int argument_count, char** arguments) {
  winrt::init_apartment(winrt::apartment_type::multi_threaded);
  pulsecast::media_host::WindowCapture capture;
  if (argument_count == 2 && std::string_view(arguments[1]) == "--version") {
    std::cout << pulsecast::media_host::kVersion << std::endl;
    return 0;
  }
  if (argument_count == 2 && std::string_view(arguments[1]) == "--probe-json") {
    std::cout << Probe(capture) << std::endl;
    return 0;
  }
  if (argument_count == 2 && std::string_view(arguments[1]) == "--serve") {
    return Serve();
  }

  std::cerr << "Usage: PulseCastMediaHost --probe-json | --serve | --version" << std::endl;
  return 2;
}
