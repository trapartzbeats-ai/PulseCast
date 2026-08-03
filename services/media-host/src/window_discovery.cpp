#include "pulsecast/window_discovery.hpp"

#include <windows.h>

#include <filesystem>
#include <sstream>
#include <string>
#include <vector>

namespace pulsecast::media_host {
namespace {

std::string Utf8(std::wstring_view value) {
  if (value.empty()) {
    return {};
  }
  const auto size = WideCharToMultiByte(
      CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  if (size <= 0) {
    return {};
  }
  std::string output(static_cast<std::size_t>(size), '\0');
  WideCharToMultiByte(
      CP_UTF8, 0, value.data(), static_cast<int>(value.size()), output.data(), size, nullptr, nullptr);
  return output;
}

std::wstring WindowText(HWND window) {
  const auto length = GetWindowTextLengthW(window);
  if (length <= 0) {
    return {};
  }
  std::wstring title(static_cast<std::size_t>(length + 1), L'\0');
  const auto copied = GetWindowTextW(window, title.data(), length + 1);
  title.resize(copied > 0 ? static_cast<std::size_t>(copied) : 0U);
  return title;
}

std::wstring ProcessPath(std::uint32_t process_id) {
  const auto process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
  if (process == nullptr) {
    return {};
  }
  std::wstring path(32768, L'\0');
  DWORD size = static_cast<DWORD>(path.size());
  const auto succeeded = QueryFullProcessImageNameW(process, 0, path.data(), &size);
  CloseHandle(process);
  if (!succeeded) {
    return {};
  }
  path.resize(size);
  return path;
}

BOOL CALLBACK EnumerateWindow(HWND window, LPARAM parameter) {
  auto* candidates = reinterpret_cast<std::vector<RemotePlayWindow>*>(parameter);
  if (!IsWindowVisible(window) || GetWindow(window, GW_OWNER) != nullptr) {
    return TRUE;
  }

  const auto wide_title = WindowText(window);
  if (wide_title.empty()) {
    return TRUE;
  }

  DWORD process_id = 0;
  GetWindowThreadProcessId(window, &process_id);
  const auto wide_process_path = ProcessPath(process_id);
  const auto executable_name = wide_process_path.empty()
      ? std::string{}
      : Utf8(std::filesystem::path(wide_process_path).filename().wstring());
  const auto title = Utf8(wide_title);
  if (!IsRemotePlayCandidate(title, executable_name)) {
    return TRUE;
  }

  wchar_t class_name[256]{};
  GetClassNameW(window, class_name, static_cast<int>(std::size(class_name)));
  RECT rectangle{};
  GetWindowRect(window, &rectangle);

  std::ostringstream window_id;
  window_id << "0x" << std::hex << reinterpret_cast<std::uintptr_t>(window);
  candidates->push_back(RemotePlayWindow{
      .window_id = window_id.str(),
      .process_id = process_id,
      .title = title,
      .executable_name = executable_name,
      .class_name = Utf8(class_name),
      .bounds = WindowBounds{
          .x = rectangle.left,
          .y = rectangle.top,
          .width = rectangle.right - rectangle.left,
          .height = rectangle.bottom - rectangle.top,
      },
  });
  return TRUE;
}

}  // namespace

std::vector<RemotePlayWindow> DiscoverRemotePlayWindows() {
  std::vector<RemotePlayWindow> candidates;
  EnumWindows(EnumerateWindow, reinterpret_cast<LPARAM>(&candidates));
  return candidates;
}

}  // namespace pulsecast::media_host
