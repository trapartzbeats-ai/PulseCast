#include "pulsecast/shared_texture_preview.hpp"

#include <d3d11_1.h>
#include <dxgi1_3.h>
#include <windows.h>

#include <winrt/base.h>

#include <algorithm>
#include <cstdint>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>

namespace pulsecast::media_host {
namespace {

constexpr wchar_t kPreviewWindowClass[] = L"PulseCastSharedTexturePreview";

HWND WindowHandle(std::string_view window_id) {
  if (window_id.size() < 3 || window_id.substr(0, 2) != "0x") {
    throw std::runtime_error("Preview parent window ID is invalid.");
  }
  const auto value = std::stoull(std::string{window_id.substr(2)}, nullptr, 16);
  return reinterpret_cast<HWND>(static_cast<std::uintptr_t>(value));
}

std::string HandleString(HANDLE handle) {
  std::ostringstream output;
  output << "0x" << std::hex << reinterpret_cast<std::uintptr_t>(handle);
  return output.str();
}

LRESULT CALLBACK PreviewWindowProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_NCHITTEST) {
    return HTTRANSPARENT;
  }
  if (message == WM_ERASEBKGND) {
    return 1;
  }
  if (message == WM_PAINT) {
    PAINTSTRUCT paint{};
    const auto device_context = BeginPaint(window, &paint);
    RECT bounds{};
    GetClientRect(window, &bounds);
    FillRect(device_context, &bounds, static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)));
    EndPaint(window, &paint);
    return 0;
  }
  return DefWindowProcW(window, message, wparam, lparam);
}

void RegisterPreviewWindowClass() {
  static const bool registered = [] {
    WNDCLASSW window_class{};
    window_class.lpfnWndProc = PreviewWindowProc;
    window_class.hInstance = GetModuleHandleW(nullptr);
    window_class.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    window_class.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
    window_class.lpszClassName = kPreviewWindowClass;
    const auto atom = RegisterClassW(&window_class);
    if (atom == 0 && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
      throw std::runtime_error("Native preview window class registration failed.");
    }
    return true;
  }();
  static_cast<void>(registered);
}

}  // namespace

class SharedTexturePreview::Impl {
 public:
  PreviewSnapshot Attach(std::string_view parent_window_id, const WindowBounds& bounds) {
    std::scoped_lock lock(mutex_);
    try {
      const auto parent = WindowHandle(parent_window_id);
      if (!IsWindow(parent)) {
        throw std::runtime_error("The PulseCast preview parent window is unavailable.");
      }
      if (bounds.width <= 0 || bounds.height <= 0) {
        throw std::runtime_error("The PulseCast preview bounds are invalid.");
      }

      const auto recreate_window =
          parent_window_ != parent || !preview_window_ || !IsWindow(preview_window_);
      if (recreate_window) {
        DestroyPreviewWindow();
        ResetGpuResources();
        RegisterPreviewWindowClass();
        preview_window_ = CreateWindowExW(
            WS_EX_NOACTIVATE,
            kPreviewWindowClass,
            L"PulseCast PlayStation Preview",
            WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            parent,
            nullptr,
            GetModuleHandleW(nullptr),
            nullptr);
        if (!preview_window_) {
          throw std::runtime_error("The native PulseCast preview surface could not be created.");
        }
        parent_window_ = parent;
      }

      SetWindowPos(
          preview_window_,
          HWND_TOP,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          SWP_NOACTIVATE | SWP_SHOWWINDOW);
      ShowWindow(preview_window_, SW_SHOWNOACTIVATE);
      UpdateWindow(preview_window_);
      if (recreate_window || snapshot_.state == PreviewState::detached ||
          snapshot_.state == PreviewState::failed) {
        snapshot_.state = PreviewState::waiting;
      }
      snapshot_.error.clear();
      return snapshot_;
    } catch (const std::exception& error) {
      snapshot_.state = PreviewState::failed;
      snapshot_.error = error.what();
      return snapshot_;
    }
  }

  PreviewSnapshot Detach() {
    std::scoped_lock lock(mutex_);
    DestroyPreviewWindow();
    ResetGpuResources();
    snapshot_ = PreviewSnapshot{};
    return snapshot_;
  }

