#pragma once
#include <array>
#include <optional>
#include <cstdint>
namespace lux {
enum class State { Free, Writing, Ready, Reading };
struct Key { uint32_t slot; uint64_t generation=1, serial=0; bool operator==(const Key&) const = default; };
// Single owner/thread state model. Cross-process transitions require equivalent atomic CAS.
class Pool {
 std::array<State,3> states{}; std::array<Key,3> keys{{{0},{1},{2}}};
 public:
 std::optional<Key> begin() { for(uint32_t i=0;i<3;++i) if(states[i]==State::Free) { states[i]=State::Writing; ++keys[i].serial; return keys[i]; } return {}; }
 Key key(uint32_t i) const { return keys.at(i); }
 bool move(Key k,State from,State to) { if(k.slot>=3 || !(keys[k.slot]==k) || states[k.slot]!=from) return false; states[k.slot]=to; return true; }
 bool complete(Key k) { return move(k,State::Writing,State::Ready); }
 bool acquire(Key k) { return move(k,State::Ready,State::Reading); }
 bool retire(Key k) { return move(k,State::Reading,State::Free); }
};
}
