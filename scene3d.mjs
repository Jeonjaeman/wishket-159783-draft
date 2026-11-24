// 히어로 3D 병: 로컬 Three.js(MIT) 절차 생성. 외부 HDRI/텍스처/모델/폰트 없음. 장식용 캔버스 — 모든 정보는 HTML에 있음.
import * as THREE from './vendor/three.module.js';

const MAX_DPR = 1.5;
const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 자작 캔버스 텍스처 ---------- */
function labelTexture() {
  const S = 1024, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#f1e8d6'; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { // 한지 섬유
    g.strokeStyle = `rgba(120,95,60,${0.05 + rnd() * 0.08})`; g.lineWidth = 0.6 + rnd();
    const x = rnd() * S, y = rnd() * S, a = rnd() * Math.PI, l = 10 + rnd() * 50;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,70,45,${rnd() * 0.18})`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  const serif = "'Noto Serif KR','Apple SD Gothic Neo','Nanum Myeongjo',serif";
  g.fillStyle = '#1d2a22'; g.textBaseline = 'top';
  g.font = `500 300px ${serif}`; g.fillText('결', 118, 150);
  g.strokeStyle = '#9b7a4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(120, 500); g.lineTo(560, 500); g.stroke();
  g.font = `500 74px ${serif}`; g.fillText('맑은 결', 122, 536);
  g.font = `300 150px ${serif}`; g.fillStyle = '#2d3b33'; g.fillText('A', 700, 236);
  g.font = `600 30px 'Pretendard Variable',Pretendard,sans-serif`; g.fillStyle = '#7a5f3c';
  g.letterSpacing = '9px'; g.fillText('FICTIONAL COLLECTION', 122, 650);
  g.letterSpacing = '4px'; g.font = `400 26px 'Pretendard Variable',Pretendard,sans-serif`;
  g.fillText('가상 브랜드 · 가상 상품', 122, 708);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function pedestalTexture() {
  const S = 512, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const g = cv.getContext('2d'), c = S / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(184,146,92,0.55)'); grad.addColorStop(0.35, 'rgba(184,146,92,0.12)'); grad.addColorStop(1, 'rgba(184,146,92,0)');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  for (const r of [0.42, 0.62, 0.82]) { // 잔물결
    g.strokeStyle = `rgba(222,200,160,${0.16 - r * 0.12})`; g.lineWidth = 1.4;
    g.beginPath(); g.arc(c, c, c * r, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- 스튜디오 환경: 발광 평면으로 PMREM 생성 ---------- */
function studioEnvironment(renderer) {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x07110d);
  const panel = (w, h, rgb, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...rgb), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...(look || [0, 0, 0])); sc.add(m);
  };
  panel(6, 10, [6, 5.4, 4.4], [-7, 6, 5]);          // 좌상 대형 소프트박스(따뜻한 키)
  panel(1.2, 12, [3.2, 4.2, 4.6], [7, 4, -2]);       // 우측 세로 스트립(차가운 림)
  panel(10, 2, [1.4, 1.1, 0.7], [0, -5, 2], [0, 0, 0]); // 바닥 브론즈 반사
  panel(4, 4, [0.9, 1.0, 0.95], [0, 9, -6]);         // 상단 뒤 희미한 필
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
  const env = pmrem.fromScene(sc, 0.05).texture; pmrem.dispose(); return env;
}

/* ---------- 병 ---------- */
function buildBottle() {
  const profile = [[0, 0.06], [0.5, 0.02], [0.84, 0.07], [0.92, 0.28], [0.935, 3.85], [0.9, 4.25], [0.78, 4.62], [0.58, 4.98], [0.42, 5.3], [0.355, 5.6], [0.35, 6.2], [0.39, 6.3], [0.39, 6.56], [0.33, 6.6], [0, 6.6]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 112), new THREE.MeshPhysicalMaterial({
    color: 0x1b4a34, roughness: 0.07, metalness: 0, transmission: 0.82, thickness: 1.4, ior: 1.5,
    attenuationColor: new THREE.Color(0x0c3421), attenuationDistance: 0.8, clearcoat: 0.7, clearcoatRoughness: 0.08,
    envMapIntensity: 1.35, specularIntensity: 1,
  }));
  glass.castShadow = true; group.add(glass);
  const core = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), new THREE.MeshStandardMaterial({ color: 0x0b2a1c, roughness: 0.55 }));
  core.scale.set(0.9, 0.985, 0.9); group.add(core);
  const tex = labelTexture();
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.05, 64, 1, true, -Math.PI * 0.47, Math.PI * 0.94),
    new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.004, roughness: 0.9 }));
  label.position.y = 2.45; label.castShadow = true; group.add(label);
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, metalness: 0.92, roughness: 0.32 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.46, 48), bronze); cap.position.y = 6.78; cap.castShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.405, 0.365, 0.55, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x5e452a, metalness: 0.9, roughness: 0.4 }));
  collar.position.y = 6.3; group.add(cap, collar);
  return group;
}

/** WebGL 컨텍스트는 이 캔버스 하나만 만든다(사전 탐지용 별도 컨텍스트 없음). 생성 실패 → null(호출자가 대체 SVG 유지).
 *  onReady = 첫 실제 렌더 직후 1회, onLost = 컨텍스트 소실(호출자가 대체 SVG로 복귀), 복원되면 다시 onReady.
 *  @returns {{dispose:()=>void}|null} */
export function mountHeroScene(canvas, { onReady, onLost } = {}) {
  const reduced = prefersReduced();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_DPR));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene(); scene.environment = studioEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
  const bottle = buildBottle(); scene.add(bottle);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.ShadowMaterial({ opacity: 0.38 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const pedestal = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({ map: pedestalTexture(), transparent: true, depthWrite: false }));
  pedestal.rotation.x = -Math.PI / 2; pedestal.position.y = 0.004; pedestal.scale.set(1.25, 1, 1); scene.add(pedestal);

  const key = new THREE.DirectionalLight(0xfff0da, 2.4); key.position.set(4.5, 9, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 9, bottom: -2, near: 1, far: 30 }); key.shadow.camera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0xc2ead6, 1.1); rim.position.set(-6, 5, -4);
  scene.add(key, rim, new THREE.HemisphereLight(0xdfe9e3, 0x071a12, 0.35));

  // 상태: 포인터·스크롤 연동 회전 + 등장 애니메이션
  const target = { ry: 0, rx: 0, rz: 0 }, cur = { ry: -0.9, rx: 0, rz: 0, y: -0.7 };
  let idle = 0, scroll = 0, raf = 0, inView = false, ready = false, dirty = true, t0 = -1;
  const pointer = { x: 0, y: 0 };

  const resize = () => {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const narrow = camera.aspect < 0.9;
    camera.position.set(0, 3.5, narrow ? 19.5 : 15.5); camera.lookAt(0, 3.15, 0); dirty = true;
    if (reduced) renderOnce();
  };
  const renderOnce = () => {
    bottle.rotation.set(0.02, 0.18, 0); bottle.position.y = 0; renderer.render(scene, camera); markReady();
  };
  const markReady = () => { if (!ready) { ready = true; onReady && onReady(); } };

  const frame = (now) => {
    raf = 0; if (!inView) return;
    if (t0 < 0) t0 = now;
    const intro = Math.min(1, Math.max(0, now - t0) / 1500), e = 1 - Math.pow(1 - intro, 3); // 첫 프레임 dt = 0
    idle += 0.0022;
    target.ry = 0.18 + idle + pointer.x * 0.55 + scroll * 1.1;
    target.rx = 0.02 + pointer.y * 0.07; target.rz = -pointer.x * 0.035;
    cur.ry += (target.ry - cur.ry) * 0.07; cur.rx += (target.rx - cur.rx) * 0.07; cur.rz += (target.rz - cur.rz) * 0.07;
    cur.y = -0.7 * (1 - e);
    bottle.rotation.set(cur.rx, cur.ry - 0.9 * (1 - e), cur.rz); bottle.position.y = cur.y;
    renderer.render(scene, camera); markReady();
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && inView && !document.hidden) raf = reduced ? 0 : requestAnimationFrame(frame); if (reduced && inView && dirty) { dirty = false; renderOnce(); } };

  const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }, { threshold: 0.05 });
  io.observe(canvas);
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    pointer.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
  };
  const onLeave = () => { pointer.x = 0; pointer.y = 0; };
  const onScroll = () => { const h = canvas.closest('section') || canvas; scroll = Math.min(1, Math.max(0, -h.getBoundingClientRect().top / Math.max(1, h.offsetHeight))); };
  const onVis = () => kick();
  const onCtxLost = (e) => { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; ready = false; onLost && onLost(); };
  const onCtxRestored = () => { dirty = true; kick(); };
  canvas.addEventListener('webglcontextlost', onCtxLost); canvas.addEventListener('webglcontextrestored', onCtxRestored);
  if (!reduced) {
    addEventListener('pointermove', onMove, { passive: true }); addEventListener('pointerleave', onLeave);
    addEventListener('scroll', onScroll, { passive: true }); document.addEventListener('visibilitychange', onVis);
  }
  resize();
  return {
    dispose() {
      io.disconnect(); ro.disconnect(); if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onCtxLost); canvas.removeEventListener('webglcontextrestored', onCtxRestored);
      removeEventListener('pointermove', onMove); removeEventListener('pointerleave', onLeave);
      removeEventListener('scroll', onScroll); document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } });
      scene.environment?.dispose(); renderer.dispose();
    },
  };
}
