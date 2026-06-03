/* ================================================================
   DOMINOD — Script Completo v3
   ================================================================ */
'use strict';

// ── Constantes ────────────────────────────────────────────────────
const MAX_SCORE  = 6;
const HAND_SIZE  = 6;
const AI_THINK   = 900;
const AI_ACT     = 600;
const AI_PLACE   = 500;

// ── Dimensões de peça (coords lógicas) ───────────────────────────
const PW = 46;   // largura vertical
const PH = 90;   // altura vertical (comprimento)
const GAP = 4;

// ── Canvas lógico ─────────────────────────────────────────────────
// Snake cresce horizontalmente primeiro.
// MUITO mais largo que alto — snake de 2+ linhas fica confortável.
const CW = 2400;
const CH = 700;
const MARGIN = 28;

// ── Pips ─────────────────────────────────────────────────────────
const PIPS = {
  0:[],1:[4],2:[0,8],3:[0,4,8],
  4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]
};

// ── Turno horário: J1(0) → J2(1) → J3(2) → J4(3) ────────────────
// Equipe A: J1(0), J3(2); Equipe B: J2(1), J4(3)
const TEAM_A = [0, 2];
const TEAM_B = [1, 3];
const isTeamA = p => TEAM_A.includes(p);

// ── Estado global ─────────────────────────────────────────────────
let G = {};

// ================================================================
// MENU
// ================================================================
let menuSel = 0;
const menuActions = ['play', 'rules'];

function initMenu() {
  menuSel = 0;
  renderMenu();
}

function renderMenu() {
  document.querySelectorAll('.menu-btn').forEach((b, i) => {
    b.classList.toggle('active', i === menuSel);
  });
}

function menuKey(k) {
  const n = menuActions.length;
  if (k === 'ArrowLeft')  menuSel = (menuSel - 1 + n) % n;
  if (k === 'ArrowRight') menuSel = (menuSel + 1) % n;
  if (k === 'Enter') { execMenuAction(menuActions[menuSel]); return; }
  renderMenu();
}

function execMenuAction(action) {
  if (action === 'play') {
    document.getElementById('screen-menu').classList.add('off');
    startNewGame();
  } else if (action === 'rules') {
    document.getElementById('screen-menu').classList.add('off');
    document.getElementById('screen-rules').classList.remove('off');
    G.phase = 'rules';
  }
}

// ================================================================
// TELA DE REGRAS
// ================================================================
function showRules() {
  _rulesPage = 0;
  renderRulesPage();
  document.getElementById('screen-rules').classList.remove('off');
  G.phase = 'rules';
}
function hideRules() {
  document.getElementById('screen-rules').classList.add('off');
  document.getElementById('screen-menu').classList.remove('off');
  G.phase = 'menu';
}

// ================================================================
// JOGO
// ================================================================

function resetGame() {
  G = {
    scoreA: 0, scoreB: 0,
    gameOver: false,
    roundWinnerA: null,
    phase: 'menu',
    ovSel: 0, ovOpts: [], ovCallback: null,
    sideSel: 'left', pendingPlay: null,
  };
}

function resetRound(forcedStarter) {
  // Regra das 5 carroças: se qualquer jogador tiver 5+ duplas, reembaralhar
  let deck, hands;
  let attempts = 0;
  do {
    deck  = shuffle(makeDeck());
    hands = [];
    for (let p = 0; p < 4; p++) hands.push(deck.splice(0, HAND_SIZE));
    attempts++;
    if (attempts > 20) break; // segurança
  } while (hands.some(hand => hand.filter(pc => pc.a === pc.b).length >= 5));

  if (attempts > 1) showToast(`Redistribuído (5 carroças detectadas)`);

  let starter, forcedPiece = null;
  if (forcedStarter !== null && forcedStarter !== undefined) {
    starter = forcedStarter;
  } else {
    starter     = findFirstStarter(hands);
    forcedPiece = findForcedPiece(hands[starter]);
  }

  Object.assign(G, {
    hands, starter, forcedPiece,
    current: starter,
    passCount: 0,
    leftEnd: null, rightEnd: null,
    headL: null, headR: null,
    boardEntries: [],
    selIdx: 0,
  });
}

