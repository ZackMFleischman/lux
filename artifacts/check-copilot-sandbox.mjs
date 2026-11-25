import {createCodex,runCodex} from '../tools/live-copilot/codex.ts';
let invocation;
const agent=createCodex({root:process.cwd(),apiKey:'',run:(args,options)=>{if(args.includes('login'))invocation=args.slice(0,-2);return runCodex(args,options);}});
await agent.verify();
const code="const fs=require('fs'); let denied=false; try {fs.writeFileSync('.worktrees/copilot-sandbox-probe.txt','probe');} catch(e){denied=true;console.log('Reserved subtree denied:',e.code);} if(!denied){fs.unlinkSync('.worktrees/copilot-sandbox-probe.txt');process.exit(1)} fs.writeFileSync('artifacts/copilot-sandbox-probe.txt','allowed'); console.log('Development workspace write allowed');";
console.log(await runCodex([...invocation,'sandbox',process.execPath,'-e',code],{cwd:process.cwd(),env:agent.childEnv}));
