#include "ContextDiagnostic.h"
#include <sstream>
#include <iostream>
int main(){std::ostringstream out;lux::diagnosticString(out,"GPU \\\"name\"\n\t\x01");if(out.str()!=R"("GPU \\\"name\"\n\t\u0001")"){std::cerr<<out.str()<<"\n";return 1;}}
