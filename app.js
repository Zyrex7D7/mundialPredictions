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
  phase: 3,    // + acertar a fase em que se decidiu (tempo regular / prolongamento / pénaltis) — vale sempre 3, seja qual for a fase
  exact: 5,    // + acertar o resultado exato
};

// Os 32 confrontos da Fase de 32, por ordem. Edita à vontade — a ordem
// aqui define a posição de cada jogo no bracket (R32_PAIRS[0] e [1] dão
// origem ao jogo r16_1, [2] e [3] ao r16_2, etc.)
const R32_PAIRS = [
  ["Alemanha", "Paraguai"],
  ["França", "Suécia"],
  ["África do Sul", "Canadá"],
  ["Holanda", "Marrocos"],
  ["Brasil", "Japão"],
  ["Costa do Marfim", "Noruega"],
  ["México", "Equador"],
  ["Inglaterra", "RD Congo"],
  ["Portugal", "Croácia"],
  ["Espanha", "Áustria"],
  ["Estados Unidos", "Bósnia-Herzegovina"],
  ["Bélgica", "Senegal"],
  ["Argentina", "Cabo Verde"],
  ["Austrália", "Egito"],
  ["Suíça", "Argélia"],
  ["Colômbia", "Gana"],
];

// Data/hora de início de cada jogo (usado para FECHAR as apostas
// automaticamente assim que o jogo começar — depois disto ninguém
// consegue apostar nesse jogo, só ver o formulário fechado).
// Horas no fuso de Portugal continental (verão = +01:00).
// Calendário completo do Mundial 26, do Jogo 73 até à Final (Jogo 104).
const KICKOFFS = {
  // --- Fase de 32 ---
  r32_3:  "2026-06-28T20:00:00+01:00", // Jogo 73 - África do Sul x Canadá
  r32_1:  "2026-06-29T21:30:00+01:00", // Jogo 74 - Alemanha x Paraguai
  r32_5:  "2026-06-29T18:00:00+01:00", // Jogo 76 - Brasil x Japão
  r32_4:  "2026-06-30T02:00:00+01:00", // Jogo 75 - Holanda x Marrocos
  r32_6:  "2026-06-30T18:00:00+01:00", // Jogo 78 - Costa do Marfim x Noruega
  r32_2:  "2026-06-30T22:00:00+01:00", // Jogo 77 - França x Suécia
  r32_7:  "2026-07-01T02:00:00+01:00", // Jogo 79 - México x Equador
  r32_8:  "2026-07-01T17:00:00+01:00", // Jogo 80 - Inglaterra x RD Congo
  r32_12: "2026-07-01T21:00:00+01:00", // Jogo 82 - Bélgica x Senegal
  r32_11: "2026-07-02T01:00:00+01:00", // Jogo 81 - Estados Unidos x Bósnia e Herzegovina
  r32_10: "2026-07-02T20:00:00+01:00", // Jogo 84 - Espanha x Áustria
  r32_9:  "2026-07-03T00:00:00+01:00", // Jogo 83 - Portugal x Croácia
  r32_15: "2026-07-03T04:00:00+01:00", // Jogo 85 - Suíça x Argélia
  r32_14: "2026-07-03T19:00:00+01:00", // Jogo 88 - Austrália x Egito
  r32_13: "2026-07-03T23:00:00+01:00", // Jogo 86 - Argentina x Cabo Verde
  r32_16: "2026-07-04T02:30:00+01:00", // Jogo 87 - Colômbia x Gana

  // --- Oitavos de final ---
  r16_2: "2026-07-04T18:00:00+01:00", // Jogo 90 - Canadá x Marrocos
  r16_1: "2026-07-04T22:00:00+01:00", // Jogo 89 - Paraguai x França
  r16_3: "2026-07-05T21:00:00+01:00", // Jogo 91 - Brasil x Noruega
  r16_4: "2026-07-06T01:00:00+01:00", // Jogo 92 - México x Inglaterra
  r16_5: "2026-07-06T20:00:00+01:00", // Jogo 93 - Vencedor jogo 83 x Vencedor jogo 84
  r16_6: "2026-07-07T01:00:00+01:00", // Jogo 94 - Vencedor jogo 81 x Vencedor jogo 82
  r16_7: "2026-07-07T17:00:00+01:00", // Jogo 95 - Vencedor jogo 86 x Vencedor jogo 88
  r16_8: "2026-07-07T21:00:00+01:00", // Jogo 96 - Vencedor jogo 85 x Vencedor jogo 87

  // --- Quartos de final ---
  qf_1: "2026-07-09T21:00:00+01:00", // Jogo 97 - Vencedor jogo 89 x Vencedor jogo 90
  qf_3: "2026-07-10T20:00:00+01:00", // Jogo 98 - Vencedor jogo 93 x Vencedor jogo 94
  qf_2: "2026-07-12T22:00:00+01:00", // Jogo 99 - Vencedor jogo 91 x Vencedor jogo 92
  qf_4: "2026-07-13T02:00:00+01:00", // Jogo 100 - Vencedor jogo 95 x Vencedor jogo 96

  // --- Meias-finais ---
  sf_1: "2026-07-14T20:00:00+01:00", // Jogo 101 - Vencedor jogo 97 x Vencedor jogo 98
  sf_2: "2026-07-15T20:00:00+01:00", // Jogo 102 - Vencedor jogo 99 x Vencedor jogo 100

  // --- Jogo do 3.º lugar ---
  third_place_1: "2026-07-18T22:00:00+01:00", // Jogo 103 - Derrotado jogo 101 x Derrotado jogo 102

  // --- Final ---
  final_1: "2026-07-19T20:00:00+01:00", // Jogo 104 - Vencedor jogo 101 x Vencedor jogo 102
};

