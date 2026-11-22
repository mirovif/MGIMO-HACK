import { createReadStream, createWriteStream } from 'node:fs'
import { cp, mkdir, readFile, readdir } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { build } from 'esbuild'

const source = new URL('../campus-os-design-exploration/', import.meta.url)
const target = new URL('./public/', import.meta.url)
const preview = await readdir(new URL('preview/', source))
const files = [
  'content.mjs',
  'fonts.css',
  'utret-theme.css',
  'kameta-wave.css',
  'assets/fonts',
  'assets/campus-fast.mp4',
  'assets/campus-still-fast.webp',
  'assets/navigation-route.webp',
  'assets/universe-example.webp',
  'assets/kameta.webp',
  'assets/team-artemiy.webp',
  'assets/team-maxim.webp',
  'assets/team-ivan.webp',
  'education-universe',
  ...preview.filter(name => /^(?:05(?:-[a-z]+)?|shared)\.(?:html|css|mjs)$/.test(name))
    .map(name => 'preview/' + name),
]

await mkdir(new URL('assets/', target), { recursive: true })
await mkdir(new URL('preview/', target), { recursive: true })
await Promise.all(files.map(file => cp(new URL(file, source), new URL(file, target), { recursive: true })))

const universe = new URL('education-universe/', target)
const meshoptLicense = await readFile(new URL('LICENSE.md', import.meta.resolve('meshoptimizer/decoder')), 'utf8')
const universeFiles = [
  'data/education_universe.graph.json',
  'models/mgimo_chrome_sculpture.glb',
  'models/mgimo_faculty_constellation.glb',
  'models/mgimo_program_artifact.glb',
]
await Promise.all([
  build({
    entryPoints: [fileURLToPath(new URL('universe-scene-entry.mjs', import.meta.url))],
    outfile: fileURLToPath(new URL('scene.bundle.mjs', universe)),
    platform: 'browser',
    format: 'esm',
    target: 'es2020',
    bundle: true,
    minify: true,
    legalComments: 'eof',
    banner: { js: `/* Meshoptimizer\n${meshoptLicense.trimEnd()}\n*/` },
    loader: { '.gz': 'binary' },
  }),
  ...universeFiles.map(name => pipeline(
    createReadStream(new URL(name, universe)),
    createGzip({ level: 9 }),
    createWriteStream(new URL(name + '.gz', universe)),
  )),
])