// ── Deck ──────────────────────────────────────────────────────────
function makeDeck() {
  const d = [];
  for (let a = 0; a <= 6; a++)
    for (let b = a; b <= 6; b++) d.push({a, b});
  return d;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function findFirstStarter(hands) {
  for (let v = 6; v >= 0; v--)
    for (let p = 0; p < 4; p++)
      if (hands[p].some(pc => pc.a === v && pc.b === v)) return p;
  return 0;
}
function findForcedPiece(hand) {
  for (let v = 6; v >= 0; v--) {
    const pc = hand.find(p => p.a === v && p.b === v);
    if (pc) return pc;
  }
  return null;
}

// ── Regras ────────────────────────────────────────────────────────
function canPlayEnd(p, end) { return p.a === end || p.b === end; }
function pieceCanPlay(p) {
  if (G.leftEnd === null) return true;
  return canPlayEnd(p, G.leftEnd) || canPlayEnd(p, G.rightEnd);
}
function getPieceSides(p) {
  if (G.leftEnd === null) return {left: false, right: false};
  return {left: canPlayEnd(p, G.leftEnd), right: canPlayEnd(p, G.rightEnd)};
}
function playerHasMoves(p) { return G.hands[p].some(pc => pieceCanPlay(pc)); }

// ================================================================
// SNAKE LAYOUT — HORIZONTAL FIRST COM CURVAS REAIS
//
// ARQUITETURA DAS CURVAS:
// Quando o braço atinge a borda horizontal (dir R ou L) e precisa virar,
// a peça de transição deve ser VERTICAL (perpendicular ao fluxo atual).
// Isso cria a curva visual real do dominó.
//
// REGRA DE ORIENTAÇÃO:
//   - Fluxo horizontal (R/L): peça normal = HORIZONTAL
//   - Fluxo vertical  (D/U): peça normal = VERTICAL
//   - Carroça: SEMPRE perpendicular ao fluxo
//   - Peça de curva (na virada): VERTICAL (muda de fluxo horizontal → vertical)
//
// SNAKE ROWS:
// Usamos maxPerRow calculado pelo espaço disponível.
// Ao atingir maxPerRow peças numa linha, a próxima vira para baixo
// (peça vertical de transição) e depois continua horizontal.
// ================================================================

const boardCV = document.getElementById('board-cv');
const boardVP = document.getElementById('board-vp');

function pieceW(horiz) { return horiz ? PH : PW; }
function pieceH(horiz) { return horiz ? PW : PH; }

// Direção seguinte ao virar (sentido horário)
// R → D → L → U → R
function nextDir(dir) {
  return {R: 'D', D: 'L', L: 'U', U: 'R'}[dir];
}

// Quantas peças horizontais cabem por fileira
function calcMaxPerRow() {
  // Espaço horizontal disponível no canvas lógico
  const usable = CW - MARGIN * 2;
  // Cada peça horizontal ocupa PH + GAP
  return Math.max(5, Math.floor(usable / (PH + GAP)));
}

function placeFirstPiece(a, b) {
  const doubled = (a === b);
  const firstHoriz = !doubled;

  let x, y;
  if (firstHoriz) {
    x = Math.round(CW / 2 - PH / 2);
    y = Math.round(CH / 2 - PW / 2);
  } else {
    x = Math.round(CW / 2 - PW / 2);
    y = Math.round(CH / 2 - PH / 2);
  }

  G.boardEntries.push({a, b, x, y, horiz: firstHoriz, doubled});
  G.leftEnd  = a;
  G.rightEnd = b;

  if (firstHoriz) {
    G.headL = {x, y, horiz: true, dir: 'L', rowCount: 0};
    G.headR = {x, y, horiz: true, dir: 'R', rowCount: 0};
  } else {
    G.headL = {x, y, horiz: false, dir: 'L', rowCount: 0};
    G.headR = {x, y, horiz: false, dir: 'R', rowCount: 0};
  }

  renderBoardPiece(G.boardEntries[G.boardEntries.length - 1], true);
  fitView();
}

function placeSidePiece(a, b, side) {
  const doubled = (a === b);
  const head    = side === 'left' ? G.headL : G.headR;
  const matchEnd = side === 'left' ? G.leftEnd : G.rightEnd;

  // Rotação de encaixe
  let fa = a, fb = b;
  if (side === 'right') {
    if (fb === matchEnd) [fa, fb] = [fb, fa];
  } else {
    if (fa === matchEnd) [fa, fb] = [fb, fa];
  }

  const dir      = head.dir;
  const flowHoriz = (dir === 'R' || dir === 'L');

  // ── Verificar se precisa virar ANTES de posicionar ──────────────
  // Conta quantas peças horizontais foram colocadas nesta fileira
  const maxPerRow = calcMaxPerRow();
  let   needsTurn = false;

  if (flowHoriz) {
    // Incrementa contador de peças na fileira atual
    head.rowCount = (head.rowCount || 0) + 1;
    if (head.rowCount >= maxPerRow) {
      needsTurn = true;
      head.rowCount = 0;
    }
  }

  // ── Orientação da peça ───────────────────────────────────────────
  // Se está virando: a peça de curva é VERTICAL (perpendicular ao fluxo horiz)
  // Isso é a curva real do dominó.
  let newHoriz;
  if (needsTurn) {
    // Peça de transição na curva: SEMPRE vertical quando vindo de horizontal
    newHoriz = doubled ? true : false; // normal=vertical, carroça=horizontal
  } else {
    // Fluxo normal
    newHoriz = doubled ? !flowHoriz : flowHoriz;
  }

  // ── Dimensões ────────────────────────────────────────────────────
  const hw = pieceW(head.horiz);
  const hh = pieceH(head.horiz);
  const nw = pieceW(newHoriz);
  const nh = pieceH(newHoriz);

  // ── Calcular posição ─────────────────────────────────────────────
  let nx, ny;
  let newDir = dir;

  if (needsTurn) {
    // Virar: a peça de curva fica na borda, perpendicular
    // Dependendo do lado:
    if (dir === 'R') {
      // Estava indo para a direita, vira para baixo
      // A peça de curva fica à direita da última peça, centrada verticalmente
      nx = head.x + hw + GAP;
      ny = head.y + (hh - nh) / 2;
      newDir = 'D';
    } else if (dir === 'L') {
      // Estava indo para a esquerda, vira para baixo
      nx = head.x - nw - GAP;
      ny = head.y + (hh - nh) / 2;
      newDir = 'D';
    } else if (dir === 'D') {
      newDir = (side === 'left') ? 'R' : 'L';
      if (newDir === 'R') {
        nx = head.x + hw + GAP;
        ny = head.y + (hh - nh) / 2;
      } else {
        nx = head.x - nw - GAP;
        ny = head.y + (hh - nh) / 2;
      }
    } else { // U
      newDir = (side === 'left') ? 'R' : 'L';
      if (newDir === 'R') {
        nx = head.x + hw + GAP;
        ny = head.y + (hh - nh) / 2;
      } else {
        nx = head.x - nw - GAP;
        ny = head.y + (hh - nh) / 2;
      }
    }
  } else {
    // Direção normal
    if      (dir === 'R') { nx = head.x + hw + GAP;       ny = head.y + (hh - nh) / 2; }
    else if (dir === 'L') { nx = head.x - nw - GAP;       ny = head.y + (hh - nh) / 2; }
    else if (dir === 'D') { nx = head.x + (hw - nw) / 2;  ny = head.y + hh + GAP; }
    else                  { nx = head.x + (hw - nw) / 2;  ny = head.y - nh - GAP; }
  }

  nx = Math.round(nx);
  ny = Math.round(ny);

  // ── Verificar borda canônica (fallback de segurança) ─────────────
  const outR = (newDir === 'R') && (nx + nw > CW - MARGIN);
  const outL = (newDir === 'L') && (nx      < MARGIN);
  const outD = (newDir === 'D') && (ny + nh > CH - MARGIN);
  const outU = (newDir === 'U') && (ny      < MARGIN);
  if (outR || outL || outD || outU) {
    newDir = nextDir(newDir);
  }

  // Clamp
  nx = Math.max(MARGIN, Math.min(CW - nw - MARGIN, nx));
  ny = Math.max(MARGIN, Math.min(CH - nh - MARGIN, ny));

  // ── Registrar ────────────────────────────────────────────────────
  const entry = {a: fa, b: fb, x: nx, y: ny, horiz: newHoriz, doubled};
  G.boardEntries.push(entry);

  if (side === 'left') {
    G.leftEnd = fa;
    G.headL   = {x: nx, y: ny, horiz: newHoriz, dir: newDir, rowCount: head.rowCount};
  } else {
    G.rightEnd = fb;
    G.headR    = {x: nx, y: ny, horiz: newHoriz, dir: newDir, rowCount: head.rowCount};
  }

  renderBoardPiece(entry, true);
  fitView();
  updateEndsHUD();
}

// ── AUTO-ZOOM ─────────────────────────────────────────────────────
function fitView() {
  const entries = G.boardEntries;
  if (!entries || !entries.length) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entries) {
    const ew = pieceW(e.horiz), eh = pieceH(e.horiz);
    if (e.x      < minX) minX = e.x;
    if (e.y      < minY) minY = e.y;
    if (e.x + ew > maxX) maxX = e.x + ew;
    if (e.y + eh > maxY) maxY = e.y + eh;
  }

  const PAD   = 22;
  const contW = (maxX - minX) + PAD * 2;
  const contH = (maxY - minY) + PAD * 2;
  const rect  = boardVP.getBoundingClientRect();
  const vpW   = rect.width, vpH = rect.height;
  if (vpW <= 0 || vpH <= 0) return;

  const scale = Math.min(vpW / contW, vpH / contH, 1.0);
  const tx = Math.round((vpW - contW * scale) / 2 - (minX - PAD) * scale);
  const ty = Math.round((vpH - contH * scale) / 2 - (minY - PAD) * scale);

  boardCV.style.width     = CW + 'px';
  boardCV.style.height    = CH + 'px';
  boardCV.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
}

