#include "InstalledSource.h"
#include <cassert>
int main(){
 const std::string release(64,'a'),runtime(64,'b');
 auto value=lux::parseInstalledSource("lux-installed-source-v1\n"+release+"\n"+runtime+"\nAB12\nTest Source\n");
 assert(value.releaseId==release&&value.runtimeId==runtime&&value.pluginId=="AB12"&&value.name=="Test Source");
 for(const auto& bad:{std::string(""),std::string("lux-installed-source-v1\n../bad\n"+runtime+"\nAB12\nTest\n"),std::string("lux-installed-source-v1\n"+release+"\n"+runtime+"\nTOOLONG\nTest\n")}) {
  bool failed=false;try{lux::parseInstalledSource(bad);}catch(...){failed=true;}assert(failed);
 }
 assert(lux::installedInstanceName(1,2)!=lux::installedInstanceName(1,3));
 assert(lux::installedInstanceName(1,2).size()==32);
}
