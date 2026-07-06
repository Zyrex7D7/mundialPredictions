# Previsões Mundial 26 🏆

Site para tu e os teus amigos preencherem o bracket do Mundial 2026, com
pontos por acertar quem passa, como passa (tempo regular / prolongamento
/ pénaltis) e o resultado exato. Tudo em HTML + CSS + JS puro, dados
guardados no Firebase Firestore (gratuito) para todos verem a mesma
classificação em tempo real.

```
index.html          → estrutura da página
style.css            → visual (tema azul-noite / dourado)
app.js               → toda a lógica (contas, salas, bracket, pontos, admin)
firebase-config.js   → as TUAS chaves do Firebase (tens de preencher — ver passo 2)
```
 
---

## Como meter tudo a funcionar (±10 minutos)

### Passo 1 — Criar o projeto no Firebase

1. Vai a **https://console.firebase.google.com** e inicia sessão com uma conta Google.
2. **Criar projeto** → dá-lhe um nome (ex: `previsoes-mundial`) → podes
   desativar o Google Analytics → **Criar projeto**.
3. No menu da esquerda: **Compilação → Firestore Database** → **Criar
   base de dados** → escolhe uma localização perto de ti (ex:
   `eur3 (europe-west)`) → começa em **modo de produção**.
4. Vai ao separador **Regras** dentro do Firestore e substitui tudo por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

   Clica **Publicar**.

   ⚠️ Isto deixa qualquer pessoa com o link ler/escrever os dados — é
   "modo confiança" entre amigos, não é à prova de batota. Para um grupo
   de amigos é suficiente.

5. Volta à página principal do projeto (ícone de casa) → clica no ícone
   **`</>`** (Web) → dá um nome à app (ex: `web`) → **não** precisas de
   Firebase Hosting → **Registar app**.
6. Aparece um bloco `firebaseConfig = { ... }`. **Copia esse objeto** e
   cola-o no ficheiro `firebase-config.js` deste projeto, substituindo os
   valores de exemplo (`apiKey`, `authDomain`, etc.).

### Passo 2 — Testar localmente (opcional mas recomendado)

Como o site usa Firestore, alguns browsers bloqueiam `fetch` quando abres
o `index.html` diretamente como ficheiro (`file://`). O mais simples é
correr um servidor local de um clique:

- Se tiveres **VS Code**: instala a extensão "Live Server", clica com o
  botão direito em `index.html` → "Open with Live Server".
- Ou, se tiveres Python instalado, abre um terminal na pasta do projeto:
  ```
  python3 -m http.server 8000
  ```
  e abre `http://localhost:8000` no browser.

Cria uma conta de teste e uma sala chamada `teste` para experimentares
à vontade (fazer apostas, confirmar resultados como admin, corrigir,
etc.) sem misturar com a sala a sério dos teus amigos.

### Passo 3 — Publicar no GitHub Pages (para os teus amigos acederem)

1. Cria um repositório novo no GitHub (pode ser privado, mas nesse caso
   vê a nota no fim deste passo).
2. Faz upload dos 4 ficheiros (`index.html`, `style.css`, `app.js`,
   `firebase-config.js`, já com as tuas chaves preenchidas) para a raiz
   do repositório.
3. **Settings → Pages** → em "Build and deployment" escolhe **Deploy
   from a branch** → branch `main`, pasta `/ (root)` → **Save**.
4. Espera 1-2 minutos. O GitHub dá-te um link tipo
   `https://o-teu-user.github.io/o-teu-repo/` — é esse link que partilhas.

   (Se o repositório for **privado**, o GitHub Pages só funciona em
   planos pagos do GitHub — nesse caso usa um repositório público, ou
   uma alternativa gratuita como Netlify/Vercel: arrastas a pasta para
   o site deles e funciona da mesma forma.)

### Passo 4 — Criar a sala a sério

1. Abre o teu link publicado.
2. Cria a tua conta (nome + password — só serve para reservar o teu
   nome, não precisa de ser uma password "a sério").
3. No ecrã de sala, escreve o código que vais dar aos teus amigos (ex:
   `mundial26`) e clica "Entrar / criar sala". Como foste tu a criar,
   ficas automaticamente **host** — só tu vês o botão "🔧 Área de
   administração" no fundo da página.
4. Partilha o link com os amigos e diz-lhes o código da sala
   (`mundial26`). Cada um cria a sua própria conta e entra com esse
   código.

---

## Como funciona, por dentro

### Contas e salas
- Uma **conta** (nome + password) é global, independente da sala.
- Uma **sala** (código) tem o seu próprio bracket, jogadores e
  classificação, totalmente separados de qualquer outra sala. A mesma
  conta pode ser host numa sala e jogador normal noutra.
- Quem cria a sala (primeira pessoa a usar esse código) fica host dessa
  sala automaticamente.

### A regra principal do bracket
- Na **Fase de 32** toda a gente aposta livremente, porque os
  confrontos já são conhecidos.
- A partir daí, **ninguém escolhe quem passa** — fica só definido quando
  o host confirma o **resultado real** de um jogo no painel de admin.