window.addEventListener('resize', () => {
  if (G.boardEntries && G.boardEntries.length) fitView();
});

// ── Renderizar peça no canvas ─────────────────────────────────────
function renderBoardPiece(entry, animate) {
  const wrap = document.createElement('div');
  wrap.className = 'bp' + (animate ? ' entering' : '');
  wrap.style.left = entry.x + 'px';
  wrap.style.top  = entry.y + 'px';
  wrap.appendChild(makePieceEl(entry.a, entry.b, entry.horiz));
  boardCV.appendChild(wrap);
  if (animate)
    wrap.addEventListener('animationend', () => wrap.classList.remove('entering'), {once: true});
}

// ── Criar elemento de peça ────────────────────────────────────────
function makePieceEl(a, b, horiz) {
  const el = document.createElement('div');
  el.className = 'piece' + (horiz ? ' h' : '');
  el.appendChild(makeHalfEl(a));
  el.appendChild(makeHalfEl(b));
  return el;
}
function makeHalfEl(val) {
  const h = document.createElement('div');
  h.className = 'half';
  const g = document.createElement('div');
  g.className = 'pip-grid';
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('div');
    p.className = 'pip' + (PIPS[val].includes(i) ? '' : ' off');
    g.appendChild(p);
  }
  h.appendChild(g);
  return h;
}
function makeBackEl() {
  const el = document.createElement('div');
  el.className = 'piece back';
  return el;
}
function clearBoard() {
  boardCV.innerHTML = '';
  boardCV.style.transform = '';
  boardCV.style.width  = CW + 'px';
  boardCV.style.height = CH + 'px';
}

// ── HUD Extremidades ─────────────────────────────────────────────
function updateEndsHUD() {
  document.getElementById('end-left').textContent  = G.leftEnd  !== null ? G.leftEnd  : '—';
  document.getElementById('end-right').textContent = G.rightEnd !== null ? G.rightEnd : '—';
}

