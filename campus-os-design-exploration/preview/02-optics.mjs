const vertexSource = `
  attribute vec2 position;
  varying vec2 local;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
    local = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  }
`;

const fragmentSource = `
  precision mediump float;
  uniform sampler2D source;
  uniform vec4 lensBox;
  uniform vec4 crop;
  uniform vec2 lamp;
  varying vec2 local;

  vec3 backgroundAt(vec2 point) {
    vec2 texel = point * crop.xy + crop.zw;
    vec2 screenEdge = min(point, 1.0 - point);
    float inside = smoothstep(-0.009, 0.008, min(screenEdge.x, screenEdge.y));
    return mix(vec3(0.87, 0.92, 1.0), texture2D(source, texel).rgb, inside);
  }

  void main() {
    vec2 p = local * 2.0 - 1.0 + vec2(local.y * -0.06 + 0.025, local.x * 0.07 - 0.04);
    float shape = pow(dot(pow(abs(p) * vec2(1.045, 1.07), vec2(3.0)), vec2(1.0)), 1.0 / 3.0);
    float alpha = 1.0 - smoothstep(0.975, 0.997, shape);
    if (alpha < 0.004) discard;

    vec2 n = normalize(p + vec2(0.0005));
    float shoulder = smoothstep(0.45, 0.97, shape);
    float band = smoothstep(0.66, 0.96, shape);
    float edge = smoothstep(0.942, 0.978, shape);
    vec2 pinch = n * (0.075 * shoulder - 0.075 * band * band);
    vec2 bent = 0.5 + (local - 0.5) * 0.69 + pinch;
    vec2 point = lensBox.xy + bent * lensBox.zw;
    vec2 disperse = n * (0.006 + 0.034 * band) * lensBox.zw;
    vec3 blueRay = backgroundAt(point + disperse);
    vec3 roseRay = backgroundAt(point - disperse * 1.1);
    float separation = dot(blueRay - roseRay, vec3(0.21, 0.72, 0.07));
    vec3 spectrum = separation > 0.0 ? vec3(0.17, 0.33, 0.85) : vec3(0.77, 0.15, 0.37);
    vec3 optics = clamp(backgroundAt(point) + abs(separation) * band * spectrum, 0.0, 1.0);

    vec2 direction = normalize((lamp - 0.5) * vec2(1.0, 1.3) + vec2(-0.27, -0.35));
    float towardLight = dot(n, direction) * 0.5 + 0.5;
    float specular = pow(towardLight, 4.0);
    float mirroredEdge = pow(1.0 - towardLight, 4.0);
    float outerFresnel = smoothstep(0.83, 0.965, shape);
    float ridge = smoothstep(0.83, 0.9, shape) * (1.0 - smoothstep(0.905, 0.944, shape));
    float focus = exp(-5.4 * length((local - lamp) * vec2(1.0, 1.4)));
    float caustic = exp(-74.0 * abs(shape - 0.84)) * mirroredEdge;

    optics = mix(optics, vec3(0.81, 0.87, 0.99), 0.12 + 0.16 * focus);
    optics = mix(optics, vec3(0.13, 0.22, 0.45), edge * (0.38 - 0.3 * specular));
    optics = mix(optics, vec3(0.99, 0.995, 1.0),
      outerFresnel * (0.12 + 0.39 * specular + 0.12 * mirroredEdge) +
      ridge * (0.21 + 0.34 * specular) + caustic * 0.25);
    gl_FragColor = vec4(optics, alpha);
  }
`;

function shader(gl, type, source) {
  const compiled = gl.createShader(type);
  gl.shaderSource(compiled, source);
  gl.compileShader(compiled);
  if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
    gl.deleteShader(compiled);
    return null;
  }
  return compiled;
}

