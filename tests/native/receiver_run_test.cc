#include "ReceiverRun.h"
#include <array>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
#define CHECK(x) do {if(!(x)){std::cerr<<"FAIL line "<<__LINE__<<": " #x "\n";return 1;}}while(0)
using lux::Completion;
using lux::CopyPollAction;

// Breaking outcome precedence, callback containment, attribution or escaping
// must fail these checks through the same helpers used by FrameReceiver.
int main() {
 struct Case {Completion completion; bool stop, expired; CopyPollAction want;};
 const Case matrix[] = {
  {Completion::Complete,false,false,CopyPollAction::Complete},
  {Completion::Complete,false,true,CopyPollAction::Complete},
  {Completion::Complete,true,false,CopyPollAction::Complete},
  {Completion::Complete,true,true,CopyPollAction::Complete},
  {Completion::Failed,false,false,CopyPollAction::Failed},
  {Completion::Failed,false,true,CopyPollAction::Failed},
  {Completion::Failed,true,false,CopyPollAction::Failed},
  {Completion::Failed,true,true,CopyPollAction::Failed},
  {Completion::Pending,false,false,CopyPollAction::Wait},
  {Completion::Pending,false,true,CopyPollAction::Deadline},
  {Completion::Pending,true,false,CopyPollAction::Stop},
  {Completion::Pending,true,true,CopyPollAction::Stop}
 };
 for(const auto& c:matrix) CHECK(lux::classifyCopyPoll(c.completion,c.stop,c.expired)==c.want);

 const std::string reasons[]={"","","local D3D copy deadline","local D3D copy query failure","unknown worker exception"};
 for(int outcome=0;outcome<5;++outcome) for(int throws=0;throws<4;++throws) {
  int summaries=0, failures=0, continued=0; std::string reason; std::vector<std::string> order;
  lux::runReceiverBody([&] {
   if(outcome==1) {
    if(lux::classifyCopyPoll(Completion::Pending,true,true)==CopyPollAction::Stop)
     throw lux::ReceiverStopRequested{};
   }
   if(outcome==2) throw std::runtime_error("local D3D copy deadline");
   if(outcome==3) throw std::runtime_error("local D3D copy query failure");
   if(outcome==4) throw 7;
   ++continued;
  },[&](const char* error) {
   ++failures; reason=error; order.push_back("failure");
   if(throws&1) throw std::runtime_error("diagnostic failure");
  },[&] {
   ++summaries; order.push_back("summary");
   if(throws&2) throw 9;
  });
  order.push_back("cleanup");
  CHECK(summaries==1); CHECK(failures==(outcome>=2?1:0));
  CHECK(continued==(outcome==0?1:0)); CHECK(reason==reasons[outcome]);
  CHECK(order==(outcome>=2?std::vector<std::string>{"failure","summary","cleanup"}:std::vector<std::string>{"summary","cleanup"}));
 }

 // Reuse an activation with a retained ID across successful and failed runs.
 // No Windows activation/host is executed by this CPU seam fixture.
 for(const auto initial: {"","old-instance"}) {
 std::string instance=initial;
 for(int setup: {0,1,2,3,0,1,2,3}) {
  bool beginSucceeded=false; int rows=0, unavailable=0, attempts=0, failures=0, cleanup=0;
  lux::runReceiverBody([&] {
   if(setup==0) throw std::runtime_error("before begin");
   if(setup==1) throw std::runtime_error("begin before ID");
   instance="new-instance";
   if(setup==2) throw std::runtime_error("begin after ID");
   beginSucceeded=true; // Only a successful begin return permits attribution.
  },[&](const char*) {++failures;},[&] {
   ++attempts;
   lux::finalizeReceiverDiagnostics(beginSucceeded,[&] {rows+=2;},[&] {++unavailable;});
  });
  ++cleanup;
  CHECK(attempts==1&&cleanup==1);
  CHECK(rows==(setup==3?2:0)); CHECK(unavailable==(setup==3?0:1));
  CHECK(failures==(setup==3?0:1));
  if(setup==3) CHECK(instance=="new-instance");
 }
 }

 const auto format=[](const char* reason) {std::ostringstream out;lux::writeReceiverFailure(out,reason);return out.str();};
 CHECK(format("quote\" slash\\\n\t\r") == "{\"kind\":\"failure\",\"reason\":\"quote\\\" slash\\\\\\u000A\\u0009\\u000D\"}\n");
 const char bytes[]={1,31,127,static_cast<char>(128),static_cast<char>(255),0};
 CHECK(format(bytes)=="{\"kind\":\"failure\",\"reason\":\"\\u0001\\u001F\\u007F\\u0080\\u00FF\"}\n");
 const char nul[]={'a',0,'b',0};
 CHECK(format(nul)=="{\"kind\":\"failure\",\"reason\":\"a\"}\n");
 CHECK(format("")=="{\"kind\":\"failure\",\"reason\":\"\"}\n");
 CHECK(format(nullptr)=="{\"kind\":\"failure\",\"reason\":\"unknown worker exception\"}\n");
 std::array<char,1024> bounded; bounded.fill('x'); // Deliberately no NUL: must not read byte 1025.
 CHECK(format(bounded.data())=="{\"kind\":\"failure\",\"reason\":\""+std::string(1024,'x')+"...[truncated]\"}\n");
 std::string below(1023,'x');
 CHECK(format(below.c_str())=="{\"kind\":\"failure\",\"reason\":\""+below+"\"}\n");

 // A real ostream that fails after partial output: no retry or completed row.
 struct FailingBuffer:std::streambuf {
  std::string bytes;
  int_type overflow(int_type c) override {
   if(bytes.size()==12) return traits_type::eof();
   if(!traits_type::eq_int_type(c,traits_type::eof())) bytes.push_back(traits_type::to_char_type(c));
   return c;
  }
 } buffer;
 std::ostream broken(&buffer); broken.exceptions(std::ios::badbit|std::ios::failbit);
 int failures=0,summaries=0,cleanup=0;
 lux::runReceiverBody([] {throw std::runtime_error("query failure");},[&](const char* reason) {
  ++failures;lux::writeReceiverFailure(broken,reason);
 },[&] {++summaries;broken<<"summary\n";});
 ++cleanup;
 CHECK(failures==1&&summaries==1&&cleanup==1);
 CHECK(buffer.bytes.size()==12&&buffer.bytes.find('\n')==std::string::npos);
 CHECK(!broken.good());
 std::cout<<"receiver run CPU checks passed: outcome matrix, diagnostic containment, attribution, bounded JSON\n";
}
