#pragma once
#include <string>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <cstdint>
namespace lux {
struct InstalledSource {std::string releaseId,runtimeId,pluginId,name;};
inline bool installedHex(const std::string& value,size_t size){return value.size()==size&&value.find_first_not_of("0123456789abcdef")==std::string::npos;}
inline InstalledSource parseInstalledSource(const std::string& text){
 if(text.size()>512)throw std::runtime_error("Lux source descriptor exceeds 512 bytes; reinstall this release");
 std::istringstream input(text);std::string version,extra;InstalledSource result;
 std::getline(input,version);std::getline(input,result.releaseId);std::getline(input,result.runtimeId);std::getline(input,result.pluginId);std::getline(input,result.name);
 if(version!="lux-installed-source-v1"||!installedHex(result.releaseId,64)||!installedHex(result.runtimeId,64)||result.pluginId.size()!=4||
    result.pluginId.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")!=std::string::npos||result.name.empty()||result.name.size()>16||std::getline(input,extra))
  throw std::runtime_error("Invalid Lux source descriptor; reinstall this release");
 for(unsigned char c:result.name)if(c<32||c>126)throw std::runtime_error("Invalid Lux source name");
 return result;
}
inline std::string installedInstanceName(uint64_t process,uint64_t sequence){std::ostringstream result;result<<std::hex<<std::setfill('0')<<std::setw(16)<<process<<std::setw(16)<<sequence;return result.str();}
}
