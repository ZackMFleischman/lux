const [task, prerequisites] = process.argv.slice(2);
console.error(`UNAVAILABLE: ${task ?? 'unknown task'} required; prerequisites: ${prerequisites ?? 'task implementation'}. This command has not exercised hardware or passed acceptance.`);
process.exitCode = 2;