// ── Mãos ──────────────────────────────────────────────────────────
function renderHand() {
  const hand = G.hands[0];
  const el   = document.getElementById('hand-p1');
  el.innerHTML = '';
  if (!hand.length) return;
  G.selIdx = Math.max(0, Math.min(G.selIdx, hand.length - 1));
  hand.forEach((pc, i) => {
    const pe = makePieceEl(pc.a, pc.b, false);
    if (!pieceCanPlay(pc)) pe.classList.add('inv');
    if (i === G.selIdx)    pe.classList.add('sel');
    el.appendChild(pe);
  });
}

function renderAIHand(p) {
  const el = document.getElementById(`hand-p${p + 1}`);
  if (!el) return;
  el.innerHTML = '';
  G.hands[p].forEach(() => el.appendChild(makeBackEl()));
}

function renderAllHands() {
  renderHand();
  for (let p = 1; p < 4; p++) renderAIHand(p);
}

// ── Destaque de turno ─────────────────────────────────────────────
function updateTurnHighlight() {
  const cur = G.current;
  const isP1Turn = cur === 0;

  // Label J1
  const lbl1 = document.getElementById('p1-label');
  lbl1.classList.toggle('your-turn', isP1Turn);

  // Hand J1
  const handEl = document.getElementById('hand-p1');
  handEl.classList.toggle('not-turn', !isP1Turn);

  // Labels AI
  [1, 2, 3].forEach(p => {
    const lbl = document.getElementById(`lbl-p${p + 1}`);
    if (!lbl) return;
    lbl.classList.toggle('active-turn', cur === p);
  });
}

// ── Placar e turno ────────────────────────────────────────────────
function updateScore() {
  document.getElementById('num-a').textContent = G.scoreA;
  document.getElementById('num-b').textContent = G.scoreB;
  mkDots('dots-a', G.scoreA);
  mkDots('dots-b', G.scoreB);
}
function mkDots(id, score) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  for (let i = 0; i < MAX_SCORE; i++) {
    const d = document.createElement('div');
    d.className = 'sdot' + (i < score ? '' : ' empty');
    el.appendChild(d);
  }
}
function updateTurn() {
  const names = ['Você (J1)', 'Jogador 2', 'Jogador 3', 'Jogador 4'];
  document.getElementById('turn-text').textContent = `TURNO: ${names[G.current]}`;
  updateTurnHighlight();
}
function setStatus(p, msg) {
  const el = document.getElementById(`st${p + 1}`);
  if (el) el.textContent = msg;
}
function clearStatuses() { for (let p = 0; p < 4; p++) setStatus(p, ''); }

// ── Toast ─────────────────────────────────────────────────────────
let _tt = null;
function showToast(msg, ms = 2600) {
  clearTimeout(_tt);
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  _tt = setTimeout(() => el.classList.remove('show'), ms);
}

// ── Overlay ───────────────────────────────────────────────────────
function showOverlay(title, body, opts, hint, cb) {
  G.phase = 'overlay';
  G.ovOpts = opts || [];
  G.ovSel  = 0;
  G.ovCallback = cb;
  document.getElementById('ov-title').innerHTML  = title;
  document.getElementById('ov-body').innerHTML   = body;
  document.getElementById('ov-hint').textContent = hint || '← → Navegar   Enter Confirmar';
  renderOvOpts();
  document.getElementById('overlay').classList.remove('off');
}
function renderOvOpts() {
  const el = document.getElementById('ov-opts');
  el.innerHTML = '';
  G.ovOpts.forEach((o, i) => {
    const d = document.createElement('div');
    d.className = 'ov-opt' + (i === G.ovSel ? ' active' : '');
    d.textContent = o.label;
    el.appendChild(d);
  });
}
function hideOverlay() {
  document.getElementById('overlay').classList.add('off');
}

// ================================================================
// TECLADO
// ================================================================
document.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
  e.preventDefault();
  const k = e.key;

  if (G.phase === 'menu') { menuKey(k); return; }
  if (G.phase === 'rules') {
    const isLast = _rulesPage === RULES_PAGES.length - 1;
    if (k === 'ArrowRight' || k === 'Enter') {
      if (isLast) { hideRules(); }
      else        { _rulesPage++; renderRulesPage(); }
    }
    if (k === 'ArrowLeft') {
      if (_rulesPage > 0) { _rulesPage--; renderRulesPage(); }
      else                { hideRules(); }
    }
    return;
  }
  if (G.phase === 'overlay')          { handleOvKey(k);      return; }
  if (G.phase === 'starter-banner')   { handleSBKey(k);      return; }
  if (G.phase === 'choose-side')      { handleSideKey(k);    return; }
  if (G.phase === 'ai-turn')     return;
  if (G.phase === 'idle' && G.current === 0) { handlePlayerKey(k); return; }
});

function handleOvKey(k) {
  const n = G.ovOpts.length;
  if (!n) return;
  if (k === 'ArrowLeft')  G.ovSel = (G.ovSel - 1 + n) % n;
  if (k === 'ArrowRight') G.ovSel = (G.ovSel + 1) % n;
  if (k === 'Enter') {
    const v = G.ovOpts[G.ovSel].value;
    hideOverlay();
    G.phase = 'idle';
    if (G.ovCallback) G.ovCallback(v);
    return;
  }
  renderOvOpts();
}

