import sculpture from './universe-models/mgimo_chrome_sculpture.glb.gz'
import constellation from './universe-models/mgimo_faculty_constellation.glb.gz'
import program from './universe-models/mgimo_program_artifact.glb.gz'

export { MeshoptDecoder } from 'meshoptimizer/decoder'
export { createUniverseScene } from '../campus-os-design-exploration/education-universe/scene.mjs'

export function loadModelFiles() {
  return Promise.all([sculpture, constellation, program].map(bytes => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).arrayBuffer()
  }))
}
