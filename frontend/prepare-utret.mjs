import { cp, mkdir, readdir } from 'node:fs/promises'

const source = new URL('../campus-os-design-exploration/', import.meta.url)
const target = new URL('./public/', import.meta.url)
const preview = await readdir(new URL('preview/', source))
const files = [
  'content.mjs',
  'fonts.css',
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
