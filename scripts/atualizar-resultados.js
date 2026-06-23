/* ===========================================================================
   atualizar-resultados.js
   Busca os jogos da Copa do Mundo 2026 numa API de futebol e atualiza:
     • o CALENDARIO (placares da fase de grupos)
     • o MATA_MATA_JOGOS (confrontos reais do mata-mata, com placares)
   em assets/js/dados.js. Pensado para rodar no GitHub Actions.

   - Lê a chave em process.env.FOOTBALL_API_KEY (secret do repositório).
   - API padrão: football-data.org (competição "WC"). Troque buscarDados()
     para usar outra API.
   - À prova de falhas: sem chave / erro de rede / sem novidades => NÃO altera
     nada e encerra com sucesso (o site mantém os dados atuais).
   - Grupos: aplica só jogos FINALIZADOS. Mata-mata: registra o confronto
     assim que as duas seleções são conhecidas (placar entra quando finaliza).

   Teste local (sem rede):  MOCK=1 node scripts/atualizar-resultados.js
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

// Estágio da API -> rótulo da fase (null = fase de grupos) -----------------
function faseDe(stage) {
  const s = (stage || "").toUpperCase();
  if (s.includes("GROUP") || s.includes("LEAGUE")) return null;
  if (s.includes("LAST_32") || s.includes("ROUND_OF_32")) return "32-avos de final";
  if (s.includes("LAST_16") || s.includes("ROUND_OF_16")) return "Oitavas de final";
  if (s.includes("QUARTER")) return "Quartas de final";
  if (s.includes("SEMI")) return "Semifinais";
  if (s.includes("THIRD") || s.includes("3RD")) return "Disputa de 3º lugar";
  if (s.includes("FINAL")) return "Final";
  return null;
}

// Normaliza a resposta da API em { grupo:[...], mata:[...] } ----------------
function normalizar(matches) {
  const grupo = [], mata = [];
  matches.forEach(function (m) {
    const a = codigo(m.homeTeam && m.homeTeam.name);
    const b = codigo(m.awayTeam && m.awayTeam.name);
    const ft = (m.score && m.score.fullTime) || {};
    const fin = (m.status || "").toUpperCase() === "FINISHED" && ft.home != null && ft.away != null;
    const fase = faseDe(m.stage);
    if (fase === null) {
      if (fin && a && b) grupo.push({ a: a, b: b, ga: ft.home, gb: ft.away });
    } else if (a && b) {                       // mata-mata: confronto já definido
      const data = (m.utcDate || "").slice(0, 10);
      mata.push([fase, data, a, b, fin ? ft.home : null, fin ? ft.away : null]);
    }
  });
  mata.sort(function (x, y) {
    return (x[1] + x[2] + x[3]).localeCompare(y[1] + y[2] + y[3]);
  });
  return { grupo: grupo, mata: mata };
}

// Camada de API (troque aqui para usar outra fonte) -----------------------
async function buscarDados(key) {
  const url = "https://api.football-data.org/v4/competitions/WC/matches";
  const resp = await fetch(url, { headers: { "X-Auth-Token": key } });
  if (!resp.ok) throw new Error("HTTP " + resp.status + " da API");
  const data = await resp.json();
  return normalizar((data && data.matches) || []);
}

// Dados de teste (MOCK=1)
function mock() {
  return {
    grupo: [
      { a: "POR", b: "UZB", ga: 3, gb: 1 }, { a: "COL", b: "COD", ga: 2, gb: 0 },
      { a: "ENG", b: "GHA", ga: 2, gb: 1 }, { a: "PAN", b: "CRO", ga: 0, gb: 2 }
    ],
    mata: [
      ["32-avos de final", "2026-06-28", "BRA", "NOR", null, null],
      ["Final", "2026-07-19", "ARG", "FRA", 2, 1]
    ]
  };
}

// Aplica placares de grupo ao calendário (respeitando o mando) ------------
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

// Reescreve os blocos CALENDARIO e MATA_MATA_JOGOS e a data ---------------
function regravar(calendario, mata) {
  let txt = fs.readFileSync(ARQ, "utf8");

  const linhasC = calendario.map(function (e) { return "    " + JSON.stringify(e); }).join(",\n");
  txt = txt.replace(/var CALENDARIO = \[[\s\S]*?\/\/ FIM_CALENDARIO/,
    "var CALENDARIO = [\n" + linhasC + "\n  ];\n  // FIM_CALENDARIO");

  const corpoM = mata.length
    ? "\n" + mata.map(function (e) { return "    " + JSON.stringify(e); }).join(",\n") + "\n  "
    : "\n  ";
  txt = txt.replace(/var MATA_MATA_JOGOS = \[[\s\S]*?\/\/ FIM_MATA_JOGOS/,
    "var MATA_MATA_JOGOS = [" + corpoM + "];\n  // FIM_MATA_JOGOS");

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
    const dados = usarMock ? mock() : await buscarDados(key);
    console.log("Grupo finalizados: " + dados.grupo.length + " | Mata-mata definidos: " + dados.mata.length);

    const calendario = D.CALENDARIO.map(function (e) { return e.slice(); });
    const nGrupo = aplicar(calendario, dados.grupo);
    const mataAtual = D.MATA_MATA_JOGOS || [];
    const mataMudou = JSON.stringify(dados.mata) !== JSON.stringify(mataAtual);

    if (!nGrupo && !mataMudou) { console.log("Nenhuma novidade para aplicar."); return; }

    regravar(calendario, mataMudou ? dados.mata : mataAtual);
    console.log("✅ Atualizado — grupos: " + nGrupo + " placar(es); mata-mata: " +
      (mataMudou ? dados.mata.length + " confronto(s)" : "sem mudança") + ".");
  } catch (e) {
    console.log("Não foi possível atualizar agora: " + e.message + " (dados mantidos).");
    // sai com sucesso para não falhar o workflow
  }
})();
