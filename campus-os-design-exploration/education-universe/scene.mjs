import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import {
  SCHOOL_ANCHORS, makeSubjectField, orbitFor, randomFor, satelliteBearing, stepSubjectField,
} from './scene-layout.mjs';

const PALETTE = [0x839fde, 0xa0a9d2, 0xc3ade2, 0xd1a986, 0x9391d9, 0x9ab5d8, 0xb179be, 0xceba9e, 0x7a99d7];
const clamp = THREE.MathUtils.clamp;
const FULL_TURN = Math.PI * 2;

function makeStudio(renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x05070d);
  const geometry = new THREE.PlaneGeometry();
  const panels = [
    [[-4, 4, 6], [5.4, 2.2], 0xe8edff, 4.6],
    [[6, 3, 0], [2.8, 7], 0xb1caff, 3.1],
    [[-5, -4, 1], [1.3, 5.4], 0xa592ec, 2.4],
    [[-1, 5, -5], [6, 3.8], 0xd1ddff, 3.2],
    [[2, -3.8, 5], [4.5, 1.2], 0xe5b792, 1.35],
    [[1.3, .9, 7], [6.8, 5.3], 0xc1d2ff, 1.09],
    [[2.6, 2.1, 6], [.8, 5.6], 0xc5b6ff, 3.15],
  ];
  for (const [position, scale, color, intensity] of panels) {
    const material = new THREE.MeshBasicMaterial({ color });
    material.color.multiplyScalar(intensity);
    const light = new THREE.Mesh(geometry, material);
    light.position.set(...position);
    light.scale.set(...scale, 1);
    light.lookAt(0, 0, 0);
    room.add(light);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(room, .035, .1, 30);
  generator.dispose();
  geometry.dispose();
  for (const object of room.children) object.material.dispose();
  return environment;
}

function makeArtTemplate(model, keep) {
  model.updateMatrixWorld(true);
  const materials = new Map();
  const sourceGeometries = new Set();
  const sourceMaterials = new Set();
  const bounds = new THREE.Box3();
  model.traverse((object) => {
    if (!object.isMesh) return;
    sourceGeometries.add(object.geometry);
    sourceMaterials.add(object.material);
    if (!keep(object.name)) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    geometry.computeBoundingBox();
    bounds.union(geometry.boundingBox);
    if (!materials.has(object.material)) materials.set(object.material, []);
    materials.get(object.material).push(geometry);
  });

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 1 / Math.max(size.x, size.y, size.z);
  const batches = [];
  for (const [material, geometries] of materials) {
    const vertexCount = geometries.reduce((total, geometry) => total + geometry.attributes.position.count, 0);
    const indexCount = geometries.reduce((total, geometry) => total + (geometry.index?.count ?? geometry.attributes.position.count), 0);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    let vertexOffset = 0;
    let indexOffset = 0;
    for (const source of geometries) {
      if (!source.attributes.normal) source.computeVertexNormals();
      const position = source.attributes.position;
      const normal = source.attributes.normal;
      for (let i = 0; i < position.count; i += 1) {
        const offset = (vertexOffset + i) * 3;
        vertices[offset] = (position.getX(i) - center.x) * scale;
        vertices[offset + 1] = (position.getY(i) - center.y) * scale;
        vertices[offset + 2] = (position.getZ(i) - center.z) * scale;
        normals[offset] = normal.getX(i);
        normals[offset + 1] = normal.getY(i);
        normals[offset + 2] = normal.getZ(i);
      }
      const count = source.index?.count ?? position.count;
      for (let i = 0; i < count; i += 1) {
        indices[indexOffset + i] = vertexOffset + (source.index ? source.index.getX(i) : i);
      }
      vertexOffset += position.count;
      indexOffset += count;
      source.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    const finish = material.clone();
    finish.envMapIntensity = 1.85;
    finish.roughness = Math.max(finish.roughness, .09);
    finish.transparent = true;
    batches.push({ geometry, finish });
  }
  for (const geometry of sourceGeometries) geometry.dispose();
  for (const material of sourceMaterials) material.dispose();
  return batches;
}

function makeOrbitalCrystal() {
  const model = new THREE.Group();
  const violet = new THREE.MeshPhysicalMaterial({
    name: 'Amethyst facets',
    color: 0x6f65bc,
    emissive: 0x41327b,
    emissiveIntensity: .28,
    metalness: .62,
    roughness: .20,
    clearcoat: .68,
    clearcoatRoughness: .19,
  });
  const edge = new THREE.MeshPhysicalMaterial({
    name: 'Pale amethyst facets',
    color: 0xaaa4e1,
    emissive: 0x483881,
    emissiveIntensity: .20,
    metalness: .65,
    roughness: .18,
    clearcoat: .72,
  });
  const gunmetal = new THREE.MeshStandardMaterial({
    name: 'Orbit plates', color: 0x38415b, metalness: .91, roughness: .24,
  });
  const chrome = new THREE.MeshStandardMaterial({
    name: 'Orbit trims', color: 0x8798bd, metalness: .96, roughness: .16,
  });
  const light = new THREE.MeshStandardMaterial({
    name: 'Violet inlays', color: 0x9b89ca, emissive: 0x6f50a7,
    emissiveIntensity: .24, metalness: .67, roughness: .24,
  });

  const layers = [
    [-.34, .25, .20],
    [-.05, .49, 0],
    [.27, .29, .18],
  ].map(([height, radius, phase]) => Array.from({ length: 8 }, (_, i) => {
    const angle = phase + i * Math.PI / 4;
    return [Math.cos(angle) * radius, height, Math.sin(angle) * radius * .90];
  }));
  const facets = [[], []];
  function face(a, b, c, finish = 0) {
    facets[finish].push(...a, ...b, ...c);
  }
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8;
    face([.035, -.81, 0], layers[0][i], layers[0][j], i % 4 === 1 ? 1 : 0);
    for (let level = 0; level < layers.length - 1; level += 1) {
      const lower = layers[level];
      const upper = layers[level + 1];
      face(lower[i], upper[i], upper[j], (i + level) % 5 === 2 ? 1 : 0);
      face(lower[i], upper[j], lower[j], (i - level) % 4 === 0 ? 1 : 0);
    }
    face(layers[2][i], [-.07, .81, .018], layers[2][j], i % 4 === 0 ? 1 : 0);
  }
  for (const [index, material] of [violet, edge].entries()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(facets[index], 3));
    geometry.computeVertexNormals();
    model.add(new THREE.Mesh(geometry, material));
  }

  const plates = new THREE.Group();
  plates.rotation.set(.59, -.15, .27);
  model.add(plates);
  function ringSegment(start, sweep, radius, width, height, material, depth) {
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(start) * radius, Math.sin(start) * radius);
    shape.absarc(0, 0, radius, start, start + sweep, false);
    const inner = radius - width;
    shape.lineTo(Math.cos(start + sweep) * inner, Math.sin(start + sweep) * inner);
    shape.absarc(0, 0, inner, start + sweep, start, true);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height, curveSegments: 7, bevelEnabled: true, bevelSegments: 2,
      bevelThickness: .014, bevelSize: .014,
    });
    const segment = new THREE.Mesh(geometry, material);
    segment.position.z = depth;
    plates.add(segment);
  }
  for (const opposite of [0, Math.PI]) {
    const start = .24 + opposite;
    for (let panel = 0; panel < 3; panel += 1) {
      const angle = start + panel * .64;
      ringSegment(angle, .60, 1.07, .185, .10, gunmetal, -.05);
      ringSegment(angle + .025, .54, 1.035, .040, .021, chrome, .055);
    }
    ringSegment(start + .36, .47, .922, .023, .017, light, .044);
  }

  const orbit = new THREE.Group();
  orbit.rotation.set(-.86, .34, -.11);
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(.77, .012, 6, 60), light));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(.062, 12, 8), chrome);
  moon.position.set(Math.cos(.41) * .77, Math.sin(.41) * .77, 0);
  orbit.add(moon);
  model.add(orbit);
  return makeArtTemplate(model, () => true);
}

