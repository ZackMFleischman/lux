import {createCodex} from '../tools/live-copilot/codex.ts';
import {readFile} from 'node:fs/promises';
const agent=createCodex({root:process.cwd(),apiKey:'',log:console.log});
console.log(await agent.execute('Software verification: write exactly copilot-workspace-write-ok followed by a newline to artifacts/copilot-write-smoke.txt. Read the file back using a command and verify its contents. Do not modify any other file or Lux state. Return operation software and accurate success.',new AbortController().signal));
console.log('File verified:',(await readFile('artifacts/copilot-write-smoke.txt','utf8')).trim()==='copilot-workspace-write-ok');
