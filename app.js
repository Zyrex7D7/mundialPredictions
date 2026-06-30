/* ====================================================================
   PREVISÕES MUNDIAL 26 — app.js
   Toda a lógica: contas, salas, bracket, pontos, Firestore, admin.
   Código comentado em português para ser fácil de seguir e editar.
   ==================================================================== */

/* ---------- 1. CONFIGURAÇÃO QUE PODES QUERER MUDAR ---------- */

// Pontos atribuídos por jogo. É cumulativo: só ganhas o nível seguinte
// se acertares no anterior (ver função calcPoints mais abaixo).
const POINTS = {
  advance: 2,  // acertar quem passa (vencedor)
  et: 2,       // + acertar que foi resolvido em prolongamento
  pens: 3,     // + acertar que foi resolvido em grandes penalidades
  exact: 5,    // + acertar o resultado exato
};

// Os 32 confrontos da Fase de 32, por ordem. Edita à vontade — a ordem
// aqui define a posição de cada jogo no bracket (R32_PAIRS[0] e [1] dão
// origem ao jogo r16_1, [2] e [3] ao r16_2, etc.)
const R32_PAIRS = [
  ["Alemanha", "Paraguai"],
  ["França", "Suécia"],
  ["África do Sul", "Canadá"],
  ["Brasil", "Arábia Saudita"],
  ["Portugal", "Egito"],
  ["Argentina", "Catar"],
  ["Inglaterra", "Irão"],
  ["Países Baixos", "Marrocos"],
  ["Espanha", "Coreia do Sul"],
  ["Bélgica", "Tunísia"],
  ["Croácia", "Austrália"],
  ["Uruguai", "Senegal"],
  ["Itália", "Japão"],
  ["EUA", "México"],
  ["Dinamarca", "Polónia"],
  ["Colômbia", "Gana"],
];

/* ---------- 2. ESTADO LOCAL ---------- */

const state = {
  account: null,        // { name, password }
  room: null,            // código da sala
  isHost: false,
  games: {},              // { gameId: gameDoc }
  predictions: {},        // { playerName: { picks: { gameId: pick } } }
  unsubGames: null,
  unsubPreds: null,
  adminOpen: false,
};

const ROUNDS = ["r32", "r16", "qf", "sf", "final"];
const ROUND_LABELS = {
  r32: "Fase de 32",
  r16: "Oitavos",
  qf: "Quartos",
  sf: "Meias",
  final: "Final",
};
let currentTab = "r32";

/* ---------- 3. UTILITÁRIOS ---------- */

function normalizeCode(str) {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function showError(container, msg) {
  const old = container.querySelector(".error-msg");
  if (old) old.remove();
  container.appendChild(el("p", { class: "error-msg" }, msg));
}

/* ---------- 4. CONSTRUÇÃO DA ESTRUTURA DO BRACKET ---------- */

// Gera a lista dos 31 jogos (ids, ronda, de onde vêm as equipas)
function buildEmptyBracket() {
  const games = {};

  // Fase de 32 — equipas já definidas
  R32_PAIRS.forEach((pair, i) => {
    const id = `r32_${i + 1}`;
    games[id] = {
      id, round: "r32", order: i + 1,
      teamA: pair[0], teamB: pair[1],
      sourceA: null, sourceB: null,
      status: "open",
      result: null,
    };
  });

  // Função genérica para gerar uma ronda seguinte a partir da anterior
  function buildRound(roundId, prevRoundId, prevCount) {
    const count = prevCount / 2;
    for (let i = 1; i <= count; i++) {
      const id = `${roundId}_${i}`;
      const sourceA = `${prevRoundId}_${2 * i - 1}`;
      const sourceB = `${prevRoundId}_${2 * i}`;
      games[id] = {
        id, round: roundId, order: i,
        teamA: null, teamB: null,
        sourceA, sourceB,
        status: "pending",
        result: null,
      };
    }
    return count;
  }

  let prevCount = 16;
  prevCount = buildRound("r16", "r32", prevCount);
  prevCount = buildRound("qf", "r16", prevCount);
  prevCount = buildRound("sf", "qf", prevCount);
  buildRound("final", "sf", prevCount);

  return games;
}

/* ---------- 5. PONTOS ---------- */

// prediction: { winner: 'A'|'B', scoreA, scoreB, mode }
// result:     { winner: 'A'|'B', scoreA, scoreB, mode }
function calcPoints(prediction, result) {
  if (!prediction || !result) return 0;
  if (prediction.winner !== result.winner) return 0;

  let pts = POINTS.advance;
  if (result.mode === "et" && prediction.mode === "et") pts += POINTS.et;
  if (result.mode === "pens" && prediction.mode === "pens") pts += POINTS.pens;
  if (
    Number(prediction.scoreA) === Number(result.scoreA) &&
    Number(prediction.scoreB) === Number(result.scoreB)
  ) {
    pts += POINTS.exact;
  }
  return pts;
}

/* ====================================================================
   6. CONTAS (nome + password, globais, coleção "accounts")
   ==================================================================== */

async function signupOrLogin(name, password) {
  const id = normalizeCode(name);
  if (!id) throw new Error("Escreve um nome válido.");
  if (!password) throw new Error("Escreve uma password.");

  const ref = db.collection("accounts").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    // conta nova
    await ref.set({ displayName: name.trim(), password });
    return { name: name.trim(), password };
  }

  // conta existente — valida password
  const data = snap.data();
  if (data.password !== password) {
    throw new Error("Password incorreta para esse nome.");
  }
  return { name: data.displayName, password };
}

