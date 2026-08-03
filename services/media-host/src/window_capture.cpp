#include "pulsecast/window_capture.hpp"
#include "pulsecast/shared_texture_preview.hpp"

#include <d3d11.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <windows.h>

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <winrt/base.h>

#include <chrono>
#include <cstdint>
#include <mutex>
#include <stdexcept>
#include <string>

namespace pulsecast::media_host {
namespace {

namespace wf = winrt::Windows::Foundation;
namespace wgc = winrt::Windows::Graphics::Capture;
namespace wgd = winrt::Windows::Graphics::DirectX;
namespace wgd11 = winrt::Windows::Graphics::DirectX::Direct3D11;

std::uint64_t MonotonicMilliseconds() {
  return static_cast<std::uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::steady_clock::now().time_since_epoch())
          .count());
}

HWND WindowHandle(std::string_view window_id) {
  if (window_id.size() < 3 || window_id.substr(0, 2) != "0x") {
    throw std::runtime_error("Capture window ID is invalid.");
  }
  const auto value = std::stoull(std::string{window_id.substr(2)}, nullptr, 16);
  return reinterpret_cast<HWND>(static_cast<std::uintptr_t>(value));
}

wgd11::IDirect3DDevice CreateWinRtDevice() {
  winrt::com_ptr<ID3D11Device> d3d_device;
  winrt::com_ptr<ID3D11DeviceContext> d3d_context;
  D3D_FEATURE_LEVEL feature_level{};
  constexpr D3D_FEATURE_LEVEL feature_levels[]{
      D3D_FEATURE_LEVEL_11_1,
      D3D_FEATURE_LEVEL_11_0,
      D3D_FEATURE_LEVEL_10_1,
      D3D_FEATURE_LEVEL_10_0,
  };
  auto result = D3D11CreateDevice(
      nullptr,
      D3D_DRIVER_TYPE_HARDWARE,
      nullptr,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      feature_levels,
      static_cast<UINT>(std::size(feature_levels)),
      D3D11_SDK_VERSION,
      d3d_device.put(),
      &feature_level,
      d3d_context.put());
  if (FAILED(result)) {
    result = D3D11CreateDevice(
        nullptr,
        D3D_DRIVER_TYPE_WARP,
        nullptr,
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        feature_levels,
        static_cast<UINT>(std::size(feature_levels)),
        D3D11_SDK_VERSION,
        d3d_device.put(),
        &feature_level,
        d3d_context.put());
  }
  winrt::check_hresult(result);

  winrt::com_ptr<IDXGIDevice> dxgi_device;
  d3d_device.as(dxgi_device);
wgd11::IDirect3DDevice winrt_device{nullptr};
  winrt::check_hresult(CreateDirect3D11DeviceFromDXGIDevice(
      dxgi_device.get(),
      reinterpret_cast<IInspectable**>(winrt::put_abi(winrt_device))));
  return winrt_device;
}

wgc::GraphicsCaptureItem CreateCaptureItem(HWND window) {
  const auto interop =
      winrt::get_activation_factory<wgc::GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
  wgc::GraphicsCaptureItem item{nullptr};
  winrt::check_hresult(interop->CreateForWindow(
      window,
      winrt::guid_of<wgc::GraphicsCaptureItem>(),
      reinterpret_cast<void**>(winrt::put_abi(item))));
  return item;
}

std::string ErrorText(const winrt::hresult_error& error) {
  return winrt::to_string(error.message());
}

}  // namespace

class WindowCapture::Impl {
 public:
  CaptureSnapshot Start(const RemotePlayWindow& candidate) {
    Stop();
    {
      std::scoped_lock lock(mutex_);
      snapshot_ = CaptureSnapshot{
          .state = CaptureState::starting,
          .window_id = candidate.window_id,
      };
    }

    try {
      if (!wgc::GraphicsCaptureSession::IsSupported()) {
        throw std::runtime_error("Windows Graphics Capture is not supported on this system.");
      }
      const auto window = WindowHandle(candidate.window_id);
      if (!IsWindow(window)) {
        throw std::runtime_error("The selected Remote Play window no longer exists.");
      }

      device_ = CreateWinRtDevice();
      item_ = CreateCaptureItem(window);
      const auto size = item_.Size();
      if (size.Width <= 0 || size.Height <= 0) {
        throw std::runtime_error("The selected Remote Play window has no capturable area.");
      }
      frame_pool_ = wgc::Direct3D11CaptureFramePool::CreateFreeThreaded(
          device_,
          wgd::DirectXPixelFormat::B8G8R8A8UIntNormalized,
          2,
          size);
      frame_arrived_token_ = frame_pool_.FrameArrived(
          [this](const wgc::Direct3D11CaptureFramePool& sender, const wf::IInspectable&) {
            OnFrameArrived(sender);
          });
      session_ = frame_pool_.CreateCaptureSession(item_);
      session_.IsCursorCaptureEnabled(false);
      session_.StartCapture();
      return Snapshot();
    } catch (const winrt::hresult_error& error) {
      return Fail(ErrorText(error));
    } catch (const std::exception& error) {
      return Fail(error.what());
    }
  }

