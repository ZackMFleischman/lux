#pragma once
#include "ReceiverLifecycle.h"
#include <exception>
#include <ostream>

namespace lux {
enum class CopyPollAction { Complete, Wait, Stop, Failed, Deadline };
constexpr CopyPollAction classifyCopyPoll(Completion result, bool stop, bool expired) {
 if(result==Completion::Failed) return CopyPollAction::Failed;
 if(result==Completion::Complete) return CopyPollAction::Complete;
 if(stop) return CopyPollAction::Stop;
 return expired?CopyPollAction::Deadline:CopyPollAction::Wait;
}
struct ReceiverStopRequested {};

// Each diagnostic gets one independent attempt. Neither callback can prevent
// the caller from reaching its existing ownership cleanup after this boundary.
template<class Body, class OnFailure, class Summary>
void runReceiverBody(Body&& body, OnFailure&& failure, Summary&& summary) noexcept {
 try {body();}
 catch(const ReceiverStopRequested&) {}
 catch(const std::exception& error) {try {failure(error.what());} catch(...) {}}
 catch(...) {try {failure("unknown worker exception");} catch(...) {}}
 try {summary();} catch(...) {}
}

// The activation object can retain an old ID or assign one before begin fails.
// Only the caller's current-run successful begin return permits attribution.
template<class Attributed, class Unavailable>
void finalizeReceiverDiagnostics(bool beginSucceeded, Attributed&& attributed, Unavailable&& unavailable) {
 if(beginSucceeded) attributed();
 else unavailable();
}

// Bounded byte escaping, deliberately not a Unicode text conversion. Reaching
// the bound always adds the suffix, without reading one byte beyond the bound.
// A stream exception propagates to runReceiverBody's contained failure callback.
inline void writeReceiverFailure(std::ostream& out, const char* reason) {
 if(!reason) reason="unknown worker exception";
 out<<"{\"kind\":\"failure\",\"reason\":\"";
 constexpr char hex[]="0123456789ABCDEF";
 unsigned index=0;
 for(;index<1024;++index) {
  const auto byte=static_cast<unsigned char>(reason[index]);
  if(!byte) break;
  if(byte=='"'||byte=='\\') {out.put('\\');out.put(static_cast<char>(byte));}
  else if(byte<32||byte>126) {out<<"\\u00";out.put(hex[byte>>4]);out.put(hex[byte&15]);}
  else out.put(static_cast<char>(byte));
 }
 if(index==1024) out<<"...[truncated]";
 out<<"\"}"<<std::endl;
}
}