- Ao confirmar, o jogo fica **bloqueado** e a equipa **realmente**
  vencedora avança automaticamente para a posição certa no jogo
  seguinte. Esse jogo seguinte só fica disponível para apostas quando
  tiver as duas equipas reais definidas (ou seja, quando os dois jogos
  anteriores estiverem confirmados).

### Como se aposta (vencedor automático)
- Cada pessoa escreve só o **resultado** (golos de cada equipa). Quem
  ganha é calculado automaticamente a partir disso — não dá para
  escolher um vencedor que contradiga o resultado escrito.
- Como é fase a eliminar, um **empate só é possível se foi decidido nos
  pénaltis**. Por isso, só quando o resultado fica empatado é que
  aparece a opção de escolher manualmente quem venceu (e a fase fica
  automaticamente em "grandes penalidades").
- **Não é possível apostar em nome de outra pessoa.** Cada conta só
  consegue guardar/alterar a sua própria aposta — não há forma de um
  jogador editar a aposta de outro, mesmo a partir do código.

### Fecho automático das apostas (à hora do jogo)
- Cada jogo pode ter uma hora de início definida na constante
  `KICKOFFS`, no topo do `app.js`. Assim que essa hora passar, o
  formulário de aposta desse jogo fecha-se sozinho (mesmo que o host
  ainda não tenha confirmado o resultado) — ninguém consegue apostar
  depois de o jogo já ter começado, mesmo vendo o resultado parcial ao
  vivo.
- Enquanto não preencheres `KICKOFFS`, um jogo só deixa de aceitar
  apostas quando o host confirma o resultado (como acontecia antes).
- Isto não impede 100% batota técnica (alguém com conhecimentos de
  programação podia em teoria contornar o site), mas resolve o caso
  normal: ninguém vê o formulário de aposta depois da hora de início.

### Ver as apostas dos amigos
- Na classificação, clica no nome de qualquer jogador para abrir a
  lista das apostas dele — mas só aparecem os jogos que **já têm
  resultado confirmado**. Enquanto um jogo ainda não foi confirmado
  (mesmo que já tenha começado ou até já tenha terminado mas o host
  ainda não meteu o resultado), a aposta de ninguém aparece a mais
  ninguém — só a tua própria, sempre, no cartão do jogo.

### Pontos (cumulativos — só contam se acertares no nível anterior)

| Acertaste em...                                          | Pontos |
|-----------------------------------------------------------|:------:|
| Quem passa (vencedor)                                      | +2     |
| → e a fase em que se decidiu (regular / prolong. / pénaltis, tanto faz qual) | +3     |
| → e no resultado exato                                     | +5     |

A fase vale sempre os mesmos 3 pontos, seja tempo regular,
prolongamento ou grandes penalidades — não há diferença entre elas,
só interessa se acertaste a fase certa ou não.

Máximo por jogo: **10 pontos**. Para mudar estes valores, edita o topo
do `app.js`:

```js
const POINTS = {
  advance: 2,
  phase: 3,
  exact: 5,
};
```

### Estrutura do bracket

```
Fase de 32 (16 jogos) → Oitavos (8) → Quartos (4) → Meias (2) → Final (1)
```

Os confrontos da Fase de 32 estão na constante `R32_PAIRS` no topo do
`app.js` — edita à vontade para pores as equipas e a ordem certas do
teu grupo. As rondas seguintes são geradas automaticamente a partir
dessa ordem (jogos 1+2 da fase de 32 alimentam o jogo 1 dos oitavos,
jogos 3+4 alimentam o jogo 2, etc.).

### Painel de administração
- Aparece só para o host, no botão "🔧 Área de administração" no fundo
  da página.
- Mostra todos os jogos por ronda. Só dá para confirmar resultado de
  jogos que já tenham as duas equipas definidas.
- Há um botão "🔓 Corrigir" para desbloquear um jogo já confirmado, caso
  te tenhas enganado. Atenção: se a ronda seguinte já tiver avançado com
  a equipa errada, pode ser preciso corrigir esse jogo seguinte
  manualmente também (o site não desfaz isso em cascata automaticamente).
- Não há nenhuma fonte automática de resultados ao vivo — tens de os
  inserir manualmente à medida que os jogos acabam.

---

## Coisas que podes querer adicionar depois (não incluídas agora)

- Fechar as apostas automaticamente quando o jogo real começar (em vez
  de dependeres só de inserires o resultado depois).
- Buscar os resultados de uma API de futebol, em vez de os inseres à mão.
- Jogo do 3º/4º lugar, se quiseres incluir esse prémio também.
- Página de perfil/histórico individual de cada jogador.

O código está comentado em português e organizado por secções numeradas
no `app.js`, por isso deve ser fácil de mexer.

---

## Resolução de problemas comuns

- **"A página fica em branco / não acontece nada ao entrar"** → abre a
  consola do browser (F12 → Console) e procura erros. O mais comum é o
  `firebase-config.js` ainda ter os valores de exemplo por preencher.
- **"Erro de permissões no Firestore"** → confirma que publicaste as
  regras do passo 1.4 exatamente como estão (com `allow read, write: if
  true;`).
- **"Os meus amigos não veem a sala"** → confirma que estão a usar
  exatamente o mesmo código de sala (o site normaliza automaticamente
  para minúsculas e hífens, mas confirma na mesma).