function makeArt(node, template, color, size) {
  const group = new THREE.Group();
  const random = randomFor(node.id);
  const materials = [];
  const tint = new THREE.Color(color);
  for (const { geometry, finish } of template) {
    const material = finish.clone();
    material.color.lerp(tint, .12);
    materials.push(material);
    group.add(new THREE.Mesh(geometry, material));
  }
  return {
    node, group, materials, size, origin: new THREE.Vector3(), weight: 0,
    pitch: (random() - .5) * .9,
    yaw: (random() - .5) * 1.1,
    roll: (random() - .5) * .9,
    rate: (random() + .15) * .29,
    accent: tint,
  };
}

function sculptSchool(item) {
  const core = new THREE.Group();
  core.add(...item.group.children);
  core.scale.setScalar(.34);
  core.position.z = .13;
  item.group.add(core);
  const steel = new THREE.MeshStandardMaterial({
    color: item.accent.clone().lerp(new THREE.Color(0x263348), .57),
    metalness: .96,
    roughness: .25,
    envMapIntensity: 1.72,
    transparent: true,
  });
  const highlight = new THREE.MeshStandardMaterial({
    color: item.accent.clone().lerp(new THREE.Color(0xd4def6), .32),
    emissive: item.accent.clone(),
    emissiveIntensity: .21,
    metalness: .86,
    roughness: .17,
    envMapIntensity: 1.9,
    transparent: true,
  });
  item.materials.push(steel, highlight);

  function rail(points, radius, material = highlight, closed = false) {
    const line = new THREE.CatmullRomCurve3(
      points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)), closed, 'catmullrom', .10,
    );
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(line, Math.min(64, points.length * 5), radius, 7, closed), material);
    item.group.add(mesh);
  }

  function plate(points, z = -.10, thickness = .095) {
    const profile = new THREE.Shape();
    profile.moveTo(...points[0]);
    for (const point of points.slice(1)) profile.lineTo(...point);
    profile.closePath();
    const geometry = new THREE.ExtrudeGeometry(profile, {
      depth: thickness, steps: 1, bevelEnabled: true, bevelSize: .022, bevelThickness: .022, bevelSegments: 2,
    });
    const mesh = new THREE.Mesh(geometry, steel);
    mesh.position.z = z;
    item.group.add(mesh);
  }

  function orbit(curve, radius, material = steel) {
    rail(Array.from({ length: 36 }, (_, i) => curve(i / 36 * Math.PI * 2)), radius, material, true);
  }

  switch (item.node.id) {
    case 'school:foresight': {
      const eye = (a) => [.65 * Math.cos(a), .33 * Math.sin(a) ** 3, .11 * Math.sin(a)];
      orbit(eye, .073);
      orbit((a) => [.54 * Math.cos(a), .23 * Math.sin(a) ** 3, -.14], .023, highlight);
      orbit((a) => [.255 * Math.cos(a), .32 * Math.sin(a), .13 * Math.cos(a)], .052);
      break;
    }
    case 'school:cyber': {
      const trace = [[-.53, -.37], [-.38, -.52], [.37, -.52], [.52, -.38], [.52, .38], [.36, .52], [-.38, .52], [-.53, .37]];
      plate(trace, -.14, .15);
      rail(trace.map(([x, y]) => [.84 * x, .84 * y, .052]), .033, highlight, true);
      for (const pin of [-.26, 0, .26]) {
        rail([[pin, -.51, .015], [pin, -.70, .015]], .032);
        rail([[pin, .51, .015], [pin, .70, .015]], .032);
        rail([[-.52, pin, .015], [-.71, pin, .015]], .032);
        rail([[.52, pin, .015], [.71, pin, .015]], .032);
      }
      break;
    }
    case 'school:economics': {
      const diamond = [[0, .66], [.58, .06], [0, -.50], [-.58, .06]];
      plate(diamond, -.18, .13);
      rail(diamond.map(([x, y]) => [x, y, .02]), .042, highlight, true);
      rail([[-.61, -.20, .13], [0, -.71, -.09], [.62, -.20, .13], [0, .33, .27]], .061, steel, true);
      rail([[-.53, .07, .05], [0, .28, .31], [.54, .07, .05]], .047);
      break;
    }
    case 'school:finance': {
      core.scale.setScalar(.57);
      for (const [radius, z, width] of [[.59, -.09, .080], [.51, .105, .048], [.39, .19, .031]]) {
        orbit((a) => [radius * Math.cos(a), .83 * radius * Math.sin(a), z], width,
          radius === .59 ? steel : highlight);
      }
      for (let i = 0; i < 12; i += 1) {
        const a = i / 12 * 2 * Math.PI;
        rail([[.56 * Math.cos(a), .465 * Math.sin(a), -.15], [.56 * Math.cos(a), .465 * Math.sin(a), .025]], .026);
      }
      break;
    }
    case 'school:integral': {
      const loop = (a, turn) => [.66 * Math.sin(a), .59 * Math.sin(a) * Math.cos(a), .22 * Math.cos(a + turn)];
      orbit((a) => loop(a, 0), .094);
      orbit((a) => {
        const [x, y, z] = loop(a, 1.4);
        return [.91 * x + .08 * y, .80 * y - .23 * x, z + .09];
      }, .037, highlight);
      core.scale.setScalar(.29);
      break;
    }
    case 'school:management': {
      for (const [width, height, z] of [[.60, .58, -.14], [.41, .45, .02], [.25, .31, .16]]) {
        const arch = [[-width, -.41, z], [-width, .23, z], [-width * .57, height, z],
          [width * .57, height, z], [width, .23, z], [width, -.41, z]];
        rail(arch, width === .60 ? .081 : .055, width === .41 ? highlight : steel);
      }
      rail([[-.69, -.48, -.16], [.69, -.48, -.16]], .054);
      core.position.set(0, -.08, .23);
      break;
    }
    case 'school:law': {
      const shield = [[-.57, .47], [0, .60], [.57, .47], [.49, -.16], [.32, -.45], [0, -.68], [-.32, -.45], [-.49, -.16]];
      plate(shield, -.16, .14);
      rail(shield.map(([x, y]) => [.96 * x, .96 * y, .02]), .046, highlight, true);
      rail([[-.32, .27, .12], [0, .35, .12], [.32, .27, .12]], .038);
      for (const sign of [-1, 1]) {
        rail([[.29 * sign, .27, .12], [.38 * sign, -.092, .12], [.18 * sign, -.092, .12]], .025, highlight, true);
      }
      core.scale.setScalar(.19);
      core.position.y = -.27;
      break;
    }
    case 'school:creative': {
      const petal = (a, shift) => {
        const r = .39 + Math.cos(3 * a + shift) * .24;
        return [Math.cos(a) * r * 1.04, Math.sin(a) * r, .21 * Math.sin(2 * a + shift)];
      };
      orbit((a) => petal(a, 0), .104);
      orbit((a) => petal(a, 1.35).map((axis) => axis * .88), .042, highlight);
      core.scale.setScalar(.25);
      break;
    }
    case 'school:humanities': {
      for (const sign of [-1, 1]) {
        const cover = [[0, .27], [.54 * sign, .57], [.66 * sign, -.32], [.55 * sign, -.47], [0, -.24]];
        plate(cover, -.19, .115);
        rail(cover.map(([x, y]) => [x, y, -.06]), .044, highlight, true);
        for (const y of [-.22, -.07, .08, .23]) {
          rail([[.10 * sign, y, .027], [.31 * sign, y + .081, .13], [.53 * sign, y + .17, .08]], .022);
        }
      }
      rail([[0, -.33, .03], [0, .068, .21], [0, .39, .038]], .056, steel);
      core.scale.setScalar(.17);
      core.position.set(0, -.15, .24);
      break;
    }
    default:
      core.scale.setScalar(.9);
  }
}