function saveSessionAccount(account) {
  localStorage.setItem("pm26_account", JSON.stringify(account));
}
function loadSessionAccount() {
  try { return JSON.parse(localStorage.getItem("pm26_account")); }
  catch { return null; }
}
function clearSessionAccount() {
  localStorage.removeItem("pm26_account");
}

/* ====================================================================
   7. SALAS (coleção "rooms", subcoleção "games" e "predictions")
   ==================================================================== */

// Cria uma sala NOVA. Dá erro se já existir uma sala com este código,
// para evitar entrar sem querer numa sala errada por engano de digitação.
async function createRoom(rawCode, account) {
  const code = normalizeCode(rawCode);
  if (!code) throw new Error("Escreve um código de sala válido.");

  const roomRef = db.collection("rooms").doc(code);
  const roomSnap = await roomRef.get();

  if (roomSnap.exists) {
    throw new Error(`Já existe uma sala com o código "${code}". Se é a tua, usa o botão "Entrar numa sala existente".`);
  }

  await roomRef.set({ host: account.name, createdAt: Date.now() });
  await seedRoomGames(code);

  saveSessionRoom(code);
  return code;
}

// Entra numa sala que já existe. Dá erro se o código não corresponder
// a nenhuma sala — assim ninguém cria salas novas por engano ao
// escrever mal o código que lhe deram.
async function joinRoom(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) throw new Error("Escreve um código de sala válido.");

  const roomRef = db.collection("rooms").doc(code);
  const roomSnap = await roomRef.get();

  if (!roomSnap.exists) {
    throw new Error(`Não existe nenhuma sala com o código "${code}". Confirma o código com quem te convidou.`);
  }

  saveSessionRoom(code);
  return code;
}

// Cria os 31 jogos da sala, só se ainda não existirem (evita duplicar)
async function seedRoomGames(roomCode) {
  const gamesCol = db.collection("rooms").doc(roomCode).collection("games");
  const existing = await gamesCol.limit(1).get();
  if (!existing.empty) return;

  const games = buildEmptyBracket();
  const batch = db.batch();
  Object.values(games).forEach((g) => {
    batch.set(gamesCol.doc(g.id), g);
  });
  await batch.commit();
}

function saveSessionRoom(code) {
  localStorage.setItem("pm26_room", code);
}
function loadSessionRoom() {
  return localStorage.getItem("pm26_room");
}
function clearSessionRoom() {
  localStorage.removeItem("pm26_room");
}

async function getRoomHost(roomCode) {
  const snap = await db.collection("rooms").doc(roomCode).get();
  return snap.exists ? snap.data().host : null;
}

/* ====================================================================
   8. PREVISÕES (subcoleção "predictions", doc id = nome do jogador)
   ==================================================================== */

