import {mkdir,open,readdir,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {verifySceneDocument} from './scene-document.ts';
import type {SceneDocument} from './scene-document.ts';
const maximumBytes=8*1024*1024,maximumLooks=128;
const idSchema=z.string().uuid();
const nameSchema=z.string().transform(value=>value.normalize('NFKC').trim()).pipe(z.string().min(1).max(80).refine(value=>!/[\u0000-\u001f\u007f]/.test(value),'Invalid look name'));
const envelope=z.object({format:z.literal('lux-look'),version:z.literal(1),id:idSchema,revision:z.number().int().positive(),name:nameSchema,updatedAt:z.string().datetime(),document:z.unknown(),thumbnail:z.string().max(350000).regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/).optional()}).strict();
export type Look=Readonly<{format:'lux-look';version:1;id:string;revision:number;name:string;updatedAt:string;document:SceneDocument;thumbnail?:string}>;
export type LookSummary=Readonly<{id:string;revision:number;name:string;updatedAt:string;thumbnail?:string;error?:string}>;
export type SaveLook={id?:string;expectedRevision?:number;name:string;document:SceneDocument;thumbnail?:string};
const summary=({document:_document,...row}:Look):LookSummary=>row;
export class LookStore {
  private queue:Promise<unknown>=Promise.resolve();
  private directory: string;
  private options: {beforeRename?:()=>Promise<void>};
  constructor(directory:string,options:{beforeRename?:()=>Promise<void>}={}){this.directory=directory;this.options=options;}
  private async ids(){await mkdir(this.directory,{recursive:true});const entries=(await readdir(this.directory)).filter(name=>name.endsWith('.json')&&idSchema.safeParse(name.slice(0,-5)).success).sort();if(entries.length>maximumLooks)throw Error('Looks supports at most 128 saved looks');return entries;}
  async read(id:string):Promise<Look>{
    if(!idSchema.safeParse(id).success)throw Error('Invalid look ID');
    const handle=await open(join(this.directory,id+'.json'),'r');
    try{
      if((await handle.stat()).size>maximumBytes)throw Error('Look exceeds 8 MiB');
      const bytes=Buffer.alloc(maximumBytes+1);let offset=0;
      while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,null);if(!bytesRead)break;offset+=bytesRead;}
      if(offset>maximumBytes)throw Error('Look exceeds 8 MiB');
      const raw=envelope.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,offset))));
      if(raw.id!==id)throw Error('Look identity mismatch');
      const document=await verifySceneDocument(raw.document);
      if(document.version===5&&document.libraryLinks.length)throw Error('Looks must contain frozen library source');
      return {...raw,document};
    }finally{await handle.close();}
  }
  async list():Promise<readonly LookSummary[]>{
    const rows:LookSummary[]=[];
    for(const filename of await this.ids()){
      const id=filename.slice(0,-5);
      try{rows.push(summary(await this.read(id)));}catch{rows.push({id,revision:0,name:'Unavailable look',updatedAt:'',error:'This look is damaged. Other looks are still available.'});}
    }
    return rows.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.name.localeCompare(b.name));
  }
  save(input:SaveLook):Promise<LookSummary>{
    const copied=structuredClone(input);
    const operation=async()=>{
      const name=nameSchema.parse(copied.name),rows=await this.list();
      if(rows.some(row=>row.id!==copied.id&&!row.error&&row.name.toLocaleLowerCase('en-US')===name.toLocaleLowerCase('en-US')))throw Error('A look has this name. Choose another name or update the selected look.');
      const previous=copied.id?await this.read(copied.id):undefined;
      if(previous&&copied.expectedRevision!==previous.revision)throw Error('Look revision changed. Refresh and try again.');
      if(!previous&&rows.length>=maximumLooks)throw Error('Looks supports at most 128 saved looks');
      const document=await verifySceneDocument(copied.document);
      if(document.version===5&&document.libraryLinks.length)throw Error('Looks must contain frozen library source');
      const candidate:Look={format:'lux-look',version:1,id:previous?.id??randomUUID(),revision:(previous?.revision??0)+1,name,updatedAt:new Date().toISOString(),document,...(copied.thumbnail?{thumbnail:copied.thumbnail}:{})};
      envelope.parse(candidate);
      const bytes=Buffer.from(JSON.stringify(candidate,null,2)+'\n');if(bytes.length>maximumBytes)throw Error('Look exceeds 8 MiB');
      const temporary=join(this.directory,`.look-${randomUUID()}.tmp`);let committed=false;
      try{
        const handle=await open(temporary,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
        await this.options.beforeRename?.();await rename(temporary,join(this.directory,candidate.id+'.json'));committed=true;
      }finally{if(!committed)await unlink(temporary).catch(()=>{});}
      return summary(candidate);
    };
    const result=this.queue.then(operation,operation);this.queue=result.catch(()=>{});return result;
  }
}
