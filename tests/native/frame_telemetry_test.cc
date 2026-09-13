#include "frame_telemetry.h"
#include <cassert>
int main(){
 lux::OpportunityQueue<2> queue;lux::HostOpportunity first;first.sequence=1;first.present=true;first.provenance.count=2;first.provenance.normalized[0]=0.2f;first.provenance.status=1;
 assert(queue.push(first));first.sequence=2;first.provenance.normalized[0]=0.8f;assert(queue.push(first));assert(!queue.push(first));assert(queue.lost==1);
 lux::HostOpportunity out;assert(queue.pop(out)&&out.sequence==1&&out.provenance.normalized[0]==0.2f&&out.provenance.status==1);assert(queue.pop(out)&&out.sequence==2&&out.provenance.normalized[0]==0.8f);assert(!queue.pop(out));
}