function handleSBKey(k) {
  const n = _sbOpts.length;
  if (!n) return;
  if (k === 'ArrowLeft')  { _sbSel = (_sbSel - 1 + n) % n; renderSBOpts(); }
  if (k === 'ArrowRight') { _sbSel = (_sbSel + 1) % n;     renderSBOpts(); }
  if (k === 'Enter') {
    const v = _sbOpts[_sbSel].value;
    hideSB();
    G.phase = 'idle';
    if (_sbCallback) _sbCallback(v);
  }
}

function handleSideKey(k) {
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    G.sideSel = G.sideSel === 'left' ? 'right' : 'left';
    renderSideOv();
  }
  if (k === 'Enter') {
    const side = G.sideSel;
    G.phase = 'idle';
    hideOverlay();
    executePlay(G.pendingPlay.playerIdx, G.pendingPlay.pieceIdx, side);
  }
}

function handlePlayerKey(k) {
  const hand = G.hands[0];
  if (!hand.length) return;
  if (k === 'ArrowLeft')  { G.selIdx = (G.selIdx - 1 + hand.length) % hand.length; renderHand(); }
  if (k === 'ArrowRight') { G.selIdx = (G.selIdx + 1) % hand.length; renderHand(); }
  if (k === 'Enter')      tryPlay(0, G.selIdx);
}

// ================================================================
// JOGADAS
// ================================================================
function tryPlay(playerIdx, pieceIdx) {
  const piece = G.hands[playerIdx][pieceIdx];
  if (!pieceCanPlay(piece)) { showToast('Peça inválida! Use ← → para escolher outra.'); return; }

  if (G.leftEnd === null) {
    if (G.forcedPiece) {
      const fp = G.forcedPiece;
      if (!(piece.a === fp.a && piece.b === fp.b)) {
        showToast(`Você deve começar com a carroça ${fp.a}/${fp.b}`); return;
      }
    }
    executePlay(playerIdx, pieceIdx, 'first');
    return;
  }

  const sides = getPieceSides(piece);
  if (sides.left && sides.right) {
    G.pendingPlay = {playerIdx, pieceIdx, piece};
    G.sideSel = 'left';
    G.phase = 'choose-side';
    renderSideOv();
  } else if (sides.left) {
    executePlay(playerIdx, pieceIdx, 'left');
  } else if (sides.right) {
    executePlay(playerIdx, pieceIdx, 'right');
  }
}

function renderSideOv() {
  const pc = G.pendingPlay.piece;
  document.getElementById('ov-title').innerHTML = 'Escolha onde jogar';
  document.getElementById('ov-body').innerHTML  =
    `Peça: <b>${pc.a}/${pc.b}</b><br>Esquerda: <b>${G.leftEnd}</b> &nbsp;|&nbsp; Direita: <b>${G.rightEnd}</b>`;
  const el = document.getElementById('ov-opts');
  el.innerHTML = '';
  ['left', 'right'].forEach(s => {
    const d = document.createElement('div');
    d.className = 'ov-opt' + (G.sideSel === s ? ' active' : '');
    d.textContent = s === 'left' ? `⬅ Esquerda (${G.leftEnd})` : `Direita (${G.rightEnd}) ➡`;
    el.appendChild(d);
  });
  document.getElementById('ov-hint').textContent = '← → Trocar lado   Enter Confirmar';
  document.getElementById('overlay').classList.remove('off');
}

function executePlay(playerIdx, pieceIdx, side) {
  const hand  = G.hands[playerIdx];
  const piece = hand.splice(pieceIdx, 1)[0];
  const isLast = hand.length === 0;

  const prevL = G.leftEnd, prevR = G.rightEnd;

  if (side === 'first') placeFirstPiece(piece.a, piece.b);
  else                  placeSidePiece(piece.a, piece.b, side);

  // Mão J1 sempre re-renderizada (para manter visível)
  renderHand();
  if (playerIdx !== 0) renderAIHand(playerIdx);

  const name = playerIdx === 0 ? 'Você' : `Jogador ${playerIdx + 1}`;
  if (side !== 'first') showToast(`${name} jogou à ${side === 'left' ? 'esquerda' : 'direita'}`);
  G.passCount = 0;

  if (isLast) {
    setTimeout(() => endByVictory(playerIdx, piece, prevL, prevR), 420);
  } else if (playerIdx === 0) {
    advanceTurn();
  }
}

// ── Avançar turno ─────────────────────────────────────────────────
function advanceTurn() {
  G.current = (G.current + 1) % 4;
  updateTurn();
  clearStatuses();

  if (G.current === 0) {
    if (!playerHasMoves(0)) {
      G.passCount++;
      if (G.passCount >= 4) { checkTrancado(); return; }
      showOverlay('Sem jogadas!',
        'Você não tem peças que encaixem.<br>Sua vez será passada.',
        [{label: 'OK, passar', value: 'pass'}],
        'Enter para continuar',
        () => advanceTurn());
    } else {
      G.passCount = 0;
      G.phase = 'idle';
      renderHand();
    }
  } else {
    G.phase = 'ai-turn';
    setTimeout(() => aiTurn(), 300);
  }
}

