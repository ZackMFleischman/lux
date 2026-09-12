import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';
const main='apps/render-host/src/main.ts';
const result=ts.transpileModule(fs.readFileSync(main,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:main});
const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];
if(errors.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
fs.writeFileSync('apps/render-host/src/main.cjs',result.outputText);
for(const filename of ['apps/render-host/src/main.cjs','apps/render-host/src/visual-worker.js','tools/gpu-spike/recorder.cjs']) {
 const check=spawnSync(process.execPath,['--check',filename],{encoding:'utf8'});
 if(check.status!==0)throw new Error(check.stderr);
}
console.log('GPU spike main emitted; worker/recorder syntax checked (not a semantic TypeScript check).');
