import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(resolve(root, f), 'utf8');
const html = read('index.html'), css = read('style.css'), app = read('app.mjs'), scene = read('scene3d.mjs'), core = read('core.mjs');
const count = (s, re) => (s.match(re) || []).length;

test('필수 파일·로컬 자원·라이선스 존재, 빌드 불필요', () => {
  for (const f of ['index.html', 'style.css', 'app.mjs', 'core.mjs', 'scene3d.mjs', 'README.md', 'package.json',
    'vendor/three.module.js', 'vendor/three.core.js', 'vendor/THREE_LICENSE.txt', 'assets/fonts/PretendardVariable.woff2', 'assets/fonts/OFL.txt'])
    assert.ok(existsSync(resolve(root, f)), `${f} 없음`);
  assert.ok(statSync(resolve(root, 'vendor/three.module.js')).size > 100000);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.test, 'node --test tests/*.test.mjs');
  assert.ok(!pkg.dependencies && !pkg.devDependencies);
});

test('외부 로드 없음: 원격 URL·외부 폰트·HDRI·모델·분석 스크립트 금지', () => {
  for (const [name, src] of [['index.html', html], ['style.css', css], ['app.mjs', app], ['scene3d.mjs', scene], ['core.mjs', core]]) {
    assert.ok(!/https?:\/\//.test(src), `${name}에 원격 URL`);
    assert.ok(!/@import|fonts\.googleapis|\.hdr\b|\.exr\b|\.gltf\b|\.glb\b/i.test(src), `${name}에 외부 자원`);
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|gtag|dataLayer/.test(src), `${name}에 저장/전송`);
  }
  assert.match(scene, /from '\.\/vendor\/three\.module\.js'/);
  assert.match(css, /url\('\.\/assets\/fonts\/PretendardVariable\.woff2'\)/);
  assert.ok(html.includes('<script type="module" src="./app.mjs">') && count(html, /<script/g) === 1);
  assert.ok(!/<img/.test(html), '빌려온 사진 없음(자작 SVG/캔버스만)');
});

test('3D 장면: 절차 생성 병·물리 유리·라벨 캔버스·PMREM·픽셀비 1.5·가시 영역 렌더·모션 축소 정적', () => {
  for (const k of ['LatheGeometry', 'MeshPhysicalMaterial', 'transmission', 'CanvasTexture', 'PMREMGenerator', 'fromScene', 'ShadowMaterial', 'castShadow', 'receiveShadow', 'IntersectionObserver', 'ResizeObserver', 'pointermove', 'prefers-reduced-motion'])
    assert.ok(scene.includes(k), `scene3d.mjs에 ${k} 없음`);
  assert.match(scene, /MAX_DPR = 1\.5/);
  assert.match(scene, /failIfMajorPerformanceCaveat/);
  assert.ok(!/console\./.test(scene) && !/console\./.test(app), '콘솔 출력 없음');
  assert.match(scene, /FICTIONAL COLLECTION/);
  assert.ok(!/(?:^|[^A-Za-z])(?:ABV|alc\.|720\s?ml|1800\s?ml|Niigata|Kyoto|Hyogo)/i.test(scene + html + app), '도수·용량·산지 사실 없음');
});