// ── IA ────────────────────────────────────────────────────────────
function aiTurn() {
  const p = G.current;
  if (p === 0) return;
  const name = `Jogador ${p + 1}`;
  setStatus(p, `${name} pensando…`);
  setTimeout(() => {
    if (!playerHasMoves(p)) {
      G.passCount++;
      setStatus(p, `${name} passou`);
      showToast(`${name} passou`);
      setTimeout(() => {
        setStatus(p, '');
        if (G.passCount >= 4) { checkTrancado(); return; }
        advanceTurn();
      }, AI_ACT);
      return;
    }
    G.passCount = 0;
    const move = aiPickMove(p);
    const sl = move.side === 'first' ? '' : (move.side === 'left' ? ' → esq' : ' → dir');
    setStatus(p, `${name}: ${move.piece.a}/${move.piece.b}${sl}`);
    setTimeout(() => {
      setStatus(p, '');
      executePlay(p, move.idx, move.side);
      if (G.hands[p].length > 0) advanceTurn();
    }, AI_ACT + AI_PLACE);
  }, AI_THINK);
}

function aiPickMove(playerIdx) {
  const hand = G.hands[playerIdx];
  let best = null, bestVal = -1;
  hand.forEach((piece, idx) => {
    if (!pieceCanPlay(piece)) return;
    const val = piece.a + piece.b;
    let side;
    if (G.leftEnd === null) {
      side = 'first';
    } else {
      const s = getPieceSides(piece);
      side = (s.left && s.right) ? 'right' : s.left ? 'left' : 'right';
    }
    if (val > bestVal) { bestVal = val; best = {piece, idx, side}; }
  });
  return best;
}

// ── Fim por vitória ───────────────────────────────────────────────
function endByVictory(playerIdx, lastPiece, prevL, prevR) {
  const doubled = lastPiece.a === lastPiece.b;
  let laeLo = false;
  if (prevL !== null && prevR !== null) {
    const cL = lastPiece.a === prevL || lastPiece.b === prevL;
    const cR = lastPiece.a === prevR || lastPiece.b === prevR;
    laeLo = cL && cR;
  }
  const cruzada = doubled && laeLo;
  let type, pts;
  if (cruzada)    { type = 'BATIDA CRUZADA';   pts = 6; }
  else if (laeLo)  { type = 'BATIDA LÁ E LÔ';   pts = 3; }
  else if (doubled){ type = 'BATIDA DE CARROÇA'; pts = 2; }
  else             { type = 'BATIDA COMUM';      pts = 1; }

  const teamA = isTeamA(playerIdx);
  if (teamA) G.scoreA += pts; else G.scoreB += pts;
  G.roundWinnerA = teamA;
  updateScore();
  showRoundResult(type, pts, playerIdx, teamA);
}

// ── Trancado — regra individual ───────────────────────────────────
// Vence o jogador INDIVIDUAL com menor soma; sua equipe ganha o ponto.
function checkTrancado() {
  const sums = G.hands.map(h => h.reduce((s, p) => s + p.a + p.b, 0));
  // Encontrar menor soma individual
  let minSum = Infinity, minPlayer = -1;
  sums.forEach((s, i) => {
    if (s < minSum) { minSum = s; minPlayer = i; }
  });
  const teamAWins = isTeamA(minPlayer);
  if (teamAWins) G.scoreA += 1; else G.scoreB += 1;
  G.roundWinnerA = teamAWins;
  updateScore();

  const rows = sums.map((s, i) => {
    const mark = i === minPlayer ? ' ✓' : '';
    return `<div>Jogador ${i + 1}: <b>${s}</b>${mark}</div>`;
  }).join('');

  showOverlay('JOGO TRANCADO',
    `${rows}<br>Menor soma: <b>J${minPlayer + 1}</b> (${minSum})<br>
     Equipe ${teamAWins ? 'A' : 'B'} vence! +1 ponto`,
    [{label: 'Continuar', value: 'next'}],
    'Enter para continuar',
    () => afterRound());
}

// ── Resultado da rodada ───────────────────────────────────────────
function showRoundResult(type, pts, winnerIdx, teamA) {
  const teamName = teamA ? 'Equipe A' : 'Equipe B';
  const winName  = winnerIdx === 0 ? 'Você (J1)' : `Jogador ${winnerIdx + 1}`;

  if (G.scoreA >= MAX_SCORE || G.scoreB >= MAX_SCORE) {
    showOverlay(type,
      `<b>${winName}</b> venceu a rodada!<br>
       Tipo: <em>${type}</em> &nbsp;+${pts} ponto${pts > 1 ? 's' : ''}<br><br>
       Equipe A: <b>${G.scoreA}</b> &nbsp;|&nbsp; Equipe B: <b>${G.scoreB}</b>`,
      [{label: 'Ver resultado final', value: 'end'}],
      'Enter para continuar',
      () => showGameOver());
    return;
  }
  showOverlay(type,
    `<b>${winName}</b> venceu a rodada!<br>
     Tipo: <em>${type}</em> &nbsp;+${pts} ponto${pts > 1 ? 's' : ''} para ${teamName}<br><br>
     Equipe A: <b>${G.scoreA}</b> &nbsp;|&nbsp; Equipe B: <b>${G.scoreB}</b>`,
    [{label: 'Próxima Rodada', value: 'next'}],
    'Enter para continuar',
    () => afterRound());
}

function showGameOver() {
  const win = G.scoreA >= MAX_SCORE ? 'EQUIPE A 🎉' : 'EQUIPE B 🎉';
  G.gameOver = true;
  showOverlay(`🏆 VITÓRIA DA ${win}`,
    `Placar final:<br>Equipe A: <b>${G.scoreA}</b> &nbsp;|&nbsp; Equipe B: <b>${G.scoreB}</b><br><br>
     Obrigado por jogar DomiNod!`,
    [{label: '▶ Nova Partida', value: 'new'}, {label: '⌂ Menu', value: 'menu'}],
    'Enter para confirmar',
    v => {
      if (v === 'new') startNewGame();
      else             goToMenu();
    });
}

