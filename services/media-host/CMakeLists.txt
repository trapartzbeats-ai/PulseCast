cmake_minimum_required(VERSION 3.25)

project(PulseCastMediaHost VERSION 0.1.0 LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "PulseCast Media Host currently requires Windows.")
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(PulseCastMediaHostContract STATIC
  src/media_host_contract.cpp
)
target_include_directories(PulseCastMediaHostContract PUBLIC include)
target_compile_definitions(PulseCastMediaHostContract PUBLIC
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
)

add_executable(PulseCastMediaHost
  src/main.cpp
  src/program_compositor.cpp
  src/shared_texture_preview.cpp
  src/window_capture.cpp
  src/window_discovery.cpp
)
target_link_libraries(PulseCastMediaHost PRIVATE
  PulseCastMediaHostContract
  d3d11
  d3dcompiler
  dxgi
  windowsapp
  user32
)

add_executable(PulseCastMediaHostContractTests
  tests/media_host_contract_test.cpp
)
target_link_libraries(PulseCastMediaHostContractTests PRIVATE
  PulseCastMediaHostContract
)

if(MSVC)
  foreach(target PulseCastMediaHostContract PulseCastMediaHost PulseCastMediaHostContractTests)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive- /utf-8)
  endforeach()
endif()

enable_testing()
add_test(NAME PulseCastMediaHostContractTests COMMAND PulseCastMediaHostContractTests)
