#pragma once
#include <chrono>
namespace lux {
class PollDeadline {
 std::chrono::steady_clock::time_point next{};bool initial=true;
 public:
 bool due(std::chrono::steady_clock::time_point now){if(!initial&&now<next)return false;initial=false;next=now+std::chrono::milliseconds(500);return true;}
};
}