// ── Após rodada — nova mão distribuída ANTES do banner ──────────
// Fluxo correto:
//   1. Atribui pontuação (já feito em endByVictory/checkTrancado)
//   2. Distribui NOVA mão
//   3. Renderiza nova mão (player-bar visível)
//   4. Banner aparece sobre a mão já visível
//   5. Jogador analisa, decide quem começa
//   6. Jogo inicia SEM redistribuir (mão já existe)
function afterRound() {
  if (G.roundWinnerA === true) {
    // 1. Preparar nova rodada (sem starter fixo ainda)
    _prepareNextRound(null);

    // 2. Banner aparece SOBRE a nova mão já distribuída e visível
    showStarterBanner(
      '✓ Sua equipe venceu!',
      'Analise sua nova mão — quem inicia?',
      [{label: 'Eu (J1)', value: 0}, {label: 'Parceiro J3', value: 2}],
      v => _launchPreparedRound(v)
    );
  } else {
    // Equipe B venceu — prepara rodada e mostra banner rápido
    _prepareNextRound(1);
    showStarterBanner(
      'Equipe B venceu a rodada',
      'Jogador 2 iniciará. Pressione Enter.',
      [{label: 'Continuar', value: 1}],
      () => _launchPreparedRound(1)
    );
  }
}

// Distribui nova mão, limpa board, mostra mão — mas NÃO lança a IA ainda
function _prepareNextRound(forcedStarter) {
  resetRound(forcedStarter);
  clearBoard();
  updateScore();
  updateEndsHUD();
  renderAllHands();   // nova mão já visível no player-bar
  updateTurn();
}

// Lança o jogo com o iniciador escolhido (mão já distribuída)
// Se o starter escolhido difere do que resetRound sorteou, ajusta apenas G.current
function _launchPreparedRound(chosenStarter) {
  // Ajustar quem começa sem re-embaralhar
  G.current = chosenStarter;
  // Se tem peça forçada, recalcular para o novo starter
  G.forcedPiece = null;
  const hand = G.hands[G.current];
  for (let v = 6; v >= 0; v--) {
    const pc = hand.find(p => p.a === v && p.b === v);
    if (pc) { G.forcedPiece = pc; break; }
  }
  updateTurn();
  showToast(`Jogador ${G.current + 1} começa${G.forcedPiece ? ` com ${G.forcedPiece.a}/${G.forcedPiece.b}` : ''}`);
  if (G.current === 0) {
    G.phase = 'idle';
    renderHand();
  } else {
    G.phase = 'ai-turn';
    setTimeout(() => aiTurn(), 800);
  }
}

// ── Banner de escolha do iniciador ───────────────────────────────
let _sbSel = 0, _sbOpts = [], _sbCallback = null;

function showStarterBanner(title, body, opts, cb) {
  _sbSel = 0; _sbOpts = opts; _sbCallback = cb;
  document.getElementById('starter-banner-title').textContent = title;
  document.getElementById('starter-banner-body').textContent  = body;
  renderSBOpts();
  document.getElementById('starter-banner').classList.remove('off');
  G.phase = 'starter-banner';
}

function renderSBOpts() {
  const el = document.getElementById('starter-banner-opts');
  el.innerHTML = '';
  _sbOpts.forEach((o, i) => {
    const d = document.createElement('div');
    d.className = 'sb-opt' + (i === _sbSel ? ' active' : '');
    d.textContent = o.label;
    el.appendChild(d);
  });
}

function hideSB() {
  document.getElementById('starter-banner').classList.add('off');
}

// ── Iniciar rodada (1ª rodada ou nova partida) ────────────────────
function beginRound(forcedStarter) {
  resetRound(forcedStarter);
  clearBoard();
  renderAllHands();
  updateScore();
  updateTurn();
  updateEndsHUD();
  showToast(`Jogador ${G.current + 1} começa${G.forcedPiece ? ` com ${G.forcedPiece.a}/${G.forcedPiece.b}` : ''}`);
  if (G.current === 0) {
    G.phase = 'idle';
    renderHand();
  } else {
    G.phase = 'ai-turn';
    setTimeout(() => aiTurn(), 800);
  }
}

// ── Iniciar jogo ──────────────────────────────────────────────────
function startNewGame() {
  // Esconde telas de menu/regras
  document.getElementById('screen-menu').classList.add('off');
  document.getElementById('screen-rules').classList.add('off');
  resetGame();
  updateScore();
  updateEndsHUD();
  showOverlay('DomiNod — Dominó Acessível',
    `Bem-vindo(a)!<br>
     Você é o <b>Jogador 1</b> e está na <b>Equipe A</b>.<br>
     Seu parceiro <b>J3</b> fica no topo (de frente para você).<br>
     Adversários: <b>J2</b> (esq) e está na <b>J4</b> (dir) Equipe B.<br>
     Ordem: J1 → J2 → J3 → J4. Meta: <b>${MAX_SCORE} pontos</b>.<br><br>
     <kbd>←</kbd><kbd>→</kbd> Selecionar &nbsp; <kbd>Enter</kbd> Confirmar`,
    [{label: '▶ Jogar!', value: 'start'}],
    'Enter para começar',
    () => beginRound(null));
}

