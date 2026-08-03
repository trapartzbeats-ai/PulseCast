#pragma once

#include "pulsecast/media_host_contract.hpp"

#include <vector>

namespace pulsecast::media_host {

std::vector<RemotePlayWindow> DiscoverRemotePlayWindows();

}  // namespace pulsecast::media_host
