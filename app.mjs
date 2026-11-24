// 결 · SAKE CURATION — 클라이언트 전용 UI. 저장·네트워크·분석 없음. 새로고침 시 초기화.
import {
  PRICE_MODES, STYLES, FOODS, BUDGETS, AXES, RESULT_CAPTION, STAFF_NOTE, STATUS_LABEL,
  byId, filterProducts, formatWon, labelOf, modeLabel, priceOf, radarPoints, recommend,
  staffInventory, tagsOf, tasteList, createQuizState, quizReducer, quizQuery,
} from './core.mjs';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => `<span class="won">${formatWon(n)}</span>`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = { mode: 'store', quiz: createQuizState(), filter: { query: '', style: 'any', food: 'any' }, openId: null };
let lastTrigger = null;

/* ---------- 공용 조각 ---------- */
const bottleGlyph = (p, cls = '') => `<svg class="glyph ${cls}" viewBox="0 0 60 140" aria-hidden="true" style="--h:${p.hue}">
  <path d="M26 8q4-2 8 0v16q0 4 2 6 10 14 10 34v62q0 8-8 8H22q-8 0-8-8V64q0-20 10-34 2-2 2-6z" class="glyph-body"/>
  <path d="M24 44v74" class="glyph-hi"/><rect x="18" y="74" width="24" height="30" class="glyph-label"/>
  <rect x="27" y="2" width="6" height="8" rx="1" class="glyph-cap"/></svg>`;
