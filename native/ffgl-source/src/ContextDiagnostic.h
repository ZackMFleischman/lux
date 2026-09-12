#pragma once
#include <ostream>
#include <string_view>
namespace lux {
// Diagnostics must remain valid JSON for driver/display names and literal handles.
inline void diagnosticString(std::ostream& out,std::string_view value){
 out<<'"';for(unsigned char c:value){switch(c){case '"':out<<"\\\"";break;case '\\':out<<"\\\\";break;case '\n':out<<"\\n";break;case '\r':out<<"\\r";break;case '\t':out<<"\\t";break;default:if(c<0x20){const char* hex="0123456789abcdef";out<<"\\u00"<<hex[c>>4]<<hex[c&15];}else out<<char(c);}}out<<'"';
}
}