// Jogos que já tinham decorrido/acabado antes de este site sequer
// existir — ninguém teve oportunidade justa de apostar antes da hora.
// Estes ficam automaticamente EXCLUÍDOS da classificação (não somam
// pontos a ninguém) em qualquer sala NOVA criada a partir de agora —
// mas o resultado real continua visível e conta para o bracket avançar
// normalmente. O host pode sempre reverter isto no painel de admin
// (botão "↩️ voltar a contar"), jogo a jogo.
//
// ⚠️ Isto só se aplica a salas criadas de agora em diante. Numa sala
// que já exista no Firebase, os jogos já lá estão gravados com
// scoreExcluded: false — tens de ir ao painel de admin e clicar
// "🚫 tirar pontos" manualmente nesses jogos (uma vez, fica guardado).
const DEFAULT_SCORE_EXCLUDED = [
  "r32_3", // Jogo 73 - África do Sul x Canadá
  "r32_1", // Jogo 74 - Alemanha x Paraguai
  "r32_5", // Jogo 76 - Brasil x Japão
  "r32_4", // Jogo 75 - Holanda x Marrocos
  "r32_6", // Jogo 78 - Costa do Marfim x Noruega
  "r32_2", // Jogo 77 - França x Suécia
];

/* ---------- 1b. BANDEIRAS ----------
   Emojis de bandeira não funcionam bem no Windows (mostra "PY", "CO",
   etc. em vez da imagem) porque dependem da fonte do sistema. Por isso
   usamos imagens reais de um CDN — funcionam iguais em qualquer SO. */

const FLAG_CODES = {
  "Alemanha": "de", "Paraguai": "py", "França": "fr", "Suécia": "se",
  "África do Sul": "za", "Canadá": "ca", "Holanda": "nl", "Marrocos": "ma",
  "Brasil": "br", "Japão": "jp", "Costa do Marfim": "ci", "Noruega": "no",
  "México": "mx", "Equador": "ec", "Inglaterra": "gb-eng", "RD Congo": "cd",
  "Portugal": "pt", "Croácia": "hr", "Espanha": "es", "Áustria": "at",
  "Estados Unidos": "us", "Bósnia-Herzegovina": "ba", "Bélgica": "be", "Senegal": "sn",
  "Argentina": "ar", "Cabo Verde": "cv", "Austrália": "au", "Egito": "eg",
  "Suíça": "ch", "Argélia": "dz", "Colômbia": "co", "Gana": "gh",
};

// Versão em TEXTO simples (sem imagem) — usar só dentro de strings/
// templates onde não dá para meter um elemento de imagem (ex: toast).
function teamLabel(name) {
  return name || "";
}

// Versão visual — devolve um <span> com a bandeira (imagem) + o nome.
// Usar como filho de el(...) em vez de dentro de uma string.
function teamLabelNode(name) {
  const wrap = el("span", { style: "display:inline-flex;align-items:center;gap:6px;justify-content:center;vertical-align:middle" });
  const code = FLAG_CODES[name];
  if (code) {
    const img = el("img", {
      src: `https://flagcdn.com/24x18/${code}.png`,
      alt: "",
      style: "width:20px;height:auto;border-radius:2px;flex-shrink:0;display:inline-block",
      onerror: function () { this.remove(); },
    });
    wrap.appendChild(img);
  }
  wrap.appendChild(document.createTextNode(name || ""));
  return wrap;
}

/* ---------- 1c. TOAST (aviso rápido no canto do ecrã) ---------- */

function showToast(msg) {
  const toast = el("div", { class: "toast" }, msg);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

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
  expandedPlayer: null,  // id do jogador cujas apostas estão abertas na classificação
  importBoxOpen: false,  // caixa de "importar apostas de outra sala" aberta/fechada
};

const ROUNDS = ["r32", "r16", "qf", "sf", "third_place", "final"];
const ROUND_LABELS = {
  r32: "Fase de 32",
  r16: "Oitavos",
  qf: "Quartos",
  sf: "Meias",
  third_place: "3.º Lugar",
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
      kickoff: KICKOFFS[id] || null,
      lateExceptions: {},  // { [idDoJogador]: true } — autorizações do host para apostar depois da hora
      scoreExcluded: DEFAULT_SCORE_EXCLUDED.includes(id),  // true = jogo não conta para a classificação (ex: já tinha começado quando a sala foi criada)
    };
  });

  // Função genérica para gerar uma ronda seguinte a partir da anterior,
  // emparelhando jogos consecutivos (1+2, 3+4, ...). Isto funciona para
  // Fase de 32 → Oitavos → Quartos, mas NÃO para Quartos → Meias: no
  // calendário oficial do Mundial 26, a Meia 1 (Jogo 101) é o vencedor
  // do Jogo 97 x vencedor do Jogo 98 — e esses correspondem a qf_1 e
  // qf_3 (não qf_1 e qf_2). A Meia 2 (Jogo 102) é qf_2 x qf_4. Por isso
  // as Meias usam um mapa de ligações explícito em vez do padrão
  // genérico "1+2, 3+4".
  function buildRound(roundId, prevRoundId, prevCount, explicitPairs) {
    const count = explicitPairs ? explicitPairs.length : prevCount / 2;
    for (let i = 1; i <= count; i++) {
      const id = `${roundId}_${i}`;
      const sourceA = explicitPairs ? `${prevRoundId}_${explicitPairs[i - 1][0]}` : `${prevRoundId}_${2 * i - 1}`;
      const sourceB = explicitPairs ? `${prevRoundId}_${explicitPairs[i - 1][1]}` : `${prevRoundId}_${2 * i}`;
      games[id] = {
        id, round: roundId, order: i,
        teamA: null, teamB: null,
        sourceA, sourceB,
        status: "pending",
        result: null,
        kickoff: KICKOFFS[id] || null,
        lateExceptions: {},
        scoreExcluded: false,
      };
    }
    return count;
  }

  let prevCount = 16;
  prevCount = buildRound("r16", "r32", prevCount);
  prevCount = buildRound("qf", "r16", prevCount);
  // Meias: ligações reais do calendário (Jogo101 = venc.97 x venc.98 = qf_1 x qf_3;
  // Jogo102 = venc.99 x venc.100 = qf_2 x qf_4), não o padrão genérico 1+2 / 3+4.
  prevCount = buildRound("sf", "qf", prevCount, [[1, 3], [2, 4]]);
  buildRound("final", "sf", prevCount);

  // Jogo do 3.º lugar (Jogo 103) — o único jogo do bracket que é
  // alimentado pelos PERDEDORES das meias-finais, não pelos vencedores.
  // Por isso usa loserSourceA/loserSourceB em vez de sourceA/sourceB
  // (ver confirmResult, que avança perdedor OU vencedor conforme o
  // tipo de ligação de cada jogo seguinte).
  games["third_place_1"] = {
    id: "third_place_1", round: "third_place", order: 1,
    teamA: null, teamB: null,
    sourceA: null, sourceB: null,
    loserSourceA: "sf_1", loserSourceB: "sf_2",
    status: "pending",
    result: null,
    kickoff: KICKOFFS.third_place_1 || null,
    lateExceptions: {},
    scoreExcluded: false,
  };

  return games;
}

