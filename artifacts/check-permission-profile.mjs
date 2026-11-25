import {runCodex,sanitizeEnvironment} from '../tools/live-copilot/codex.ts';
const args=['-c','default_permissions="lux-copilot"','-c','permissions={lux-copilot={extends=":workspace",filesystem={"C:/Users/zFlei/repos/lux/.worktrees"="read"}}}','login','status'];
console.log(await runCodex(args,{env:sanitizeEnvironment(process.env,process.env.OPENAI_API_KEY??''),cwd:process.cwd()}));