function makeGlow(geometry, color) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tint: { value: new THREE.Color(color) },
      strength: { value: 0 },
      extent: { value: 4 },
    },
    vertexShader: `
      uniform float extent;
      varying vec2 coordinates;
      void main() {
        coordinates = position.xy * 2.0;
        vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        gl_Position = projectionMatrix * (center + vec4(position.xy * extent, 0.0, 0.0));
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      uniform float strength;
      varying vec2 coordinates;
      void main() {
        float radius = length(coordinates);
        float glow = exp(-radius * radius * 5.3) * (1.0 - smoothstep(.49, 1.0, radius));
        gl_FragColor = vec4(tint, strength * glow);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function createPoints(count, size, positions = new Float32Array(count * 3)) {
  const geometry = new THREE.BufferGeometry();
  const opacity = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const radii = new Float32Array(count).fill(1);
  opacity.fill(1);
  colors.fill(1);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('glow', new THREE.BufferAttribute(opacity, 1));
  geometry.setAttribute('tint', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('radius', new THREE.BufferAttribute(radii, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { scale: { value: size }, intensity: { value: 1 } },
    vertexShader: `
      uniform float scale;
      attribute float glow;
      attribute float radius;
      attribute vec3 tint;
      varying vec4 light;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(scale * radius * 29.0 / -mvPosition.z, 1.1, 18.0);
        light = vec4(tint, glow);
      }
    `,
    fragmentShader: `
      uniform float intensity;
      varying vec4 light;
      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float r = length(point) * 2.0;
        if (r > 1.0) discard;
        float halo = pow(1.0 - r, 3.0);
        float core = 1.0 - smoothstep(0.11, 0.48, r);
        gl_FragColor = vec4(light.rgb, light.a * intensity * (halo * 0.6 + core * 0.55));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return { object: new THREE.Points(geometry, material), geometry, material, positions, opacity, colors, radii, size };
}