/* ---------- 5. PONTOS ---------- */

// prediction: { winner: 'A'|'B', scoreA, scoreB, mode }
// result:     { winner: 'A'|'B', scoreA, scoreB, mode }
function calcPoints(prediction, result) {
  if (!prediction || !result) return 0;
  if (prediction.winner !== result.winner) return 0;

  let pts = POINTS.advance;
  if (prediction.mode === result.mode) pts += POINTS.phase;
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

// Cria uma conta NOVA. Dá erro se já existir uma conta com este nome,
// para evitar criar contas a mais por engano de digitação.
async function signup(name, password) {
  const id = normalizeCode(name);
  if (!id) throw new Error("Escreve um nome válido.");
  if (!password) throw new Error("Escreve uma password.");

  const ref = db.collection("accounts").doc(id);
  const snap = await ref.get();

  if (snap.exists) {
    throw new Error(`Já existe uma conta com o nome "${name}". Se é a tua, usa o botão "Entrar".`);
  }

  await ref.set({ displayName: name.trim(), password });
  return { name: name.trim(), password };
}

// Entra numa conta que já existe. Dá erro se o nome não existir ou se a
// password estiver errada — assim ninguém cria contas novas sem querer
// ao escrever mal o nome que já usou antes.
async function login(name, password) {
  const id = normalizeCode(name);
  if (!id) throw new Error("Escreve um nome válido.");
  if (!password) throw new Error("Escreve uma password.");

  const ref = db.collection("accounts").doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error(`Não existe nenhuma conta com o nome "${name}". Confirma se escreveste bem, ou usa "Criar conta".`);
  }

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

// Deixa a pessoa trazer as SUAS PRÓPRIAS apostas (mesma conta) de uma
// sala antiga para a sala em que está agora — útil quando alguém
// apostou por engano na sala errada, ou quando um grupo se junta numa
// sala nova depois de ter começado noutra. Nunca mexe nas apostas de
// mais ninguém. Jogo a jogo: se a pessoa já tiver apostado no mesmo
// jogo nesta sala, a versão importada substitui-a; jogos que só
// existem numa das duas salas mantêm-se como estavam.
async function importMyPredictionsFromRoom(fromRoomCode) {
  const fromCode = normalizeCode(fromRoomCode);
  if (!fromCode) throw new Error("Escreve o código da sala de onde queres importar.");
  if (fromCode === state.room) throw new Error("Essa já é a sala em que estás.");

  const myId = normalizeCode(state.account.name);
  const sourceSnap = await db.collection("rooms").doc(fromCode)
    .collection("predictions").doc(myId).get();

  if (!sourceSnap.exists || !sourceSnap.data().picks) {
    throw new Error(`Não encontrei apostas tuas na sala "${fromCode}".`);
  }

  const sourcePicks = sourceSnap.data().picks;
  await predictionsDocRef(state.account.name).set(
    { displayName: state.account.name, picks: sourcePicks },
    { merge: true }
  );

  return Object.keys(sourcePicks).length;
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
  const losingTeam = winnerSide === "A" ? game.teamB : game.teamA;

  // avança a equipa vencedora (ou, no caso do jogo do 3.º lugar, a
  // perdedora) para o jogo seguinte, se houver
  const nextGames = Object.values(state.games).filter(
    (g) => g.sourceA === gameId || g.sourceB === gameId ||
           g.loserSourceA === gameId || g.loserSourceB === gameId
  );

  for (const ng of nextGames) {
    const update = {};
    if (ng.sourceA === gameId) update.teamA = winningTeam;
    if (ng.sourceB === gameId) update.teamB = winningTeam;
    if (ng.loserSourceA === gameId) update.teamA = losingTeam;
    if (ng.loserSourceB === gameId) update.teamB = losingTeam;

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

// Permite que o host autorize UMA pessoa específica a apostar mesmo
// depois da hora de início (ex: esqueceu-se). Não reabre o jogo para
// mais ninguém — só essa pessoa deixa de ver o formulário fechado.
async function grantLateException(gameId, playerName) {
  const pid = normalizeCode(playerName);
  if (!pid) throw new Error("Escreve o nome do jogador.");
  const gamesCol = db.collection("rooms").doc(state.room).collection("games");
  await gamesCol.doc(gameId).update({ [`lateExceptions.${pid}`]: true });
  return pid;
}

async function revokeLateException(gameId, playerId) {
  const gamesCol = db.collection("rooms").doc(state.room).collection("games");
  await gamesCol.doc(gameId).update({ [`lateExceptions.${playerId}`]: firebase.firestore.FieldValue.delete() });
}

// Permite ao host excluir (ou voltar a incluir) um jogo do cálculo da
// classificação — útil para jogos que já tinham começado/acabado antes
// de a sala ter sido criada, onde ninguém teve oportunidade justa de
// apostar antes da hora. O jogo continua a aparecer normalmente (com o
// resultado real e o feedback de cada um), só deixa de contar pontos.
async function toggleScoreExclusion(gameId, exclude) {
  const gamesCol = db.collection("rooms").doc(state.room).collection("games");
  await gamesCol.doc(gameId).update({ scoreExcluded: exclude });
}

// ---------------------------------------------------------------------
// Atualiza uma sala JÁ CRIADA para receber as novidades de código mais
// recentes (horários, ligação correta das meias-finais, etc.) SEM
// apagar nem tocar em nada que já lá esteja: apostas, resultados
// confirmados e equipas já avançadas ficam exatamente na mesma. Isto
// existe porque os jogos de uma sala só são criados UMA VEZ, no
// momento em que a sala nasce — atualizações posteriores ao código
// (como acrescentar `kickoff`) nunca chegavam a uma sala já existente,
// e a única forma de as aplicar era apagar a sala toda (perdendo os
// dados). Este botão resolve isso em definitivo, jogo a jogo:
//   - kickoff: sincronizado sempre com o calendário mais recente do
//     código (é só informação de horário, não é escolha de ninguém).
//   - sourceA / sourceB: sincronizados sempre com a estrutura mais
//     recente do bracket (corrige, por ex., o bug em que as
//     meias-finais ligavam aos quartos errados) — nunca mexe em
//     teamA/teamB, que é o progresso real já feito.
//   - lateExceptions / scoreExcluded: só é criado se AINDA NÃO
//     existir nesse jogo — nunca apaga uma decisão que o host já
//     tenha tomado manualmente.
async function migrateRoomGames(roomCode) {
  const gamesCol = db.collection("rooms").doc(roomCode).collection("games");
  const snap = await gamesCol.get();
  if (snap.empty) return { updated: 0, created: 0, total: 0 };

  const template = buildEmptyBracket();
  const batch = db.batch();
  let updated = 0;
  let created = 0;

  const existingIds = new Set();
  snap.forEach((docSnap) => {
    existingIds.add(docSnap.id);
    const id = docSnap.id;
    const tpl = template[id];
    if (!tpl) return; // jogo que já não existe na estrutura atual — não mexe

    const data = docSnap.data();
    const patch = {};

    if (data.kickoff !== tpl.kickoff) patch.kickoff = tpl.kickoff || null;
    if (data.sourceA !== tpl.sourceA) patch.sourceA = tpl.sourceA;
    if (data.sourceB !== tpl.sourceB) patch.sourceB = tpl.sourceB;
    if ((data.loserSourceA || null) !== (tpl.loserSourceA || null)) patch.loserSourceA = tpl.loserSourceA || null;
    if ((data.loserSourceB || null) !== (tpl.loserSourceB || null)) patch.loserSourceB = tpl.loserSourceB || null;
    if (data.lateExceptions === undefined) patch.lateExceptions = {};
    if (data.scoreExcluded === undefined) patch.scoreExcluded = tpl.scoreExcluded;

    if (Object.keys(patch).length > 0) {
      batch.update(docSnap.ref, patch);
      updated++;
    }
  });

  // Jogos que existem na estrutura mais recente mas ainda não existem
  // nesta sala (ex: o jogo do 3.º lugar, acrescentado mais tarde) —
  // são criados de raiz, sem afetar nenhum dos jogos já existentes.
  Object.values(template).forEach((tpl) => {
    if (!existingIds.has(tpl.id)) {
      batch.set(gamesCol.doc(tpl.id), tpl);
      created++;
    }
  });

  if (updated > 0 || created > 0) await batch.commit();
  return { updated, created, total: snap.size + created };
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

  const btnRow = el("div", { style: "display:flex;gap:10px;margin-top:16px" });

  const loginBtn = el("button", { class: "primary", style: "flex:1" }, "Entrar");
  loginBtn.onclick = async () => {
    try {
      const account = await login(nameInput.value, passInput.value);
      state.account = account;
      saveSessionAccount(account);
      render();
    } catch (e) {
      showError(card, e.message);
    }
  };

  const signupBtn = el("button", { style: "flex:1" }, "Criar conta");
  signupBtn.onclick = async () => {
    try {
      const account = await signup(nameInput.value, passInput.value);
      state.account = account;
      saveSessionAccount(account);
      render();
    } catch (e) {
      showError(card, e.message);
    }
  };

  btnRow.appendChild(loginBtn);
  btnRow.appendChild(signupBtn);
  card.appendChild(btnRow);

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
  const finalLocked = state.games.final_1 && state.games.final_1.status === "locked";

  const tabs = el("div", { class: "round-tabs" });
  ROUNDS.forEach((r) => {
    const btn = el("button", { class: r === currentTab ? "active" : "" }, ROUND_LABELS[r]);
    btn.onclick = () => { currentTab = r; render(); };
    tabs.appendChild(btn);
  });
  if (finalLocked) {
    const summaryBtn = el("button", { class: "summary-tab" + (currentTab === "summary" ? " active" : "") }, "🏆 Resumo Final");
    summaryBtn.onclick = () => { currentTab = "summary"; render(); };
    tabs.appendChild(summaryBtn);
  }
  appEl.appendChild(tabs);
  appEl.appendChild(renderImportBox());

  if (currentTab === "summary" && finalLocked) {
    appEl.appendChild(renderFinalSummary());
    appEl.appendChild(renderLeaderboard());
    if (state.adminOpen && state.isHost) appEl.appendChild(renderAdminPanel());
    return;
  }

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

// Caixa colapsável para trazer as próprias apostas de uma sala antiga
// (mesma conta) para a sala atual. Fica fechada por omissão para não
// atrapalhar quem não precisa.
function renderImportBox() {
  const box = el("div", { class: "card import-box" });

  const toggleBtn = el("button", { class: "link-btn" },
    state.importBoxOpen ? "▲ importar apostas de outra sala" : "📥 já apostaste noutra sala? importa aqui");
  toggleBtn.onclick = () => { state.importBoxOpen = !state.importBoxOpen; render(); };
  box.appendChild(toggleBtn);

  if (state.importBoxOpen) {
    box.appendChild(el("p", { style: "margin:10px 0" },
      "Traz as TUAS apostas de uma sala antiga (com esta mesma conta) para esta sala. Jogo a jogo: se já tiveres apostado no mesmo jogo aqui, a versão importada substitui-a; apostas de jogos que só existem numa das duas salas mantêm-se."));
    const codeInput = el("input", { type: "text", placeholder: "código da sala antiga" });
    box.appendChild(codeInput);
    const importBtn = el("button", { class: "primary", style: "margin-top:10px" }, "Importar as minhas apostas");
    importBtn.onclick = async () => {
      try {
        const count = await importMyPredictionsFromRoom(codeInput.value);
        showToast(`✅ ${count} apostas importadas`);
        state.importBoxOpen = false;
        render();
      } catch (e) {
        showError(box, e.message);
      }
    };
    box.appendChild(importBtn);
  }

  return box;
}

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
  const myId = normalizeCode(state.account.name);
  const hasLateException = !!(game.lateExceptions && game.lateExceptions[myId]);
  const kickoffPassed = !locked && game.kickoff && new Date(game.kickoff).getTime() <= Date.now() && !hasLateException;

  const teamsRow = el("div", { class: "teams-row" });
  const teamABtn = el("div", { class: pickClass("A") }, teamLabelNode(game.teamA));
  const teamBBtn = el("div", { class: pickClass("B") }, teamLabelNode(game.teamB));

  function pickClass(side) {
    let cls = "team-pick";
    if (locked && result) {
      cls += result.winner === side ? " winner" : " loser";
      if (myPick && myPick.winner === side) {
        cls += result.winner === side ? " my-pick-correct" : " my-pick-wrong";
      }
    } else if (local.winner === side) {
      cls += " selected";
    }
    return cls;
  }
  function refreshTeamClasses() {
    teamABtn.className = pickClass("A");
    teamBBtn.className = pickClass("B");
  }

  teamsRow.appendChild(teamABtn);
  teamsRow.appendChild(el("span", { class: "vs-label" }, "vs"));
  teamsRow.appendChild(teamBBtn);
  card.appendChild(teamsRow);

  /* ---- jogo já confirmado: mostra resultado real + feedback verde/vermelho ---- */
  if (locked) {
    card.appendChild(
      el("p", { style: "text-align:center;font-size:13px;color:var(--text-dim)" },
        `Resultado real: ${result.scoreA} - ${result.scoreB} (${modeLabel(result.mode)})`)
    );

    if (myPick) {
      const winnerCorrect = myPick.winner === result.winner;
      const modeCorrect = myPick.mode === result.mode;
      const exactCorrect = Number(myPick.scoreA) === Number(result.scoreA) &&
                            Number(myPick.scoreB) === Number(result.scoreB);
      const myWinnerNode = teamLabelNode(myPick.winner === "A" ? game.teamA : game.teamB);
      const pts = calcPoints(myPick, result);

      const feedback = el("div", { class: "feedback-box" });
      feedback.appendChild(feedbackRow("Quem ganha", myWinnerNode, winnerCorrect));
      feedback.appendChild(feedbackRow("Fase (regular / prolong. / pénaltis)", modeLabel(myPick.mode), modeCorrect));
      feedback.appendChild(feedbackRow("Resultado exato", `${myPick.scoreA} - ${myPick.scoreB}`, exactCorrect));
      card.appendChild(feedback);

      card.appendChild(
        el("div", { style: "text-align:center" },
          el("span", { class: "points-pill" + (game.scoreExcluded ? " excluded" : "") },
            game.scoreExcluded
              ? "este jogo não conta para a classificação"
              : `a tua aposta valeu ${pts} pontos`))
      );
    } else {
      card.appendChild(el("p", { class: "pending-msg", style: "text-align:center" }, "não fizeste aposta a este jogo"));
    }
    return card;
  }

  /* ---- apostas fechadas porque o jogo já começou (e ainda sem resultado) ----
     A pessoa continua a ver sempre a SUA PRÓPRIA aposta (só não pode
     mudá-la) — só não vê as apostas de outros, isso continua a
     depender do jogo estar confirmado (ver renderPlayerPicksDetail). */
  if (kickoffPassed) {
    if (myPick) {
      const myWinnerNode = teamLabelNode(myPick.winner === "A" ? game.teamA : game.teamB);
      card.appendChild(
        el("div", { class: "my-locked-pick" }, [
          el("p", { class: "pending-msg", style: "margin:0 0 6px" }, "🔒 a tua aposta (já não pode ser alterada):"),
          el("div", { class: "ppd-compare-line", style: "justify-content:center;gap:16px;font-size:14px" }, [
            myWinnerNode,
            el("span", { class: "ppd-compare-score" }, `${myPick.scoreA} - ${myPick.scoreB}`),
            el("span", { class: "pending-msg" }, `(${modeLabel(myPick.mode)})`),
          ]),
        ])
      );
    }
    card.appendChild(el("p", { class: "pending-msg", style: "text-align:center" },
      "⏱️ as apostas fecharam — o jogo já começou. assim que o resultado for confirmado vês aqui como te saíste."));
    return card;
  }

  /* ---- jogo aberto — formulário de aposta ----
     O vencedor é deduzido automaticamente do resultado que escreves.
     Só podes escolher manualmente quem ganha quando o resultado fica
     empatado — nesse caso só pode ter sido decidido nos pénaltis. */
  if (game.kickoff && !hasLateException) {
    card.appendChild(renderCountdown(game.kickoff));
  }

  const scoreRow = el("div", { class: "score-row" });
  const scoreA = el("input", { type: "number", min: "0", placeholder: "golos " + game.teamA, value: local.scoreA });
  const scoreB = el("input", { type: "number", min: "0", placeholder: "golos " + game.teamB, value: local.scoreB });

  if (hasLateException) {
    card.appendChild(el("p", { class: "pending-msg" }, "⏱️ o jogo já começou, mas o host autorizou-te a apostar na mesma."));
  }

  const modeSelect = el("select", {}, [
    el("option", { value: "regular" }, "Tempo regular"),
    el("option", { value: "et" }, "Prolongamento"),
    el("option", { value: "pens" }, "Grandes penalidades"),
  ]);
  const pensOption = modeSelect.querySelector('option[value="pens"]');

  const hint = el("p", { class: "pending-msg", style: "margin:6px 0 0" }, "");

  function recomputeFromScore() {
    if (local.scoreA === "" || local.scoreB === "") {
      local.winner = null;
      hint.textContent = "";
      return;
    }
    const a = Number(local.scoreA);
    const b = Number(local.scoreB);
    if (a === b) {
      // empate no resultado só é possível se foi a pénaltis
      local.mode = "pens";
      if (local.winner !== "A" && local.winner !== "B") local.winner = null;
      hint.textContent = "empate → só pode ter sido decidido nos pénaltis. escolhe em cima quem venceu.";
    } else {
      local.winner = a > b ? "A" : "B";
      if (local.mode === "pens") local.mode = "et";
      hint.textContent = "vencedor escolhido automaticamente pelo resultado.";
    }
  }

  function updateInteractivity() {
    const tied = local.scoreA !== "" && local.scoreB !== "" && Number(local.scoreA) === Number(local.scoreB);
    teamABtn.style.cursor = tied ? "pointer" : "default";
    teamBBtn.style.cursor = tied ? "pointer" : "default";
    teamABtn.onclick = tied ? () => { local.winner = "A"; refreshTeamClasses(); } : null;
    teamBBtn.onclick = tied ? () => { local.winner = "B"; refreshTeamClasses(); } : null;
    pensOption.style.display = tied ? "" : "none";
    modeSelect.disabled = tied;
    modeSelect.value = local.mode;
    refreshTeamClasses();
  }

  scoreA.oninput = () => { local.scoreA = scoreA.value; recomputeFromScore(); updateInteractivity(); };
  scoreB.oninput = () => { local.scoreB = scoreB.value; recomputeFromScore(); updateInteractivity(); };

  scoreRow.appendChild(scoreA);
  scoreRow.appendChild(scoreB);
  card.appendChild(scoreRow);
  card.appendChild(modeSelect);
  card.appendChild(hint);

  updateInteractivity();

  const saveBtn = el("button", { class: "primary", style: "width:100%;margin-top:10px" }, myPick ? "Atualizar aposta" : "Guardar aposta");
  saveBtn.onclick = async () => {
    if (local.scoreA === "" || local.scoreB === "") return showError(card, "Preenche o resultado.");
    if (!local.winner) return showError(card, "Resultado empatado: escolhe quem venceu nos pénaltis.");
    await savePick(game.id, {
      winner: local.winner,
      scoreA: Number(local.scoreA),
      scoreB: Number(local.scoreB),
      mode: local.mode,
    });
    showToast(`✅ aposta guardada: ${game.teamA} ${local.scoreA} - ${local.scoreB} ${game.teamB}`);
  };
  card.appendChild(saveBtn);

  return card;
}

function feedbackRow(label, value, correct) {
  return el("div", { class: "feedback-row " + (correct ? "correct" : "wrong") }, [
    el("span", {}, label),
    el("span", { class: "feedback-value" }, [value, ` ${correct ? "✅" : "❌"}`]),
  ]);
}

function modeLabel(mode) {
  return { regular: "tempo regular", et: "prolongamento", pens: "grandes penalidades" }[mode] || mode;
}

// Contagem decrescente até as apostas fecharem (hora de início do jogo).
// Atualiza-se sozinha a cada segundo sem precisar de re-renderizar o
// resto da página (evita perder o que a pessoa está a escrever).
function renderCountdown(kickoffIso) {
  const pill = el("span", { class: "countdown-pill" }, "");
  let timer = null;

  function update() {
    if (timer !== null && !document.body.contains(pill)) { clearInterval(timer); return; }
    const diff = new Date(kickoffIso).getTime() - Date.now();
    if (diff <= 0) {
      pill.textContent = "⏱️ as apostas vão fechar a qualquer momento";
      if (timer !== null) clearInterval(timer);
      return;
    }
    const totalMin = Math.floor(diff / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    let txt = "⏱️ fecha em ";
    if (days > 0) txt += `${days}d ${hours}h`;
    else if (hours > 0) txt += `${hours}h ${mins}min`;
    else txt += `${mins}min`;
    pill.textContent = txt;
  }

  update();
  timer = setInterval(update, 1000);
  return el("div", { style: "text-align:center;margin-bottom:8px" }, pill);
}

/* --- 11.6 Classificação --- */

function renderLeaderboard() {
  const wrap = el("div", { class: "card section-gap" });
  wrap.appendChild(el("h2", {}, "🏅 Classificação"));
  wrap.appendChild(el("p", { style: "margin-top:-6px" }, "clica num nome para ver as apostas dessa pessoa nos jogos já confirmados."));

  const totals = {};
  Object.entries(state.predictions).forEach(([playerId, data]) => {
    let total = 0;
    Object.entries(data.picks || {}).forEach(([gameId, pick]) => {
      const game = state.games[gameId];
      if (game && game.status === "locked" && game.result && !game.scoreExcluded) {
        total += calcPoints(pick, game.result);
      }
    });
    totals[playerId] = { name: data.displayName || playerId, pts: total };
  });

  const ranking = Object.entries(totals).sort((a, b) => b[1].pts - a[1].pts);

  if (ranking.length === 0) {
    wrap.appendChild(el("p", {}, "Ainda ninguém fez previsões nesta sala."));
    return wrap;
  }

  const myId = normalizeCode(state.account.name);

  ranking.forEach(([playerId, info], i) => {
    const isMe = playerId === myId;
    const row = el("div", { class: "leaderboard-row clickable" + (isMe ? " own-row" : "") });
    row.appendChild(el("span", { class: "rank" }, `${i + 1}.`));
    row.appendChild(el("span", { style: "flex:1" }, isMe ? `${info.name} (tu)` : info.name));
    row.appendChild(el("span", { class: "pts" }, `${info.pts} pts`));
    row.onclick = () => {
      state.expandedPlayer = state.expandedPlayer === playerId ? null : playerId;
      render();
    };
    wrap.appendChild(row);

    if (state.expandedPlayer === playerId) {
      wrap.appendChild(renderPlayerPicksDetail(state.predictions[playerId]));
    }
  });

  return wrap;
}

// Mostra as apostas de um jogador, mas só para jogos já confirmados —
// enquanto um jogo não tem resultado real ninguém vê a aposta de
// ninguém (a própria pessoa continua a ver sempre a sua, no cartão do
// jogo lá em cima).
function renderPlayerPicksDetail(data) {
  const box = el("div", { class: "player-picks-detail" });
  const picks = (data && data.picks) || {};

  const lockedGames = Object.values(state.games)
    .filter((g) => g.status === "locked")
    .sort((a, b) => ROUNDS.indexOf(a.round) - ROUNDS.indexOf(b.round) || a.order - b.order);

  if (lockedGames.length === 0) {
    box.appendChild(el("p", { class: "pending-msg" }, "ainda nenhum jogo desta sala tem resultado confirmado."));
    return box;
  }

  let currentRound = null;
  let totalPts = 0;

  lockedGames.forEach((game) => {
    if (game.round !== currentRound) {
      currentRound = game.round;
      box.appendChild(el("div", { class: "ppd-round-header" }, ROUND_LABELS[currentRound]));
    }

    const pick = picks[game.id];
    const row = el("div", { class: "ppd-row" });

    const teams = el("div", { class: "ppd-teams" }, [
      teamLabelNode(game.teamA), el("span", { class: "vs-label" }, " vs "), teamLabelNode(game.teamB),
    ]);
    row.appendChild(teams);

    if (!pick) {
      row.appendChild(el("div", { class: "ppd-nobet" }, "sem aposta"));
      box.appendChild(row);
      return;
    }

    const result = game.result;
    const winnerCorrect = pick.winner === result.winner;
    const modeCorrect = pick.mode === result.mode;
    const exactCorrect = Number(pick.scoreA) === Number(result.scoreA) &&
                          Number(pick.scoreB) === Number(result.scoreB);
    const pts = calcPoints(pick, result);
    if (!game.scoreExcluded) totalPts += pts;

    const compare = el("div", { class: "ppd-compare" }, [
      el("div", { class: "ppd-compare-line" }, [
        el("span", { class: "ppd-compare-label" }, "apostou"),
        el("span", { class: "ppd-compare-score" }, `${pick.scoreA} - ${pick.scoreB}`),
      ]),
      el("div", { class: "ppd-compare-line" }, [
        el("span", { class: "ppd-compare-label" }, "real"),
        el("span", { class: "ppd-compare-score" }, `${result.scoreA} - ${result.scoreB}`),
      ]),
    ]);
    row.appendChild(compare);

    const badges = el("div", { class: "ppd-badges" }, [
      ppdBadge("vencedor", winnerCorrect),
      ppdBadge("fase", modeCorrect),
      ppdBadge("exato", exactCorrect),
    ]);
    row.appendChild(badges);

    if (game.scoreExcluded) {
      row.appendChild(el("span", { class: "points-pill excluded" }, "não conta"));
    } else {
      row.appendChild(el("span", { class: "points-pill" }, `${pts} pts`));
    }

    box.appendChild(row);
  });

  box.appendChild(el("div", { class: "ppd-total" }, `Total nesta sala: ${totalPts} pts`));

  return box;
}

function ppdBadge(label, correct) {
  return el("span", { class: "ppd-badge " + (correct ? "correct" : "wrong") }, `${correct ? "✅" : "❌"} ${label}`);
}

/* --- 11.6b Resumo Final (pódio + estatísticas + comentários) ---
   Só aparece quando a final está confirmada. Calcula, por jogador,
   quantos vencedores/fases/resultados exatos acertou ao longo de toda
   a competição (jogos excluídos da pontuação continuam a contar aqui
   como "acerto", já que isto é estatística de conhecimento de
   futebol, não a classificação oficial). */

function computePlayerStats() {
  const lockedGames = Object.values(state.games).filter((g) => g.status === "locked" && g.result);

  return Object.entries(state.predictions).map(([playerId, data]) => {
    const name = data.displayName || playerId;
    const picks = data.picks || {};
    let points = 0, correctWinners = 0, correctPhases = 0, correctExact = 0, totalBets = 0;

    lockedGames.forEach((game) => {
      const pick = picks[game.id];
      if (!pick) return;
      totalBets++;
      const result = game.result;
      const winnerOk = pick.winner === result.winner;
      if (winnerOk) correctWinners++;
      if (pick.mode === result.mode) correctPhases++;
      if (Number(pick.scoreA) === Number(result.scoreA) && Number(pick.scoreB) === Number(result.scoreB)) correctExact++;
      if (!game.scoreExcluded) points += calcPoints(pick, result);
    });

    return { playerId, name, points, correctWinners, correctPhases, correctExact, totalBets };
  }).sort((a, b) => b.points - a.points);
}

function renderFinalSummary() {
  const wrap = el("div", { class: "card section-gap" });
  const stats = computePlayerStats();

  wrap.appendChild(el("h2", {}, "🏆 Resumo do Mundial 26"));

  if (stats.length === 0) {
    wrap.appendChild(el("p", {}, "Ninguém fez previsões nesta sala."));
    return wrap;
  }

  wrap.appendChild(renderPodium(stats));
  wrap.appendChild(renderAwards(stats));
  wrap.appendChild(renderRoasts(stats));

  return wrap;
}

// Pódio visual com os 3 primeiros por pontos (2º-1º-3º, como um pódio a sério)
function renderPodium(stats) {
  const box = el("div", { class: "podium" });
  const order = [stats[1], stats[0], stats[2]]; // 2º, 1º, 3º
  const heights = [110, 150, 85];
  const medals = ["🥈", "🥇", "🥉"];

  order.forEach((p, i) => {
    const col = el("div", { class: "podium-col" });
    col.appendChild(el("div", { class: "podium-name" }, p ? p.name : "—"));
    col.appendChild(el("div", { class: "podium-pts" }, p ? `${p.points} pts` : ""));
    col.appendChild(el("div", { class: "podium-bar", style: `height:${heights[i]}px` }, medals[i]));
    box.appendChild(col);
  });

  return box;
}

// Pequenos "prémios" por categoria — quem mais acertou em cada coisa
function renderAwards(stats) {
  const box = el("div", { class: "awards-grid" });

  const topBy = (key, label, icon) => {
    const best = [...stats].sort((a, b) => b[key] - a[key])[0];
    if (!best || best[key] === 0) return null;
    return el("div", { class: "award-card" }, [
      el("div", { class: "award-icon" }, icon),
      el("div", { class: "award-label" }, label),
      el("div", { class: "award-name" }, best.name),
      el("div", { class: "award-value" }, `${best[key]}`),
    ]);
  };

  [
    topBy("correctWinners", "Mais vencedores certos", "🎯"),
    topBy("correctExact", "Mais resultados exatos", "🔮"),
    topBy("correctPhases", "Mais fases certas (regular/prolong./pénaltis)", "⏱️"),
  ].forEach((card) => { if (card) box.appendChild(card); });

  return box;
}

// Comentários "picantes" com humor sobre cada lugar do pódio + lanterna vermelha
function renderRoasts(stats) {
  const box = el("div", { class: "roasts" });

  const first = stats[0];
  const second = stats[1];
  const third = stats[2];
  const last = stats[stats.length - 1];

  if (first) {
    box.appendChild(roastCard("🥇", `${first.name} — o topo`,
      `${first.points} pontos e uma atitude completamente insuportável a partir de agora, garantido. ` +
      `Acertaste ${first.correctWinners} vencedores e ${first.correctExact} resultados exatos — ou percebes mesmo de futebol, ou tens um acordo secreto com a bola. De qualquer forma, aproveita o troféu imaginário, porque para o ano começas do zero como toda a gente.`));
  }

  if (second) {
    box.appendChild(roastCard("🥈", `${second.name} — tão perto, tão longe`,
      `${second.points} pontos, a uma unha de distância da glória. É o pódio mais frustrante que existe: alto o suficiente para cheirar o ouro, baixo o suficiente para nunca lhe tocar. Vais dormir bem esta noite? Boa pergunta.`));
  }

  if (third) {
    box.appendChild(roastCard("🥉", `${third.name} — entrou pela porta do cão`,
      `${third.points} pontos e um lugar no pódio que, sejamos honestos, ninguém vai lembrar daqui a um ano. Mas contam-se é os presentes, e tu estiveste presente. Parabéns pelo bronze de participação.`));
  }

  if (last && stats.length > 3) {
    box.appendChild(roastCard("🚨", `${last.name} — a lanterna vermelha`,
      `${last.points} pontos. Impressionante, no mau sentido — dava para apostar de olhos fechados e sair-se melhor. Já pensaste em apostar contra as tuas próprias escolhas para o ano? Estatisticamente parece ser a jogada certa.`));
  }

  return box;
}

function roastCard(icon, title, text) {
  return el("div", { class: "roast-card" }, [
    el("div", { class: "roast-title" }, `${icon} ${title}`),
    el("p", { class: "roast-text" }, text),
  ]);
}

/* --- 11.7 Painel de administração --- */

function renderAdminPanel() {
  const wrap = el("div", { class: "card section-gap" });
  wrap.appendChild(el("h2", {}, "🔧 Área de administração"));

  wrap.appendChild(renderRoomUpdateBox());

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

// Caixa para o host puxar as novidades de código (horários, correção
// do bracket, etc.) para dentro desta sala já criada, sem apagar nada.
function renderRoomUpdateBox() {
  const box = el("div", { style: "border:1px solid var(--gold); border-radius:var(--radius); padding:12px; margin-bottom:18px" });
  box.appendChild(el("p", { style: "margin:0 0 8px" },
    "💡 Sempre que eu acrescentar novidades ao site (horários, correções ao bracket, etc.), clica aqui para as trazer para esta sala — não apaga nem altera nenhuma aposta, resultado confirmado ou equipa já avançada."));
  const btn = el("button", { class: "primary" }, "🔄 Atualizar esta sala com as novidades mais recentes");
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "a atualizar...";
    try {
      const { updated, created, total } = await migrateRoomGames(state.room);
      if (updated === 0 && created === 0) {
        showToast("✅ já estava tudo atualizado");
      } else {
        const parts = [];
        if (created > 0) parts.push(`${created} jogo(s) novo(s) criado(s)`);
        if (updated > 0) parts.push(`${updated} de ${total} jogos atualizados`);
        showToast(`✅ ${parts.join(", ")}`);
      }
    } catch (e) {
      showError(box, e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔄 Atualizar esta sala com as novidades mais recentes";
    }
  };
  box.appendChild(btn);
  return box;
}

function renderAdminGameRow(game) {
  const row = el("div", { class: "admin-game-row" });

  if (game.status === "pending") {
    row.appendChild(el("span", {}, `jogo ${game.order} — equipas por confirmar`));
    return row;
  }

  if (game.status === "locked" && game.result) {
    const r = game.result;
    const winnerNode = teamLabelNode(r.winner === "A" ? game.teamA : game.teamB);
    row.appendChild(
      el("span", {}, [
        teamLabelNode(game.teamA), ` ${r.scoreA} - ${r.scoreB} `, teamLabelNode(game.teamB),
        ` · venceu `, winnerNode, ` (${modeLabel(r.mode)})`,
      ])
    );
    if (game.scoreExcluded) {
      row.appendChild(el("span", { class: "points-pill excluded" }, "não conta p/ classificação"));
    }
    const unlockBtn = el("button", { class: "small danger" }, "🔓 Corrigir");
    unlockBtn.onclick = () => unlockResult(game.id);
    row.appendChild(unlockBtn);
    const excludeBtn = el("button", { class: "small" }, game.scoreExcluded ? "↩️ voltar a contar" : "🚫 tirar pontos");
    excludeBtn.onclick = () => toggleScoreExclusion(game.id, !game.scoreExcluded);
    row.appendChild(excludeBtn);
    return row;
  }

  // jogo aberto — admin pode confirmar resultado real
  const form = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap;width:100%" });
  form.appendChild(el("span", { style: "min-width:160px;display:inline-flex;align-items:center;gap:6px" }, [
    teamLabelNode(game.teamA), " vs ", teamLabelNode(game.teamB),
  ]));

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
  row.appendChild(renderLateExceptionsBox(game));

  return row;
}

// Caixa para o host autorizar (ou retirar autorização a) jogadores
// específicos a apostar depois da hora de início do jogo.
function renderLateExceptionsBox(game) {
  const box = el("div", { style: "width:100%;margin-top:6px;padding-top:8px;border-top:1px dashed var(--navy-600)" });

  const exceptions = Object.keys(game.lateExceptions || {});
  if (exceptions.length > 0) {
    const list = el("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px" });
    exceptions.forEach((pid) => {
      const name = state.predictions[pid]?.displayName || pid;
      const pill = el("span", { class: "points-pill", style: "display:flex;align-items:center;gap:6px" }, [
        el("span", {}, `⏱️ ${name} pode apostar atrasado`),
      ]);
      const removeBtn = el("button", { class: "small danger", style: "padding:2px 8px" }, "x");
      removeBtn.onclick = () => revokeLateException(game.id, pid);
      pill.appendChild(removeBtn);
      list.appendChild(pill);
    });
    box.appendChild(list);
  }

  const grantRow = el("div", { style: "display:flex;gap:6px;align-items:center;flex-wrap:wrap" });
  grantRow.appendChild(el("span", { style: "font-size:12px;color:var(--text-dim)" }, "esqueceu-se de apostar?"));
  const nameInput = el("input", { type: "text", placeholder: "nome do jogador", style: "width:160px" });
  const grantBtn = el("button", { class: "small" }, "permitir aposta atrasada");
  grantBtn.onclick = async () => {
    try {
      await grantLateException(game.id, nameInput.value);
      nameInput.value = "";
    } catch (e) {
      showError(box, e.message);
    }
  };
  grantRow.appendChild(nameInput);
  grantRow.appendChild(grantBtn);
  box.appendChild(grantRow);

  return box;
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