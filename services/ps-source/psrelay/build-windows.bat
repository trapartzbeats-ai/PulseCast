@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
set PATH=C:\Program Files\LLVM\bin;C:\Dev\vcpkg\downloads\tools\ninja-1.13.2-windows;C:\Dev\vcpkg\installed\x64-windows\tools\pkgconf;C:\Users\User\AppData\Local\Temp\claude\8d4b169dc6c0fd90\ba67ce51-fad0-4760-9b86-aced35c30d7c\scratchpad\bin;%PATH%
set PKG_CONFIG_PATH=C:\Dev\vcpkg\installed\x64-windows-static-md\lib\pkgconfig
if exist C:\Dev\psrelay-build-ninja rmdir /s /q C:\Dev\psrelay-build-ninja
cmake -S D:\Projects\_archive\PulseCast\services\ps-source\psrelay -B C:\Dev\psrelay-build-ninja -G Ninja -DCMAKE_BUILD_TYPE=Release "-DCMAKE_C_FLAGS=/FIintrin.h /DMINIUPNP_STATICLIB" -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl -DCMAKE_TOOLCHAIN_FILE=C:/Dev/vcpkg/scripts/buildsystems/vcpkg.cmake -DVCPKG_TARGET_TRIPLET=x64-windows-static-md -DPROTOC=C:/Users/User/AppData/Local/Temp/claude/8d4b169dc6c0fd90/ba67ce51-fad0-4760-9b86-aced35c30d7c/scratchpad/bin/protoc.cmd -DPYTHON_EXECUTABLE=C:/Python314/python.exe || exit /b 1
cmake --build C:\Dev\psrelay-build-ninja --target psrelay -- -k 0
