#include "lux_texture_bridge.h"
#include <cassert>
int main() {
  lux::Pool p;
  for (int i=0;i<3;++i) { auto k=p.begin(); assert(k); assert(p.complete(*k)); assert(p.acquire(*k)); }
  assert(!p.begin());
  auto old=p.key(1); assert(p.retire(old)); auto fresh=p.begin(); assert(fresh && fresh->slot==1 && fresh->serial>old.serial);
  assert(!p.retire(old)); assert(!p.acquire(*fresh)); assert(p.complete(*fresh)); assert(p.acquire(*fresh));
  assert(!p.complete(*fresh)); assert(!p.begin());
  auto wrong=*fresh; ++wrong.generation; assert(!p.retire(wrong)); assert(p.retire(*fresh));
}