  CaptureSnapshot Stop() {
    if (frame_pool_) {
      frame_pool_.FrameArrived(frame_arrived_token_);
    }
    if (session_) {
      session_.Close();
    }
    if (frame_pool_) {
      frame_pool_.Close();
    }
    session_ = nullptr;
    frame_pool_ = nullptr;
    item_ = nullptr;
    device_ = nullptr;
    const auto preview = preview_.Detach();

    std::scoped_lock lock(mutex_);
    if (snapshot_.state != CaptureState::idle && snapshot_.state != CaptureState::failed) {
      snapshot_.state = CaptureState::stopped;
    }
    snapshot_.preview = preview;
    return snapshot_;
  }

  CaptureSnapshot AttachPreview(
      std::string_view parent_window_id,
      const WindowBounds& bounds) {
    const auto preview = preview_.Attach(parent_window_id, bounds);
    std::scoped_lock lock(mutex_);
    snapshot_.preview = preview;
    return snapshot_;
  }

  CaptureSnapshot DetachPreview() {
    const auto preview = preview_.Detach();
    std::scoped_lock lock(mutex_);
    snapshot_.preview = preview;
    return snapshot_;
  }

  CaptureSnapshot Snapshot() const {
    std::scoped_lock lock(mutex_);
    auto result = snapshot_;
    if (result.state == CaptureState::active && result.last_frame_monotonic_ms > 0 &&
        MonotonicMilliseconds() - result.last_frame_monotonic_ms > 2'000) {
      result.state = CaptureState::stalled;
    }
    return result;
  }

 private:
  CaptureSnapshot Fail(std::string error) {
    if (session_) {
      session_.Close();
    }
    if (frame_pool_) {
      frame_pool_.Close();
    }
    session_ = nullptr;
    frame_pool_ = nullptr;
    item_ = nullptr;
    device_ = nullptr;
    std::scoped_lock lock(mutex_);
    snapshot_.state = CaptureState::failed;
    snapshot_.error = std::move(error);
    return snapshot_;
  }

  void OnFrameArrived(const wgc::Direct3D11CaptureFramePool& sender) {
    try {
      const auto frame = sender.TryGetNextFrame();
      if (!frame) {
        return;
      }
      const auto size = frame.ContentSize();
      const auto surface_access =
          frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::
                                 IDirect3DDxgiInterfaceAccess>();
      winrt::com_ptr<ID3D11Texture2D> source_texture;
      winrt::check_hresult(surface_access->GetInterface(
          __uuidof(ID3D11Texture2D), source_texture.put_void()));
      const auto preview = preview_.Present(source_texture.get());
      std::scoped_lock lock(mutex_);
      ++snapshot_.frame_count;
      snapshot_.width = static_cast<std::uint32_t>(size.Width);
      snapshot_.height = static_cast<std::uint32_t>(size.Height);
      snapshot_.last_frame_monotonic_ms = MonotonicMilliseconds();
      snapshot_.state = CaptureState::active;
      snapshot_.error.clear();
      snapshot_.preview = preview;
    } catch (const winrt::hresult_error& error) {
      std::scoped_lock lock(mutex_);
      snapshot_.state = CaptureState::failed;
      snapshot_.error = ErrorText(error);
    }
  }

  mutable std::mutex mutex_;
  CaptureSnapshot snapshot_;
  wgd11::IDirect3DDevice device_{nullptr};
  wgc::GraphicsCaptureItem item_{nullptr};
  wgc::Direct3D11CaptureFramePool frame_pool_{nullptr};
  wgc::GraphicsCaptureSession session_{nullptr};
  winrt::event_token frame_arrived_token_{};
  SharedTexturePreview preview_;
};

WindowCapture::WindowCapture() : impl_(std::make_unique<Impl>()) {}
WindowCapture::~WindowCapture() = default;

CaptureSnapshot WindowCapture::Start(const RemotePlayWindow& candidate) {
  return impl_->Start(candidate);
}

CaptureSnapshot WindowCapture::Stop() {
  return impl_->Stop();
}

CaptureSnapshot WindowCapture::AttachPreview(
    std::string_view parent_window_id,
    const WindowBounds& bounds) {
  return impl_->AttachPreview(parent_window_id, bounds);
}

CaptureSnapshot WindowCapture::DetachPreview() {
  return impl_->DetachPreview();
}

CaptureSnapshot WindowCapture::Snapshot() const {
  return impl_->Snapshot();
}

}  // namespace pulsecast::media_host
