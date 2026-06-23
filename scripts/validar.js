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

// gera os 72 jogos da fase de grupos
const RODIZIO = [[[0,1],[2,3]],[[0,2],[3,1]],[[0,3],[1,2]]];
let jogos = [];
grupos.forEach(g => D.GRUPOS[g] && RODIZIO.forEach((rod, ri) => rod.forEach(par => {
  jogos.push({ grupo: g, casa: D.GRUPOS[g][par[0]], fora: D.GRUPOS[g][par[1]] });
})));
check(jogos.length === 72, "72 jogos na fase de grupos");
const cont = {};
jogos.forEach(j => { cont[j.casa] = (cont[j.casa] || 0) + 1; cont[j.fora] = (cont[j.fora] || 0) + 1; });
check(Object.values(cont).every(n => n === 3), "cada seleção joga 3 vezes na fase de grupos");

// motor de análise
const p = A.prever(D.SELECOES.BRA, D.SELECOES.HAI, {});
check(Math.abs(p.pA + p.pEmpate + p.pB - 1) < 1e-6, "probabilidades somam 1");
check(p.favoritoA && p.probVencedor > 0.5, "Brasil favorito sobre o Haiti");
const t = A.montarTextos(D.SELECOES.BRA, D.SELECOES.HAI, p, {});
check(typeof t.veredito === "string" && t.veredito.length > 20, "veredito gerado");
check(Array.isArray(t.fatores) && t.fatores.length >= 2, "fatores decisivos gerados");

console.log("\n" + (falhas ? falhas + " falha(s)." : "Tudo certo! ✅"));
process.exit(falhas ? 1 : 0);
