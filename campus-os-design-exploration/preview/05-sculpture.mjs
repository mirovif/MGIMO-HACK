const vertexSource = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  uniform vec2 uTurn;
  uniform float uAspect;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vClay;

  vec3 rotate(vec3 p) {
    float cx = cos(uTurn.x), sx = sin(uTurn.x);
    float cy = cos(uTurn.y), sy = sin(uTurn.y);
    p = vec3(p.x, cx*p.y - sx*p.z, sx*p.y + cx*p.z);
    return vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);
  }

  void main() {
    vec3 p = rotate(aPosition);
    float w = 1.0 - p.z * 0.147;
    gl_Position = vec4(p.x * 0.49, p.y * 0.49 * uAspect, -p.z * 0.2, w);
    vNormal = rotate(aNormal);
    vPosition = p;
    vClay = aPosition;
  }
`;

const fragmentSource = `
  precision mediump float;
  uniform vec2 uLight;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vClay;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewer = normalize(vec3(0.0, 0.0, 5.0) - vPosition);
    vec3 key = normalize(vec3(-0.8 + uLight.x, 0.9 + uLight.y, 1.35));
    vec3 rim = normalize(vec3(1.0, 0.18, -0.4));
    vec3 reflected = reflect(-viewer, n);
    float diffuse = max(0.0, dot(n, key));
    float fresnel = pow(1.0 - max(0.0, dot(n, viewer)), 2.5);
    float keySpecular = pow(max(0.0, dot(n, normalize(key + viewer))), 25.0);
    float warmSpecular = pow(max(0.0, dot(n, normalize(rim + viewer))), 11.0);
    float softbox = exp(-pow((reflected.x + reflected.y * 0.25 + 0.38) * 5.0, 2.0))
                  * smoothstep(0.05, 0.52, reflected.y);
    float grain = fract(sin(dot(floor(vClay.xy * 240.0), vec2(12.9898, 78.233))) * 43758.5453);
    float blueShade = 0.5 + 0.5*sin(vClay.x*1.3 - vClay.z*2.6 + reflected.z*1.4);
    vec3 body = mix(vec3(0.39, 0.24, 0.61), vec3(0.70, 0.53, 0.90), blueShade);
    vec3 light = mix(vec3(0.38, 0.34, 0.52), vec3(1.05, 1.03, 1.04), diffuse);
    vec3 color = body * light;
    color += fresnel * vec3(0.23, 0.19, 0.30);
    color += (keySpecular * 0.53 + softbox * 0.26) * vec3(1.0, 0.96, 1.0);
    color += warmSpecular * vec3(0.52, 0.30, 0.27);
    color += (grain - 0.5) * 0.042;
    gl_FragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(0.76)), 1.0);
  }
`;

const turn = Math.PI * 2;
const cross = ([ax, ay, az], [bx, by, bz]) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const minus = ([ax, ay, az], [bx, by, bz]) => [ax - bx, ay - by, az - bz];

function unit(vector) {
  const length = Math.hypot(...vector);
  return vector.map(component => component / length);
}

function center(t) {
  const radius = 1.08 + .41 * Math.cos(3 * t);
  return [
    radius * Math.cos(2 * t),
    radius * Math.sin(2 * t),
    .45 * Math.sin(3 * t),
  ];
}

// A trefoil sweep with a rounded, continuously twisted ribbon section.
function surface(t, a) {
  const origin = center(t);
  const tangent = unit(minus(center(t + .0005), center(t - .0005)));
  const normal = unit(cross(tangent, [0, 0, 1]));
  const binormal = cross(tangent, normal);
  const twist = t * 2 + .46 * Math.sin(t * 3);
  const width = (.29 + .065 * Math.cos(t * 3 + 1.25)) * Math.cos(a);
  const depth = .089 * Math.sin(a);
  const across = width * Math.cos(twist) - depth * Math.sin(twist);
  const through = width * Math.sin(twist) + depth * Math.cos(twist);
  return origin.map((component, axis) => component + normal[axis] * across + binormal[axis] * through);
}

function mesh() {
  const sweeps = 184;
  const radial = 28;
  const stride = radial + 1;
  const vertices = [];
  const triangles = [];
  for (let row = 0; row <= sweeps; row++) {
    const t = turn * row / sweeps;
    for (let column = 0; column <= radial; column++) {
      const a = turn * column / radial;
      const point = surface(t, a);
      const normal = unit(cross(minus(surface(t, a + .001), point), minus(surface(t + .001, a), point)));
      vertices.push(...point, ...normal);
      if (row < sweeps && column < radial) {
        const index = row * stride + column;
        triangles.push(index, index + 1, index + stride, index + 1, index + stride + 1, index + stride);
      }
    }
  }
  return [new Float32Array(vertices), new Uint16Array(triangles)];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
}

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) return;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const [vertices, triangles] = mesh();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangles, gl.STATIC_DRAW);
  for (const [index, name] of ['aPosition', 'aNormal'].entries()) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 24, index * 12);
  }

  const angle = gl.getUniformLocation(program, 'uTurn');
  const aspect = gl.getUniformLocation(program, 'uAspect');
  const light = gl.getUniformLocation(program, 'uLight');
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  return {
    draw(x, y, scroll) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(angle, -.38 + y * .2 + scroll * .26, -.43 + x * .2 + scroll * .48);
      gl.uniform2f(light, x * .65, y * -.42);
      gl.uniform1f(aspect, canvas.width / canvas.height);
      gl.drawElements(gl.TRIANGLES, triangles.length, gl.UNSIGNED_SHORT, 0);
    },
  };
}

export function mountSculpture(canvas) {
  const renderer = createRenderer(canvas);
  if (!renderer) return;
  const hero = canvas.closest('.relief-hero');
  const sculpture = canvas.parentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { x: 0, y: 0, scroll: 0 };
  const goal = { ...state };
  let frame = 0;
  let visible = true;
  let lost = false;

  function draw() {
    frame = 0;
    if (!visible || lost) return;
    for (const key of Object.keys(state)) {
      state[key] += (goal[key] - state[key]) * (motion.matches ? 1 : .135);
    }
    renderer.draw(state.x, state.y, state.scroll);
    sculpture.style.setProperty('--shadow-x', `${51 - state.x * 8 + state.scroll * 5}%`);
    canvas.setAttribute('data-ready', '');
    sculpture.setAttribute('data-rendered', '');
    if (Object.keys(state).some(key => Math.abs(goal[key] - state[key]) > .002)) requestDraw();
  }

  function requestDraw() {
    if (!frame && visible && !lost) frame = requestAnimationFrame(draw);
  }

  new ResizeObserver(([{ contentRect }]) => {
    const scale = Math.min(devicePixelRatio, 1.4);
    canvas.width = Math.round(contentRect.width * scale);
    canvas.height = Math.round(contentRect.height * scale);
    requestDraw();
  }).observe(canvas);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    goal.scroll = motion.matches ? 0 : (1 - entry.intersectionRatio);
    requestDraw();
  }, { threshold: Array.from({ length: 51 }, (_, index) => index / 50) }).observe(hero);

  hero.addEventListener('pointermove', event => {
    if (motion.matches || event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    goal.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    goal.y = (event.clientY - rect.top) / rect.height * 2 - 1;
    requestDraw();
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    goal.x = 0;
    goal.y = 0;
    requestDraw();
  });

  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    Object.assign(goal, { x: 0, y: 0, scroll: 0 });
    requestDraw();
  });

  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    canvas.removeAttribute('data-ready');
    sculpture.removeAttribute('data-rendered');
  });
}
