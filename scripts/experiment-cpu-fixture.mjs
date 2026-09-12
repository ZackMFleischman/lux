// Fixed harmless scenarios only. CPU mode never accepts arbitrary commands.
import { spawn } from 'node:child_process';
console.log('cpu fixture', process.argv[2]);
console.log('experiment directory', process.env.LUX_EXPERIMENT_DIRECTORY);
console.log('experiment timeout', process.env.LUX_EXPERIMENT_TIMEOUT_MS);
if (process.argv[2] === 'failure') { console.error('expected fixture failure'); process.exitCode = 7; }
else if (process.argv[2] === 'timeout') {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  console.log('grandchild', child.pid);
  setInterval(() => {}, 1000);
}
