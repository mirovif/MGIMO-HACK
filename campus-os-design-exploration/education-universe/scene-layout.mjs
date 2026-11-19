const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const SCHOOL_ANCHORS = [
  [-10.2, 3.4, -4.4], [-5.2, 5.2, -3.0], [1.1, 5.3, -4.7],
  [7.7, 4.1, -3.6], [10.2, -.2, -6.1], [7.7, -4.2, -.9],
  [2.4, -5.1, -2.0], [-4.4, -4.8, -4.7], [-9.5, -2.3, -2.4],
];

export function seedFrom(id) {
  let hash = 2166136261;
  for (const char of id) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomFor(id) {
  let state = seedFrom(id);
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function orbitFor(id, index, count, radius, bearing) {
  const random = randomFor(id);
  const angle = bearing + (index - (count - 1) / 2) * 1.04 + (random() - .5) * .12;
  return {
    angle,
    radius: radius * (.96 + random() * .08),
    depth: (random() - .5) * radius * .16,
    speed: (random() - .5) * .065,
  };
}

export function satelliteBearing(parentOrbit) {
  const towardLowerLeft = -2.12 - parentOrbit.angle;
  const turn = Math.atan2(Math.sin(towardLowerLeft), Math.cos(towardLowerLeft));
  return parentOrbit.angle + Math.max(-.88, Math.min(.88, turn));
}

export function makeSubjectField(subjects, programId) {
  const random = randomFor(programId);
  const count = subjects.length;
  const radius = Math.min(4.35, 2.6 + Math.sqrt(count) * .24);
  const startAngle = random() * Math.PI * 2;
  return subjects.map((node, index) => {
    const y = 1 - 2 * (index + .5) / count;
    const angle = startAngle + GOLDEN_ANGLE * index;
    const ring = Math.sqrt(1 - y * y);
    const spread = radius * (.73 + random() * .32);
    const anchor = [
      Math.cos(angle) * ring * spread,
      y * spread * .72,
      Math.sin(angle) * ring * spread * .58,
    ];
    return {
      node,
      anchor,
      radius: Math.hypot(...anchor),
      point: anchor.map((axis) => axis * .14),
      velocity: [0, 0, 0],
    };
  });
}

// Each active discipline has one spring to its program and one stable spatial anchor.
// Pairwise repulsion applies only to the current program's visible, unique subjects.
export function stepSubjectField(subjects) {
  for (let i = 0; i < subjects.length; i += 1) {
    const { point, velocity, anchor, radius } = subjects[i];
    const radialForce = (radius - Math.hypot(...point)) * .016;
    const currentRadius = Math.max(.08, Math.hypot(...point));
    for (let axis = 0; axis < 3; axis += 1) {
      velocity[axis] += (anchor[axis] - point[axis]) * .024
        + point[axis] / currentRadius * radialForce;
    }
    for (let j = i + 1; j < subjects.length; j += 1) {
      const other = subjects[j];
      const x = point[0] - other.point[0];
      const y = point[1] - other.point[1];
      const z = point[2] - other.point[2];
      const distanceSq = x * x + y * y + z * z;
      if (distanceSq > 1.05) continue;
      const force = Math.min(.20, .021 / Math.max(.03, distanceSq));
      velocity[0] += x * force;
      velocity[1] += y * force;
      velocity[2] += z * force;
      other.velocity[0] -= x * force;
      other.velocity[1] -= y * force;
      other.velocity[2] -= z * force;
    }
  }
  for (const { point, velocity, radius } of subjects) {
    for (let axis = 0; axis < 3; axis += 1) {
      velocity[axis] *= .77;
      point[axis] += velocity[axis];
    }
    const length = Math.hypot(...point);
    if (length > radius + .7) {
      for (let axis = 0; axis < 3; axis += 1) point[axis] *= (radius + .7) / length;
    }
  }
}