function createLines(count) {
  const positions = new Float32Array(count * 6);
  const strength = new Float32Array(count * 2);
  const colors = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('strength', new THREE.BufferAttribute(strength, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 1 } },
    vertexShader: `
      attribute float strength;
      attribute vec3 tint;
      varying vec4 color;
      void main() {
        color = vec4(tint, strength);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec4 color;
      void main() {
        gl_FragColor = vec4(color.rgb, opacity * color.a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const object = new THREE.LineSegments(geometry, material);
  object.frustumCulled = false;
  return { object, geometry, material, positions, strength, colors };
}

function makeGalaxyDust(mobile) {
  const count = mobile ? 560 : 1060;
  const dust = createPoints(count, 2.0);
  const random = randomFor('universe:distance');
  const blue = new THREE.Color(0x929dbb);
  const amber = new THREE.Color(0xcda88c);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 31;
    dust.positions.set([
      Math.cos(angle) * distance - 2,
      Math.sin(angle) * distance * .66,
      -4 - random() * 31,
    ], offset);
    (i % 13 ? blue : amber).toArray(dust.colors, offset);
    dust.opacity[i] = .14 + random() ** 2 * .43;
    dust.radii[i] = .65 + random() ** 3 * 1.3;
  }
  return dust;
}

function makeAcademicStars(mobile) {
  const motifs = [
    { // Open book
      color: 0xa6b0d2,
      paths: [
        [[0, .24], [-.25, .38], [-.49, .38], [-.49, -.26], [-.25, -.26], [0, -.40],
          [.25, -.26], [.49, -.26], [.49, .38], [.25, .38], [0, .24], [0, -.40]],
      ],
    },
    { // Graduation cap
      color: 0xb1a0ce,
      paths: [
        [[-.54, .15], [0, .40], [.54, .15], [0, -.10], [-.54, .15]],
        [[-.29, .03], [-.29, -.20], [0, -.32], [.29, -.20], [.29, .03]],
        [[.43, .10], [.43, -.28]],
      ],
    },
    { // Laptop
      color: 0x9dadd1,
      paths: [
        [[-.38, -.13], [-.38, .37], [.38, .37], [.38, -.13], [-.38, -.13],
          [-.53, -.34], [.53, -.34], [.38, -.13]],
      ],
    },
  ];
  const copies = mobile ? 14 : 24;
  const rightCopies = mobile ? 4 : 7;
  const segments = motifs.reduce((total, { paths }) =>
    total + paths.reduce((sum, path) => sum + path.length - 1, 0), 0);
  const stars = createLines(segments * (copies + rightCopies));
  const random = randomFor('universe:academic-stars');
  const randomRight = randomFor('universe:academic-stars:right');
  let vertex = 0;

  for (const { color, paths } of motifs) {
    const tint = new THREE.Color(color);
    for (let i = 0; i < copies + rightCopies; i += 1) {
      const right = i >= copies;
      const sample = right ? randomRight : random;
      const horizontal = sample();
      const x = right
        ? (mobile ? 5 : 13) + horizontal * (mobile ? 8 : 17)
        : (horizontal - .5) * 65;
      const y = (sample() - .5) * 42;
      const z = -13 - sample() * 20;
      const size = .23 + sample() * .24;
      const tilt = (sample() - .5) * .84;
      const cos = Math.cos(tilt) * size;
      const sin = Math.sin(tilt) * size;
      const brightness = .13 + sample() * .11;
      for (const path of paths) {
        for (let point = 1; point < path.length; point += 1) {
          for (const [u, v] of [path[point - 1], path[point]]) {
            const offset = vertex * 3;
            stars.positions.set([x + u * cos - v * sin, y + u * sin + v * cos, z], offset);
            tint.toArray(stars.colors, offset);
            stars.strength[vertex] = brightness;
            vertex += 1;
          }
        }
      }
    }
  }
  stars.object.name = 'Academic stars';
  return stars.object;
}

function makeSchoolCloud(school, mobile) {
  const random = randomFor(school.node.id);
  const count = (mobile ? 56 : 93) + school.directions.length * 9;
  const cloud = createPoints(count, 3.14);
  const fibers = createLines(Math.floor(count / 3));
  const tint = school.accent.clone();
  const bright = tint.clone().lerp(new THREE.Color(0xe8eaff), .56);
  const angle = (random() - .5) * 1.7;
  const stretch = .88 + random() * .25;
  let line = 0;
  for (let i = 0; i < count; i += 1) {
    const orbit = random() * Math.PI * 2;
    const radius = .25 + Math.sqrt(random()) * 1.72;
    const x = Math.cos(orbit) * radius * stretch;
    const y = Math.sin(orbit) * radius * .64;
    const z = (random() - .5) * (radius + .15);
    const point = [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
    cloud.positions.set(point, i * 3);
    (i % 6 ? tint : bright).toArray(cloud.colors, i * 3);
    cloud.opacity[i] = .45 + random() * .5;
    cloud.radii[i] = .6 + random() ** 3 * 1.1;
    if (i % 3 === 2) {
      fibers.positions.set(point, line * 6 + 3);
      tint.toArray(fibers.colors, line * 6);
      tint.toArray(fibers.colors, line * 6 + 3);
      fibers.strength[line * 2] = .065;
      fibers.strength[line * 2 + 1] = .29;
      line += 1;
    }
  }
  cloud.object.add(fibers.object);
  return { cloud, fibers };
}

function makeOrbit(radius, squash, tilt, opacity, color) {
  const segments = 112;
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * 2 * Math.PI;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * squash;
    points.push(new THREE.Vector3(x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt), Math.sin(angle) * radius * .47));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

function modelUrl(name) {
  return new URL(`./models/${name}.glb`, import.meta.url).href;
}

export async function createUniverseScene(canvas, graph, handlers) {
  const attributes = { alpha: true, antialias: true, powerPreference: 'high-performance' };
  const context = canvas.getContext('webgl2', attributes);
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
  renderer.setClearColor(0x080a10, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.27;
  const studio = makeStudio(renderer);
  const world = new THREE.Scene();
  world.environment = studio.texture;
  const camera = new THREE.PerspectiveCamera(40, 1, .15, 116);
  const fill = new THREE.HemisphereLight(0xbbccf3, 0x272036, 1.12);
  const kick = new THREE.DirectionalLight(0xb7c6ff, 1.3);
  kick.position.set(-3, 6, 4);
  const rim = new THREE.DirectionalLight(0x8f78c9, .8);
  rim.position.set(3, -1, -3);
  world.add(fill, kick, rim);

  const loader = new GLTFLoader();
  let models;
  try {
    models = await Promise.all([
      loader.loadAsync(modelUrl('mgimo_chrome_sculpture')),
      loader.loadAsync(modelUrl('mgimo_faculty_constellation')),
      loader.loadAsync(modelUrl('mgimo_program_artifact')),
    ]);
  } catch (error) {
    studio.dispose();
    renderer.dispose();
    throw error;
  }
  const [gyroscope, constellation, programModel] = models;
  const crystal = makeOrbitalCrystal();
  const templates = {
    planet: makeArtTemplate(programModel.scene, (name) => !/satellites|tethers/i.test(name)),
    direction: crystal,
    school: makeArtTemplate(constellation.scene, (name) => /hub|inlay/i.test(name)),
    program: crystal,
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const initialMobile = canvas.clientWidth <= 760;
  const objects = new Map();
  const edges = [];
  const pointBatches = [];
  const schoolObjects = [];
  const glowGeometry = new THREE.PlaneGeometry(1, 1);
  const root = makeArt(graph.root, [], 0xa3b8ee, 5.75);
  // The rotating rings and satellites fit inside a 4.73-unit diameter about the authored pivot.
  gyroscope.scene.scale.setScalar(1 / 4.73);
  root.group.add(gyroscope.scene);
  const gyroscopeMixer = new THREE.AnimationMixer(gyroscope.scene);
  gyroscopeMixer.clipAction(gyroscope.animations[0]).play();
  const gyroscopeFinishes = new Map();
  gyroscope.scene.traverse((object) => {
    if (!object.isMesh) return;
    const { material } = object;
    gyroscopeFinishes.set(material, { opacity: material.opacity, transparent: material.transparent });
  });
  root.origin.set(.5, .03, 2.1);
  root.weight = 1;
  root.glow = makeGlow(glowGeometry, 0x818ccd);
  const focusGlow = makeGlow(glowGeometry, 0xa0a9d2);
  focusGlow.visible = false;
  objects.set(root.node.id, root);
  world.add(root.group, root.glow, focusGlow);

  function link(parent, child) {
    edges.push([parent, child]);
  }

  function drawArt(node, parent, type, accent, size, orbit) {
    const item = makeArt(node, templates[type], accent, size);
    item.parent = parent;
    item.orbit = orbit;
    objects.set(node.id, item);
    world.add(item.group);
    link(parent, item);
    return item;
  }

  graph.children(graph.root.id).forEach((schoolNode, index) => {
    const color = PALETTE[index % PALETTE.length];
    const schoolScale = schoolNode.id === 'school:economics' ? 1.10 : 1;
    const school = drawArt(schoolNode, root, 'school', color, 1.05 * schoolScale, null);
    sculptSchool(school);
    school.glow = makeGlow(glowGeometry, color);
    world.add(school.glow);
    school.anchor = SCHOOL_ANCHORS[index % SCHOOL_ANCHORS.length];
    school.weight = 1;
    schoolObjects.push(school);
    const [anchorX, anchorY] = school.anchor;
    const outerSchool = Math.abs(anchorX) > 8;
    const bearing = outerSchool
      ? (anchorY >= 1 ? 1 : -1) * Math.PI / 2
      : Math.atan2(anchorY, anchorX * .34);
    school.directions = graph.children(schoolNode.id).map((direction, order, neighbors) => {
      const artifact = (index + order) % 3 === 1 ? 'planet' : 'direction';
      const radius = outerSchool ? 2.71 : 2.91;
      const fanBearing = neighbors.length === 3 ? bearing + .15 : bearing;
      const orbit = orbitFor(direction.id, order, neighbors.length, radius, fanBearing);
      const item = drawArt(direction, school, artifact, color, (1.06 + (order % 3) * .15) * .85, orbit);
      item.weight = 1;
      graph.children(direction.id).forEach((program, index, programs) => {
        const path = orbitFor(program.id, index, programs.length, 3.24, satelliteBearing(orbit));
        drawArt(program, item, 'program', color, .86 * .85, path);
      });
      return item;
    });
    const { cloud, fibers } = makeSchoolCloud(school, initialMobile);
    school.cloud = cloud;
    school.fibers = fibers;
    pointBatches.push(cloud);
    world.add(cloud.object);
    school.orbitLine = makeOrbit(2.11, .67, .23 + school.roll, .16, color);
    world.add(school.orbitLine);
  });

  const dust = makeGalaxyDust(initialMobile);
  world.add(dust.object, makeAcademicStars(initialMobile));
  pointBatches.push(dust);
  const structure = createLines(edges.length);
  world.add(structure.object);
  const belts = [
    makeOrbit(12.6, .32, -.29, .17, 0x6779a6),
    makeOrbit(10, .58, .42, .12, 0x7385b6),
    makeOrbit(14, .64, .03, .11, 0x8c799e),
  ];
  for (const belt of belts) {
    belt.position.z = -4.2;
    world.add(belt);
  }
  edges.forEach(([parent, child], index) => {
    parent.accent.toArray(structure.colors, index * 6);
    child.accent.toArray(structure.colors, index * 6 + 3);
  });

  const maxSubjects = Math.max(1, ...Array.from(graph.byId.values(), (node) => node.type === 'program' ? graph.children(node.id).length : 0));
  const subjectsPoints = createPoints(maxSubjects, 3.9);
  const subjectsLines = createLines(maxSubjects);
  subjectsPoints.object.frustumCulled = false;
  world.add(subjectsPoints.object, subjectsLines.object);
  pointBatches.push(subjectsPoints);
  const graphControls = {
    field: [], program: null, target: null, alpha: 0, steps: 0, settle: 0,
  };
  subjectsPoints.geometry.setDrawRange(0, 0);
  subjectsLines.geometry.setDrawRange(0, 0);

  let selection = graph.root;
  let ancestry = [graph.root];
  let relevant = new Set([graph.root.id]);
  let hovered = null;
  let keyboardHighlight = null;
  let width = 1;
  let height = 1;
  let mobile = initialMobile;
  let enabled = true;
  let disposed = false;
  let frame = 0;
  let lastFrame = 0;
  let time = 0;
  let pixelBudget = 1.55;
  let slowFrames = 0;
  let transition = null;
  let zoom = 1;
  let overviewRoll = 0;
  let cameraRoll = 0;
  const view = new THREE.Vector3(.35, 0, 0);
  const cameraOffset = new THREE.Vector3(0, 0, 32);
  const drag = new THREE.Vector2();
  const dragGoal = new THREE.Vector2();
  const target = new THREE.Vector3();
  const childrenMidpoint = new THREE.Vector3();
  const targetOffset = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const projectedSubject = new THREE.Vector3();
  const touch = new Map();
  let pinch = null;
  let gesture = null;
  let pointer = null;

  function subjectWorld(id, result) {
    const course = graphControls.field.find((item) => item.node.id === id);
    if (!course || !graphControls.program) return null;
    return result.set(...(reduced.matches ? course.anchor : course.point)).add(graphControls.program.origin);
  }

  function cameraTarget() {
    const item = objects.get(selection.id);
    if (selection.type === 'degree') {
      const verticalSpan = 32 + 7 * Math.abs(Math.sin(cameraRoll));
      const horizontalSpan = 25 + 3 * Math.abs(Math.sin(2 * cameraRoll));
      const distance = Math.max(verticalSpan, horizontalSpan / camera.aspect);
      const titleClearance = mobile ? 0 : distance * .049;
      target.set(.2 - Math.sin(cameraRoll) * titleClearance, .12 + Math.cos(cameraRoll) * titleClearance, -1.3);
      targetOffset.set(0, mobile ? .18 : .8, distance);
      return;
    }
    if (selection.type === 'subject') {
      const program = objects.get(ancestry.at(-2).id);
      target.copy(subjectWorld(selection.id, projectedSubject) ?? program.origin);
      target.lerp(program.origin, .57);
    } else {
      target.copy(item.origin);
      if (selection.type === 'school' || selection.type === 'direction') {
        const children = graph.children(selection.id);
        if (children.length) {
          childrenMidpoint.set(0, 0, 0);
          for (const child of children) childrenMidpoint.add(objects.get(child.id).origin);
          childrenMidpoint.divideScalar(children.length);
          target.lerp(childrenMidpoint, .32);
        }
      }
    }
    const distance = { school: 13.3, direction: 11.6, program: 13.3, subject: 10.7 }[selection.type];
    const bottomCard = width <= 840;
    const focusDistance = distance * Math.max(bottomCard ? 1.20 : 1, .9 / camera.aspect);
    if (bottomCard) target.y -= focusDistance * .091;
    targetOffset.set(-.39, .52, focusDistance);
  }

  function sendHover(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : 'grab';
    handlers.hover?.(id);
  }

  function resize() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (!nextWidth || !nextHeight) return;
    width = nextWidth;
    height = nextHeight;
    mobile = width <= 760;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? Math.min(pixelBudget, 1.22) : pixelBudget));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const points of pointBatches) points.material.uniforms.scale.value = points.size * renderer.getPixelRatio();
    queue();
  }

  function placeObjects() {
    const spread = mobile ? .69 : 1;
    root.origin.y = .02 + Math.sin(time * .38) * .17;
    for (const item of objects.values()) {
      if (item.anchor) {
        const [x, y, z] = item.anchor;
        item.origin.set(x * spread + Math.sin(time * .26 + item.roll) * .23, y + Math.sin(time * .39 + y) * .09, z);
      } else if (item.orbit) {
        const orbit = item.orbit;
        const angle = orbit.angle + Math.sin(time * .42) * orbit.speed;
        item.origin.set(Math.cos(angle) * orbit.radius, Math.sin(angle) * orbit.radius * .8, orbit.depth);
        item.origin.add(item.parent.origin);
      }
      item.group.position.copy(item.origin);
    }
  }

  function applyFocus(id, viaProgramId) {
    const selected = graph.byId.get(id);
    if (!selected) return;
    selection = selected;
    ancestry = graph.path(id, viaProgramId);
    const family = [...ancestry, ...graph.children(id)];
    if (selection.type === 'program' || selection.type === 'subject') {
      const program = ancestry.find((node) => node.type === 'program');
      family.push(...graph.children(program.id));
      graphControls.target = objects.get(program.id);
    } else {
      graphControls.target = null;
    }
    relevant = new Set(family.map((node) => node.id));
    sendHover(null);
    keyboardHighlight = null;
    zoom = 1;
    dragGoal.set(0, 0);
    transition = { from: view.clone(), offset: cameraOffset.clone(), started: time };
    queue();
  }

  function updateArt(ease, highlight) {
    const isOverview = selection.type === 'degree';
    const activeSchool = ancestry.find((node) => node.type === 'school')?.id;
    const childType = graph.children(selection.id)[0]?.type;
    const hoverSchool = objects.get(highlight);
    for (const item of objects.values()) {
      const node = item.node;
      let weight = 0;
      if (isOverview) {
        weight = node.type === 'program' ? 0 : 1;
        if (hoverSchool && node.type !== 'degree' && node.type !== 'program'
          && item !== hoverSchool && item.parent !== hoverSchool && hoverSchool.parent !== item
          && hoverSchool.parent !== item.parent) weight = .38;
      } else if (relevant.has(node.id)) {
        weight = node.id === selection.id || node.type === childType ? 1 : .12;
        if (node.type === 'degree') weight = .02;
        if (selection.type === 'subject' && node.type === 'program') weight = .88;
      }
      if (node.id === highlight && weight) weight = 1;
      item.weight += (weight - item.weight) * ease;
      item.group.visible = item.weight > .024;
      if (item.glow) {
        const degree = node.type === 'degree';
        item.glow.visible = item.group.visible;
        item.glow.position.copy(item.origin);
        item.glow.position.z -= degree ? .74 : .54;
        item.glow.material.uniforms.extent.value = degree ? (mobile ? 7.1 : 8.6) : (node.id === selection.id ? 4.3 : 3.15);
        item.glow.material.uniforms.strength.value = item.weight * (degree ? .28 : .24);
      }
      if (!item.group.visible) continue;
      let size = item.size;
      if (mobile && node.type === 'degree') size *= .90;
      if (node.id === selection.id && node.type !== 'degree') size *= node.type === 'school' ? 1.63 : 1.31;
      if (node.id === highlight) size *= 1.19;
      if (!isOverview && node.type === 'degree') size *= .81;
      item.group.scale.setScalar(THREE.MathUtils.lerp(item.group.scale.x, size, ease));
      if (node.type !== 'degree') {
        item.group.rotation.set(
          item.pitch + Math.sin(time * item.rate) * .045,
          item.yaw + Math.sin(time * item.rate * .83) * .08,
          item.roll + Math.sin(time * item.rate * .37) * .045,
        );
      }
      for (const material of item.materials) material.opacity = item.weight;
    }
    if (root.group.visible) {
      const weight = root.weight > .995 ? 1 : root.weight;
      for (const [material, finish] of gyroscopeFinishes) {
        const transparent = finish.transparent || weight < 1;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.opacity = finish.opacity * weight;
      }
    }
    const focalArtifact = objects.get(selection.id);
    focusGlow.visible = selection.type === 'direction' || selection.type === 'program';
    if (focusGlow.visible) {
      focusGlow.position.copy(focalArtifact.origin);
      focusGlow.position.z -= .65;
      focusGlow.material.uniforms.tint.value.copy(focalArtifact.accent);
      focusGlow.material.uniforms.strength.value = .324 * focalArtifact.weight;
      focusGlow.material.uniforms.extent.value = 4.1;
    }
    for (const school of schoolObjects) {
      const focused = school.node.id === activeSchool;
      const related = !hoverSchool || hoverSchool === school || hoverSchool.parent === school;
      school.cloud.object.position.copy(school.origin);
      school.cloud.object.rotation.z = school.roll * .25 + Math.sin(time * .19 + school.roll) * .11;
      school.cloud.object.scale.setScalar(focused ? 1.14 : 1);
      const brightness = isOverview ? (related ? .92 : .38) : focused ? .65 : .17;
      const intensity = school.cloud.material.uniforms.intensity;
      intensity.value += (brightness - intensity.value) * ease;
      const opacity = school.fibers.material.uniforms.opacity;
      const brightLines = isOverview && related && Boolean(hoverSchool) || focused;
      opacity.value += ((brightLines ? .94 : .36) - opacity.value) * ease;
      school.orbitLine.position.copy(school.origin);
      school.orbitLine.material.opacity = .15 * intensity.value + (focused ? .09 : 0);
    }
    for (const [index, belt] of belts.entries()) {
      belt.rotation.z = Math.sin(time * .19 + index) * .055;
      const opacity = (isOverview ? .17 : .035) / (index * .45 + 1);
      belt.material.opacity += (opacity - belt.material.opacity) * ease;
    }
    edges.forEach(([parent, child], index) => {
      parent.origin.toArray(structure.positions, index * 6);
      child.origin.toArray(structure.positions, index * 6 + 3);
      const highlighted = highlight === parent.node.id || highlight === child.node.id;
      const active = !isOverview && relevant.has(parent.node.id) && relevant.has(child.node.id);
      const brightness = (highlighted ? .48 : active ? .29 : .075) * Math.min(parent.weight, child.weight);
      structure.strength[index * 2] = brightness * .62;
      structure.strength[index * 2 + 1] = brightness;
    });
    structure.geometry.attributes.position.needsUpdate = true;
    structure.geometry.attributes.strength.needsUpdate = true;
  }

  function updateSubjects(ease, delta, highlight) {
    const state = graphControls;
    const wantsNewField = state.target !== state.program;
    const alphaGoal = state.program && !wantsNewField ? 1 : 0;
    state.alpha += (alphaGoal - state.alpha) * ease;
    if (wantsNewField && (state.alpha < .045 || reduced.matches)) {
      state.program = state.target;
      state.field = state.program ? makeSubjectField(graph.children(state.program.node.id), state.program.node.id) : [];
      state.steps = 0;
      state.settle = 0;
      state.alpha = reduced.matches && state.program ? 1 : 0;
      subjectsPoints.geometry.setDrawRange(0, state.field.length);
      subjectsLines.geometry.setDrawRange(0, state.field.length * 2);
      state.field.forEach((subject, i) => {
        const tint = graph.sharedPrograms(subject.node.id).length > 1
          ? state.program.accent.clone().lerp(new THREE.Color(0xdab9bf), .57) : state.program.accent;
        tint.toArray(subjectsPoints.colors, i * 3);
        tint.toArray(subjectsLines.colors, i * 6);
        tint.toArray(subjectsLines.colors, i * 6 + 3);
      });
      subjectsPoints.geometry.attributes.tint.needsUpdate = true;
      subjectsLines.geometry.attributes.tint.needsUpdate = true;
    }
    if (!state.field.length) return;
    if (!reduced.matches && !wantsNewField && state.steps < 102) {
      state.settle += delta * 60;
      while (state.settle >= 1) {
        stepSubjectField(state.field);
        state.settle -= 1;
        state.steps += 1;
      }
    }
    const origin = state.program.origin;
    for (const [i, item] of state.field.entries()) {
      const local = reduced.matches ? item.anchor : item.point;
      const collapse = wantsNewField ? .18 + .82 * state.alpha : 1;
      const position = projectedSubject.set(
        origin.x + local[0] * collapse,
        origin.y + local[1] * collapse,
        origin.z + local[2] * collapse,
      );
      position.toArray(subjectsPoints.positions, i * 3);
      origin.toArray(subjectsLines.positions, i * 6);
      position.toArray(subjectsLines.positions, i * 6 + 3);
      const emphasized = item.node.id === selection.id || item.node.id === highlight;
      const quiet = selection.type === 'subject' && !emphasized;
      subjectsPoints.opacity[i] = quiet ? .64 : 1;
      subjectsPoints.radii[i] = emphasized ? 1.8 : i % 4 === 0 ? 1.1 : .82;
      subjectsLines.strength[i * 2] = emphasized ? .18 : .068;
      subjectsLines.strength[i * 2 + 1] = emphasized ? .66 : .33;
    }
    subjectsPoints.material.uniforms.intensity.value = state.alpha;
    subjectsLines.material.uniforms.opacity.value = state.alpha;
    subjectsPoints.geometry.attributes.position.needsUpdate = true;
    subjectsPoints.geometry.attributes.glow.needsUpdate = true;
    subjectsPoints.geometry.attributes.radius.needsUpdate = true;
    subjectsLines.geometry.attributes.position.needsUpdate = true;
    subjectsLines.geometry.attributes.strength.needsUpdate = true;
  }

  function updateCamera(ease) {
    const overview = selection.type === 'degree';
    // Detail cards use an upright view, returning along the shortest turn.
    const neutralRoll = Math.round(cameraRoll / FULL_TURN) * FULL_TURN;
    cameraRoll = THREE.MathUtils.lerp(cameraRoll, overview ? overviewRoll : neutralRoll, ease);
    cameraTarget();
    targetOffset.multiplyScalar(zoom);
    if (transition && !reduced.matches) {
      const elapsed = clamp((time - transition.started) / .84, 0, 1);
      const progress = elapsed * elapsed * (3 - 2 * elapsed);
      view.lerpVectors(transition.from, target, progress);
      cameraOffset.lerpVectors(transition.offset, targetOffset, progress);
      const curve = Math.sin(elapsed * Math.PI);
      cameraOffset.x -= curve * Math.min(2.35, view.distanceTo(transition.from) * .37);
      cameraOffset.y += curve * .59;
      if (elapsed === 1) transition = null;
    } else {
      view.lerp(target, ease);
      cameraOffset.lerp(targetOffset, ease);
      transition = null;
    }
    drag.lerp(dragGoal, ease * .78);
    camera.position.copy(view).add(cameraOffset);
    if (!reduced.matches) {
      camera.position.x += drag.x * 3.7;
      camera.position.y += drag.y * 2.9;
    }
    camera.lookAt(view);
    camera.rotateZ(cameraRoll);
    camera.updateMatrixWorld();
  }

  function project(id) {
    const item = objects.get(id);
    const position = item?.origin ?? subjectWorld(id, projectedSubject);
    if (!position) return { x: 0, y: 0, visible: false };
    projected.copy(position).project(camera);
    return {
      x: (projected.x * .5 + .5) * width,
      y: (.5 - projected.y * .5) * height,
      visible: Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && Math.abs(projected.z) <= 1,
    };
  }

  function hitTest(position, pointerType) {
    if (!position) return null;
    let found = null;
    let nearest = Infinity;
    const touchRadius = pointerType === 'touch' ? 10 : 0;
    function consider(id, radius) {
      const point = project(id);
      if (!point.visible) return;
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance < radius && distance / radius < nearest) {
        nearest = distance / radius;
        found = id;
      }
    }
    if (selection.type === 'degree') {
      for (const school of schoolObjects) {
        consider(school.node.id, (mobile ? 21 : 32) + touchRadius);
        for (const direction of school.directions) consider(direction.node.id, 19 + touchRadius);
      }
    } else {
      for (const child of graph.children(selection.id)) {
        if (child.type === 'subject') continue;
        consider(child.id, (mobile ? 26 : 44) + touchRadius);
      }
      if (selection.type === 'program' || selection.type === 'subject') {
        for (const subject of graphControls.field) consider(subject.node.id, 12 + touchRadius);
      }
    }
    return found;
  }

  function render(now) {
    frame = 0;
    if (!enabled || disposed || document.hidden) return;
    const interval = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
    const delta = Math.min(.05, interval);
    lastFrame = now;
    if (!reduced.matches) time += delta;
    const ease = reduced.matches ? 1 : 1 - Math.exp(-delta * 10.8);
    placeObjects();
    updateSubjects(ease, delta, keyboardHighlight ?? hovered);
    updateCamera(ease);
    if (pointer && !gesture) sendHover(hitTest(pointer, 'mouse'));
    updateArt(ease, keyboardHighlight ?? hovered);
    if (!reduced.matches && root.group.visible) gyroscopeMixer.update(delta);
    renderer.render(world, camera);
    if (!reduced.matches) {
      slowFrames = interval > .032 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames >= 35 && pixelBudget > 1) {
        pixelBudget = Math.max(1, pixelBudget - .18);
        slowFrames = 0;
        resize();
      }
      queue();
    }
  }

  function queue() {
    if (!frame && enabled && !disposed && !document.hidden) frame = requestAnimationFrame(render);
  }

  function local(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * width / (bounds.width || width),
      y: (event.clientY - bounds.top) * height / (bounds.height || height),
    };
  }

  function setZoom(value) {
    zoom = clamp(value, .48, 1.75);
    queue();
  }

  function wheelZoom(event) {
    if (!event.ctrlKey || !event.cancelable) return;
    event.preventDefault();
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const amount = clamp(event.deltaY * units, -125, 125);
    setZoom(zoom * Math.exp(amount * .003));
  }

  function pointerDown(event) {
    if (event.button !== 0) return;
    const position = local(event);
    if (event.pointerType === 'touch') {
      touch.set(event.pointerId, position);
      if (touch.size === 2) {
        const [first, second] = touch.values();
        pinch = { distance: Math.hypot(first.x - second.x, first.y - second.y), zoom };
        gesture = null;
      }
      if (touch.size !== 1) return;
    } else {
      canvas.setPointerCapture(event.pointerId);
    }
    gesture = { pointerId: event.pointerId, position, drag: dragGoal.clone(), roll: overviewRoll, moved: false };
  }

  function pointerMove(event) {
    const position = local(event);
    const moving = gesture?.pointerId === event.pointerId;
    if (event.pointerType === 'touch' && touch.has(event.pointerId)) {
      touch.set(event.pointerId, position);
      if (pinch && touch.size === 2) {
        const [first, second] = touch.values();
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        setZoom(pinch.zoom * pinch.distance / Math.max(1, distance));
      }
    } else {
      pointer = position;
    }
    if (moving) {
      const offsetX = position.x - gesture.position.x;
      const offsetY = position.y - gesture.position.y;
      if (Math.hypot(offsetX, offsetY) > 6) {
        gesture.moved = true;
        if (selection.type === 'degree') {
          overviewRoll = gesture.roll + offsetX / width * FULL_TURN * 1.45;
          sendHover(null);
        } else {
          dragGoal.set(clamp(gesture.drag.x - offsetX / 200, -1, 1), clamp(gesture.drag.y + offsetY / 230, -.75, .75));
        }
      }
    }
    queue();
  }

  function endPointer(event) {
    touch.delete(event.pointerId);
    if (touch.size < 2) pinch = null;
    if (gesture?.pointerId !== event.pointerId) return;
    const click = event.type === 'pointerup' && !gesture.moved;
    gesture = null;
    if (click) {
      const id = hitTest(local(event), event.pointerType);
      if (id) handlers.select?.(id);
    }
    queue();
  }

  function clearPointer() {
    pointer = null;
    sendHover(null);
    queue();
  }

  const events = new AbortController();
  const signal = events.signal;
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener('pointerdown', pointerDown, { signal });
  canvas.addEventListener('pointermove', pointerMove, { signal });
  canvas.addEventListener('pointerup', endPointer, { signal });
  canvas.addEventListener('pointercancel', endPointer, { signal });
  canvas.addEventListener('pointerleave', clearPointer, { signal });
  canvas.addEventListener('wheel', wheelZoom, { signal, passive: false });
  document.addEventListener('visibilitychange', queue, { signal });
  reduced.addEventListener('change', queue, { signal });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    enabled = false;
    cancelAnimationFrame(frame);
    frame = 0;
    handlers.unavailable?.(new Error('Контекст WebGL потерян.'));
  }, { signal });

  resize();
  placeObjects();
  applyFocus(graph.root.id);
  return {
    focus: applyFocus,
    zoomBy(steps) {
      setZoom(zoom * Math.pow(1.26, -steps));
    },
    highlight(id) {
      keyboardHighlight = id;
      queue();
    },
    setActive(value) {
      enabled = value;
      if (!value) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastFrame = 0;
        clearPointer();
      }
      queue();
    },
    project,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      events.abort();
      observer.disconnect();
      gyroscopeMixer.stopAllAction();
      gyroscopeMixer.uncacheRoot(gyroscope.scene);
      const geometries = new Set();
      const materials = new Set();
      world.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      const textures = new Set([...gyroscopeFinishes.keys()].map((material) => material.map).filter(Boolean));
      for (const texture of textures) {
        texture.dispose();
        texture.source.data?.close?.();
      }
      for (const template of new Set(Object.values(templates))) {
        for (const { finish } of template) finish.dispose();
      }
      studio.dispose();
      renderer.dispose();
    },
  };
}
