import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

const contentTypes = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  glb: 'model/gltf-binary',
  woff2: 'font/woff2',
  webp: 'image/webp',
  mp4: 'video/mp4',
};
const allowedPath = /^\/(?:index\.html|home\.html|(?:base|compare|fonts)\.css|(?:compare|content|home)\.mjs|concepts\/0[1-5]\.(?:css|js)|assets\/(?:[a-z-]+\.(?:mp4|webp)|fonts\/[a-z0-9-]+\.woff2))$/;
const previewPath = /^\/preview\/(?:index\.html|(?:shared|viewer)\.(?:css|mjs)|0[2-5](?:-[a-z0-9-]+)?\.(?:html|css|mjs|webp))$/;
const universePath = /^\/education-universe\/(?:(?:booklet|universe)\.(?:mjs|css)|(?:graph|scene(?:-layout)?)\.mjs|data\/education_universe\.graph\.json|models\/mgimo_(?:chrome_sculpture|faculty_constellation|hero_universe|program_artifact)\.glb|vendor\/(?:three\.module|three\.core\.min|GLTFLoader|BufferGeometryUtils)\.js)$/;
const port = Number(process.env.PORT || 4180);

function rangeFor(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return start <= end ? { start, end } : null;
}

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const path = request.url.split('?')[0];
  if (path === '/preview') {
    response.writeHead(308, { Location: `/preview/${request.url.slice(path.length)}` }).end();
    return;
  }
  const name = path === '/' ? '/index.html' : path === '/preview/' ? '/preview/index.html' : path;
  if (!allowedPath.test(name) && !previewPath.test(name) && !universePath.test(name)) {
    response.writeHead(404).end();
    return;
  }

  const file = new URL(`.${name}`, import.meta.url);
  const extension = name.split('.').at(-1);

  try {
    const { size } = await stat(file);
    const headers = {
      'Content-Type': contentTypes[extension],
      'Cache-Control': name.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache',
      'Content-Length': size,
    };
    let range;

    if (extension === 'mp4') {
      headers['Accept-Ranges'] = 'bytes';
      if (request.headers.range) {
        range = rangeFor(request.headers.range, size);
        if (!range) {
          response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
          return;
        }
        headers['Content-Length'] = range.end - range.start + 1;
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      }
    }

    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = createReadStream(file, range);
    stream.once('error', () => response.destroy());
    response.once('close', () => stream.destroy());
    stream.pipe(response);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Campus OS · http://127.0.0.1:${port}/`);
});