function predictionsDocRef(playerName) {
  return db.collection("rooms").doc(state.room)
    .collection("predictions").doc(normalizeCode(playerName));
}

async function savePick(gameId, pick) {
  const ref = predictionsDocRef(state.account.name);
  await ref.set(
    { displayName: state.account.name, picks: { [gameId]: pick } },
    { merge: true }
  );
}

/* ====================================================================
   9. ADMIN — confirmar / corrigir resultados
   ==================================================================== */

async function confirmResult(gameId, winnerSide, scoreA, scoreB, mode) {
  const gamesCol = db.collection("rooms").doc(state.room).collection("games");
  const game = state.games[gameId];
  if (!game) return;

  const result = {
    winner: winnerSide,
    scoreA: Number(scoreA),
    scoreB: Number(scoreB),
    mode, // 'regular' | 'et' | 'pens'
  };

  await gamesCol.doc(gameId).update({ status: "locked", result });

  const winningTeam = winnerSide === "A" ? game.teamA : game.teamB;

  // avança a equipa vencedora para o jogo seguinte (se houver)
  const nextGames = Object.values(state.games).filter(
    (g) => g.sourceA === gameId || g.sourceB === gameId
  );

  for (const ng of nextGames) {
    const update = {};
    if (ng.sourceA === gameId) update.teamA = winningTeam;
    if (ng.sourceB === gameId) update.teamB = winningTeam;

    const futureTeamA = update.teamA ?? ng.teamA;
    const futureTeamB = update.teamB ?? ng.teamB;
    if (futureTeamA && futureTeamB) update.status = "open";

    await gamesCol.doc(ng.id).update(update);
  }
}

async function unlockResult(gameId) {
  const gamesCol = db.collection("rooms").doc(state.room).collection("games");
  await gamesCol.doc(gameId).update({ status: "open", result: null });
}

/* ====================================================================
   10. LISTENERS EM TEMPO REAL
   ==================================================================== */

function attachRoomListeners() {
  if (state.unsubGames) state.unsubGames();
  if (state.unsubPreds) state.unsubPreds();

  const roomRef = db.collection("rooms").doc(state.room);

  state.unsubGames = roomRef.collection("games").onSnapshot((snap) => {
    const games = {};
    snap.forEach((doc) => (games[doc.id] = doc.data()));
    state.games = games;
    render();
  });

  state.unsubPreds = roomRef.collection("predictions").onSnapshot((snap) => {
    const preds = {};
    snap.forEach((doc) => (preds[doc.id] = doc.data()));
    state.predictions = preds;
    render();
  });
}

/* ====================================================================
   11. RENDERIZAÇÃO
   ==================================================================== */

const appEl = document.getElementById("app");
const topbarRight = document.getElementById("topbarRight");
const adminToggleBtn = document.getElementById("adminToggleBtn");

function render() {
  appEl.innerHTML = "";
  topbarRight.innerHTML = "";
  adminToggleBtn.style.display = "none";

  if (!state.account) {
    renderAuthView();
    return;
  }
  if (!state.room) {
    renderRoomChoiceView();
    renderTopbarAccountOnly();
    return;
  }

  renderTopbarFull();
  renderMainView();

  if (state.isHost) {
    adminToggleBtn.style.display = "inline";
  }
}

/* --- 11.1 Topbar --- */

function renderTopbarAccountOnly() {
  topbarRight.appendChild(
    el("button", { class: "link-btn", onclick: logout }, "sair da conta")
  );
}

function renderTopbarFull() {
  topbarRight.appendChild(el("span", {}, `${state.account.name} · sala ${state.room}`));
  topbarRight.appendChild(
    el("button", { class: "small", onclick: leaveRoom }, "🚪 sala")
  );
  topbarRight.appendChild(
    el("button", { class: "small", onclick: logout }, "sair")
  );
}

/* --- 11.2 Ecrã de autenticação --- */

