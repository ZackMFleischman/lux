#pragma once
#include <chrono>

namespace lux {
class ReceiverPoll {
 public:
  using Clock = std::chrono::steady_clock;
  bool due(Clock::time_point now, bool canAttach) {
    if (!canAttach || now < next_) return false;
    next_ = now + std::chrono::milliseconds(500);
    return true;
  }
 private:
  Clock::time_point next_ = Clock::time_point::min();
};
}
