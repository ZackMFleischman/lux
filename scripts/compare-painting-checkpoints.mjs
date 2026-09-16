import {readFile,writeFile} from 'node:fs/promises';
import {decode} from 'fast-png';
const [beforePath,afterPath,resultPath]=process.argv.slice(2);const before=decode(await readFile(beforePath)),after=decode(await readFile(afterPath));
if(before.width!==after.width||before.height!==after.height||before.channels!==after.channels)throw Error('Capture dimensions differ');
let total=0,max=0,changed=0,overOne=0;for(let i=0;i<before.data.length;i++){const delta=Math.abs(before.data[i]-after.data[i]);total+=delta;max=Math.max(max,delta);if(delta)changed++;if(delta>1)overOne++;}
const result={beforePath,afterPath,width:before.width,height:before.height,channels:before.channels,maxChannelDifference:max,meanChannelDifference:total/before.data.length,changedChannels:changed,channelsBeyondOneLevel:overOne,exactMatch:changed===0};
console.log(JSON.stringify(result,null,2));if(resultPath)await writeFile(resultPath,JSON.stringify(result,null,2));
