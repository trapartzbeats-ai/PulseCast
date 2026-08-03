#include "pulsecast/media_host_contract.hpp"
#include "pulsecast/window_discovery.hpp"

#include <windows.h>

#include <iostream>
#include <string>

namespace {

std::string Probe() {
  return pulsecast::media_host::BuildProbeJson(
      pulsecast::media_host::DiscoverRemotePlayWindows(),
      GetCurrentProcessId());
}

int Serve() {
  std::string input;
  while (std::getline(std::cin, input)) {
    if (pulsecast::media_host::IsProbeCommand(input)) {
      std::cout << Probe() << std::endl;
      continue;
    }
    if (pulsecast::media_host::IsShutdownCommand(input)) {
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
  if (argument_count == 2 && std::string_view(arguments[1]) == "--version") {
    std::cout << pulsecast::media_host::kVersion << std::endl;
    return 0;
  }
  if (argument_count == 2 && std::string_view(arguments[1]) == "--probe-json") {
    std::cout << Probe() << std::endl;
    return 0;
  }
  if (argument_count == 2 && std::string_view(arguments[1]) == "--serve") {
    return Serve();
  }

  std::cerr << "Usage: PulseCastMediaHost --probe-json | --serve | --version" << std::endl;
  return 2;
}
