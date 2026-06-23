/* Validação rápida da base de dados e do motor de análise.
   Uso: node scripts/validar.js
   Não exige dependências nem rede. */
const path = require("path");
const D = require(path.join(__dirname, "..", "assets", "js", "dados.js"));
const A = require(path.join(__dirname, "..", "assets", "js", "analise.js"));

let falhas = 0;
function check(cond, msg) { console.log((cond ? "✓" : "✗") + " " + msg); if (!cond) falhas++; }

const grupos = Object.keys(D.GRUPOS);
const times = [].concat(...grupos.map(g => D.GRUPOS[g]));
check(grupos.length === 12, "12 grupos");
check(times.length === 48, "48 vagas de seleção");
check(new Set(times).size === 48, "48 seleções únicas");
check(times.every(t => D.SELECOES[t]), "todas as seleções têm perfil");
check(Object.keys(D.SELECOES).every(c => times.includes(c)), "nenhum perfil órfão");

// Calendário
const cal = D.CALENDARIO;
check(cal.length === 72, "72 jogos no calendário");
check(cal.every(c => D.SELECOES[c[3]] && D.SELECOES[c[4]]), "todos os jogos referenciam seleções válidas");
check(cal.every(c => D.GRUPOS[c[0]].includes(c[3]) && D.GRUPOS[c[0]].includes(c[4])), "confrontos coerentes com o grupo");

// cada seleção joga exatamente 3 vezes
const cont = {};
cal.forEach(c => { cont[c[3]] = (cont[c[3]] || 0) + 1; cont[c[4]] = (cont[c[4]] || 0) + 1; });
check(Object.values(cont).every(n => n === 3), "cada seleção joga 3 vezes na fase de grupos");

// nenhum confronto repetido
const pares = new Set(cal.map(c => [c[3], c[4]].sort().join("-")));
check(pares.size === 72, "nenhum confronto repetido (72 únicos)");

// jogos com placar (cresce conforme a Copa avança)
const comPlacar = cal.filter(c => c[5] != null && c[6] != null).length;
check(comPlacar >= 44 && comPlacar <= 72, "jogos com placar entre 44 e 72 (" + comPlacar + ")");
check(cal.every(c => (c[5] == null) === (c[6] == null)), "placar consistente (ambos vazios ou ambos preenchidos)");

// motor de análise
const p = A.prever(D.SELECOES.BRA, D.SELECOES.HAI, {});
check(Math.abs(p.pA + p.pEmpate + p.pB - 1) < 1e-6, "probabilidades somam 1");
check(p.favoritoA && p.probVencedor > 0.5, "Brasil favorito sobre o Haiti");
const t = A.montarTextos(D.SELECOES.BRA, D.SELECOES.HAI, p, {});
check(typeof t.veredito === "string" && t.veredito.length > 20, "veredito gerado");
check(Array.isArray(t.fatores) && t.fatores.length >= 2, "fatores decisivos gerados");

console.log("\n" + (falhas ? falhas + " falha(s)." : "Tudo certo! ✅"));
process.exit(falhas ? 1 : 0);