  PreviewSnapshot Present(ID3D11Texture2D* source_texture) {
    std::scoped_lock lock(mutex_);
    if (!preview_window_ || !IsWindow(preview_window_) || !source_texture) {
      return snapshot_;
    }
    try {
      D3D11_TEXTURE2D_DESC source_description{};
      source_texture->GetDesc(&source_description);
      if (!shared_texture_ || source_description.Width != texture_width_ ||
          source_description.Height != texture_height_ ||
          source_description.Format != texture_format_) {
        CreateGpuResources(source_texture, source_description);
      }

      auto result = producer_mutex_->AcquireSync(0, 16);
      if (FAILED(result)) {
        return snapshot_;
      }
      producer_context_->CopyResource(shared_texture_.get(), source_texture);
      producer_mutex_->ReleaseSync(1);

      result = consumer_mutex_->AcquireSync(1, 16);
      if (FAILED(result)) {
        return snapshot_;
      }
      consumer_context_->CopyResource(back_buffer_.get(), opened_shared_texture_.get());
      consumer_mutex_->ReleaseSync(0);

      result = swap_chain_->Present(0, DXGI_PRESENT_DO_NOT_WAIT);
      if (result == DXGI_ERROR_WAS_STILL_DRAWING) {
        return snapshot_;
      }
      winrt::check_hresult(result);
      ++snapshot_.presented_frame_count;
      snapshot_.state = PreviewState::active;
      snapshot_.error.clear();
      return snapshot_;
    } catch (const winrt::hresult_error& error) {
      snapshot_.state = PreviewState::failed;
      snapshot_.error = winrt::to_string(error.message());
      return snapshot_;
    } catch (const std::exception& error) {
      snapshot_.state = PreviewState::failed;
      snapshot_.error = error.what();
      return snapshot_;
    }
  }

  PreviewSnapshot Snapshot() const {
    std::scoped_lock lock(mutex_);
    return snapshot_;
  }

  ~Impl() {
    std::scoped_lock lock(mutex_);
    DestroyPreviewWindow();
    ResetGpuResources();
  }

 private:
  void CreateGpuResources(
      ID3D11Texture2D* source_texture,
      const D3D11_TEXTURE2D_DESC& source_description) {
    ResetGpuResources();

    source_texture->GetDevice(producer_device_.put());
    producer_device_->GetImmediateContext(producer_context_.put());

    D3D11_TEXTURE2D_DESC shared_description = source_description;
    shared_description.MipLevels = 1;
    shared_description.ArraySize = 1;
    shared_description.SampleDesc = DXGI_SAMPLE_DESC{.Count = 1, .Quality = 0};
    shared_description.Usage = D3D11_USAGE_DEFAULT;
    shared_description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    shared_description.CPUAccessFlags = 0;
    shared_description.MiscFlags =
        D3D11_RESOURCE_MISC_SHARED_NTHANDLE | D3D11_RESOURCE_MISC_SHARED_KEYEDMUTEX;
    winrt::check_hresult(
        producer_device_->CreateTexture2D(&shared_description, nullptr, shared_texture_.put()));
    shared_texture_.as(producer_mutex_);

    winrt::com_ptr<IDXGIResource1> shared_resource;
    shared_texture_.as(shared_resource);
    winrt::check_hresult(shared_resource->CreateSharedHandle(
        nullptr,
        DXGI_SHARED_RESOURCE_READ | DXGI_SHARED_RESOURCE_WRITE,
        nullptr,
        &shared_handle_));

    winrt::com_ptr<IDXGIDevice> producer_dxgi_device;
    producer_device_.as(producer_dxgi_device);
    winrt::com_ptr<IDXGIAdapter> adapter;
    winrt::check_hresult(producer_dxgi_device->GetAdapter(adapter.put()));
    D3D_FEATURE_LEVEL feature_level{};
    constexpr D3D_FEATURE_LEVEL feature_levels[]{
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
        D3D_FEATURE_LEVEL_10_1,
        D3D_FEATURE_LEVEL_10_0,
    };
    winrt::check_hresult(D3D11CreateDevice(
        adapter.get(),
        D3D_DRIVER_TYPE_UNKNOWN,
        nullptr,
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        feature_levels,
        static_cast<UINT>(std::size(feature_levels)),
        D3D11_SDK_VERSION,
        consumer_device_.put(),
        &feature_level,
        consumer_context_.put()));

    winrt::com_ptr<ID3D11Device1> consumer_device_1;
    consumer_device_.as(consumer_device_1);
    winrt::check_hresult(consumer_device_1->OpenSharedResource1(
        shared_handle_,
        __uuidof(ID3D11Texture2D),
        opened_shared_texture_.put_void()));
    opened_shared_texture_.as(consumer_mutex_);

    winrt::com_ptr<IDXGIFactory2> factory;
    winrt::check_hresult(adapter->GetParent(__uuidof(IDXGIFactory2), factory.put_void()));
    DXGI_SWAP_CHAIN_DESC1 swap_chain_description{};
    swap_chain_description.Width = source_description.Width;
    swap_chain_description.Height = source_description.Height;
    swap_chain_description.Format = source_description.Format;
    swap_chain_description.SampleDesc = DXGI_SAMPLE_DESC{.Count = 1, .Quality = 0};
    swap_chain_description.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    swap_chain_description.BufferCount = 2;
    swap_chain_description.Scaling = DXGI_SCALING_STRETCH;
    swap_chain_description.SwapEffect = DXGI_SWAP_EFFECT_FLIP_SEQUENTIAL;
    swap_chain_description.AlphaMode = DXGI_ALPHA_MODE_IGNORE;
    winrt::check_hresult(factory->CreateSwapChainForHwnd(
        consumer_device_.get(),
        preview_window_,
        &swap_chain_description,
        nullptr,
        nullptr,
        swap_chain_.put()));
    winrt::check_hresult(
        swap_chain_->GetBuffer(0, __uuidof(ID3D11Texture2D), back_buffer_.put_void()));

    texture_width_ = source_description.Width;
    texture_height_ = source_description.Height;
    texture_format_ = source_description.Format;
    snapshot_.width = texture_width_;
    snapshot_.height = texture_height_;
    snapshot_.shared_handle = HandleString(shared_handle_);
    snapshot_.state = PreviewState::waiting;
    snapshot_.error.clear();
  }