function renderAuthView() {
  const card = el("div", { class: "card center-card" });
  card.appendChild(el("h1", {}, "Entrar"));
  card.appendChild(el("p", {}, "Usa o mesmo nome e password sempre que entrares."));

  const nameInput = el("input", { type: "text", placeholder: "O teu nome" });
  const passInput = el("input", { type: "password", placeholder: "Password" });

  card.appendChild(el("label", {}, "Nome"));
  card.appendChild(nameInput);
  card.appendChild(el("label", {}, "Password"));
  card.appendChild(passInput);

  const btn = el("button", { class: "primary", style: "width:100%;margin-top:16px" }, "Entrar / Criar conta");
  btn.onclick = async () => {
    try {
      const account = await signupOrLogin(nameInput.value, passInput.value);
      state.account = account;
      saveSessionAccount(account);
      render();
    } catch (e) {
      showError(card, e.message);
    }
  };
  card.appendChild(btn);

  appEl.appendChild(card);
}

/* --- 11.3 Escolha de sala --- */

function renderRoomChoiceView() {
  const card = el("div", { class: "card center-card" });
  card.appendChild(el("h1", {}, `Olá, ${state.account.name} 👋`));
  card.appendChild(el("p", {}, "Cria uma sala nova ou entra numa já existente com o código que te derem."));

  const codeInput = el("input", { type: "text", placeholder: "código da sala (ex: amigos2026)" });
  card.appendChild(el("label", {}, "Código da sala"));
  card.appendChild(codeInput);

  const btnRow = el("div", { style: "display:flex;gap:10px;margin-top:16px" });

  const joinBtn = el("button", { class: "primary", style: "flex:1" }, "Entrar numa sala existente");
  joinBtn.onclick = async () => {
    try {
      const code = await joinRoom(codeInput.value);
      await enterRoom(code);
    } catch (e) {
      showError(card, e.message);
    }
  };

  const createBtn = el("button", { style: "flex:1" }, "Criar sala nova");
  createBtn.onclick = async () => {
    try {
      const code = await createRoom(codeInput.value, state.account);
      await enterRoom(code);
    } catch (e) {
      showError(card, e.message);
    }
  };

  btnRow.appendChild(joinBtn);
  btnRow.appendChild(createBtn);
  card.appendChild(btnRow);

  appEl.appendChild(card);
}

/* --- 11.4 Vista principal (bracket + leaderboard) --- */

function renderMainView() {
  const tabs = el("div", { class: "round-tabs" });
  ROUNDS.forEach((r) => {
    const btn = el("button", { class: r === currentTab ? "active" : "" }, ROUND_LABELS[r]);
    btn.onclick = () => { currentTab = r; render(); };
    tabs.appendChild(btn);
  });
  appEl.appendChild(tabs);

  const gamesOfRound = Object.values(state.games)
    .filter((g) => g.round === currentTab)
    .sort((a, b) => a.order - b.order);

  gamesOfRound.forEach((g) => appEl.appendChild(renderGameCard(g)));

  appEl.appendChild(renderLeaderboard());

  if (state.adminOpen && state.isHost) {
    appEl.appendChild(renderAdminPanel());
  }
}

/* --- 11.5 Cartão de um jogo --- */

