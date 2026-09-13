#pragma once
#include <string>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <cstdint>
#include <vector>
#include <set>
#include <cmath>
#include <charconv>
namespace lux {
struct InstalledParameter {std::string id,label;float initial=0;};
struct InstalledSource {std::string releaseId,runtimeId,pluginId,name,schemaHash,descriptorHash;uint32_t version=1;std::vector<InstalledParameter> controls;};
inline bool installedHex(const std::string& value,size_t size){return value.size()==size&&value.find_first_not_of("0123456789abcdef")==std::string::npos;}
inline InstalledSource parseInstalledSource(const std::string& text){
 if(text.size()>8192)throw std::runtime_error("Lux source descriptor exceeds limit; reinstall this release");
 std::istringstream input(text);std::string version,extra;InstalledSource result;
 std::getline(input,version);std::getline(input,result.releaseId);std::getline(input,result.runtimeId);std::getline(input,result.pluginId);std::getline(input,result.name);
 if((version!="lux-installed-source-v1"&&version!="lux-installed-source-v2")||!installedHex(result.releaseId,64)||!installedHex(result.runtimeId,64)||result.pluginId.size()!=4||
    result.pluginId.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")!=std::string::npos||result.name.empty()||result.name.size()>16)
  throw std::runtime_error("Invalid Lux source descriptor; reinstall this release");
 for(unsigned char c:result.name)if(c<32||c>126)throw std::runtime_error("Invalid Lux source name");
 if(version=="lux-installed-source-v1") {if(text.size()>512||std::getline(input,extra))throw std::runtime_error("Invalid legacy Lux descriptor");return result;}
 result.version=2;std::string countText;std::getline(input,result.schemaHash);std::getline(input,countText);
 unsigned count=33;auto parsed=std::from_chars(countText.data(),countText.data()+countText.size(),count);
 if(!installedHex(result.schemaHash,64)||parsed.ec!=std::errc()||parsed.ptr!=countText.data()+countText.size()||count>32||std::to_string(count)!=countText)throw std::runtime_error("Invalid Lux parameter count/schema");
 std::set<std::string> ids,labels;
 for(unsigned index=0;index<count;++index){
  std::string line,value;InstalledParameter row;std::getline(input,line);std::istringstream fields(line);
  if(!std::getline(fields,row.id,'\t')||!std::getline(fields,row.label,'\t')||!std::getline(fields,value,'\t')||std::getline(fields,extra,'\t'))throw std::runtime_error("Invalid Lux parameter row");
  auto number=std::from_chars(value.data(),value.data()+value.size(),row.initial);
  if(row.id.empty()||row.id.size()>64||row.id[0]<'a'||row.id[0]>'z'||row.id.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")!=std::string::npos||row.id=="constructor"||row.id=="prototype"||!ids.insert(row.id).second||row.label.empty()||row.label.size()>16||!labels.insert(row.label).second||number.ec!=std::errc()||number.ptr!=value.data()+value.size()||!std::isfinite(row.initial)||row.initial<0||row.initial>1)throw std::runtime_error("Invalid Lux parameter mapping");
  for(unsigned char c:row.label)if(c<32||c>126)throw std::runtime_error("Invalid Lux host label");
  result.controls.push_back(row);
 }
 if(std::getline(input,extra))throw std::runtime_error("Extra Lux descriptor rows");
 return result;
}
inline std::string installedInstanceName(uint64_t process,uint64_t sequence){std::ostringstream result;result<<std::hex<<std::setfill('0')<<std::setw(16)<<process<<std::setw(16)<<sequence;return result.str();}
}
