#pragma once
#include <array>
#include <cstdlib>
namespace lux::probe {
using Quartet=std::array<std::array<unsigned char,4>,4>;
inline constexpr Quartet white{{{{187,187,255,255}},{{0,255,0,255}},{{255,255,255,255}},{{255,255,255,255}}}};
inline constexpr Quartet transparent{{{{0,0,128,128}},{{0,255,0,255}},{{0,0,0,0}},{{64,64,64,64}}}};
inline bool matches(const Quartet& actual,const Quartet& expected) {
  for(unsigned row=0;row<4;++row)for(unsigned channel=0;channel<4;++channel)
    if(std::abs(int(actual[row][channel])-int(expected[row][channel]))>5)return false;
  return true;
}
}
