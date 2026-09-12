// Test-only server: deliberately separate from the future application registry.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { deflateSync } from 'node:zlib';

function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, data, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(32, 0); header.writeUInt32BE(32, 4); header[8] = 8; header[9] = 2;
const pixels = Buffer.alloc(32 * 97);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const color = y < 16 ? (x < 16 ? [255, 0, 0] : [0, 255, 0]) : (x < 16 ? [0, 0, 255] : [255, 255, 0]);
  pixels.set(color, y * 97 + 1 + x * 3);
}
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
const server = new McpServer({ name: 'lux-tr01-profile-fixture', version: '0.0.0' });
server.registerTool('lux_fixture_image', { description: 'TR-01 test-only known image fixture; no renderer or application state.', inputSchema: {} }, async () => ({
  content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }],
}));
await server.connect(new StdioServerTransport());
