#include "frame_telemetry.h"
#include <cassert>
int main(){
 lux::ControlSchemaHashV4 schema{};schema.fill('a');
 lux::FrameProvenanceV4 claim;assert(lux::validFrameProvenanceV4(claim,schema,2));
 claim.status=1;claim.workerFrame=1;claim.receivedQpc=1;claim.revisionHash.fill('b');claim.schemaHash=schema;claim.count=2;claim.normalized[0]=0.2f;
 assert(lux::validFrameProvenanceV4(claim,schema,2));
 auto rejects=[&](auto change){auto invalid=claim;change(invalid);assert(!lux::validFrameProvenanceV4(invalid,schema,2));};
 rejects([](auto& p){p.count=UINT32_MAX;});rejects([](auto& p){p.count=33;});rejects([](auto& p){p.count=1;});
 rejects([](auto& p){p.status=2;});rejects([](auto& p){p.status=0;});rejects([](auto& p){p.reserved=1;});
 rejects([](auto& p){p.schemaHash[0]='c';});rejects([](auto& p){p.revisionHash[0]='"';});
 rejects([](auto& p){p.workerFrame=0;});rejects([](auto& p){p.receivedQpc=0;});rejects([](auto& p){p.controlSequence=9007199254740992ULL;});
 rejects([](auto& p){p.normalized[0]=std::numeric_limits<float>::quiet_NaN();});rejects([](auto& p){p.normalized[0]=std::numeric_limits<float>::infinity();});
 rejects([](auto& p){p.normalized[0]=-0.1f;});rejects([](auto& p){p.normalized[0]=1.1f;});rejects([](auto& p){p.normalized[31]=0.5f;});
 auto empty=claim;empty.count=0;empty.normalized={};assert(lux::validFrameProvenanceV4(empty,schema,0));
 lux::OpportunityQueue<2> queue;lux::HostOpportunity first;first.sequence=1;first.present=true;first.provenance.count=2;first.provenance.normalized[0]=0.2f;first.provenance.status=1;
 assert(queue.push(first));first.sequence=2;first.provenance.normalized[0]=0.8f;assert(queue.push(first));assert(!queue.push(first));assert(queue.lost==1);
 lux::HostOpportunity out;assert(queue.pop(out)&&out.sequence==1&&out.provenance.normalized[0]==0.2f&&out.provenance.status==1);assert(queue.pop(out)&&out.sequence==2&&out.provenance.normalized[0]==0.8f);assert(!queue.pop(out));
}