function renderGameCard(game) {
  const card = el("div", { class: "game-card" + (game.status === "locked" ? " locked" : "") });

  const myPick = (state.predictions[normalizeCode(state.account.name)] || {}).picks?.[game.id];

  card.appendChild(
    el("div", { class: "game-label" }, [
      el("span", {}, `${ROUND_LABELS[game.round]} · jogo ${game.order}`),
      el("span", {}, game.status === "locked" ? "🔒 confirmado" : ""),
    ])
  );

  if (game.status === "pending") {
    card.appendChild(el("p", { class: "pending-msg" }, "⏳ as equipas ainda não foram confirmadas"));
    return card;
  }

  // estado local do formulário (se ainda não há pick guardado)
  let local = myPick ? { ...myPick } : { winner: null, scoreA: "", scoreB: "", mode: "regular" };
  const locked = game.status === "locked";
  const result = game.result;

  const teamsRow = el("div", { class: "teams-row" });
  const teamABtn = el(
    "div",
    { class: pickClass("A") },
    game.teamA
  );
  const teamBBtn = el(
    "div",
    { class: pickClass("B") },
    game.teamB
  );

  function pickClass(side) {
    let cls = "team-pick";
    if (locked && result) {
      cls += result.winner === side ? " winner" : " loser";
    } else if (local.winner === side) {
      cls += " selected";
    }
    return cls;
  }

  if (!locked) {
    teamABtn.style.cursor = "pointer";
    teamBBtn.style.cursor = "pointer";
    teamABtn.onclick = () => { local.winner = "A"; refreshTeamClasses(); };
    teamBBtn.onclick = () => { local.winner = "B"; refreshTeamClasses(); };
  }
  function refreshTeamClasses() {
    teamABtn.className = pickClass("A");
    teamBBtn.className = pickClass("B");
  }

  teamsRow.appendChild(teamABtn);
  teamsRow.appendChild(el("span", { class: "vs-label" }, "vs"));
  teamsRow.appendChild(teamBBtn);
  card.appendChild(teamsRow);

  if (locked) {
    card.appendChild(
      el("p", { style: "text-align:center;font-size:13px;color:var(--text-dim)" },
        `Resultado real: ${result.scoreA} - ${result.scoreB} (${modeLabel(result.mode)})`)
    );
    if (myPick) {
      const pts = calcPoints(myPick, result);
      card.appendChild(
        el("div", { style: "text-align:center" },
          el("span", { class: "points-pill" }, `a tua aposta valeu ${pts} pontos`))
      );
    } else {
      card.appendChild(el("p", { class: "pending-msg", style: "text-align:center" }, "não fizeste aposta a este jogo"));
    }
    return card;
  }

  // jogo aberto — formulário de aposta
  const scoreRow = el("div", { class: "score-row" });
  const scoreA = el("input", { type: "number", min: "0", placeholder: "golos " + game.teamA, value: local.scoreA });
  const scoreB = el("input", { type: "number", min: "0", placeholder: "golos " + game.teamB, value: local.scoreB });
  scoreA.oninput = () => { local.scoreA = scoreA.value; };
  scoreB.oninput = () => { local.scoreB = scoreB.value; };
  scoreRow.appendChild(scoreA);
  scoreRow.appendChild(scoreB);
  card.appendChild(scoreRow);

  const modeSelect = el("select", {}, [
    el("option", { value: "regular", selected: local.mode === "regular" }, "Tempo regular"),
    el("option", { value: "et", selected: local.mode === "et" }, "Prolongamento"),
    el("option", { value: "pens", selected: local.mode === "pens" }, "Grandes penalidades"),
  ]);
  modeSelect.value = local.mode;
  modeSelect.onchange = () => { local.mode = modeSelect.value; };
  card.appendChild(modeSelect);

  const saveBtn = el("button", { class: "primary", style: "width:100%;margin-top:10px" }, myPick ? "Atualizar aposta" : "Guardar aposta");
  saveBtn.onclick = async () => {
    if (!local.winner) return showError(card, "Escolhe primeiro quem ganha.");
    if (local.scoreA === "" || local.scoreB === "") return showError(card, "Preenche o resultado.");
    await savePick(game.id, {
      winner: local.winner,
      scoreA: Number(local.scoreA),
      scoreB: Number(local.scoreB),
      mode: local.mode,
    });
  };
  card.appendChild(saveBtn);

  return card;
}

function modeLabel(mode) {
  return { regular: "tempo regular", et: "prolongamento", pens: "grandes penalidades" }[mode] || mode;
}

/* --- 11.6 Classificação --- */

function renderLeaderboard() {
  const wrap = el("div", { class: "card section-gap" });
  wrap.appendChild(el("h2", {}, "🏅 Classificação"));

  const totals = {};
  Object.entries(state.predictions).forEach(([playerId, data]) => {
    let total = 0;
    Object.entries(data.picks || {}).forEach(([gameId, pick]) => {
      const game = state.games[gameId];
      if (game && game.status === "locked" && game.result) {
        total += calcPoints(pick, game.result);
      }
    });
    totals[data.displayName || playerId] = total;
  });

  const ranking = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  if (ranking.length === 0) {
    wrap.appendChild(el("p", {}, "Ainda ninguém fez previsões nesta sala."));
    return wrap;
  }

  ranking.forEach(([name, pts], i) => {
    wrap.appendChild(
      el("div", { class: "leaderboard-row" }, [
        el("span", { class: "rank" }, `${i + 1}.`),
        el("span", { style: "flex:1" }, name),
        el("span", { class: "pts" }, `${pts} pts`),
      ])
    );
  });

  return wrap;
}