const tagList = (p) => `<ul class="tags">${tagsOf(p).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
const stockBadge = (p) => p.status === 'soldout' ? '<span class="badge badge-out">품절</span>' : `<span class="badge">재고 ${p.stock}</span>`;
const priceLine = (p) => `<p class="price">${won(priceOf(p, state.mode))} <small>${esc(modeLabel(state.mode))}</small></p>`;
const choiceButtons = (list, value, name, extra = (o) => '') => list.map((o) =>
  `<button type="button" class="choice" role="radio" aria-checked="${value === o.key}" data-field="${name}" data-value="${esc(o.key)}">${esc(o.label)}${extra(o)}</button>`).join('');

/* ---------- 가격 모드 ---------- */
function renderModeSwitch() {
  $('#mode-switch').innerHTML = PRICE_MODES.map((m) =>
    `<button type="button" role="radio" aria-checked="${state.mode === m.key}" data-mode="${m.key}">${esc(m.label)}</button>`).join('');
}
$('#mode-switch').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]'); if (!b || b.dataset.mode === state.mode) return;
  state.mode = b.dataset.mode; renderAll();
  // Rendering replaces the focused radio button; retain keyboard context.
  if (header.classList.contains('menu-open')) $(`[data-mode="${state.mode}"]`)?.focus();
  announce(`가격 모드가 ${modeLabel(state.mode)}로 바뀌었습니다. 예산 조건과 결과를 다시 계산했습니다.`);
});

/* ---------- 헤더 메뉴 (모바일 불투명 패널, 포커스 트랩, inert) ---------- */
const header = $('.site-header'), menu = $('#menu'), toggle = $('.menu-toggle');
const mq = matchMedia('(min-width: 900px)');
function setMenu(open) {
  header.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  ['#main', '.site-footer', '.demo-band'].forEach((s) => { const el = $(s); if (el) el.inert = open; });
  document.body.classList.toggle('no-scroll', open);
  if (open) $('a', menu).focus(); else toggle.focus();
}
toggle.addEventListener('click', () => setMenu(!header.classList.contains('menu-open')));
$('.menu-close').addEventListener('click', () => setMenu(false));
menu.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]') && !mq.matches) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (!header.classList.contains('menu-open')) return;
  if (e.key === 'Escape') { e.preventDefault(); setMenu(false); return; }
  if (e.key !== 'Tab') return;
  const f = [...menu.querySelectorAll('a,button:not([disabled])')], first = f[0], last = f[f.length - 1];
  if (!menu.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
mq.addEventListener('change', () => { if (mq.matches && header.classList.contains('menu-open')) setMenu(false); });

/* ---------- 라이브 안내 ---------- */
const live = $('#quiz-live');
function announce(msg) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); }

/* ---------- 히어로 ---------- */
function renderHeroAnnotation() {
  const a = byId('A');
  $('#hero-annotation').innerHTML = `<p class="ann-name">${esc(a.short)} <span class="ann-id">${a.id}</span></p>
    <p class="ann-tags">${tagsOf(a).map(esc).join(' · ')}</p><p class="ann-price">${won(priceOf(a, state.mode))} <small>${esc(modeLabel(state.mode))}</small></p>`;
}
async function mountHero() {
  const stage = $('.hero-stage'), canvas = $('.hero-canvas');
  try {
    const { mountHeroScene } = await import('./scene3d.mjs');
    // 첫 실제 3D 프레임 뒤에만 is-3d → CSS visibility가 캔버스/대체 SVG를 한 번에 교체. 소실 시 제거 → 대체 SVG, 빈 무대 없음.
    const ctl = mountHeroScene(canvas, { onReady: () => stage.classList.add('is-3d'), onLost: () => stage.classList.remove('is-3d') });
    if (!ctl) stage.classList.add('is-fallback');
  } catch { stage.classList.add('is-fallback'); }
}

/* ---------- 히어로 → 퀴즈 마스크 장면 (CSS --open 0→1, 장식 레이어만. 기본값 1 = JS 없음·모션 축소 완결) ---------- */
function setupMaskScene() {
  const sec = $('#quiz'); if (reduced) return;
  let tick = 0;
  const update = () => {
    tick = 0;
    const top = sec.getBoundingClientRect().top, vh = innerHeight || 1;
    sec.style.setProperty('--open', Math.min(1, Math.max(0, (vh - top) / (vh * 0.7))).toFixed(3)); // 섹션 상단이 화면 아래 끝 → 0, 30% 지점 → 1
  };
  const req = () => { if (!tick) tick = requestAnimationFrame(update); };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); update();
}

/* ---------- 퀴즈 ---------- */
const quizPanel = $('#quiz-panel');
const stepMeta = [
  { title: '예산은 어느 정도로 생각하세요?', hint: () => `선택한 가격 모드(${modeLabel(state.mode)}) 기준 최대 금액입니다.` },
  { title: '어떤 스타일이 끌리나요?', hint: () => '산뜻·묵직·향긋 중 하나, 또는 상관없음.' },
  { title: '어떤 음식과 함께 하나요?', hint: () => '해산물·구이 중 하나, 또는 상관없음.' },
];
function dispatch(action) {
  const prev = state.quiz; state.quiz = quizReducer(prev, action); renderQuiz();
  if (state.quiz.step !== prev.step || action.type === 'reset') {
    const h = $('#quiz-step-title'); if (h) h.focus();
    if (state.quiz.step === 3) { const r = recommend(quizQuery(state.quiz, state.mode)); announce(`${r.title}. ${r.items.map((i) => i.product.short).join(', ')}`); }
    else announce(`${state.quiz.step + 1}단계. ${stepMeta[state.quiz.step].title}`);
  } else if (state.quiz.error) announce(state.quiz.error);
}
function renderQuiz() {
  const q = state.quiz, step = q.step;
  const progress = `<ol class="steps" aria-label="진행 단계">${['예산', '스타일', '음식', '결과'].map((n, i) =>
    `<li class="${i === step ? 'is-current' : i < step ? 'is-done' : ''}" ${i === step ? 'aria-current="step"' : ''}>${n}</li>`).join('')}</ol>`;
  const summary = `<p class="quiz-summary">${[q.budget != null && `예산 ${formatWon(q.budget)} 이하`, q.style && `스타일 ${labelOf(STYLES, q.style)}`, q.food && `음식 ${labelOf(FOODS, q.food)}`].filter(Boolean).map(esc).join(' · ') || '아직 선택한 조건이 없습니다.'}</p>`;
  let body;
  if (step < 3) {
    const m = stepMeta[step];
    const opts = step === 0
      ? BUDGETS.map((b) => ({ key: String(b), label: `${formatWon(b)} 이하` }))
      : step === 1 ? STYLES : FOODS;
    const field = ['budget', 'style', 'food'][step];
    const value = step === 0 ? (q.budget == null ? null : String(q.budget)) : q[field];
    body = `<h3 id="quiz-step-title" class="quiz-q" tabindex="-1">${esc(m.title)}</h3><p class="quiz-hint">${esc(m.hint())}</p>
      <div class="choices" role="radiogroup" aria-labelledby="quiz-step-title">${choiceButtons(opts, value, field)}</div>
      ${q.error ? `<p class="quiz-error" role="alert">${esc(q.error)}</p>` : ''}
      <div class="quiz-nav">
        <button type="button" class="btn btn-ghost" data-act="back" ${step === 0 ? 'disabled' : ''}>이전</button>
        <button type="button" class="btn btn-primary" data-act="next">${step === 2 ? '결과 보기' : '다음'}</button>
        <button type="button" class="btn btn-text" data-act="reset">처음부터</button>
      </div>`;
  } else {
    const r = recommend(quizQuery(q, state.mode));
    const items = r.items.map(({ product: p, score, reasons }) => `<li class="result-card">
        ${bottleGlyph(p)}<div class="result-main"><h4>${esc(p.name)}</h4>${tagList(p)}
        <ul class="reasons">${reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${priceLine(p)}${r.kind === 'match' ? `<p class="score">일치 점수 ${score}</p>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" data-open="${p.id}">상세 보기</button></div></li>`).join('');
    body = `<h3 id="quiz-step-title" class="quiz-q" tabindex="-1">${esc(r.title)}</h3>
      ${r.kind === 'budget' ? '<p class="quiz-hint">스타일·음식을 모두 ‘상관없음’으로 두셔서 취향 점수 없이 예산 안의 상품을 ID 순서로 보여 드립니다.</p>' : ''}
      ${r.kind === 'empty' ? `<div class="empty"><p>선택한 가격 모드(${esc(modeLabel(state.mode))})와 예산 ${esc(formatWon(q.budget))} 이하에서 조건에 맞는 판매 중 상품이 없습니다.</p>
          <button type="button" class="btn btn-primary" data-act="goto" data-step="0">조건 다시 선택</button></div>`
        : `<ol class="results">${items}</ol>`}
      <p class="caption">${esc(RESULT_CAPTION)}</p>
      <div class="quiz-nav">
        <button type="button" class="btn btn-ghost" data-act="goto" data-step="2">조건 바꾸기</button>
        <button type="button" class="btn btn-text" data-act="reset">처음부터</button>
        <a class="btn btn-text" href="#collection">전체 목록으로</a>
      </div>`;
  }
  quizPanel.innerHTML = progress + summary + body;
}
quizPanel.addEventListener('click', (e) => {
  const c = e.target.closest('.choice');
  if (c) { const f = c.dataset.field; dispatch({ type: 'set', field: f, value: f === 'budget' ? Number(c.dataset.value) : c.dataset.value }); return; }
  const o = e.target.closest('[data-open]'); if (o) { openDetail(o.dataset.open, o); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  dispatch(a.dataset.act === 'goto' ? { type: 'goto', step: Number(a.dataset.step) } : { type: a.dataset.act });
});

/* ---------- 컬렉션 ---------- */
const form = $('#filters');
form.addEventListener('submit', (e) => e.preventDefault());
$('#search').addEventListener('input', (e) => { state.filter.query = e.target.value; renderCollection(); });
function renderFilterChips() {
  const chip = (list, name, value) => `<span class="chips-label">${name === 'style' ? '스타일' : '음식'}</span>` +
    list.map((o) => `<button type="button" class="chip" aria-pressed="${value === o.key}" data-filter="${name}" data-value="${o.key}">${esc(o.key === 'any' ? '전체' : o.label)}</button>`).join('');
  $('#filter-style').innerHTML = chip(STYLES, 'style', state.filter.style);
  $('#filter-food').innerHTML = chip(FOODS, 'food', state.filter.food);
}
form.addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  state.filter[b.dataset.filter] = b.dataset.value; renderFilterChips(); renderCollection();
});
function renderCollection() {
  const list = filterProducts(state.filter);
  $('#collection-count').textContent = list.length ? `상품 ${list.length}개 · ${modeLabel(state.mode)} 기준` : '검색 조건에 맞는 상품이 없습니다.';
  $('#cards').innerHTML = list.map((p) => `<li class="card ${p.status === 'soldout' ? 'is-out' : ''}">
    <button type="button" class="card-hit" data-open="${p.id}" aria-label="${esc(p.name)} 상세 보기">
      <figure class="card-figure">${bottleGlyph(p)}</figure>
      <div class="card-body"><p class="card-id">${p.id}</p><h3>${esc(p.name)}</h3>${tagList(p)}
        <div class="card-foot">${priceLine(p)}${stockBadge(p)}</div></div>
    </button></li>`).join('');
}
$('#cards').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) openDetail(b.dataset.open, b); });

