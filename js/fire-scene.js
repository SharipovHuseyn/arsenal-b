(function () {
  var root = document.querySelector("[data-fire]");
  if (!root) return;

  var THREE_URLS = [
    "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "https://unpkg.com/three@0.170.0/build/three.module.js",
  ];
  var LOOP_SECONDS = 18;
  var STEPS = [
    { from: 0, to: 0.16 },
    { from: 0.16, to: 0.4 },
    { from: 0.4, to: 0.52 },
    { from: 0.52, to: 0.66 },
    { from: 0.66, to: 1 },
  ];
  var LABEL_STEP = { fire: 0, smoke: 1, detector: 2, panel: 3, siren: 4, exit: 4 };

  var canvas = root.querySelector("canvas");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fail() {
    root.classList.add("no-webgl");
  }

  function hasWebGL() {
    try {
      var probe = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (probe.getContext("webgl2") || probe.getContext("webgl")));
    } catch (e) {
      return false;
    }
  }

  if (!canvas || !hasWebGL()) {
    fail();
    return;
  }

  var pendingStep = null;
  Array.prototype.forEach.call(root.querySelectorAll("[data-step]"), function (btn, i) {
    btn.addEventListener("click", function () {
      if (!root.classList.contains("is-live")) pendingStep = i;
    });
  });

  var settled = false;
  var timer = setTimeout(function () {
    if (!settled) fail();
  }, 12000);
  function load(urls) {
    return import(urls[0]).catch(function (err) {
      if (urls.length > 1) return load(urls.slice(1));
      throw err;
    });
  }
  load(THREE_URLS)
    .then(function (THREE) {
      settled = true;
      clearTimeout(timer);
      root.classList.remove("no-webgl");
      start(THREE);
    })
    .catch(function () {
      settled = true;
      clearTimeout(timer);
      fail();
    });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) {
    var x = clamp((v - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  }

  function start(THREE) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    } catch (e) {
      fail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      running = false;
      fail();
    });

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0c07);
    scene.fog = new THREE.Fog(0x0d0c07, 13, 24);

    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    var lookTarget = new THREE.Vector3(-0.15, 1.55, -0.4);
    var camBase = new THREE.Vector3(3.3, 2.3, 7.4);
    var distFactor = 1;

    // ---------- materials and helpers ----------
    function std(color, rough, metal) {
      return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.85 : rough, metalness: metal || 0 });
    }
    function glow(color) {
      return new THREE.MeshBasicMaterial({ color: color, toneMapped: false });
    }
    function box(w, h, d, mat, x, y, z, parent) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      (parent || scene).add(mesh);
      return mesh;
    }
    function textTexture(lines, bg, fg, w, h, size) {
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var ctx = c.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 " + size + "px Manrope, Arial, sans-serif";
      lines.forEach(function (line, i) {
        ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15);
      });
      var tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    }

    // ---------- room ----------
    var wallMat = std(0x2a231c);
    var sideMat = std(0x241e18);
    box(5.4, 0.12, 5, std(0x30281f, 0.95), 0, -0.06, 0);
    var grid = new THREE.GridHelper(5.4, 12, 0x463a2e, 0x3a3027);
    grid.scale.z = 5 / 5.4;
    grid.position.y = 0.002;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);
    box(5.4, 3.2, 0.12, wallMat, 0, 1.6, -2.5);
    box(0.12, 3.2, 5, sideMat, -2.7, 1.6, 0);
    box(5.4, 0.1, 5, std(0x1f1a15), 0, 3.25, 0);
    box(5.4, 0.12, 0.04, std(0x3b3026), 0, 0.06, -2.42);
    box(0.04, 0.12, 5, std(0x3b3026), -2.62, 0.06, 0);

    // desk and cabinet
    var wood = std(0x5a4130, 0.7);
    box(1.5, 0.06, 0.7, wood, -1.15, 0.76, -1.95);
    [[-1.8, -2.2], [-0.5, -2.2], [-1.8, -1.7], [-0.5, -1.7]].forEach(function (p) {
      box(0.05, 0.74, 0.05, std(0x2a2019), p[0], 0.37, p[1]);
    });
    box(0.36, 0.26, 0.04, std(0x16130f, 0.4), -1.2, 0.95, -2.12);

    // door
    box(1.06, 2.16, 0.06, std(0x2a1f18), 1.85, 1.08, -2.43);
    box(0.92, 2.04, 0.05, std(0x5b402d, 0.7), 1.85, 1.04, -2.4);
    var handle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), std(0xc9b48a, 0.35, 0.8));
    handle.position.set(2.19, 1.02, -2.36);
    scene.add(handle);

    // waste bin with papers on the left
    var FIRE = new THREE.Vector3(-1.95, 0.46, 0.55);
    var bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.46, 24, 1, true), std(0x3c3a36, 0.5, 0.6));
    bin.material.side = THREE.DoubleSide;
    bin.position.set(FIRE.x, 0.23, FIRE.z);
    scene.add(bin);
    var binBottom = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), std(0x24221f));
    binBottom.rotation.x = -Math.PI / 2;
    binBottom.position.set(FIRE.x, 0.01, FIRE.z);
    scene.add(binBottom);
    var paperMat = std(0x8a7a62, 0.9);
    [[0.06, 0.4, 0.02], [-0.08, 0.38, -0.05], [0.02, 0.42, 0.08]].forEach(function (p, i) {
      var paper = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 + i * 0.015, 0), paperMat);
      paper.position.set(FIRE.x + p[0], p[1], FIRE.z + p[2]);
      scene.add(paper);
    });
    var ember = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), glow(0xff5a1a));
    ember.rotation.x = -Math.PI / 2;
    ember.position.set(FIRE.x, 0.45, FIRE.z);
    ember.material.transparent = true;
    scene.add(ember);

    // ceiling lamp
    box(0.9, 0.03, 0.9, glow(0xf6e6cc), 1.3, 3.19, 1.1);

    // ---------- smoke detector ----------
    var DET = new THREE.Vector3(-0.75, 3.2, -0.1);
    var det = new THREE.Group();
    det.position.copy(DET);
    scene.add(det);
    var detBody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.11, 32), std(0xefeae0, 0.5));
    detBody.position.y = -0.06;
    det.add(detBody);
    var detCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), std(0xdcd5c8, 0.5));
    detCap.position.y = -0.13;
    det.add(detCap);
    var ledMat = glow(0x330806);
    var led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), ledMat);
    led.position.set(0.19, -0.12, 0.08);
    det.add(led);
    var detRings = [0, 1, 2].map(function () {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.012, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xff3b2c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.14;
      det.add(ring);
      return ring;
    });
    var detLight = new THREE.PointLight(0xff2a1a, 0, 0, 2);
    detLight.position.set(DET.x, DET.y - 0.35, DET.z);
    scene.add(detLight);
    [detBody, detCap, led].concat(detRings).forEach(function (mesh) {
      mesh.material.transparent = true;
      mesh.renderOrder = 5;
    });

    // ---------- control panel ----------
    var PANEL = new THREE.Vector3(0.2, 1.5, -2.4);
    box(0.72, 0.92, 0.1, std(0xe9e3d7, 0.55), PANEL.x, PANEL.y, PANEL.z);
    var texNorm = textTexture(["НОРМА"], "#0f2a1a", "#57e38f", 256, 128, 52);
    var texFire = textTexture(["ПОЖАР"], "#3a0805", "#ff5a46", 256, 128, 52);
    var screenMat = new THREE.MeshBasicMaterial({ map: texNorm, toneMapped: false });
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.24), screenMat);
    screen.position.set(PANEL.x, PANEL.y + 0.2, PANEL.z + 0.052);
    scene.add(screen);
    var panelLeds = [-0.22, -0.08, 0.06, 0.2].map(function (dx, i) {
      var m = glow(i === 0 ? 0x2bd16b : 0x2a0a08);
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), m);
      s.position.set(PANEL.x + dx, PANEL.y - 0.12, PANEL.z + 0.06);
      scene.add(s);
      return m;
    });
    box(0.5, 0.04, 0.01, std(0xbdb5a6), PANEL.x, PANEL.y - 0.3, PANEL.z + 0.055);
    var panelLight = new THREE.PointLight(0xff3020, 0, 0, 2);
    panelLight.position.set(PANEL.x, PANEL.y + 0.2, PANEL.z + 0.6);
    scene.add(panelLight);

    // ---------- siren with strobe ----------
    var SIREN = new THREE.Vector3(0.9, 2.55, -2.4);
    box(0.28, 0.28, 0.08, std(0xb3261c, 0.6), SIREN.x, SIREN.y, SIREN.z);
    var domeMat = new THREE.MeshStandardMaterial({ color: 0x7a1a12, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.25 });
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.rotation.x = Math.PI / 2;
    dome.position.set(SIREN.x, SIREN.y, SIREN.z + 0.04);
    dome.renderOrder = 5;
    domeMat.transparent = true;
    scene.add(dome);
    var soundRings = [0, 1, 2].map(function () {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.012, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0xffb4a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
      );
      ring.position.set(SIREN.x, SIREN.y, SIREN.z + 0.12);
      ring.renderOrder = 5;
      scene.add(ring);
      return ring;
    });
    var alarmLight = new THREE.PointLight(0xff2a1a, 0, 0, 2);
    alarmLight.position.set(SIREN.x, SIREN.y - 0.2, SIREN.z + 0.9);
    scene.add(alarmLight);

    // manual call point
    box(0.22, 0.22, 0.05, std(0xc4291e, 0.55), 1.12, 1.38, -2.42);
    box(0.13, 0.13, 0.01, std(0xf2ece2, 0.5), 1.12, 1.38, -2.39);

    // ---------- exit sign ----------
    var EXIT = new THREE.Vector3(1.85, 2.5, -2.4);
    var texExit = textTexture(["ВЫХОД"], "#0f7a3d", "#ffffff", 256, 96, 56);
    var exitFront = new THREE.MeshStandardMaterial({ map: texExit, emissiveMap: texExit, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4 });
    var plastic = std(0xe9e3d7, 0.5);
    var exitSign = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.27, 0.06), [plastic, plastic, plastic, plastic, exitFront, plastic]);
    exitSign.position.copy(EXIT);
    exitSign.renderOrder = 5;
    [plastic, exitFront].forEach(function (m) { m.transparent = true; });
    scene.add(exitSign);
    var exitLight = new THREE.PointLight(0x30ff80, 0, 0, 2);
    exitLight.position.set(EXIT.x, EXIT.y - 0.1, EXIT.z + 0.6);
    scene.add(exitLight);

    // ---------- cables and signal ----------
    function cablePath(points) {
      var path = new THREE.CurvePath();
      for (var i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
      return path;
    }
    var cable1 = cablePath([
      new THREE.Vector3(DET.x, DET.y - 0.04, DET.z),
      new THREE.Vector3(DET.x, DET.y - 0.04, -2.4),
      new THREE.Vector3(PANEL.x, DET.y - 0.04, -2.4),
      new THREE.Vector3(PANEL.x, PANEL.y + 0.46, -2.4),
    ]);
    var cable2 = cablePath([
      new THREE.Vector3(PANEL.x + 0.36, PANEL.y, -2.41),
      new THREE.Vector3(SIREN.x, PANEL.y, -2.41),
      new THREE.Vector3(SIREN.x, SIREN.y - 0.14, -2.41),
    ]);
    function cableMesh(path) {
      var mat = new THREE.MeshStandardMaterial({ color: 0x51443a, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.6 });
      var mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 160, 0.016, 8, false), mat);
      scene.add(mesh);
      return mat;
    }
    var cable1Mat = cableMesh(cable1);
    var cable2Mat = cableMesh(cable2);
    function makePulse() {
      var group = new THREE.Group();
      var dots = [0, 1, 2, 3, 4].map(function (i) {
        var m = new THREE.MeshBasicMaterial({ color: 0xff4a36, transparent: true, opacity: 1 - i * 0.18, toneMapped: false });
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.06 - i * 0.009, 14, 10), m);
        group.add(s);
        return s;
      });
      var light = new THREE.PointLight(0xff3020, 0, 0, 2);
      group.add(light);
      scene.add(group);
      return { group: group, dots: dots, light: light };
    }
    var pulse1 = makePulse();
    var pulse2 = makePulse();
    var tmpV = new THREE.Vector3();
    function placePulse(p, path, u) {
      var show = u > 0 && u < 1;
      p.group.visible = show;
      if (!show) return;
      p.dots.forEach(function (dot, i) {
        var k = clamp(u - i * 0.025, 0, 1);
        path.getPointAt(k, tmpV);
        dot.position.copy(tmpV);
      });
      p.light.position.copy(p.dots[0].position);
      p.light.intensity = 2.5;
    }

    // ---------- lights ----------
    scene.add(new THREE.HemisphereLight(0xfff1e0, 0x1a120c, 0.55));
    var key = new THREE.DirectionalLight(0xffe6c8, 0.55);
    key.position.set(4, 6, 6);
    scene.add(key);
    var lamp = new THREE.PointLight(0xffd8a8, 9, 0, 2);
    lamp.position.set(1.3, 3.0, 1.1);
    scene.add(lamp);
    var fireLight = new THREE.PointLight(0xff7a2a, 0, 0, 2);
    fireLight.position.set(FIRE.x + 0.2, FIRE.y + 0.7, FIRE.z + 0.3);
    scene.add(fireLight);

    // ---------- particles ----------
    var vertexShader = [
      "attribute float aSize;",
      "attribute vec4 aColor;",
      "uniform float uScale;",
      "varying vec4 vColor;",
      "void main() {",
      "  vColor = aColor;",
      "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
      "  gl_PointSize = aSize * uScale / max(0.001, -mv.z);",
      "  gl_Position = projectionMatrix * mv;",
      "}",
    ].join("\n");
    var fragmentShader = [
      "uniform float uSoft;",
      "varying vec4 vColor;",
      "void main() {",
      "  float d = length(gl_PointCoord - 0.5);",
      "  float a = smoothstep(0.5, uSoft, d);",
      "  if (vColor.a * a < 0.003) discard;",
      "  gl_FragColor = vec4(vColor.rgb, vColor.a * a);",
      "}",
    ].join("\n");

    function makeSystem(count, additive, soft, order) {
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(count * 3);
      var col = new Float32Array(count * 4);
      var size = new Float32Array(count);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
      var mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 400 }, uSoft: { value: soft } },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      var points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = order;
      scene.add(points);
      return {
        n: count, geo: geo, pos: pos, col: col, size: size, mat: mat,
        vel: new Float32Array(count * 3), age: new Float32Array(count), life: new Float32Array(count),
        seed: new Float32Array(count), alive: new Uint8Array(count), cursor: 0, acc: 0,
      };
    }
    var smoke = makeSystem(260, false, 0.0, 1);
    var flame = makeSystem(280, true, 0.05, 2);

    function spawn(sys) {
      var i = sys.cursor;
      sys.cursor = (sys.cursor + 1) % sys.n;
      sys.alive[i] = 1;
      sys.age[i] = 0;
      sys.seed[i] = Math.random();
      return i;
    }

    function updateFlame(dt, intensity, time) {
      flame.acc += dt * 170 * intensity;
      while (flame.acc >= 1) {
        flame.acc -= 1;
        var i = spawn(flame);
        var a = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.random()) * 0.17 * (0.7 + 0.5 * intensity);
        flame.pos[i * 3] = FIRE.x + Math.cos(a) * r;
        flame.pos[i * 3 + 1] = FIRE.y + Math.random() * 0.05;
        flame.pos[i * 3 + 2] = FIRE.z + Math.sin(a) * r;
        flame.vel[i * 3] = (Math.random() - 0.5) * 0.25;
        flame.vel[i * 3 + 1] = 0.6 + Math.random() * 0.8 * (0.6 + 0.6 * intensity);
        flame.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        flame.life[i] = 0.45 + Math.random() * 0.45;
      }
      for (var j = 0; j < flame.n; j++) {
        var c = j * 4, p = j * 3;
        if (!flame.alive[j]) { flame.size[j] = 0; flame.col[c + 3] = 0; continue; }
        flame.age[j] += dt;
        var k = flame.age[j] / flame.life[j];
        if (k >= 1) { flame.alive[j] = 0; flame.size[j] = 0; flame.col[c + 3] = 0; continue; }
        flame.vel[p + 1] += 1.2 * dt;
        flame.vel[p] += (FIRE.x - flame.pos[p]) * 2.4 * dt;
        flame.vel[p + 2] += (FIRE.z - flame.pos[p + 2]) * 2.4 * dt;
        flame.pos[p] += flame.vel[p] * dt + Math.sin(time * 9 + flame.seed[j] * 6) * 0.2 * dt;
        flame.pos[p + 1] += flame.vel[p + 1] * dt;
        flame.pos[p + 2] += flame.vel[p + 2] * dt;
        var r1, g1, b1;
        if (k < 0.25) {
          var m = k / 0.25;
          r1 = 1; g1 = 0.92 - 0.47 * m; b1 = 0.55 - 0.45 * m;
        } else {
          var n = (k - 0.25) / 0.75;
          r1 = 1 - 0.45 * n; g1 = 0.45 - 0.37 * n; b1 = 0.1 - 0.08 * n;
        }
        flame.col[c] = r1; flame.col[c + 1] = g1; flame.col[c + 2] = b1;
        flame.col[c + 3] = Math.pow(1 - k, 1.2) * 0.85;
        flame.size[j] = (0.16 + 0.5 * (1 - k)) * (0.75 + 0.45 * intensity);
      }
    }

    function updateSmoke(dt, intensity, time) {
      smoke.acc += dt * 38 * intensity;
      while (smoke.acc >= 1) {
        smoke.acc -= 1;
        var i = spawn(smoke);
        smoke.pos[i * 3] = FIRE.x + (Math.random() - 0.5) * 0.2;
        smoke.pos[i * 3 + 1] = FIRE.y + 0.55 + Math.random() * 0.1;
        smoke.pos[i * 3 + 2] = FIRE.z + (Math.random() - 0.5) * 0.2;
        smoke.vel[i * 3] = 0;
        smoke.vel[i * 3 + 1] = 1.0 + Math.random() * 0.4;
        smoke.vel[i * 3 + 2] = 0;
        smoke.life[i] = 7 + Math.random() * 2;
      }
      for (var j = 0; j < smoke.n; j++) {
        var c = j * 4, p = j * 3;
        if (!smoke.alive[j]) { smoke.size[j] = 0; smoke.col[c + 3] = 0; continue; }
        smoke.age[j] += dt;
        var age = smoke.age[j];
        var k = age / smoke.life[j];
        if (k >= 1) { smoke.alive[j] = 0; smoke.size[j] = 0; smoke.col[c + 3] = 0; continue; }
        var s = smoke.seed[j];
        var ceiling = 3.08 - s * 0.32;
        if (smoke.pos[p + 1] < ceiling) {
          smoke.vel[p + 1] += (1.4 - smoke.vel[p + 1]) * 1.5 * dt;
          smoke.vel[p] += (0.18 - smoke.vel[p]) * dt;
        } else {
          smoke.vel[p + 1] *= Math.max(0, 1 - 5 * dt);
          smoke.pos[p + 1] = Math.min(smoke.pos[p + 1], ceiling + 0.04);
          smoke.vel[p] += (0.95 - smoke.vel[p]) * 1.2 * dt;
          smoke.vel[p + 2] += (-0.3 + (s - 0.5) * 1.4 - smoke.vel[p + 2]) * dt;
        }
        smoke.pos[p] += smoke.vel[p] * dt + Math.sin(time * 1.3 + s * 20) * 0.14 * dt;
        smoke.pos[p + 1] += smoke.vel[p + 1] * dt;
        smoke.pos[p + 2] += smoke.vel[p + 2] * dt + Math.cos(time * 1.1 + s * 13) * 0.14 * dt;
        if (smoke.pos[p] > 2.4) { smoke.pos[p] = 2.4; smoke.vel[p] = 0; }
        smoke.pos[p + 2] = clamp(smoke.pos[p + 2], -2.2, 1.6);
        var g = 0.26 + s * 0.1;
        smoke.col[c] = g; smoke.col[c + 1] = g * 0.97; smoke.col[c + 2] = g * 0.93;
        smoke.col[c + 3] = 0.3 * Math.min(1, age / 0.6) * (1 - smooth(0.7, 1, k));
        smoke.size[j] = 0.35 + 1.05 * Math.min(1, age / 3);
      }
    }

    function commit(sys) {
      sys.geo.attributes.position.needsUpdate = true;
      sys.geo.attributes.aColor.needsUpdate = true;
      sys.geo.attributes.aSize.needsUpdate = true;
    }

    // ceiling haze that grows from the fire side
    var hazeCanvas = document.createElement("canvas");
    hazeCanvas.width = 256;
    hazeCanvas.height = 16;
    var hctx = hazeCanvas.getContext("2d");
    var grad = hctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, "rgba(120,112,104,1)");
    grad.addColorStop(0.7, "rgba(120,112,104,0.55)");
    grad.addColorStop(1, "rgba(120,112,104,0)");
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 256, 16);
    var hazeTex = new THREE.CanvasTexture(hazeCanvas);
    hazeTex.colorSpace = THREE.SRGBColorSpace;
    var hazeMat = new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    var haze = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4.6), hazeMat);
    haze.rotation.x = Math.PI / 2;
    haze.position.y = 3.12;
    haze.position.z = -0.2;
    scene.add(haze);

    // ---------- state ----------
    function fireIntensity(t) {
      var end = 1 - smooth(0.92, 1, t);
      return smooth(0, 0.12, t) * (1 + 0.35 * smooth(0.3, 0.9, t)) * end;
    }

    var progress = reduce ? 0.8 : 0;
    var playing = !reduce;
    var resumeAt = 0;
    var dragging = false;
    var visible = true;
    var running = false;
    var clock = new THREE.Clock();
    var elapsed = 0;

    function prewarm(t) {
      var I = Math.min(1, fireIntensity(t));
      var span = Math.min(4, t * LOOP_SECONDS);
      for (var s = 0; s < span; s += 1 / 30) {
        updateFlame(1 / 30, I, s);
        updateSmoke(1 / 30, I, s);
      }
    }

    // ---------- UI ----------
    var stepBox = root.querySelector(".fire-step");
    var stepNum = root.querySelector(".fire-num");
    var stepTitle = root.querySelector(".fire-step strong");
    var stepText = root.querySelector(".fire-step p");
    var buttons = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
    var labels = Array.prototype.slice.call(root.querySelectorAll("[data-label]"));
    var anchors = {
      fire: new THREE.Vector3(FIRE.x, FIRE.y + 1.05, FIRE.z),
      smoke: new THREE.Vector3(-1.25, 2.55, 0.3),
      detector: new THREE.Vector3(DET.x, DET.y - 0.3, DET.z),
      panel: new THREE.Vector3(PANEL.x - 0.42, PANEL.y + 0.1, PANEL.z),
      siren: new THREE.Vector3(SIREN.x - 0.2, SIREN.y - 0.22, SIREN.z),
      exit: new THREE.Vector3(EXIT.x + 0.39, EXIT.y + 0.22, EXIT.z),
    };
    var currentStep = -1;

    function stepFor(t) {
      for (var i = STEPS.length - 1; i >= 0; i--) if (t >= STEPS[i].from) return i;
      return 0;
    }

    function updateUI(t) {
      var idx = stepFor(t);
      if (idx !== currentStep) {
        currentStep = idx;
        var b = buttons[idx];
        if (b) {
          stepNum.textContent = "0" + (idx + 1);
          stepTitle.textContent = b.getAttribute("data-title");
          stepText.textContent = b.getAttribute("data-text");
        }
        buttons.forEach(function (btn, i) { btn.setAttribute("aria-current", i === idx ? "step" : "false"); });
        labels.forEach(function (label) {
          label.classList.toggle("on", LABEL_STEP[label.getAttribute("data-label")] === idx);
        });
        stepBox.classList.remove("swap");
        void stepBox.offsetWidth;
        stepBox.classList.add("swap");
      }
      buttons.forEach(function (btn, i) {
        var st = STEPS[i];
        btn.style.setProperty("--p", clamp((t - st.from) / (st.to - st.from), 0, 1).toFixed(3));
      });
    }

    var proj = new THREE.Vector3();
    function placeLabels(w, h) {
      labels.forEach(function (label) {
        if (!label.classList.contains("on")) return;
        proj.copy(anchors[label.getAttribute("data-label")]).project(camera);
        var lw = label.offsetWidth;
        var lh = label.offsetHeight;
        var align = label.getAttribute("data-align") || "center";
        var x = (proj.x * 0.5 + 0.5) * w;
        x -= align === "left" ? 0 : align === "right" ? lw : lw / 2;
        x = clamp(x, 12, Math.max(12, w - 12 - lw));
        var y = (-proj.y * 0.5 + 0.5) * h - (label.hasAttribute("data-below") ? 0 : lh);
        y = clamp(y, 48, Math.max(48, h - uiHeight - lh - 8));
        label.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
    }

    function markUsed() {
      root.classList.add("used");
    }

    function jumpTo(t) {
      var target = clamp(t, 0, 0.999);
      if (target > progress + 0.05) prewarm(target);
      progress = target;
      playing = false;
      resumeAt = performance.now() + 6000;
      markUsed();
      kick();
    }

    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        jumpTo(STEPS[i].from + (i === 0 ? 0.02 : 0.03));
      });
    });

    root.addEventListener("keydown", function (event) {
      if (event.target !== root) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        jumpTo(STEPS[Math.min(STEPS.length - 1, stepFor(progress) + 1)].from + 0.03);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        jumpTo(STEPS[Math.max(0, stepFor(progress) - 1)].from + 0.03);
      }
    });

    var dragStartX = 0;
    var dragStartT = 0;
    var dragId = null;
    root.addEventListener("pointerdown", function (event) {
      if (event.target.closest("button")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragging = true;
      dragId = event.pointerId;
      dragStartX = event.clientX;
      dragStartT = progress;
      playing = false;
      root.classList.add("is-dragging");
      markUsed();
      try { root.setPointerCapture(event.pointerId); } catch (e) {}
    });
    root.addEventListener("pointermove", function (event) {
      var rect = root.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      if (!dragging || event.pointerId !== dragId) return;
      var next = clamp(dragStartT + (event.clientX - dragStartX) / rect.width, 0, 0.999);
      if (next > progress + 0.05) prewarm(next);
      progress = next;
    });
    function endDrag(event) {
      if (!dragging || (event && event.pointerId !== dragId)) return;
      dragging = false;
      dragId = null;
      root.classList.remove("is-dragging");
      resumeAt = performance.now() + 3500;
    }
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    root.addEventListener("pointerleave", function () { pointer.x = 0; pointer.y = 0; });

    var pointer = { x: 0, y: 0 };
    var smoothPointer = { x: 0, y: 0 };

    // ---------- sizing ----------
    var width = 1;
    var height = 1;
    var uiHeight = 0;
    var ui = root.querySelector(".fire-ui");
    function resize() {
      width = Math.max(1, root.clientWidth);
      height = Math.max(1, root.clientHeight);
      uiHeight = ui ? ui.offsetHeight + 12 : 0;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      distFactor = camera.aspect < 1.1 ? 1 + (1.1 - camera.aspect) * 0.7 : 1;
      camera.setViewOffset(width, height, 0, Math.round(uiHeight * 0.42), width, height);
      camera.updateProjectionMatrix();
      var scale = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      flame.mat.uniforms.uScale.value = scale;
      smoke.mat.uniforms.uScale.value = scale;
    }
    resize();
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(root);
    else window.addEventListener("resize", resize);

    // ---------- frame ----------
    function frame() {
      if (!running) return;
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      requestAnimationFrame(frame);

      var dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      var now = performance.now();
      if (!playing && !dragging && !reduce && now > resumeAt) playing = true;
      if (playing) {
        progress += dt / LOOP_SECONDS;
        if (progress >= 1) progress -= 1;
      }
      var t = progress;
      var end = 1 - smooth(0.94, 1, t);
      var I = fireIntensity(t);

      updateFlame(dt, Math.min(1.35, I), elapsed);
      updateSmoke(dt, Math.min(1, I * 1.2), elapsed);
      commit(flame);
      commit(smoke);

      var flicker = 0.75 + 0.25 * Math.sin(elapsed * 23) * Math.sin(elapsed * 7.3 + 1.2);
      fireLight.intensity = I * 22 * flicker;
      ember.material.opacity = clamp(I, 0, 1);
      ember.material.color.setRGB(1, 0.35 + 0.15 * flicker, 0.08);

      var hazeFront = smooth(0.14, 0.55, t);
      hazeMat.opacity = smooth(0.16, 0.45, t) * 0.5 * end;
      haze.scale.x = Math.max(0.001, hazeFront);
      haze.position.x = -2.7 + 2.7 * hazeFront;

      var detect = smooth(0.4, 0.42, t) * end;
      var blinkFast = (elapsed * 3) % 1 < 0.5 ? 1 : 0;
      var idleBlink = (elapsed % 2.4) < 0.08 ? 0.6 : 0.08;
      var ledLevel = detect > 0.01 ? (blinkFast ? 1 : 0.15) : idleBlink;
      ledMat.color.setRGB(0.25 + ledLevel * 1.4, 0.04 + ledLevel * 0.12, 0.03 + ledLevel * 0.08);
      detLight.intensity = detect * blinkFast * 3;
      detRings.forEach(function (ring, i) {
        var phase = (elapsed * 0.8 + i / 3) % 1;
        ring.scale.setScalar(1 + phase * 3.2);
        ring.material.opacity = detect * (1 - phase) * 0.9;
      });

      var u1 = clamp((t - 0.52) / 0.12, 0, 1);
      placePulse(pulse1, cable1, u1);
      cable1Mat.emissiveIntensity = (t > 0.52 ? 0.7 * Math.min(1, u1 * 1.3) : 0) * end;

      var panelAlarm = smooth(0.64, 0.65, t) * end;
      screenMat.map = panelAlarm > 0.5 ? texFire : texNorm;
      panelLeds[1].color.setRGB(panelAlarm > 0.5 && blinkFast ? 1.6 : 0.16, 0.05, 0.04);
      panelLeds[2].color.setRGB(panelAlarm > 0.5 ? 1.4 : 0.16, panelAlarm > 0.5 ? 0.25 : 0.05, 0.04);
      panelLight.intensity = panelAlarm * (blinkFast ? 2.2 : 1);

      var u2 = clamp((t - 0.66) / 0.06, 0, 1);
      placePulse(pulse2, cable2, u2);
      cable2Mat.emissiveIntensity = (t > 0.66 ? 0.7 * Math.min(1, u2 * 1.3) : 0) * end;

      var alarm = smooth(0.71, 0.73, t) * end;
      var strobe = reduce ? 0.6 : ((elapsed * 1.6) % 1 < 0.18 ? 1 : 0.12);
      domeMat.emissiveIntensity = alarm * strobe * 6;
      alarmLight.intensity = alarm * strobe * 14;
      soundRings.forEach(function (ring, i) {
        var phase = (elapsed * 0.9 + i / 3) % 1;
        ring.scale.setScalar(1 + phase * 4);
        ring.material.opacity = alarm * (1 - phase) * 0.85;
      });
      exitFront.emissiveIntensity = 0.25 + alarm * 1.6;
      exitLight.intensity = alarm * 2.2;
      lamp.intensity = 9 - alarm * 4;

      smoothPointer.x += (pointer.x - smoothPointer.x) * Math.min(1, dt * 3);
      smoothPointer.y += (pointer.y - smoothPointer.y) * Math.min(1, dt * 3);
      var sway = reduce ? 0 : Math.sin(elapsed * 0.12) * 0.35;
      camera.position.set(
        lookTarget.x + (camBase.x - lookTarget.x) * distFactor + sway + smoothPointer.x * 0.45,
        lookTarget.y + (camBase.y - lookTarget.y) * distFactor - smoothPointer.y * 0.25,
        lookTarget.z + (camBase.z - lookTarget.z) * distFactor
      );
      camera.lookAt(lookTarget);

      updateUI(t);
      renderer.render(scene, camera);
      placeLabels(width, height);
    }

    function kick() {
      if (running || !visible || document.hidden) return;
      running = true;
      clock.getDelta();
      requestAnimationFrame(frame);
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0.01 }).observe(root);
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) kick();
    });

    if (pendingStep !== null) {
      progress = STEPS[pendingStep].from + 0.03;
      playing = false;
      resumeAt = performance.now() + 6000;
    }
    if (reduce || pendingStep !== null) prewarm(progress);
    root.classList.add("is-live");
    kick();
  }
})();
