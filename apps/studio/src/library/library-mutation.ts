const delay=()=>new Promise<void>(resolve=>setTimeout(resolve,250));
export async function completeLibraryMutation<T>(mutate:()=>Promise<T>,refresh:()=>Promise<unknown>,onRefreshError:(reason:unknown)=>void,wait:()=>Promise<void>=delay):Promise<T>{
 const result=await mutate();
 void (async()=>{for(let attempt=0;attempt<80;attempt++){try{await refresh();return;}catch(reason){if(!(reason instanceof Error)||reason.message!=='Studio is busy'||attempt===79)throw reason;await wait();}}})().catch(onRefreshError);
 return result;
}
