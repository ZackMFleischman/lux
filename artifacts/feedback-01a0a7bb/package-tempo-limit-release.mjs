import {writeFile} from 'node:fs/promises';
import {packageDesktop} from '../../scripts/studio-package.mjs';
const record=await packageDesktop();
await writeFile(new URL('./tempo-limit-installation.json',import.meta.url),JSON.stringify(record,null,2));
console.log(JSON.stringify({sourceCommit:record.sourceCommit,directory:record.directory,sourceDigest:record.sourceDigest}));
