/* ===========================================================================
   analise.js — Motor de análise e previsão dos jogos
   Recebe os perfis de duas seleções (de dados.js) e o contexto (momento na
   competição, mando) e devolve: probabilidades, provável vencedor, placar
   estimado e os textos explicativos (como jogam, desfalques, destaques,
   fatores decisivos e veredito).
   =========================================================================== */

(function (raiz) {
  "use strict";

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function pct(x) { return Math.round(x * 100); }

  // Desfalques que ainda impactam o jogo (ignora suspensões já cumpridas) ---
  function desfalquesAtivos(time) {
    return (time.desfalques || []).filter(function (d) {
      return !/cumpriu|na estreia/i.test(d);
    });
  }

  // Penalidade de força por desfalques (estrelas pesam mais) ----------------
  function penalidade(time) {
    var ativos = desfalquesAtivos(time);
    var p = 0;
    ativos.forEach(function (d) {
      p += /LCA|Aquiles|cirurgia|fora|pesad/i.test(d) ? 1.7 : 1.1;
    });
    return Math.min(p, 5.5);
  }

  /* -------------------------------------------------------------------------
     Núcleo da previsão
     a, b: perfis das seleções; ctx: { momentoA, momentoB }
     ------------------------------------------------------------------------- */
  function prever(a, b, ctx) {
    ctx = ctx || {};
    var penA = penalidade(a), penB = penalidade(b);
    var notaA = a.nota + (ctx.momentoA || 0) + (a.anfitriao ? 3 : 0) - penA;
    var notaB = b.nota + (ctx.momentoB || 0) + (b.anfitriao ? 3 : 0) - penB;
    var d = notaA - notaB;

    // Probabilidade de empate diminui conforme cresce a diferença de força
    var pEmpate = clamp(0.30 - Math.abs(d) * 0.011, 0.13, 0.30);
    var sA = 1 / (1 + Math.exp(-d / 5.2));
    var pA = (1 - pEmpate) * sA;
    var pB = (1 - pEmpate) * (1 - sA);

    // Placar estimado a partir de gols esperados
    var xgA = clamp(1.3 + d * 0.045 + (ctx.momentoA || 0) * 0.04, 0.2, 3.6);
    var xgB = clamp(1.3 - d * 0.045 + (ctx.momentoB || 0) * 0.04, 0.2, 3.6);
    var golA = Math.round(xgA), golB = Math.round(xgB);

    var maxp = Math.max(pA, pEmpate, pB);
    var favoritoA = pA >= pB;
    var equilibrio = Math.abs(pA - pB) < 0.08;

    // Garante coerência entre placar e favorito
    if (!equilibrio) {
      if (favoritoA && golA <= golB) golA = golB + 1;
      if (!favoritoA && golB <= golA) golB = golA + 1;
    } else if (golA !== golB) {
      // jogo equilibrado tende a placar curto/empate
      var m = Math.min(golA, golB); golA = m; golB = m;
    }

    var confianca = maxp > 0.56 ? "Alta" : (maxp > 0.43 ? "Média" : "Equilibrada");
    var vencedor = favoritoA ? a : b;
    var probVencedor = favoritoA ? pA : pB;

    return {
      notaA: notaA, notaB: notaB, diff: d,
      pA: pA, pEmpate: pEmpate, pB: pB,
      golA: golA, golB: golB,
      vencedor: vencedor, probVencedor: probVencedor,
      favoritoA: favoritoA, equilibrio: equilibrio,
      confianca: confianca,
      empateProvavel: pEmpate >= maxp - 0.001,
      penA: penA, penB: penB
    };
  }

  /* -------------------------------------------------------------------------
     Fatores decisivos — explicam o "porquê" do palpite a partir dos deltas
     ------------------------------------------------------------------------- */
  function fatores(a, b, p, ctx) {
    ctx = ctx || {};
    var fav = p.favoritoA ? a : b;
    var lista = [];

    if (Math.abs(a.nota - b.nota) >= 6) {
      var maisForte = a.nota > b.nota ? a : b;
      lista.push({ ico: "⚡", txt: "Qualidade individual superior de " + maisForte.nome + " (favorito no papel)." });
    } else {
      lista.push({ ico: "⚖️", txt: "Seleções de força parelha — o equilíbrio técnico é grande." });
    }

    var mA = ctx.momentoA || 0, mB = ctx.momentoB || 0;
    if (Math.abs(mA - mB) >= 0.6) {
      var emAlta = mA > mB ? a : b;
      lista.push({ ico: "📈", txt: "Melhor momento na competição é de " + emAlta.nome + " (resultados recentes)." });
    }

    if (a.anfitriao || b.anfitriao) {
      var casa = a.anfitriao ? a : b;
      lista.push({ ico: "🏟️", txt: "Fator casa: " + casa.nome + " conta com o apoio da torcida como anfitriã." });
    }

    var defA = desfalquesAtivos(a), defB = desfalquesAtivos(b);
    if (defA.length && defA.length >= defB.length) {
      lista.push({ ico: "🚑", txt: a.nome + " sente desfalques importantes: " + defA.join("; ") + "." });
    }
    if (defB.length && defB.length > defA.length) {
      lista.push({ ico: "🚑", txt: b.nome + " sente desfalques importantes: " + defB.join("; ") + "." });
    }

    if ((a.titulos || 0) !== (b.titulos || 0) && (a.titulos >= 2 || b.titulos >= 2)) {
      var camp = (a.titulos || 0) > (b.titulos || 0) ? a : b;
      lista.push({ ico: "🏆", txt: "Tradição em Copas pesa: " + camp.nome + " já foi campeão mundial " + camp.titulos + "x." });
    }

    if (p.equilibrio) {
      lista.push({ ico: "🎯", txt: "Jogo aberto: o empate é um resultado bastante provável." });
    } else {
      lista.push({ ico: "✅", txt: "No conjunto dos fatores, " + fav.nome + " leva a melhor." });
    }
    return lista;
  }

  /* -------------------------------------------------------------------------
     Textos prontos para exibição
     ------------------------------------------------------------------------- */
  function montarTextos(a, b, p, ctx) {
    var fav = p.favoritoA ? a : b;
    var maiorIcon = fav.flag;

    var comoJogam =
      cap(a.nome) + " " + a.estilo + " (formação " + a.formacao + "). " +
      "Do outro lado, " + b.nome + " " + b.estilo + " (formação " + b.formacao + ").";

    var defA = desfalquesAtivos(a), defB = desfalquesAtivos(b);

    var veredito;
    if (p.equilibrio) {
      veredito = "Confronto muito equilibrado. Há um ligeiro favoritismo de " + fav.nome +
        " (" + pct(p.probVencedor) + "% de chance de vitória), mas o empate é plenamente possível (" +
        pct(p.pEmpate) + "%). Decisão nos detalhes.";
    } else {
      veredito = "O palpite é vitória de " + fav.nome + " (" + pct(p.probVencedor) + "% de probabilidade). " +
        motivoPrincipal(a, b, p, ctx) +
        " Placar mais provável: " + p.golA + " a " + p.golB + " para " + (p.favoritoA ? a.nome : b.nome) + ".";
    }

    var narrativa =
      cap(a.nome) + " encara " + b.nome + " em um duelo " +
      (p.equilibrio ? "de forças semelhantes" : "no qual " + fav.nome + " chega como favorito") + ". " +
      comoJogam + " " +
      (defA.length || defB.length
        ? "Pelos desfalques, " + (defA.length ? a.nome + " perde " + defA.join(", ") : "")
          + (defA.length && defB.length ? "; e " : "")
          + (defB.length ? b.nome + " não conta com " + defB.join(", ") : "") + ". "
        : "Nenhuma das equipes tem desfalques de peso confirmados. ") +
      "No ataque, os olhos se voltam para " + primeiro(a.destaques) + " (" + a.nome + ") e " +
      primeiro(b.destaques) + " (" + b.nome + ").";

    return {
      icone: maiorIcon,
      comoJogam: comoJogam,
      veredito: veredito,
      narrativa: narrativa,
      destaquesA: a.destaques || [],
      destaquesB: b.destaques || [],
      desfalquesA: defA,
      desfalquesB: defB,
      fatores: fatores(a, b, p, ctx)
    };
  }

  function motivoPrincipal(a, b, p, ctx) {
    ctx = ctx || {};
    var fav = p.favoritoA ? a : b;
    var adv = p.favoritoA ? b : a;
    if (Math.abs(a.nota - b.nota) >= 8)
      return "A diferença de qualidade individual a favor de " + fav.nome + " é o fator decisivo.";
    var mFav = p.favoritoA ? (ctx.momentoA || 0) : (ctx.momentoB || 0);
    var mAdv = p.favoritoA ? (ctx.momentoB || 0) : (ctx.momentoA || 0);
    if (mFav - mAdv >= 0.6)
      return "O melhor momento de " + fav.nome + " na competição inclina a balança.";
    if (fav.anfitriao)
      return "O fator casa de " + fav.nome + " pode ser determinante.";
    if (desfalquesAtivos(adv).length > desfalquesAtivos(fav).length)
      return "Os desfalques de " + adv.nome + " ajudam a explicar o favoritismo de " + fav.nome + ".";
    return cap(fav.nome) + " reúne, no conjunto, mais argumentos para vencer.";
  }

  function primeiro(arr) {
    if (!arr || !arr.length) return "seus principais jogadores";
    return arr[0].replace(/\s*\(.*?\)\s*/g, "");
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var API = { prever: prever, montarTextos: montarTextos, desfalquesAtivos: desfalquesAtivos, pct: pct };
  raiz.Analise = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof window !== "undefined" ? window : this);