test('히어로: 문구·CTA 앵커·캔버스 장식·SVG 대체·정적 렌더 계약', () => {
  assert.ok(html.includes('오늘의 취향에,') && html.includes('한 병의 발견.'));
  assert.ok(html.includes('취향과 음식, 예산을 따라 가상의 상품을 살펴보는 큐레이션 시연입니다.'));
  assert.match(html, /href="#quiz"[^>]*>내 취향 찾아보기</);
  assert.match(html, /href="#collection"[^>]*>전체 상품 보기</);
  assert.match(html, /<canvas class="hero-canvas" aria-hidden="true">/);
  assert.match(html, /<svg class="hero-fallback"[^>]*role="img"/);
  assert.ok(count(html, /<(linear|radial)Gradient/g) >= 6, '대체 SVG 그라디언트');
  assert.ok(html.includes('결 · SAKE CURATION') && html.includes('가상 브랜드'));
  assert.match(css, /\.hero-title \{ font-size: clamp\(40px, .*80px\)/);
  assert.match(css, /\.hero \{[^}]*overflow: hidden/);
});

test('구조: GNB 3항목·가격 모드 제어·퀴즈·컬렉션·이야기·직원 패널·푸터·다이얼로그', () => {
  for (const a of ['#collection', '#quiz', '#story']) assert.ok(html.includes(`href="${a}"`), `GNB ${a}`);
  for (const id of ['id="collection"', 'id="quiz"', 'id="story"', 'id="mode-switch"', 'id="quiz-panel"', 'id="cards"', 'id="search"', 'id="staff-table"', 'id="detail"']) assert.ok(html.includes(id), id);
  assert.ok(html.includes('컬렉션') && html.includes('내 취향 찾기') && html.includes('큐레이션 이야기'));
  assert.ok(html.includes('시연용 가격 모드 · 직원 인증 미구현'));
  assert.match(html, /<details class="staff-panel">/);
  assert.match(html, /<dialog class="detail" id="detail" aria-labelledby="detail-title">/);
  assert.ok(html.includes('<footer') && html.includes('실제 구매·주문·결제·회원 기능이 없습니다'));
  for (const axis of ['단맛', '드라이', '산미', '감칠맛', '바디', '향']) assert.ok(html.includes(axis));
});

test('입력 의미: 모든 버튼 type=button, 폼은 제출 차단, 검색은 이름·태그 전용 비개인정보', () => {
  const buttons = html.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttons.length >= 2);
  for (const b of buttons) assert.match(b, /type="button"/, b);
  const dyn = app.match(/<button\b[^>]*>/g) || [];
  for (const b of dyn) assert.match(b, /type="button"/, b);
  assert.match(app, /addEventListener\('submit', \(e\) => e\.preventDefault\(\)\)/);
  assert.match(html, /<input type="search" name="q" id="search"[^>]*autocomplete="off"/);
  assert.ok(!/type="(email|tel|password)"|name="(name|phone|email)"/.test(html));
  assert.ok(!/<form[^>]*action=/.test(html));
  assert.ok(!/<a[^>]*href="(https?:|mailto:|tel:)/.test(html), '외부·주문 링크 없음');
  assert.ok(!/(주문하기|구매하기|장바구니|결제하기|QR 생성하기)/.test(html + app), '주문·구매·QR 없음');
});

test('접근성 계약: 스킵 링크·메뉴 토글 aria·포커스 트랩·inert·Escape·라이브 영역·44px', () => {
  assert.match(html, /<a class="skip" href="#main">/);
  assert.match(html, /aria-expanded="false" aria-controls="menu" aria-label="메뉴 열기"/);
  assert.ok(app.includes(".inert = open") && app.includes("e.key === 'Escape'") && app.includes("e.key !== 'Tab'"));
  assert.match(html, /aria-live="polite" id="quiz-live"/);
  assert.ok(app.includes("role=\"radiogroup\"") && app.includes('aria-checked'));
  assert.ok(app.includes("tabindex=\"-1\"") && app.includes("h.focus()"));
  assert.ok(app.includes('lastTrigger?.focus?.()'), '다이얼로그 닫힘 후 포커스 복귀');
  assert.match(app, /dialog\.addEventListener\('cancel'/);
  for (const sel of ['.btn', '.menu-toggle', '.chip', '.choice', '.segmented button', '.dialog-close', '.search input'])
    assert.ok(new RegExp(sel.replace(/[.$]/g, '\\$&') + ' \\{[^}]*(min-height|height|width): (4[4-9]|[5-9]\\d)px').test(css), `${sel} 44px`);
  assert.match(css, /\.demo-band \{ font-size: 12px/);
});

test('타이포·레이아웃 규칙: keep-all, 통화 nowrap, 수평 넘침 차단, 불투명 다이얼로그, transform 전환, 모션 축소', () => {
  assert.match(css, /body \{[^}]*word-break: keep-all/);
  assert.match(css, /h1, h2, h3, h4 \{[^}]*word-break: keep-all/);
  assert.match(css, /\.won \{ white-space: nowrap/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /\.detail \{[^}]*background: var\(--cream\);[^}]*opacity: 1/);
  assert.match(css, /\.detail \{[^}]*transition: transform/);
  assert.match(css, /\.detail::backdrop/);
  assert.ok(!/\.detail \{[^}]*transition:[^;]*opacity/.test(css), '다이얼로그 표면은 opacity 전환 없음');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.ok(css.includes('max-width: 899.98px') && css.includes('max-width: 767.98px') && css.includes('max-width: 479.98px'));
  assert.match(css, /minmax\(min\(100%, 230px\), 1fr\)/, '320px에서도 카드가 넘치지 않음');
});

test('가격 모드는 한 번에 하나만: 템플릿에 양쪽 가격을 동시에 찍는 코드 없음', () => {
  assert.ok(!/prices\.store[\s\S]{0,80}prices\.retail|prices\.retail[\s\S]{0,80}prices\.store/.test(app), 'app.mjs에서 두 가격 동시 출력 금지');
  assert.ok(!/prices\./.test(app), 'app.mjs는 priceOf(product, state.mode)만 사용');
  assert.ok(count(app, /priceOf\(/g) >= 2);
  assert.ok(app.includes('staffInventory(state.mode)'));
  assert.ok(app.includes("if (dialog.open) renderDetail()"), '모드 전환 시 열린 상세도 갱신');
  assert.ok(app.includes('RESULT_CAPTION') && count(app, /RESULT_CAPTION/g) >= 2);
  assert.ok(!/(AI|인공지능|LLM|머신러닝)/.test(html + app), 'AI 주장 없음');
});

test('등장 모션: JS 없이 모든 글자 기본 표시, translate 전용(opacity 0 콘텐츠 없음), 0.5~0.9s ease-out, 모션 축소 정적', () => {
  const block = (sel) => (css.match(new RegExp(sel.replace(/[.$()*+?[\]\\^|]/g, '\\$&') + ' \\{([^}]*)\\}')) || [])[1] || '';
  for (const sel of ['.hero-title .line > span', '.hero-lead', '.hero-actions', '.hero-note', '.annotation', '.reveal', '.hero-stage'])
    assert.ok(!/opacity: 0|translateY\(110%\)/.test(block(sel)), `${sel} 기본 상태가 숨김`);
  assert.ok(!/@keyframes (rise|slide|note)[^}]*opacity/.test(css), '등장 키프레임은 transform만');
  assert.match(css, /\.reveal \{ transform: translateY\(18px\); transition: transform/);
  for (const m of css.matchAll(/\.is-ready [^{]+\{ animation: \w+ (\.\d+|\d\.\d+)s/g)) {
    const s = Number(m[1]); assert.ok(s >= 0.5 && s <= 0.9, `${m[0]} 등장 ${s}s (0.5~0.9s 밖)`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.is-ready \.hero-title \.line > span[^}]*animation: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.quiz \{ --open: 1 !important; \}/);
});

test('3D ↔ 대체 SVG: 첫 렌더 뒤 visibility 원자 교체(알파 혼합 없음), 단일 WebGL 컨텍스트, 소실 시 대체 유지, 첫 프레임 dt 0', () => {
  assert.match(css, /\.hero-canvas \{ visibility: hidden; \}/);
  assert.match(css, /\.is-3d \.hero-canvas \{ visibility: visible; \}/);
  assert.match(css, /\.is-3d \.hero-fallback \{ visibility: hidden; \}/);
  assert.ok(!/\.hero-canvas \{[^}]*(opacity|transition)/.test(css) && !/\.hero-fallback \{[^}]*(opacity|transition)/.test(css), '캔버스/대체에 opacity 전환 없음');
  assert.ok(!/getContext\(['"]webgl/.test(scene) && !/supportsWebGL/.test(scene + app), '사전 탐지용 WebGL 컨텍스트 없음');
  assert.equal(count(scene, /new THREE\.WebGLRenderer\(/g), 1);
  assert.match(scene, /renderer\.render\(scene, camera\); markReady\(\)/, 'onReady는 실제 render 뒤');
  assert.ok(scene.includes("'webglcontextlost'") && scene.includes("'webglcontextrestored'") && scene.includes('onLost && onLost()'));
  assert.match(app, /onLost: \(\) => stage\.classList\.remove\('is-3d'\)/);
  assert.match(scene, /t0 = -1/); assert.match(scene, /if \(t0 < 0\) t0 = now;/); assert.match(scene, /Math\.max\(0, now - t0\)/);
});

test('히어로 → 퀴즈 마스크 장면: 히어로 바로 다음 #quiz, 장식 레이어(::before)만 clip-path, 글자는 위, 기본값·축소 = 완결', () => {
  const heroEnd = html.indexOf('</section>'), quizAt = html.indexOf('<section class="quiz section" id="quiz"');
  assert.ok(quizAt > heroEnd && !/<section/.test(html.slice(heroEnd, quizAt)), '히어로와 퀴즈 사이 다른 섹션 없음');
  assert.match(css, /\.quiz \{ --open: 1;[^}]*position: relative; isolation: isolate/);
  assert.match(css, /\.quiz::before \{[^}]*z-index: -1;[^}]*clip-path: inset\(calc\(var\(--my\) \* \(1 - var\(--open\)\)\) calc\(var\(--mx\) \* \(1 - var\(--open\)\)\) round/);
  assert.ok(!/\.quiz-panel \{[^}]*clip-path|\.section-head \{[^}]*clip-path/.test(css), '본문 요소에 clip-path 없음');
  assert.match(app, /sec\.style\.setProperty\('--open'/); assert.match(app, /if \(reduced\) return;/);
  assert.match(css, /\.section \{ padding: clamp\(96px, 60px \+ 7vw, 168px\) var\(--gutter\)/, '섹션 상하 여백 1440≥160·390≥96');
});

test('글자 크기 12px 미만 0: CSS px·HTML SVG font-size·템플릿', () => {
  for (const m of css.matchAll(/font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `style.css font-size ${m[1]}px`);
  for (const m of css.matchAll(/clamp\((\d+(?:\.\d+)?)px/g)) assert.ok(Number(m[1]) >= 12, `style.css clamp 최소 ${m[1]}px`);
  for (const m of html.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)) assert.ok(Number(m[1]) >= 12, `index.html SVG font-size ${m[1]}`);
  assert.ok(!/font-size/.test(app), 'app.mjs 템플릿에 인라인 글자 크기 없음');
  for (const sel of ['.ann-id', '.card-id', '.r-label']) assert.match(css, new RegExp(sel.replace('.', '\\.') + ' \\{[^}]*font-size: 12px'));
});

test('README: 실행법·규칙·제외 기능·라이선스·레퍼런스 출처', () => {
  const md = read('README.md');
  for (const k of ['python -m http.server 8795', 'npm test', '매장가', '소매가', '+3', '+2', '제외', 'Pretendard', 'OFL', 'MIT', 'awwwards.com', 'webjangi.com', 'claude-fable-5-1'])
    assert.ok(md.includes(k), `README에 ${k} 없음`);
  assert.ok(!/탱탱소프트|PLANS|buzz:\/\/|인계서|HANDOFF/i.test(md), '내부 문서 경로 복사 금지');
});

test('B1 회귀: 가격 모드 클릭 뒤 교체된 라디오로 포커스 복귀 — 데스크톱(1440/1366/1024)에서도, 메뉴 열림 조건 없이', () => {
  const handler = app.match(/\$\('#mode-switch'\)\.addEventListener\('click', \(e\) => \{([\s\S]*?)\n\}\);/);
  assert.ok(handler, '모드 전환 클릭 핸들러');
  const body = handler[1];
  assert.match(body, /renderAll\(\);/);
  assert.match(body, /\$\(`#mode-switch \[data-mode="\$\{state\.mode\}"\]`\)\?\.focus\(\);/, '현재 모드의 교체 라디오로 focus');
  assert.ok(!/menu-open/.test(body), '포커스 복귀가 header.menu-open에 묶이지 않음(데스크톱에서 body로 떨어지지 않음)');
  assert.ok(body.indexOf('renderAll();') < body.indexOf('.focus()'), '다시 그린 뒤에 focus');
  assert.ok(app.includes("state.mode = b.dataset.mode; renderAll();"), '영향 받는 컨트롤은 모두 state.mode에서 다시 계산');
  // 모바일 메뉴 계약 유지: no-scroll · 포커스 트랩 · Escape
  assert.ok(app.includes("document.body.classList.toggle('no-scroll', open)"));
  assert.match(app, /document.addEventListener\('keydown'/);
  assert.match(app, /if \(e.key === 'Escape'\) \{ e.preventDefault\(\); setMenu\(false\); return; \}/);
  assert.match(app, /!menu.contains\(document.activeElement\)/);
  assert.match(css, /body\.no-scroll \{ overflow: hidden; \}/);
});

test('B2·개선 회귀: 한국어 어절 묶음 — 퀴즈 제목 ‘오늘의 한 병’ nowrap, 상품명은 접두(ID)·표시명 조각으로만 줄바꿈, 320 결과 카드 축소', () => {
  assert.match(css, /\.nowrap \{ white-space: nowrap; \}/, 'nowrap 유틸리티');
  assert.ok(html.includes('<h2 id="quiz-title">세 가지만 고르면, <span class="nowrap">오늘의 한 병</span></h2>'), '퀴즈 제목: 앞 절은 줄바꿈 가능, ‘오늘의 한 병’은 한 덩이');
  assert.ok(!/<span class="nowrap">세 가지만 고르면, 오늘의 한 병<\/span>/.test(html), '문장 전체를 nowrap으로 묶지 않음(320 넘침 방지)');
  // 상품명 조각: core의 name 형식 '가상 사케 {ID} · {표시명}'을 ' · ' 기준으로 나눠 각 조각 nowrap
  assert.match(core, /name: `가상 사케 \$\{id\} · \$\{short\}`/);
  assert.match(app, /const nameHtml = \(p\) => \{ const i = p\.name\.indexOf\(' · '\);/);
  assert.match(app, /<span class="nowrap">\$\{esc\(p\.name\.slice\(0, i\)\)\}<\/span> · <span class="nowrap">\$\{esc\(p\.name\.slice\(i \+ 3\)\)\}<\/span>/);
  assert.ok(app.includes('<h4>${nameHtml(p)}</h4>'), '결과 카드 이름');
  assert.ok(app.includes('<h3>${nameHtml(p)}</h3>'), '컬렉션 카드 이름');
  assert.ok(app.includes('<h2 id="detail-title">${nameHtml(p)}</h2>'), '상세 제목');
  assert.ok(!/<h4>\$\{esc\(p\.name\)\}<\/h4>|<h3>\$\{esc\(p\.name\)\}<\/h3>/.test(app), '이름 제목에 평문 출력 없음');
  assert.ok(app.includes('aria-label="${esc(p.name)} 상세 보기"'), '접근 가능한 이름은 평문 그대로');
  assert.match(css, /@media \(max-width: 479\.98px\) \{ \.result-card \{ grid-template-columns: 44px 1fr; gap: 12px; padding: 14px; \}/, '320 결과 카드: 글리프 열 축소로 이름 조각 한 줄 확보');
  assert.match(css, /\.result-main h4 \{ font-size: 20px; \}/, '글자 크기 기준선 유지');
});

test('detail reuses the material-rich authored bottle with isolated SVG identifiers', () => {
  assert.match(app, /hero-fallback'\).cloneNode\(true\)/);
  assert.match(app, /class', 'detail-bottle'/);
  assert.match(app, /detail-\$\{p.id\}-/);
  assert.match(app, /\$\{detailBottle\(p\)\}/);
});