/* ---------- 이야기 · 직원 패널 ---------- */
function renderStory() {
  const a = byId('A');
  $('#story-axes').innerHTML = tasteList(a.taste).map(({ axis, value }) =>
    `<li><span>${esc(axis)}</span><i style="--v:${value}"></i><b>${value}</b></li>`).join('');
}
function renderStaff() {
  const rows = staffInventory(state.mode);
  $('#staff-table').innerHTML = `<caption class="sr-only">전체 상품 재고·상태 (${esc(modeLabel(state.mode))}, 읽기 전용 샘플)</caption>
    <thead><tr><th scope="col">ID</th><th scope="col">상품</th><th scope="col">${esc(modeLabel(state.mode))}</th><th scope="col">재고</th><th scope="col">상태</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="st-${esc(r.status)}"><td>${r.id}</td><td>${esc(r.name)}</td><td>${won(r.price)}</td><td>${r.stock}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody>`;
}

/* ---------- 상세 다이얼로그 ---------- */
const dialog = $('#detail'), detailBody = $('#detail-body');
function radarSvg(taste) {
  const S = 240, c = S / 2, rings = [1, 2, 3, 4, 5];
  const pts = radarPoints(taste, S).map((p) => p.join(',')).join(' ');
  const grid = rings.map((v) => `<polygon points="${radarPoints([v, v, v, v, v, v], S).map((p) => p.join(',')).join(' ')}" class="r-grid"/>`).join('');
  const spokes = radarPoints([5, 5, 5, 5, 5, 5], S).map(([x, y]) => `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="r-grid"/>`).join('');
  const labels = radarPoints([5, 5, 5, 5, 5, 5], S, 8).map(([x, y], i) => `<text x="${x}" y="${y}" class="r-label" text-anchor="middle" dominant-baseline="middle">${AXES[i]}</text>`).join('');
  return `<svg class="radar" viewBox="0 0 ${S} ${S}" role="img" aria-label="6축 맛 그래프: ${tasteList(taste).map((t) => `${t.axis} ${t.value}`).join(', ')}">${grid}${spokes}<polygon points="${pts}" class="r-fill"/>${labels}</svg>`;
}
function detailBottle(p) {
  // Reuse the authored material-rich hero fallback, not a flat list thumbnail.
  const svg = document.querySelector('.hero-fallback').cloneNode(true);
  svg.setAttribute('class', 'detail-bottle');
  svg.setAttribute('aria-label', `가상 사케 ${p.id} ${p.short} — 유리병·종이 라벨 구성 예시`);
  const prefix = `detail-${p.id}-`;
  for (const node of svg.querySelectorAll('[id]')) node.id = prefix + node.id;
  for (const node of svg.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (attr.value.includes('url(#')) node.setAttribute(attr.name, attr.value.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`));
    }
  }
  for (const text of svg.querySelectorAll('text')) {
    if (text.textContent === 'A') text.textContent = p.id;
    if (text.textContent === '맑은 결') text.textContent = p.short;
  }
  return svg.outerHTML;
}
function renderDetail() {
  const p = state.openId && byId(state.openId); if (!p) return;
  detailBody.innerHTML = `<header class="detail-head"><p class="kicker">가상 상품 ${p.id} · ${esc(STATUS_LABEL[p.status])}</p>
      <h2 id="detail-title">${esc(p.name)}</h2>${tagList(p)}
      <button type="button" class="dialog-close" data-close aria-label="닫기">×</button></header>
    <div class="detail-grid">
      <div class="detail-visual">${detailBottle(p)}</div>
      <div class="detail-info">
        ${priceLine(p)}<p class="detail-stock">${p.status === 'soldout' ? '품절' : `재고 ${p.stock}`}</p>
        <dl class="meta"><dt>가상 지역</dt><dd>가상 지역 ${p.id}</dd><dt>가상 분류</dt><dd>가상 분류 ${p.id}</dd><dt>도수·용량·제조</dt><dd>자료 확인 전</dd></dl>
      </div>
      <div class="detail-taste">${radarSvg(p.taste)}
        <dl class="taste-list">${tasteList(p.taste).map((t) => `<div><dt>${esc(t.axis)}</dt><dd>${t.value}<span class="of"> / 5</span></dd></div>`).join('')}</dl>
      </div>
    </div>
    <p class="caption">${esc(RESULT_CAPTION)}</p>
    <div class="detail-actions"><button type="button" class="btn btn-primary" data-close>목록으로 돌아가기</button></div>`;
}
function openDetail(id, trigger) {
  state.openId = id; lastTrigger = trigger || document.activeElement; renderDetail();
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => dialog.classList.add('is-open'));
  $('#detail-title').setAttribute('tabindex', '-1'); $('#detail-title').focus();
}
function closeDetail() {
  dialog.classList.remove('is-open');
  const done = () => { if (dialog.open) dialog.close(); state.openId = null; lastTrigger?.focus?.(); };
  if (reduced) done(); else setTimeout(done, 220);
}
dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dialog) closeDetail(); });
dialog.addEventListener('cancel', (e) => { e.preventDefault(); closeDetail(); });

/* ---------- 스크롤 등장 ---------- */
function setupReveal() {
  const targets = document.querySelectorAll('.section-head, .quiz-panel, .filters, .cards, .story-visual, .story-copy, .staff-panel');
  targets.forEach((t) => t.classList.add('reveal'));
  if (reduced || !('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
  targets.forEach((t) => io.observe(t));
}

/* ---------- 전체 렌더 ---------- */
function renderAll() { renderModeSwitch(); renderHeroAnnotation(); renderQuiz(); renderFilterChips(); renderCollection(); renderStaff(); if (dialog.open) renderDetail(); }
renderAll(); renderStory(); setupReveal(); setupMaskScene(); mountHero();
document.body.classList.add('is-ready');
