const RuntimeMap=Map,RuntimeError=Error,freeze=Object.freeze,call=Function.prototype.call,mapGet=call.bind(Map.prototype.get),mapSet=call.bind(Map.prototype.set);

export function createTriggerLedger(limit=16384){
 if(!Number.isSafeInteger(limit)||limit<1)throw new RuntimeError('Invalid trigger ledger limit');
 const entries=new RuntimeMap();let size=0;
 return Object.freeze({
  lookup(commandId,targetKey){const existing=mapGet(entries,commandId);if(existing&&existing.targetKey!==targetKey)throw new RuntimeError('Command ID was already used for another payload');return existing;},
  begin(commandId,targetKey){
   const existing=mapGet(entries,commandId);
   if(existing){if(existing.targetKey!==targetKey)throw new RuntimeError('Trigger command ID was already used for another target');return freeze({entry:existing,duplicate:true});}
   if(size>=limit)throw new RuntimeError('Trigger command ledger is full; restart runtime');
   const entry={targetKey,receipt:undefined};mapSet(entries,commandId,entry);size++;
   return freeze({entry,duplicate:false});
  },
  complete(entry,receipt){if(entry.receipt)throw new RuntimeError('Trigger command was already completed');entry.receipt=receipt;},
  hasCapacity(){return size<limit;},
  size(){return size;},
 });
}
