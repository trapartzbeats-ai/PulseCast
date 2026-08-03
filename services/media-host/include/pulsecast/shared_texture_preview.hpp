#pragma once

#include "pulsecast/media_host_contract.hpp"

#include <d3d11.h>

#include <memory>
#include <string_view>

namespace pulsecast::media_host {

class SharedTexturePreview {
 public:
  SharedTexturePreview();
  ~SharedTexturePreview();
  SharedTexturePreview(const SharedTexturePreview&) = delete;
  SharedTexturePreview& operator=(const SharedTexturePreview&) = delete;

  PreviewSnapshot Attach(std::string_view parent_window_id, const WindowBounds& bounds);
  PreviewSnapshot Detach();
  PreviewSnapshot Present(ID3D11Texture2D* source_texture);
  PreviewSnapshot Snapshot() const;

 private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

}  // namespace pulsecast::media_host
