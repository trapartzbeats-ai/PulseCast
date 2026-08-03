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
    std::uint32_t process_id) {
  std::ostringstream output;
  output << "{\"schema\":\"" << kProbeSchema << "\","
         << "\"adapter\":\"" << kAdapterName << "\","
         << "\"version\":\"" << kVersion << "\","
         << "\"proofType\":\"real\","
         << "\"processId\":" << process_id << ','
         << "\"capabilities\":["
         << "{\"id\":\"window-discovery\",\"proofType\":\"real\",\"state\":\"ready\"},"
         << "{\"id\":\"window-capture\",\"proofType\":\"unavailable\",\"state\":\"unavailable\"},"
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

  output << "]}";
  return output.str();
}

bool IsProbeCommand(std::string_view input) {
  return input == "probe" ||
         (Contains(input, kCommandSchema) && Contains(input, "\"type\":\"probe\""));
}

bool IsShutdownCommand(std::string_view input) {
  return input == "shutdown" ||
         (Contains(input, kCommandSchema) && Contains(input, "\"type\":\"shutdown\""));
}

}  // namespace pulsecast::media_host
