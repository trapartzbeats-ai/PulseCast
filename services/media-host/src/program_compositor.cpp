#include "pulsecast/program_compositor.hpp"

#include <d3dcompiler.h>

#include <winrt/base.h>

#include <algorithm>
#include <cstring>
#include <mutex>
#include <stdexcept>
#include <string>

namespace pulsecast::media_host {
namespace {

constexpr std::uint32_t kProgramWidth = 1920;
constexpr std::uint32_t kProgramHeight = 1080;

constexpr char kVertexShaderSource[] = R"(
struct VertexOutput {
  float4 position : SV_POSITION;
  float2 uv : TEXCOORD0;
};

VertexOutput main(uint vertexId : SV_VertexID) {
  const float2 positions[3] = {
    float2(-1.0, -1.0),
    float2(-1.0,  3.0),
    float2( 3.0, -1.0)
  };
  const float2 uvs[3] = {
    float2(0.0,  1.0),
    float2(0.0, -1.0),
    float2(2.0,  1.0)
  };
  VertexOutput output;
  output.position = float4(positions[vertexId], 0.0, 1.0);
  output.uv = uvs[vertexId];
  return output;
}
)";

constexpr char kPixelShaderSource[] = R"(
Texture2D sourceTexture : register(t0);
SamplerState sourceSampler : register(s0);

float4 main(float4 position : SV_POSITION, float2 uv : TEXCOORD0) : SV_TARGET {
  return sourceTexture.Sample(sourceSampler, uv);
}
)";

winrt::com_ptr<ID3DBlob> CompileShader(
    const char* source,
    const char* entry_point,
    const char* target) {
  winrt::com_ptr<ID3DBlob> bytecode;
  winrt::com_ptr<ID3DBlob> errors;
  const auto result = D3DCompile(
      source,
      std::strlen(source),
      "PulseCastProgramCompositor",
      nullptr,
      nullptr,
      entry_point,
      target,
      D3DCOMPILE_ENABLE_STRICTNESS,
      0,
      bytecode.put(),
      errors.put());
  if (FAILED(result)) {
    const auto message = errors
                             ? std::string{
                                   static_cast<const char*>(errors->GetBufferPointer()),
                                   errors->GetBufferSize()}
                             : "D3D shader compilation failed.";
    throw std::runtime_error(message);
  }
  return bytecode;
}

ProgramTransform ValidateTransform(const ProgramTransform& transform) {
  if (transform.width <= 0 || transform.height <= 0) {
    throw std::invalid_argument("Program source transform dimensions must be positive.");
  }
  if (transform.x < 0 || transform.y < 0 ||
      transform.x + transform.width > static_cast<std::int32_t>(kProgramWidth) ||
      transform.y + transform.height > static_cast<std::int32_t>(kProgramHeight)) {
    throw std::invalid_argument("Program source transform must stay inside the 1920x1080 canvas.");
  }
  return transform;
}

}  // namespace

class ProgramCompositor::Impl {
 public:
  Impl() {
    snapshot_.output_width = kProgramWidth;
    snapshot_.output_height = kProgramHeight;
    snapshot_.transform = transform_;
  }