  void ResetGpuResources() {
    back_buffer_ = nullptr;
    swap_chain_ = nullptr;
    consumer_mutex_ = nullptr;
    opened_shared_texture_ = nullptr;
    consumer_context_ = nullptr;
    consumer_device_ = nullptr;
    producer_mutex_ = nullptr;
    shared_texture_ = nullptr;
    producer_context_ = nullptr;
    producer_device_ = nullptr;
    if (shared_handle_) {
      CloseHandle(shared_handle_);
      shared_handle_ = nullptr;
    }
    texture_width_ = 0;
    texture_height_ = 0;
    texture_format_ = DXGI_FORMAT_UNKNOWN;
  }

  void DestroyPreviewWindow() {
    if (preview_window_ && IsWindow(preview_window_)) {
      ShowWindow(preview_window_, SW_HIDE);
      DestroyWindow(preview_window_);
    }
    preview_window_ = nullptr;
    parent_window_ = nullptr;
  }

  mutable std::mutex mutex_;
  HWND parent_window_{};
  HWND preview_window_{};
  PreviewSnapshot snapshot_;
  HANDLE shared_handle_{};
  std::uint32_t texture_width_{};
  std::uint32_t texture_height_{};
  DXGI_FORMAT texture_format_{DXGI_FORMAT_UNKNOWN};
  winrt::com_ptr<ID3D11Device> producer_device_;
  winrt::com_ptr<ID3D11DeviceContext> producer_context_;
  winrt::com_ptr<ID3D11Texture2D> shared_texture_;
  winrt::com_ptr<IDXGIKeyedMutex> producer_mutex_;
  winrt::com_ptr<ID3D11Device> consumer_device_;
  winrt::com_ptr<ID3D11DeviceContext> consumer_context_;
  winrt::com_ptr<ID3D11Texture2D> opened_shared_texture_;
  winrt::com_ptr<IDXGIKeyedMutex> consumer_mutex_;
  winrt::com_ptr<IDXGISwapChain1> swap_chain_;
  winrt::com_ptr<ID3D11Texture2D> back_buffer_;
};

SharedTexturePreview::SharedTexturePreview() : impl_(std::make_unique<Impl>()) {}
SharedTexturePreview::~SharedTexturePreview() = default;

PreviewSnapshot SharedTexturePreview::Attach(
    std::string_view parent_window_id,
    const WindowBounds& bounds) {
  return impl_->Attach(parent_window_id, bounds);
}

PreviewSnapshot SharedTexturePreview::Detach() {
  return impl_->Detach();
}

PreviewSnapshot SharedTexturePreview::Present(ID3D11Texture2D* source_texture) {
  return impl_->Present(source_texture);
}

PreviewSnapshot SharedTexturePreview::Snapshot() const {
  return impl_->Snapshot();
}

}  // namespace pulsecast::media_host