/* --- 11.7 Painel de administração --- */

function renderAdminPanel() {
  const wrap = el("div", { class: "card section-gap" });
  wrap.appendChild(el("h2", {}, "🔧 Área de administração"));

  ROUNDS.forEach((round) => {
    const gamesOfRound = Object.values(state.games)
      .filter((g) => g.round === round)
      .sort((a, b) => a.order - b.order);
    if (gamesOfRound.length === 0) return;

    wrap.appendChild(el("h3", { style: "margin-top:18px" }, ROUND_LABELS[round]));

    gamesOfRound.forEach((g) => wrap.appendChild(renderAdminGameRow(g)));
  });

  return wrap;
}

function renderAdminGameRow(game) {
  const row = el("div", { class: "admin-game-row" });

  if (game.status === "pending") {
    row.appendChild(el("span", {}, `jogo ${game.order} — equipas por confirmar`));
    return row;
  }

  if (game.status === "locked" && game.result) {
    const r = game.result;
    const winnerName = r.winner === "A" ? game.teamA : game.teamB;
    row.appendChild(
      el("span", {}, `${game.teamA} ${r.scoreA} - ${r.scoreB} ${game.teamB} · venceu ${winnerName} (${modeLabel(r.mode)})`)
    );
    const unlockBtn = el("button", { class: "small danger" }, "🔓 Corrigir");
    unlockBtn.onclick = () => unlockResult(game.id);
    row.appendChild(unlockBtn);
    return row;
  }

  // jogo aberto — admin pode confirmar resultado real
  const form = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap;width:100%" });
  form.appendChild(el("span", { style: "min-width:160px" }, `${game.teamA} vs ${game.teamB}`));

  const winnerSelect = el("select", { style: "width:auto" }, [
    el("option", { value: "A" }, game.teamA),
    el("option", { value: "B" }, game.teamB),
  ]);
  const scoreA = el("input", { type: "number", min: "0", style: "width:54px", placeholder: "0" });
  const scoreB = el("input", { type: "number", min: "0", style: "width:54px", placeholder: "0" });
  const modeSelect = el("select", { style: "width:auto" }, [
    el("option", { value: "regular" }, "tempo regular"),
    el("option", { value: "et" }, "prolongamento"),
    el("option", { value: "pens" }, "pénaltis"),
  ]);

  const confirmBtn = el("button", { class: "small primary" }, "Confirmar resultado");
  confirmBtn.onclick = async () => {
    if (scoreA.value === "" || scoreB.value === "") return;
    await confirmResult(game.id, winnerSelect.value, scoreA.value, scoreB.value, modeSelect.value);
  };

  form.appendChild(winnerSelect);
  form.appendChild(scoreA);
  form.appendChild(scoreB);
  form.appendChild(modeSelect);
  form.appendChild(confirmBtn);
  row.appendChild(form);

  return row;
}

/* ====================================================================
   12. AÇÕES DE NAVEGAÇÃO (logout, sair da sala, etc.)
   ==================================================================== */

async function enterRoom(code) {
  state.room = code;
  const host = await getRoomHost(code);
  state.isHost = host === state.account.name;
  attachRoomListeners();
  render();
}

function leaveRoom() {
  if (state.unsubGames) state.unsubGames();
  if (state.unsubPreds) state.unsubPreds();
  state.room = null;
  state.games = {};
  state.predictions = {};
  state.isHost = false;
  clearSessionRoom();
  render();
}

function logout() {
  leaveRoom();
  state.account = null;
  clearSessionAccount();
  render();
}

adminToggleBtn.addEventListener("click", () => {
  state.adminOpen = !state.adminOpen;
  adminToggleBtn.textContent = state.adminOpen ? "🔧 Fechar administração" : "🔧 Área de administração";
  render();
});

/* ====================================================================
   13. ARRANQUE
   ==================================================================== */

(async function init() {
  const account = loadSessionAccount();
  if (account) state.account = account;

  const room = loadSessionRoom();
  if (account && room) {
    await enterRoom(room);
  } else {
    render();
  }
})();
