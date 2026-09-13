#include "../../tools/gpu-spike/standalone_alpha.h"
#include <cassert>
int main(){
  using namespace lux::probe;
  assert(matches(white,white));assert(matches(transparent,transparent));assert(!matches(white,transparent));
  auto wrong=transparent;wrong[0][2]=188;assert(!matches(wrong,transparent));
  wrong=transparent;wrong[0][2]=255;assert(!matches(wrong,transparent));
  wrong=transparent;wrong[0][3]=255;assert(!matches(wrong,transparent));
  wrong=transparent;wrong[3][3]=69;assert(matches(wrong,transparent));wrong[3][3]=70;assert(!matches(wrong,transparent));
}