  ComposedProgramFrame Compose(ID3D11Texture2D* source_texture) {
    std::scoped_lock lock(mutex_);
    if (!source_texture) {
      snapshot_.state = ProgramState::failed;
      snapshot_.error = "Program compositor source texture is unavailable.";
      return {.snapshot = snapshot_};
    }

    try {
      D3D11_TEXTURE2D_DESC source_description{};
      source_texture->GetDesc(&source_description);
      winrt::com_ptr<ID3D11Device> source_device;
      source_texture->GetDevice(source_device.put());
      if (!output_texture_ || device_.get() != source_device.get() ||
          source_width_ != source_description.Width ||
          source_height_ != source_description.Height ||
          source_format_ != source_description.Format) {
        CreateResources(source_device.get(), source_description);
      }

      context_->CopyResource(input_texture_.get(), source_texture);
      constexpr float clear_color[]{0.012F, 0.016F, 0.022F, 1.0F};
      context_->ClearRenderTargetView(output_view_.get(), clear_color);

      ID3D11RenderTargetView* render_targets[]{output_view_.get()};
      context_->OMSetRenderTargets(1, render_targets, nullptr);
      const D3D11_VIEWPORT viewport{
          .TopLeftX = static_cast<float>(transform_.x),
          .TopLeftY = static_cast<float>(transform_.y),
          .Width = static_cast<float>(transform_.width),
          .Height = static_cast<float>(transform_.height),
          .MinDepth = 0.0F,
          .MaxDepth = 1.0F,
      };
      context_->RSSetViewports(1, &viewport);
      context_->IASetInputLayout(nullptr);
      context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
      context_->VSSetShader(vertex_shader_.get(), nullptr, 0);
      context_->PSSetShader(pixel_shader_.get(), nullptr, 0);
      ID3D11ShaderResourceView* resources[]{input_view_.get()};
      ID3D11SamplerState* samplers[]{sampler_.get()};
      context_->PSSetShaderResources(0, 1, resources);
      context_->PSSetSamplers(0, 1, samplers);
      context_->Draw(3, 0);
      ID3D11ShaderResourceView* empty_resources[]{nullptr};
      context_->PSSetShaderResources(0, 1, empty_resources);

      ++snapshot_.composed_frame_count;
      snapshot_.state = ProgramState::active;
      snapshot_.error.clear();
      return {.snapshot = snapshot_, .texture = output_texture_};
    } catch (const winrt::hresult_error& error) {
      snapshot_.state = ProgramState::failed;
      snapshot_.error = winrt::to_string(error.message());
      return {.snapshot = snapshot_};
    } catch (const std::exception& error) {
      snapshot_.state = ProgramState::failed;
      snapshot_.error = error.what();
      return {.snapshot = snapshot_};
    }
  }

  ProgramSnapshot SetTransform(const ProgramTransform& transform) {
    std::scoped_lock lock(mutex_);
    try {
      transform_ = ValidateTransform(transform);
      snapshot_.transform = transform_;
      snapshot_.error.clear();
    } catch (const std::exception& error) {
      snapshot_.state = ProgramState::failed;
      snapshot_.error = error.what();
    }
    return snapshot_;
  }

  ProgramSnapshot Reset() {
    std::scoped_lock lock(mutex_);
    ResetResources();
    snapshot_ = ProgramSnapshot{};
    snapshot_.output_width = kProgramWidth;
    snapshot_.output_height = kProgramHeight;
    snapshot_.transform = transform_;
    return snapshot_;
  }

  ProgramSnapshot Snapshot() const {
    std::scoped_lock lock(mutex_);
    return snapshot_;
  }