function programFor(gl) {
  const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function mountOptic(lens, surface, currentMedia) {
  const preferences = matchMedia('(prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce)');
  if (preferences.matches) return;

  const canvas = lens.querySelector('canvas');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
    premultipliedAlpha: false,
  });
  if (!gl) return;
  const program = programFor(gl);
  if (!program) return;

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const lensBox = gl.getUniformLocation(program, 'lensBox');
  const crop = gl.getUniformLocation(program, 'crop');
  const lamp = gl.getUniformLocation(program, 'lamp');
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(gl.getUniformLocation(program, 'source'), 0);

  let visible = false;
  let stopped = false;
  let pending = 0;
  let uploaded = null;
  let uploadedTime = -1;
  let lastUpload = -Infinity;
  let lightX = 0.23;
  let lightY = 0.2;
  let targetX = lightX;
  let targetY = lightY;

  function isActive() {
    return visible && !stopped && !preferences.matches && !document.hidden
      && !document.documentElement.hasAttribute('data-preview-inactive');
  }

  function queue() {
    if (!pending && isActive()) pending = requestAnimationFrame(draw);
  }

  function draw(now) {
    pending = 0;
    if (!isActive()) return;

    const media = currentMedia();
    if (!media) return;
    const video = media instanceof HTMLVideoElement;
    const width = video ? media.videoWidth : media.naturalWidth;
    const height = video ? media.videoHeight : media.naturalHeight;
    if (!width || !height || (video && media.readyState < 2)) return;

    const view = surface.getBoundingClientRect();
    const tile = canvas.getBoundingClientRect();
    if (!view.width || !view.height || !tile.width || !tile.height) return;

    const time = video ? media.currentTime : 0;
    if (uploaded !== media || (time !== uploadedTime && now - lastUpload >= 38)) {
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
      } catch {
        if (video) queue();
        return;
      }
      uploaded = media;
      uploadedTime = time;
      lastUpload = now;
    }

    const resolution = Math.min(devicePixelRatio || 1, 1.45, 495 / tile.width);
    const pixelWidth = Math.max(1, Math.round(tile.width * resolution));
    const pixelHeight = Math.max(1, Math.round(tile.height * resolution));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const scale = Math.max(view.width / width, view.height / height);
    const scaleX = view.width / (width * scale);
    const scaleY = view.height / (height * scale);

    lightX += (targetX - lightX) * 0.19;
    lightY += (targetY - lightY) * 0.19;
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(lensBox,
      (tile.left - view.left) / view.width, (tile.top - view.top) / view.height,
      tile.width / view.width, tile.height / view.height);
    gl.uniform4f(crop, scaleX, scaleY, (1 - scaleX) / 2, (1 - scaleY) / 2);
    gl.uniform2f(lamp, lightX, lightY);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    lens.dataset.optic = 'ready';

    if ((video && !media.paused) || Math.abs(lightX - targetX) + Math.abs(lightY - targetY) > 0.001) {
      queue();
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    queue();
  });
  observer.observe(lens);

  const resize = new ResizeObserver(queue);
  resize.observe(surface);
  resize.observe(lens);
  surface.querySelectorAll('img').forEach(img => img.addEventListener('load', queue));
  const video = surface.querySelector('video');
  video?.addEventListener('playing', queue);
  video?.addEventListener('error', queue);
  lens.addEventListener('animationend', queue);

  const pointerTarget = surface.parentElement;
  pointerTarget.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = lens.getBoundingClientRect();
    targetX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    targetY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    queue();
  }, { passive: true });
  pointerTarget.addEventListener('pointerleave', () => {
    targetX = 0.23;
    targetY = 0.2;
    queue();
  });

  preferences.addEventListener('change', () => {
    if (preferences.matches) delete lens.dataset.optic;
    else queue();
  });
  document.addEventListener('visibilitychange', queue);
  document.addEventListener('campus-preview-visibility', queue);
  canvas.addEventListener('webglcontextlost', () => {
    stopped = true;
    delete lens.dataset.optic;
    resize.disconnect();
    observer.disconnect();
  });
}
