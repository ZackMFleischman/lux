import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import packageIO from '../../packages/export/src/package.cjs';
const require = createRequire(import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => JSON.stringify(value,null,2) + '\n';
test('Node and bundled Electron inventory, validate and copy raw ASAR bytes identically', () => {
  const root = path.resolve(import.meta.dirname,'../..'), artifacts = path.join(root,'artifacts');
  fs.mkdirSync(artifacts,{recursive:true});
  const temporary = fs.mkdtempSync(path.join(artifacts,'export-rawfs-'));
  const runtime = path.join(temporary,'runtime'); fs.mkdirSync(runtime);
  const electron = require('electron');
  const asarRelative = 'electron/resources/default_app.asar';
  try {
    for (const relative of packageIO.requiredRuntimeFiles) {
      const filename = path.join(runtime,relative); fs.mkdirSync(path.dirname(filename),{recursive:true});
      fs.writeFileSync(filename,relative === 'electron/version' ? '44.3.0' : 'CPU fixture: ' + relative);
    }
    const archive = fs.readFileSync(path.join(path.dirname(electron),'resources/default_app.asar'));
    fs.writeFileSync(path.join(runtime,asarRelative),archive);
    const inventory = packageIO.requiredRuntimeFiles.map(relative => {
      const bytes = fs.readFileSync(path.join(runtime,relative));return {path:relative,bytes:bytes.length,sha256:hash(bytes)};
    }).sort((a,b)=>a.path.localeCompare(b.path));
    const body = {format:'lux-runtime',version:1,platform:'win32-x64',electronVersion:'44.3.0',files:inventory};
    const runtimeId = hash(encode(body));fs.writeFileSync(path.join(runtime,'runtime.json'),encode({...body,runtimeId}));
    const script = path.join(temporary,'inspect.cjs');
    fs.writeFileSync(script, `const p=require(${JSON.stringify(path.join(root,'packages/export/src/package.cjs'))});
const fs=process.versions.electron?require('original-fs'):require('node:fs');
const path=require('node:path'),crypto=require('node:crypto');
const manifest=p.validateRuntime(process.argv[2]);p.copyTree(process.argv[2],process.argv[3]);
const copied=p.validateRuntime(process.argv[3]);const file=path.join(process.argv[3],${JSON.stringify(asarRelative)}),bytes=fs.readFileSync(file);
process.stdout.write(JSON.stringify({runtimeId:manifest.runtimeId,copiedId:copied.runtimeId,files:copied.files,archive:{size:fs.statSync(file).size,isFile:fs.statSync(file).isFile(),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}}));`);
    const env = {...process.env,ELECTRON_RUN_AS_NODE:'1'}; delete env.NODE_OPTIONS;delete env.NODE_PATH;delete env.ELECTRON_NO_ASAR;
    const options = {env,windowsHide:true,timeout:15000,maxBuffer:1024*1024,encoding:'utf8'};
    const machine = JSON.parse(execFileSync(process.execPath,[script,runtime,path.join(temporary,'node-copy')],options));
    const bundled = JSON.parse(execFileSync(electron,[script,runtime,path.join(temporary,'electron-copy')],options));
    assert.deepEqual(bundled,machine);
    assert.deepEqual(bundled.archive,{size:archive.length,isFile:true,bytes:archive.length,sha256:hash(archive)});
    assert.equal(bundled.runtimeId,runtimeId);
  } finally {
    assert.equal(path.dirname(temporary),artifacts);fs.rmSync(temporary,{recursive:true,force:true});
  }
});
