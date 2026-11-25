const http = require('node:http');
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end('Read-only portal');
  }
  const upstream = http.request({ hostname: '127.0.0.1', port: 7331,
    path: req.url, method: req.method,
    headers: { accept: req.headers.accept || '*/*', host: '127.0.0.1:7331' } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Portal unavailable'); });
  res.on('close', () => upstream.destroy());
  upstream.end();
});
server.listen(7331, '192.168.0.4', () => console.log('Conductor LAN portal: http://192.168.0.4:7331'));