 private:
  void CreateResources(
      ID3D11Device* source_device,
      const D3D11_TEXTURE2D_DESC& source_description) {
    ResetResources();
    device_.copy_from(source_device);
    device_->GetImmediateContext(context_.put());

    D3D11_TEXTURE2D_DESC input_description{};
    input_description.Width = source_description.Width;
    input_description.Height = source_description.Height;
    input_description.MipLevels = 1;
    input_description.ArraySize = 1;
    input_description.Format = source_description.Format;
    input_description.SampleDesc = DXGI_SAMPLE_DESC{.Count = 1, .Quality = 0};
    input_description.Usage = D3D11_USAGE_DEFAULT;
    input_description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    winrt::check_hresult(
        device_->CreateTexture2D(&input_description, nullptr, input_texture_.put()));
    winrt::check_hresult(
        device_->CreateShaderResourceView(input_texture_.get(), nullptr, input_view_.put()));

    D3D11_TEXTURE2D_DESC output_description{};
    output_description.Width = kProgramWidth;
    output_description.Height = kProgramHeight;
    output_description.MipLevels = 1;
    output_description.ArraySize = 1;
    output_description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    output_description.SampleDesc = DXGI_SAMPLE_DESC{.Count = 1, .Quality = 0};
    output_description.Usage = D3D11_USAGE_DEFAULT;
    output_description.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
    winrt::check_hresult(
        device_->CreateTexture2D(&output_description, nullptr, output_texture_.put()));
    winrt::check_hresult(
        device_->CreateRenderTargetView(output_texture_.get(), nullptr, output_view_.put()));

    const auto vertex_bytecode = CompileShader(kVertexShaderSource, "main", "vs_5_0");
    const auto pixel_bytecode = CompileShader(kPixelShaderSource, "main", "ps_5_0");
    winrt::check_hresult(device_->CreateVertexShader(
        vertex_bytecode->GetBufferPointer(),
        vertex_bytecode->GetBufferSize(),
        nullptr,
        vertex_shader_.put()));
    winrt::check_hresult(device_->CreatePixelShader(
        pixel_bytecode->GetBufferPointer(),
        pixel_bytecode->GetBufferSize(),
        nullptr,
        pixel_shader_.put()));

    D3D11_SAMPLER_DESC sampler_description{};
    sampler_description.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    sampler_description.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampler_description.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampler_description.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
    sampler_description.MaxLOD = D3D11_FLOAT32_MAX;
    winrt::check_hresult(device_->CreateSamplerState(&sampler_description, sampler_.put()));

    source_width_ = source_description.Width;
    source_height_ = source_description.Height;
    source_format_ = source_description.Format;
    snapshot_.output_width = kProgramWidth;
    snapshot_.output_height = kProgramHeight;
    snapshot_.transform = transform_;
    snapshot_.state = ProgramState::waiting;
    snapshot_.error.clear();
  }

  void ResetResources() {
    sampler_ = nullptr;
    pixel_shader_ = nullptr;
    vertex_shader_ = nullptr;
    output_view_ = nullptr;
    output_texture_ = nullptr;
    input_view_ = nullptr;
    input_texture_ = nullptr;
    context_ = nullptr;
    device_ = nullptr;
    source_width_ = 0;
    source_height_ = 0;
    source_format_ = DXGI_FORMAT_UNKNOWN;
  }

  mutable std::mutex mutex_;
  ProgramTransform transform_{.x = 160, .y = 90, .width = 1600, .height = 900};
  ProgramSnapshot snapshot_;
  std::uint32_t source_width_{};
  std::uint32_t source_height_{};
  DXGI_FORMAT source_format_{DXGI_FORMAT_UNKNOWN};
  winrt::com_ptr<ID3D11Device> device_;
  winrt::com_ptr<ID3D11DeviceContext> context_;
  winrt::com_ptr<ID3D11Texture2D> input_texture_;
  winrt::com_ptr<ID3D11ShaderResourceView> input_view_;
  winrt::com_ptr<ID3D11Texture2D> output_texture_;
  winrt::com_ptr<ID3D11RenderTargetView> output_view_;
  winrt::com_ptr<ID3D11VertexShader> vertex_shader_;
  winrt::com_ptr<ID3D11PixelShader> pixel_shader_;
  winrt::com_ptr<ID3D11SamplerState> sampler_;
};

ProgramCompositor::ProgramCompositor() : impl_(std::make_unique<Impl>()) {}
ProgramCompositor::~ProgramCompositor() = default;

ComposedProgramFrame ProgramCompositor::Compose(ID3D11Texture2D* source_texture) {
  return impl_->Compose(source_texture);
}

ProgramSnapshot ProgramCompositor::SetTransform(const ProgramTransform& transform) {
  return impl_->SetTransform(transform);
}

ProgramSnapshot ProgramCompositor::Reset() {
  return impl_->Reset();
}

ProgramSnapshot ProgramCompositor::Snapshot() const {
  return impl_->Snapshot();
}

}  // namespace pulsecast::media_host
