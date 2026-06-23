/* ===========================================================================
   atualizar-resultados.js
   Busca os placares da Copa do Mundo 2026 numa API de futebol e atualiza o
   CALENDARIO em assets/js/dados.js. Pensado para rodar no GitHub Actions.

   - Lê a chave em process.env.FOOTBALL_API_KEY (secret do repositório).
   - API padrão: football-data.org (competição "WC"). Troque buscarPlacares()
     se quiser usar outra API.
   - À prova de falhas: sem chave / erro de rede / sem jogos finalizados =>
     NÃO altera nada e encerra com sucesso (o site mantém os dados atuais).
   - Só aplica placares de jogos FINALIZADOS (evita mostrar jogo em andamento
     como encerrado).

   Modo de teste local (sem rede):
     MOCK=1 node scripts/atualizar-resultados.js
   =========================================================================== */

const fs = require("fs");
const path = require("path");

const ARQ = path.join(__dirname, "..", "assets", "js", "dados.js");
const D = require(ARQ);

// Nomes (em inglês, como vêm das APIs) -> nossos códigos -------------------
const ALIAS = {
  "mexico": "MEX", "south africa": "RSA", "south korea": "KOR", "korea republic": "KOR",
  "czechia": "CZE", "czech republic": "CZE",
  "switzerland": "SUI", "bosnia and herzegovina": "BIH", "bosnia": "BIH", "qatar": "QAT", "canada": "CAN",
  "brazil": "BRA", "morocco": "MAR", "scotland": "SCO", "haiti": "HAI",
  "united states": "USA", "usa": "USA", "united states of america": "USA",
  "paraguay": "PAR", "australia": "AUS", "turkey": "TUR", "türkiye": "TUR", "turkiye": "TUR",
  "germany": "GER", "ivory coast": "CIV", "cote d'ivoire": "CIV", "côte d'ivoire": "CIV",
  "ecuador": "ECU", "curacao": "CUW", "curaçao": "CUW",
  "netherlands": "NED", "japan": "JPN", "sweden": "SWE", "tunisia": "TUN",
  "belgium": "BEL", "egypt": "EGY", "iran": "IRN", "ir iran": "IRN", "new zealand": "NZL",
  "spain": "ESP", "uruguay": "URU", "saudi arabia": "KSA", "cape verde": "CPV", "cabo verde": "CPV",
  "france": "FRA", "norway": "NOR", "senegal": "SEN", "iraq": "IRQ",
  "argentina": "ARG", "austria": "AUT", "algeria": "ALG", "jordan": "JOR",
  "portugal": "POR", "colombia": "COL",
  "dr congo": "COD", "congo dr": "COD", "democratic republic of congo": "COD", "dr congo (kinshasa)": "COD",
  "uzbekistan": "UZB",
  "england": "ENG", "croatia": "CRO", "ghana": "GHA", "panama": "PAN"
};
function codigo(nome) {
  if (!nome) return null;
  return ALIAS[String(nome).toLowerCase().trim()] || null;
}

// ---- Camada de API (troque aqui para usar outra fonte) -------------------
async function buscarPlacares(key) {
  const url = "https://api.football-data.org/v4/competitions/WC/matches";
  const resp = await fetch(url, { headers: { "X-Auth-Token": key } });
  if (!resp.ok) throw new Error("HTTP " + resp.status + " da API");
  const data = await resp.json();
  const jogos = (data && data.matches) || [];
  const out = [];
  jogos.forEach(function (m) {
    const st = (m.status || "").toUpperCase();
    const ft = (m.score && m.score.fullTime) || {};
    if (st !== "FINISHED" || ft.home == null || ft.away == null) return;
    const a = codigo(m.homeTeam && m.homeTeam.name);
    const b = codigo(m.awayTeam && m.awayTeam.name);
    if (!a || !b) return;
    out.push({ a: a, b: b, ga: ft.home, gb: ft.away });
  });
  return out;
}

// Dados de teste (MOCK=1): finaliza os 4 jogos de hoje com placares fictícios
function placaresMock() {
  return [
    { a: "POR", b: "UZB", ga: 3, gb: 1 },
    { a: "COL", b: "COD", ga: 2, gb: 0 },
    { a: "ENG", b: "GHA", ga: 2, gb: 1 },
    { a: "PAN", b: "CRO", ga: 0, gb: 2 }
  ];
}

// Aplica os placares ao calendário (respeitando mando) --------------------
function aplicar(calendario, placares) {
  const idx = {};
  calendario.forEach(function (e) { idx[[e[3], e[4]].sort().join("|")] = e; });
  let n = 0;
  placares.forEach(function (r) {
    const e = idx[[r.a, r.b].sort().join("|")];
    if (!e) return;
    const ga = (e[3] === r.a) ? r.ga : r.gb;
    const gb = (e[3] === r.a) ? r.gb : r.ga;
    if (e[5] !== ga || e[6] !== gb) { e[5] = ga; e[6] = gb; n++; }
  });
  return n;
}

// Reescreve o bloco CALENDARIO e a data dos dados -------------------------
function regravar(calendario) {
  let txt = fs.readFileSync(ARQ, "utf8");
  const linhas = calendario.map(function (e) { return "    " + JSON.stringify(e); }).join(",\n");
  const bloco = "var CALENDARIO = [\n" + linhas + "\n  ];\n  // FIM_CALENDARIO";
  txt = txt.replace(/var CALENDARIO = \[[\s\S]*?\/\/ FIM_CALENDARIO/, bloco);
  const d = new Date();
  const dataBR = String(d.getUTCDate()).padStart(2, "0") + "/" +
                 String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear();
  txt = txt.replace(/dataDados:\s*"[^"]*"/, 'dataDados: "' + dataBR + '"');
  fs.writeFileSync(ARQ, txt);
}

(async function main() {
  try {
    const usarMock = process.env.MOCK === "1";
    const key = process.env.FOOTBALL_API_KEY;
    if (!usarMock && !key) {
      console.log("Sem FOOTBALL_API_KEY definido — nada a atualizar. Encerrando.");
      return;
    }
    const placares = usarMock ? placaresMock() : await buscarPlacares(key);
    console.log("Placares finalizados recebidos: " + placares.length);

    const calendario = D.CALENDARIO.map(function (e) { return e.slice(); });
    const mudancas = aplicar(calendario, placares);
    if (!mudancas) { console.log("Nenhum placar novo para aplicar."); return; }

    regravar(calendario);
    console.log("✅ " + mudancas + " jogo(s) atualizado(s) em dados.js.");
  } catch (e) {
    console.log("Não foi possível atualizar agora: " + e.message + " (dados mantidos).");
    // sai com sucesso para não falhar o workflow
  }
})();
