#include "ReceiverPoll.h"
#include <iostream>
using namespace std::chrono_literals;
#define CHECK(x) do {if(!(x)){std::cerr<<"FAIL line "<<__LINE__<<": " #x "\n";return 1;}}while(0)
int main() {
  const lux::ReceiverPoll::Clock::time_point start{};
  lux::ReceiverPoll discovery;
  CHECK(discovery.due(start, true));
  // Model a producer advertising just after the first lookup, and a Windows
  // worker whose requested 1 ms sleeps actually wake every 16 ms.
  bool found = false;
  for (int ms = 16; ms <= 512; ms += 16) {
    if (discovery.due(start + std::chrono::milliseconds(ms), true)) found = true;
  }
  CHECK(found);
  // Due work must remain due while a GPU copy prevents a safe ring change.
  lux::ReceiverPoll pending;
  CHECK(pending.due(start, true));
  CHECK(!pending.due(start + 500ms, false));
  CHECK(pending.due(start + 516ms, true));
  CHECK(!pending.due(start + 517ms, true));
  // A delayed worker polls once on return rather than replaying missed polls.
  CHECK(pending.due(start + 10s, true));
  CHECK(!pending.due(start + 10s, true));
  std::cout << "receiver discovery deadlines passed\n";
}
