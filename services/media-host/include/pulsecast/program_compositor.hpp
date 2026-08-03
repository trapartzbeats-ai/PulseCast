#pragma once

#include "pulsecast/media_host_contract.hpp"

#include <d3d11.h>
#include <winrt/base.h>

#include <memory>

namespace pulsecast::media_host {

struct ComposedProgramFrame {
  ProgramSnapshot snapshot;
  winrt::com_ptr<ID3D11Texture2D> texture;
};

class ProgramCompositor {
 public:
  ProgramCompositor();
  ~ProgramCompositor();
  ProgramCompositor(const ProgramCompositor&) = delete;
  ProgramCompositor& operator=(const ProgramCompositor&) = delete;

  ComposedProgramFrame Compose(ID3D11Texture2D* source_texture);
  ProgramSnapshot SetTransform(const ProgramTransform& transform);
  ProgramSnapshot Reset();
  ProgramSnapshot Snapshot() const;

 private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

}  // namespace pulsecast::media_host
