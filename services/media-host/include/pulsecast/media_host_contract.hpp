#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace pulsecast::media_host {

inline constexpr std::string_view kAdapterName = "MediaHostProcessAdapter/v1";
inline constexpr std::string_view kProbeSchema = "pulsecast.media-host-probe/v1";
inline constexpr std::string_view kCommandSchema = "pulsecast.media-host-command/v1";
inline constexpr std::string_view kVersion = "0.1.0";

struct WindowBounds {
  std::int32_t x{};
  std::int32_t y{};
  std::int32_t width{};
  std::int32_t height{};
};

struct RemotePlayWindow {
  std::string window_id;
  std::uint32_t process_id{};
  std::string title;
  std::string executable_name;
  std::string class_name;
  WindowBounds bounds;
};

std::string JsonEscape(std::string_view value);
bool IsRemotePlayCandidate(std::string_view title, std::string_view executable_name);
std::string BuildProbeJson(
    const std::vector<RemotePlayWindow>& candidates,
    std::uint32_t process_id);
bool IsProbeCommand(std::string_view input);
bool IsShutdownCommand(std::string_view input);

}  // namespace pulsecast::media_host
