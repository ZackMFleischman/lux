const fs=require('node:fs');
const {spawn}=require('node:child_process');
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
console.log('descendant '+child.pid);
setInterval(()=>{if(process.argv[3]!=='ignore'&&fs.existsSync(process.argv[2]))process.exit(0);},20);
