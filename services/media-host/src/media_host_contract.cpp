#include "pulsecast/media_host_contract.hpp"

#include <algorithm>
#include <cctype>
#include <iomanip>
#include <sstream>

namespace pulsecast::media_host {
namespace {

std::string Lower(std::string_view value) {
  std::string lowered(value);
  std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char character) {
    return static_cast<char>(std::tolower(character));
  });
  return lowered;
}

bool Contains(std::string_view value, std::string_view fragment) {
  return value.find(fragment) != std::string_view::npos;
}

bool IsVersionedCommand(std::string_view input, std::string_view type) {
  const auto type_fragment = std::string{"\"type\":\""} + std::string{type} + "\"";
  return Contains(input, kCommandSchema) && Contains(input, type_fragment);
}

}  // namespace

std::string JsonEscape(std::string_view value) {
  std::ostringstream output;
  for (const unsigned char character : value) {
    switch (character) {
      case '\"':
        output << "\\\"";
        break;
      case '\\':
        output << "\\\\";
        break;
      case '\b':
        output << "\\b";
        break;
      case '\f':
        output << "\\f";
        break;
      case '\n':
        output << "\\n";
        break;
      case '\r':
        output << "\\r";
        break;
      case '\t':
        output << "\\t";
        break;
      default:
        if (character < 0x20U) {
          output << "\\u" << std::hex << std::setw(4) << std::setfill('0')
                 << static_cast<int>(character) << std::dec;
        } else {
          output << static_cast<char>(character);
        }
        break;
    }
  }
  return output.str();
}

bool IsRemotePlayCandidate(std::string_view title, std::string_view executable_name) {
  const auto lower_title = Lower(title);
  const auto lower_executable = Lower(executable_name);
  return Contains(lower_title, "ps remote play") ||
         Contains(lower_title, "playstation remote play") ||
         Contains(lower_executable, "remoteplay.exe") ||
         Contains(lower_executable, "psremoteplay.exe");
}

std::string BuildProbeJson(
    const std::vector<RemotePlayWindow>& candidates,
    std::uint32_t process_id,
    const CaptureSnapshot& capture) {
  std::ostringstream output;
  output << "{\"schema\":\"" << kProbeSchema << "\","
         << "\"adapter\":\"" << kAdapterName << "\","
         << "\"version\":\"" << kVersion << "\","
         << "\"proofType\":\"real\","
         << "\"processId\":" << process_id << ','
         << "\"capabilities\":["
         << "{\"id\":\"window-discovery\",\"proofType\":\"real\",\"state\":\"ready\"},"
         << "{\"id\":\"window-capture\",\"proofType\":\"real\",\"state\":\"ready\"},"
         << "{\"id\":\"process-audio\",\"proofType\":\"unavailable\",\"state\":\"unavailable\"},"
         << "{\"id\":\"program-composition\",\"proofType\":\"unavailable\",\"state\":\"unavailable\"}],"
         << "\"remotePlay\":{\"state\":\""
         << (candidates.empty() ? "not-detected" : "detected")
         << "\",\"candidateCount\":" << candidates.size() << "},"
         << "\"candidates\":[";

  for (std::size_t index = 0; index < candidates.size(); ++index) {
    if (index > 0) {
      output << ',';
    }
    const auto& candidate = candidates[index];
    output << "{\"windowId\":\"" << JsonEscape(candidate.window_id) << "\","
           << "\"processId\":" << candidate.process_id << ','
           << "\"title\":\"" << JsonEscape(candidate.title) << "\","
           << "\"executableName\":\"" << JsonEscape(candidate.executable_name) << "\","
           << "\"className\":\"" << JsonEscape(candidate.class_name) << "\","
           << "\"bounds\":{\"x\":" << candidate.bounds.x
           << ",\"y\":" << candidate.bounds.y
           << ",\"width\":" << candidate.bounds.width
           << ",\"height\":" << candidate.bounds.height << "}}";
  }

  output << "],\"capture\":" << BuildCaptureJson(capture) << '}';
  return output.str();
}

std::string CaptureStateName(CaptureState state) {
  switch (state) {
    case CaptureState::idle:
      return "idle";
    case CaptureState::starting:
      return "starting";
    case CaptureState::active:
      return "active";
    case CaptureState::stalled:
      return "stalled";
    case CaptureState::failed:
      return "failed";
    case CaptureState::stopped:
      return "stopped";
  }
  return "failed";
}

std::string BuildCaptureJson(const CaptureSnapshot& capture) {
  const auto has_frames = capture.frame_count > 0;
  std::ostringstream output;
  output << "{\"schema\":\"" << kCaptureSchema << "\","
         << "\"proofType\":\"" << (has_frames ? "real" : "unavailable") << "\","
         << "\"state\":\"" << CaptureStateName(capture.state) << "\","
         << "\"windowId\":"
         << (capture.window_id.empty() ? "null" : "\"" + JsonEscape(capture.window_id) + "\"")
         << ",\"frameCount\":" << capture.frame_count
         << ",\"width\":" << capture.width
         << ",\"height\":" << capture.height
         << ",\"lastFrameMonotonicMs\":" << capture.last_frame_monotonic_ms
         << ",\"error\":"
         << (capture.error.empty() ? "null" : "\"" + JsonEscape(capture.error) + "\"")
         << '}';
  return output.str();
}

std::string ExtractCommandString(std::string_view input, std::string_view property) {
  const auto prefix = std::string{"\""} + std::string{property} + "\":\"";
  const auto start = input.find(prefix);
  if (start == std::string_view::npos) {
    return {};
  }
  const auto value_start = start + prefix.size();
  const auto end = input.find('"', value_start);
  if (end == std::string_view::npos) {
    return {};
  }
  return std::string{input.substr(value_start, end - value_start)};
}

bool IsProbeCommand(std::string_view input) {
  return input == "probe" || IsVersionedCommand(input, "probe");
}

bool IsShutdownCommand(std::string_view input) {
  return input == "shutdown" || IsVersionedCommand(input, "shutdown");
}

bool IsCaptureStartCommand(std::string_view input) {
  return IsVersionedCommand(input, "capture-start");
}

bool IsCaptureStatusCommand(std::string_view input) {
  return IsVersionedCommand(input, "capture-status");
}

bool IsCaptureStopCommand(std::string_view input) {
  return IsVersionedCommand(input, "capture-stop");
}

}  // namespace pulsecast::media_host
