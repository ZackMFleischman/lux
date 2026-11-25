import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sessionId = 'fedca8b2144cd22fec2a5219dbbf5198c782';
const installation = JSON.parse(readFileSync(`${process.env.LOCALAPPDATA}/Programs/Lux/installation.json`, 'utf8'));
const { Client } = await import(pathToFileURL(`${installation.workspace}/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js`));
const { StdioClientTransport } = await import(pathToFileURL(`${installation.workspace}/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js`));

const mode = process.argv[2];
const argsPath = process.argv[3];
const outputPath = process.argv[4];
if (!mode) throw new Error('Usage: starfield-session.mjs <tool> [args.json] [output]');

let toolName = mode.includes('.') ? mode : `lux.studio.${mode}`;
let args = argsPath && argsPath !== '-'
  ? JSON.parse(readFileSync(resolve(argsPath), 'utf8'))
  : {};
if (mode === 'publish-starfield') {
  toolName = 'lux.library.create';
  args = {
    name: 'Cosmos Starfield',
    description: 'Layered fine stars and fixed six-ray feature stars with independent density, scale, variance, opacity, brightness, and subtle twinkle controls.',
    source: {
      sdkVersion: '0.4.0',
      entry: 'starfield.ts',
      files: {
        'starfield.ts': readFileSync(resolve('creative/quasar/starfield.ts'), 'utf8'),
        'starfield-flare-rig.ts': readFileSync(resolve('creative/quasar/starfield-flare-rig.ts'), 'utf8'),
      },
    },
  };
}
const client = new Client({ name: 'quasar-starfield-author', version: '1.0.0' });

try {
  await client.connect(new StdioClientTransport({
    command: installation.node,
    args: [installation.adapter],
    cwd: installation.workspace,
    env: {
      ...process.env,
      LUX_STUDIO_PROFILE: 'desktop',
      LUX_STUDIO_DESKTOP: '1',
      LUX_STUDIO_SESSION_ID: sessionId,
    },
  }));

  if (mode === 'tools') {
    const tools = await client.listTools();
    const data = JSON.stringify(tools.tools, null, 2);
    if (outputPath) {
      mkdirSync(dirname(resolve(outputPath)), { recursive: true });
      writeFileSync(resolve(outputPath), data);
    }
    console.log(data);
  } else {
    const invoke = (name, value = {}) => client.callTool(
      { name, arguments: value },
      undefined,
      { timeout: 75000 },
    );
    let result;
    if (mode === 'build-starfield-scene') {
      const library = JSON.parse(readFileSync(resolve(argsPath), 'utf8'));
      const readResult = await invoke('lux.studio.read');
      const current = JSON.parse(readResult.content.find(block => block.type === 'text').text);
      const authoring = current.status?.authoring;
      if (authoring?.playback === 'playing') {
        await invoke('lux.studio.playback', {
          instanceId: authoring.instanceId,
          expectedGeneration: authoring.generation,
          action: 'pause',
        });
      }
      result = await invoke('lux.studio.build', {
        expectedDraftVersion: current.draftVersion,
        source: {
          sdkVersion: '0.4.0',
          entry: 'scene-setup.ts',
          files: {
            'scene-setup.ts': readFileSync(resolve('creative/quasar/scene-setup.ts'), 'utf8'),
          },
        },
        libraryLinks: [
          {
            componentId: library.id,
            mountPath: 'starfield',
          },
        ],
      });
    } else {
      result = await client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { timeout: 75000 },
      );
    }
    let textIndex = 0;
    let imageIndex = 0;
    for (const block of result.content ?? []) {
      if (block.type === 'text') {
        const path = outputPath
          ? resolve(outputPath.endsWith('.png') ? `${outputPath}.json` : outputPath)
          : resolve(`creative/quasar/starfield-${mode.replaceAll('.', '-')}-${textIndex}.json`);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, block.text);
        console.log(block.text);
        textIndex += 1;
      } else if (block.type === 'image') {
        const base = outputPath ? resolve(outputPath) : resolve(`creative/quasar/starfield-${mode.replaceAll('.', '-')}`);
        const path = base.endsWith('.png') ? base : `${base}-${imageIndex}.png`;
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, Buffer.from(block.data, 'base64'));
        console.log(JSON.stringify({ image: path, mimeType: block.mimeType }));
        imageIndex += 1;
      }
    }
    if (result.isError) process.exitCode = 1;
  }
} finally {
  await client.close();
}