function goToMenu() {
  document.getElementById('screen-menu').classList.remove('off');
  G.phase = 'menu';
  initMenu();
}

// ================================================================
// REGRAS — paginadas, zero scroll, 100% teclado
// ================================================================
const RULES_PAGES = [
  {
    title: 'Objetivo & Mesa',
    html: `
      <div class="rules-section">
        <h3>🎯 Objetivo</h3>
        <p>Primeira <b>dupla</b> a atingir <b>6 pontos</b> vence. Você (J1) + Jogador 3 = <b>Equipe A</b>. Jogadores 2 e 4 = <b>Equipe B</b>.</p>
      </div>
      <div class="rules-section">
        <h3>📐 Disposição da Mesa</h3>
        <p style="font-family:monospace;font-size:.8rem;line-height:1.8;color:#c8a84b;text-align:center">
          &nbsp;&nbsp;&nbsp;J3 (A — parceiro)<br>
          J2 (Adversário - B)&nbsp;&nbsp;[BOARD]&nbsp;&nbsp;J4 (B - Adversário)<br>
          &nbsp;&nbsp;&nbsp;Você J1 (A - Você)
        </p>
        <p>Parceiros em lados <b>opostos</b>. Adversários alternam. Ordem horária: J1 → J2 → J3 → J4.</p>
      </div>
      <div class="rules-section">
        <h3>🎮 Controles</h3>
        <ul>
          <li><kbd>←</kbd> <kbd>→</kbd> — Selecionar peça ou opção</li>
          <li><kbd>Enter</kbd> — Confirmar / Jogar</li>
          <li>Sem mouse, sem scroll, sem drag.</li>
        </ul>
      </div>`
  },
  {
    title: 'Como Jogar',
    html: `
      <div class="rules-section">
        <h3>🃏 Regras Básicas</h3>
        <ul>
          <li>Cada jogador recebe <b>6 peças</b>.</li>
          <li>4 peças "dormem".</li>
          <li>A maior carroça fora do dorme inicia.</li>
          <li>Encaixe peças pelas extremidades com o <b>mesmo número</b>.</li>
          <li>Se não tiver jogada válida, você terá que passar a vez.</li>
          <li>Se você possui uma jogada possível, não poderá passar a vez.</li>
        </ul>
      </div>
      <div class="rules-section">
        <h3>🏆 Tipos de Batida</h3>
        <ul>
          <li><b>Batida Comum</b> — +1 ponto</li>
          <li><b>Carroça</b> (última peça é dupla) — +2 pontos</li>
          <li><b>Lá e Lô</b> (última peça cabe nos dois lados) — +3 pontos</li>
          <li><b>Cruzada</b> (Carroça + Lá e Lô) — +6 pontos</li>
        </ul>
      </div>
      <div class="rules-section">
        <h3>💡 HUD de Extremidades</h3>
        <p>O painel <b>ESQ | DIR</b> no canto mostra os valores das pontas em tempo real.</p>
      </div>`
  },
  {
    title: 'Regras Especiais',
    html: `
      <div class="rules-section">
        <h3>🔒 Jogo Trancado</h3>
        <p>Quando nenhum jogador pode jogar, vence a equipe do jogador <b>individual</b> com <b>menor soma</b> de pontos na mão — mesmo em duplas.</p>
      </div>
      <div class="rules-section">
        <h3>🎲 Regra das 5 Carroças</h3>
        <p>Se qualquer jogador receber <b>5 ou mais peças duplas</b>, toda a rodada é anulada e redistribuída automaticamente.</p>
      </div>
      <div class="rules-section">
        <h3>🧠 Escolha Estratégica</h3>
        <p>Quando sua equipe vence, um <b>banner</b> aparece sobre sua mão 
         para você analisar as peças antes de decidir quem inicia.</p>
      </div>
      <div class="rules-section" style="text-align:center;margin-top:12px">
        <p style="color:var(--gold-lo);font-style:italic">Pressione Enter ou → para voltar ao menu</p>
      </div>`
  }
];

let _rulesPage = 0;

function renderRulesPage() {
  const page = RULES_PAGES[_rulesPage];
  document.getElementById('rules-title').textContent  = page.title;
  document.getElementById('rules-pager').textContent  = `${_rulesPage + 1} / ${RULES_PAGES.length}`;
  document.getElementById('rules-content').innerHTML  = page.html;

  const isFirst = _rulesPage === 0;
  const isLast  = _rulesPage === RULES_PAGES.length - 1;
  document.getElementById('rules-prev').classList.toggle('dim', isFirst);
  document.getElementById('rules-next').textContent = isLast ? 'Sair ✕' : 'Próxima →';
  document.getElementById('rules-next').classList.remove('dim');
}

// ================================================================
// BOOT
// ================================================================
window.addEventListener('DOMContentLoaded', () => {
  resetGame();
  initMenu();
  G.phase = 'menu';

  // Botões do menu principal
  document.querySelectorAll('.menu-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      menuSel = i;
      renderMenu();
      execMenuAction(menuActions[i]);
    });
  });

  // Navegação das regras (click também funciona)
  document.getElementById('rules-prev').addEventListener('click', () => {
    if (_rulesPage > 0) { _rulesPage--; renderRulesPage(); }
    else                { hideRules(); }
  });
  document.getElementById('rules-next').addEventListener('click', () => {
    if (_rulesPage < RULES_PAGES.length - 1) { _rulesPage++; renderRulesPage(); }
    else                                      { hideRules(); }
  });
});