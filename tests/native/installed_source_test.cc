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
 const auto v2="lux-installed-source-v2\n"+release+"\n"+runtime+"\nAB12\nTest Source\n"+std::string(64,'c')+"\n2\nheight\tHeight\t0.75\nspeed\tSpeed\t0.5\n";
 auto parameters=lux::parseInstalledSource(v2);
 assert(parameters.version==2&&parameters.controls.size()==2&&parameters.controls[0].id=="height"&&parameters.controls[0].initial==0.75f);
 assert(lux::parseInstalledSource("lux-installed-source-v2\n"+release+"\n"+runtime+"\nAB12\nEmpty\n"+std::string(64,'c')+"\n0\n").controls.empty());
 for(const auto& bad:{v2+"extra\n",std::string("lux-installed-source-v2\n"+release+"\n"+runtime+"\nAB12\nTest\n"+std::string(64,'c')+"\n1\nx\tX\tnan\n")}){
  bool failed=false;try{lux::parseInstalledSource(bad);}catch(...){failed=true;}assert(failed);
 }
}
