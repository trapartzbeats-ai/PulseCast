#pragma once

#include "pulsecast/media_host_contract.hpp"

#include <memory>

namespace pulsecast::media_host {

class WindowCapture {
 public:
  WindowCapture();
  ~WindowCapture();
  WindowCapture(const WindowCapture&) = delete;
  WindowCapture& operator=(const WindowCapture&) = delete;

  CaptureSnapshot Start(const RemotePlayWindow& candidate);
  CaptureSnapshot Stop();
  CaptureSnapshot Snapshot() const;

 private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

}  // namespace pulsecast::media_host
