#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace pulsecast::media_host {

inline constexpr std::string_view kAdapterName = "MediaHostProcessAdapter/v1";
inline constexpr std::string_view kProbeSchema = "pulsecast.media-host-probe/v1";
inline constexpr std::string_view kCommandSchema = "pulsecast.media-host-command/v1";
inline constexpr std::string_view kCaptureSchema = "pulsecast.media-host-capture/v1";
inline constexpr std::string_view kVersion = "0.3.0";

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

enum class CaptureState {
  idle,
  starting,
  active,
  stalled,
  failed,
  stopped,
};

enum class PreviewState {
  detached,
  waiting,
  active,
  failed,
};

struct PreviewSnapshot {
  PreviewState state{PreviewState::detached};
  std::uint64_t presented_frame_count{};
  std::uint32_t width{};
  std::uint32_t height{};
  std::string shared_handle;
  std::string error;
};

struct CaptureSnapshot {
  CaptureState state{CaptureState::idle};
  std::string window_id;
  std::uint64_t frame_count{};
  std::uint32_t width{};
  std::uint32_t height{};
  std::uint64_t last_frame_monotonic_ms{};
  std::string error;
  PreviewSnapshot preview;
};

std::string JsonEscape(std::string_view value);
bool IsRemotePlayCandidate(std::string_view title, std::string_view executable_name);
std::string BuildProbeJson(
    const std::vector<RemotePlayWindow>& candidates,
    std::uint32_t process_id,
    const CaptureSnapshot& capture = {});
std::string BuildCaptureJson(const CaptureSnapshot& capture);
std::string CaptureStateName(CaptureState state);
std::string PreviewStateName(PreviewState state);
std::string ExtractCommandString(std::string_view input, std::string_view property);
std::int32_t ExtractCommandInteger(std::string_view input, std::string_view property);
bool IsProbeCommand(std::string_view input);
bool IsShutdownCommand(std::string_view input);
bool IsCaptureStartCommand(std::string_view input);
bool IsCaptureStatusCommand(std::string_view input);
bool IsCaptureStopCommand(std::string_view input);
bool IsPreviewAttachCommand(std::string_view input);
bool IsPreviewDetachCommand(std::string_view input);

}  // namespace pulsecast::media_host
