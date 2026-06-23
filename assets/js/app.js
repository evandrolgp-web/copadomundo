/* ===========================================================================
   app.js — Interface da Central de Análises da Copa do Mundo 2026
   Gera a tabela de jogos automaticamente, calcula o momento das seleções,
   monta os filtros/abas e abre a análise completa de cada jogo no modal.
   Inclui busca opcional de resultados ao vivo (best-effort).
   =========================================================================== */

(function () {
  "use strict";

  var D = window.COPA_DADOS;
  var A = window.Analise;
  var hoje = D.TORNEIO.hoje;

  // Estado da UI
  var estado = { aba: "jogos", busca: "", grupo: "todos", status: "proximos" };
  var JOGOS = [];        // jogos da fase de grupos (analisáveis)
  var JOGOS_MATA = [];   // jogos REAIS do mata-mata (quando definidos)
  var MOMENTO = {};      // momento (forma) por seleção, vindo dos resultados

  // ----------------------------- utilidades --------------------------------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function fmtData(iso) {
    var p = iso.split("-"); var dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return DIAS[dt.getDay()] + ", " + (+p[2]) + " de " + MESES[+p[1] - 1];
  }
  function statusDoJogo(j) {
    if (j.placar) return "encerrado";
    if (j.data < hoje) return "encerrado";
    if (j.data === hoje) return "hoje";
    return "agendado";
  }

  // ------------ montagem dos jogos a partir do calendário real -------------
  // A tabela é preenchida automaticamente a partir de D.CALENDARIO.
  function gerarJogos() {
    var lista = D.CALENDARIO.map(function (c, i) {
      var pc = c[5], pf = c[6];
      return {
        id: "G" + c[0] + "-" + c[1] + "-" + c[3] + c[4],
        fase: "Fase de Grupos",
        grupo: c[0],
        rodada: c[1],
        data: c[2],
        local: D.CIDADES[i % D.CIDADES.length],
        casa: c[3], fora: c[4],
        placar: (pc == null || pf == null) ? null : [pc, pf]
      };
    });
    lista.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : (a.grupo < b.grupo ? -1 : 1); });
    return lista;
  }

  // Jogos reais do mata-mata (preenchidos pela atualização automática) ------
  // Formato em D.MATA_MATA_JOGOS: [fase, data, casa, fora, golsCasa, golsFora]
  function gerarJogosMata() {
    var lista = (D.MATA_MATA_JOGOS || []).filter(function (c) {
      return D.SELECOES[c[2]] && D.SELECOES[c[3]];   // só confrontos já definidos
    }).map(function (c, i) {
      var pc = c[4], pf = c[5];
      return {
        id: "M-" + i + "-" + c[2] + c[3],
        fase: c[0],
        grupo: null, rodada: null,
        data: c[1],
        local: "",
        casa: c[2], fora: c[3],
        placar: (pc == null || pf == null) ? null : [pc, pf]
      };
    });
    lista.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    return lista;
  }

  // Momento de cada seleção a partir dos resultados confirmados -------------
  function calcularMomento() {
    var m = {};
    JOGOS.forEach(function (j) {
      if (!j.placar) return;
      var ga = j.placar[0], gb = j.placar[1];
      var dgA = Math.max(-1, Math.min(1, (ga - gb) * 0.2));
      var dgB = -dgA;
      var rA = ga > gb ? 1.0 : ga === gb ? 0.35 : -0.6;
      var rB = gb > ga ? 1.0 : ga === gb ? 0.35 : -0.6;
      m[j.casa] = (m[j.casa] || 0) + rA + dgA;
      m[j.fora] = (m[j.fora] || 0) + rB + dgB;
    });
    MOMENTO = m;
  }

  function ctxJogo(j) {
    return { momentoA: MOMENTO[j.casa] || 0, momentoB: MOMENTO[j.fora] || 0 };
  }

  // ------------------------------ filtros ----------------------------------
  // comStatus=false ignora o filtro de situação (usado na aba "Por rodada")
  function jogosFiltrados(comStatus) {
    var b = estado.busca.toLowerCase();
    return JOGOS.filter(function (j) {
      var ca = D.SELECOES[j.casa], fo = D.SELECOES[j.fora];
      if (estado.grupo !== "todos" && j.grupo !== estado.grupo) return false;
      if (comStatus && estado.status !== "todos") {
        var st = statusDoJogo(j);
        if (estado.status === "proximos") {
          if (st === "encerrado") return false;       // próximos = hoje + a disputar
        } else if (st !== estado.status) {
          return false;
        }
      }
      if (b) {
        var alvo = (ca.nome + " " + fo.nome + " grupo " + j.grupo).toLowerCase();
        if (alvo.indexOf(b) === -1) return false;
      }
      return true;
    });
  }

  // ---------------------------- render: jogos ------------------------------
  function cardJogo(j) {
    var ca = D.SELECOES[j.casa], fo = D.SELECOES[j.fora];
    var st = statusDoJogo(j);
    var p = A.prever(ca, fo, ctxJogo(j));
    var favNome = p.favoritoA ? ca.nome : fo.nome;
    var pa = Math.round(p.pA * 100), pe = Math.round(p.pEmpate * 100), pb = 100 - pa - pe;

    var placarHtml = j.placar
      ? '<div class="placar">' + j.placar[0] + " " + j.placar[1] + "</div>"
      : '<div class="placar vs">VS</div>';

    var pill = st === "hoje" ? '<span class="pill hoje">HOJE</span>'
      : st === "encerrado" ? '<span class="pill encerrado">ENCERRADO</span>'
      : '<span class="pill agendado">AGENDADO</span>';

    var topoLabel = j.grupo ? ("Grupo " + j.grupo + " · " + j.rodada + "ª rod.") : esc(j.fase);

    return el(
      '<div class="jogo" data-id="' + j.id + '">' +
        '<div class="jogo-topo">' +
          '<span class="jogo-grupo">' + topoLabel + "</span>" +
          pill +
        "</div>" +
        '<div class="confronto">' +
          '<div class="lado esq"><span class="flag">' + ca.flag + '</span><span class="nome-time">' + esc(ca.nome) + "<small>" + esc(ca.conf) + "</small></span></div>" +
          placarHtml +
          '<div class="lado dir"><span class="flag">' + fo.flag + '</span><span class="nome-time">' + esc(fo.nome) + "<small>" + esc(fo.conf) + "</small></span></div>" +
        "</div>" +
        '<div class="previsao-mini">' +
          (p.equilibrio ? "<span>Jogo equilibrado</span>" : "<span>Favorito: <b>" + esc(favNome) + "</b></span>") +
          '<span class="barra-mini">' +
            '<i class="a" style="width:' + pa + '%"></i>' +
            '<i class="d" style="width:' + pe + '%"></i>' +
            '<i class="b" style="width:' + pb + '%"></i>' +
          "</span>" +
          "<span>" + Math.max(pa, pb) + "%</span>" +
        "</div>" +
      "</div>"
    );
  }

  function renderJogos(container) {
    var js = jogosFiltrados(true);
    if (!js.length) {
      container.appendChild(el('<div class="vazio"><div class="big">🔍</div>Nenhum jogo encontrado com esses filtros.</div>'));
      return;
    }
    var porData = {};
    js.forEach(function (j) { (porData[j.data] = porData[j.data] || []).push(j); });
    Object.keys(porData).sort().forEach(function (data) {
      var rotulo = fmtData(data) + (data === hoje ? "  ·  HOJE" : "");
      container.appendChild(el('<div class="dia-rotulo">' + esc(rotulo) + "</div>"));
      var grade = el('<div class="grade-jogos"></div>');
      porData[data].forEach(function (j) { grade.appendChild(cardJogo(j)); });
      container.appendChild(grade);
    });
  }

  // ------------------------ render: por rodada -----------------------------
  function diaCurto(iso) { var p = iso.split("-"); return p[2] + "/" + p[1]; }

  // Linha compacta de jogo (usada na aba "Por rodada")
  function linhaJogo(j) {
    var ca = D.SELECOES[j.casa], fo = D.SELECOES[j.fora];
    var st = statusDoJogo(j);
    var mid = j.placar
      ? '<span class="lj-mid">' + j.placar[0] + "-" + j.placar[1] + "</span>"
      : (st === "hoje"
        ? '<span class="lj-mid fut" style="color:var(--gold)">HOJE</span>'
        : '<span class="lj-mid fut">' + diaCurto(j.data) + "</span>");
    return el(
      '<div class="linha-jogo" data-id="' + j.id + '">' +
        '<span class="lj-time"><span class="flag-sm">' + ca.flag + '</span><span class="nm">' + esc(ca.nome) + "</span></span>" +
        mid +
        '<span class="lj-time dir"><span class="flag-sm">' + fo.flag + '</span><span class="nm">' + esc(fo.nome) + "</span></span>" +
      "</div>"
    );
  }

  function renderRodadas(container) {
    var js = jogosFiltrados(false);
    if (!js.length) {
      container.appendChild(el('<div class="vazio"><div class="big">🔍</div>Nenhum jogo encontrado com esses filtros.</div>'));
      return;
    }
    var porRodada = {};
    js.forEach(function (j) { (porRodada[j.rodada] = porRodada[j.rodada] || []).push(j); });
    Object.keys(porRodada).sort().forEach(function (r) {
      var jogos = porRodada[r];
      var feitos = jogos.filter(function (j) { return j.placar; }).length;
      var sec = el('<div class="rodada-sec"></div>');
      sec.appendChild(el(
        '<div class="rodada-cab"><b>' + r + 'ª Rodada</b><span class="cont">' + feitos + " / " + jogos.length + " disputados</span></div>"
      ));
      // organiza por grupo (cada bloco = 1 grupo com seus 2 jogos)
      var porGrupo = {};
      jogos.forEach(function (j) { (porGrupo[j.grupo] = porGrupo[j.grupo] || []).push(j); });
      var grid = el('<div class="grupos-grid"></div>');
      Object.keys(porGrupo).sort().forEach(function (g) {
        var gb = el('<div class="gb"><div class="gb-cab">Grupo ' + g + "</div></div>");
        porGrupo[g].forEach(function (j) { gb.appendChild(linhaJogo(j)); });
        grid.appendChild(gb);
      });
      sec.appendChild(grid);
      container.appendChild(sec);
    });
  }

  // ---------------------------- render: grupos -----------------------------
  function tabelaGrupo(g) {
    var times = D.GRUPOS[g].slice();
    var stats = {};
    times.forEach(function (t) { stats[t] = { j: 0, pts: 0, gp: 0, gc: 0 }; });
    JOGOS.forEach(function (j) {
      if (j.grupo !== g || !j.placar) return;
      var a = stats[j.casa], b = stats[j.fora];
      a.j++; b.j++; a.gp += j.placar[0]; a.gc += j.placar[1]; b.gp += j.placar[1]; b.gc += j.placar[0];
      if (j.placar[0] > j.placar[1]) a.pts += 3;
      else if (j.placar[0] < j.placar[1]) b.pts += 3;
      else { a.pts++; b.pts++; }
    });
    times.sort(function (x, y) {
      var sx = stats[x], sy = stats[y];
      if (sy.pts !== sx.pts) return sy.pts - sx.pts;
      var sgx = sx.gp - sx.gc, sgy = sy.gp - sy.gc;
      if (sgy !== sgx) return sgy - sgx;
      return D.SELECOES[y].nota - D.SELECOES[x].nota; // empata por força estimada
    });

    var linhas = times.map(function (t, i) {
      var s = stats[t], sel = D.SELECOES[t];
      var cls = i === 0 ? "q1" : i === 1 ? "q2" : "";
      var badge = sel.classificado ? ' <span class="pill classificado">classificado</span>' : "";
      return '<tr class="' + cls + '">' +
        '<td class="time"><span class="pos">' + (i + 1) + '</span><span class="flag-sm">' + sel.flag + "</span>" + esc(sel.nome) + badge + "</td>" +
        "<td>" + s.j + "</td>" +
        "<td>" + (s.gp - s.gc > 0 ? "+" : "") + (s.gp - s.gc) + "</td>" +
        '<td class="pts">' + s.pts + "</td>" +
        "</tr>";
    }).join("");

    return el(
      '<div class="grupo-card">' +
        '<div class="grupo-head">Grupo ' + g + '<span class="qtd">proj. classificação</span></div>' +
        '<table class="tab-class"><thead><tr><th class="time">Seleção</th><th>J</th><th>SG</th><th>Pts</th></tr></thead>' +
        "<tbody>" + linhas + "</tbody></table>" +
      "</div>"
    );
  }

  function renderGrupos(container) {
    container.appendChild(el('<p style="color:var(--txt-mute);font-size:13px;margin:0 0 14px">Classificação parcial com base nos resultados confirmados; em caso de empate, ordenada pela força estimada da seleção. <span style="color:var(--green)">■</span> projetado em 1º · <span style="color:var(--gold)">■</span> projetado em 2º.</p>'));
    var grade = el('<div class="grade-grupos"></div>');
    Object.keys(D.GRUPOS).forEach(function (g) { grade.appendChild(tabelaGrupo(g)); });
    container.appendChild(grade);
  }

  // -------------------------- render: mata-mata ----------------------------
  function renderMata(container) {
    // Quando os confrontos reais já existem, mostra-os COM análise (clicáveis)
    if (JOGOS_MATA.length) {
      container.appendChild(el('<p style="color:var(--txt-mute);font-size:13px;margin:0 0 14px">Confrontos reais do mata-mata — clique em um jogo para ver a análise e o provável vencedor. Atualizados automaticamente conforme o chaveamento avança.</p>'));
      var porFaseR = {};
      JOGOS_MATA.forEach(function (j) { (porFaseR[j.fase] = porFaseR[j.fase] || []).push(j); });
      Object.keys(porFaseR).forEach(function (fase) {
        var qtd = porFaseR[fase].length;
        container.appendChild(el('<div class="dia-rotulo">' + esc(fase) + " <span style='color:var(--txt-dim);font-weight:500;font-size:11px'>" + qtd + " jogo" + (qtd > 1 ? "s" : "") + "</span></div>"));
        var grade = el('<div class="grade-jogos"></div>');
        porFaseR[fase].forEach(function (j) { grade.appendChild(cardJogo(j)); });
        container.appendChild(grade);
      });
      return;
    }
    // Antes da definição dos confrontos: mostra o chaveamento (placeholders)
    container.appendChild(el('<p style="color:var(--txt-mute);font-size:13px;margin:0 0 14px">Chaveamento do mata-mata (a partir de 28/jun). Os confrontos dependem da classificação final dos grupos — formato inédito de 48 seleções, com 32-avos de final. <b>Assim que os confrontos forem definidos, cada jogo aparecerá aqui com análise e provável vencedor automaticamente.</b></p>'));
    var porFase = {};
    D.MATA_MATA.forEach(function (m) { (porFase[m.fase] = porFase[m.fase] || []).push(m); });
    Object.keys(porFase).forEach(function (fase) {
      container.appendChild(el('<div class="dia-rotulo">' + esc(fase) + "</div>"));
      var grade = el('<div class="grade-jogos"></div>');
      porFase[fase].forEach(function (m) {
        var txt = m.m[1] ? legendaVaga(m.m[0]) + "  ✕  " + legendaVaga(m.m[1]) : esc(m.m[0]);
        grade.appendChild(el(
          '<div class="jogo" style="cursor:default">' +
            '<div class="jogo-topo"><span class="jogo-grupo">' + esc(m.fase) + '</span><span class="pill agendado">' + fmtData(m.data) + "</span></div>" +
            '<div style="font-weight:600;font-size:15px;text-align:center;padding:8px 0">' + txt + "</div>" +
          "</div>"
        ));
      });
      container.appendChild(grade);
    });
  }
  function legendaVaga(code) {
    var m = /^([123])([A-L]+)$/.exec(code);
    if (!m) return esc(code);
    var pos = { "1": "1º", "2": "2º", "3": "3º" }[m[1]];
    if (m[2].length === 1) return pos + " Grupo " + m[2];
    return "Melhor " + m[1] + "º (" + m[2].split("").join("/") + ")";
  }

  // ----------------------------- render: sobre -----------------------------
  function renderSobre(container) {
    container.appendChild(el(
      '<div class="mini-card" style="max-width:760px">' +
        "<h3 style='margin-top:0'>Como a análise é feita</h3>" +
        "<p style='color:var(--txt-mute);font-size:14px;line-height:1.7'>" +
        "Cada seleção tem um perfil construído a partir de <b>pesquisa na internet</b> (forma de jogar, formação, destaques, desfalques por lesão/suspensão, momento e força estimada). " +
        "O motor de análise combina esses fatores — qualidade individual, momento na competição, fator casa, desfalques e tradição em Copas — para estimar as probabilidades de vitória, empate e derrota, o placar mais provável e o <b>provável vencedor</b>, sempre explicando o porquê.</p>" +
        "<p style='color:var(--txt-mute);font-size:14px;line-height:1.7'>A tabela de 72 jogos da fase de grupos é <b>gerada automaticamente</b> a partir do calendário. Os <b>44 jogos já disputados</b> até " + esc(D.TORNEIO.dataDados) + " exibem o placar real (pesquisado na internet); os jogos de hoje e os futuros mostram a previsão da análise.</p>" +
        "<h4 style='color:var(--gold);margin-bottom:8px'>Fontes da pesquisa</h4>" +
        '<div class="fontes" style="font-size:13px">' +
          '<a href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026" target="_blank" rel="noopener">FIFA</a>' +
          '<a href="https://www.espn.com/soccer/" target="_blank" rel="noopener">ESPN</a>' +
          '<a href="https://www.sofascore.com/football/tournament/world/world-championship/16" target="_blank" rel="noopener">Sofascore</a>' +
          '<a href="https://www.olympics.com/pt/noticias/copa-do-mundo-2026-tabela-classificacao-resultados" target="_blank" rel="noopener">Olympics.com</a>' +
          '<a href="https://en.wikipedia.org/wiki/2026_FIFA_World_Cup" target="_blank" rel="noopener">Wikipedia</a>' +
        "</div>" +
        "<p style='color:var(--txt-dim);font-size:12px;margin-top:16px'>Aviso: trata-se de uma ferramenta analítica e de entretenimento. As previsões são estimativas baseadas em modelo e não garantem resultados.</p>" +
      "</div>"
    ));
  }

  // ------------------------------- MODAL -----------------------------------
  function abrirModal(jogoId) {
    var acha = function (x) { return x.id === jogoId; };
    var j = JOGOS.find(acha) || JOGOS_MATA.find(acha);
    if (!j) return;
    var ca = D.SELECOES[j.casa], fo = D.SELECOES[j.fora];
    var p = A.prever(ca, fo, ctxJogo(j));
    var t = A.montarTextos(ca, fo, p, ctxJogo(j));
    var st = statusDoJogo(j);

    var pa = Math.round(p.pA * 100), pe = Math.round(p.pEmpate * 100), pb = 100 - pa - pe;
    var fav = p.favoritoA ? ca : fo;

    var meioHtml = j.placar
      ? '<div class="placar-real">' + j.placar[0] + " - " + j.placar[1] + '</div><div class="rotulo">resultado final</div>'
      : '<div class="vs-grande">×</div><div class="rotulo">' + (st === "hoje" ? "hoje" : "a disputar") + "</div>";

    var destaquesHtml = function (sel, def) {
      var dest = (sel.destaques || []).map(function (d) { return '<li>' + esc(d) + "</li>"; }).join("");
      var desf = def.length
        ? def.map(function (d) { return '<span class="tag bad">' + esc(d) + "</span>"; }).join("")
        : '<span class="tag good">Sem desfalques de peso</span>';
      return '<div class="mini-card">' +
        '<div class="cab"><span class="flag">' + sel.flag + "</span>" + esc(sel.nome) + "</div>" +
        "<div class='estilo-txt'><b>Como joga:</b> " + esc(sel.estilo) + " (" + esc(sel.formacao) + ").</div>" +
        "<div style='margin-top:10px'><b style='font-size:12px;color:var(--gold)'>★ DESTAQUES</b><ul>" + dest + "</ul></div>" +
        "<div style='margin-top:10px'><b style='font-size:12px;color:#ff9b9b'>🚑 DESFALQUES</b><br>" + desf + "</div>" +
        (sel.tecnico ? "<div style='margin-top:10px;font-size:12px;color:var(--txt-dim)'>Técnico: " + esc(sel.tecnico) + "</div>" : "") +
        "</div>";
    };

    var fatoresHtml = t.fatores.map(function (f) {
      return '<li><span class="ico">' + f.ico + '</span><span>' + esc(f.txt) + "</span></li>";
    }).join("");

    var modal = el(
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          "<div class='meta'>" + (j.grupo ? "<b>Grupo " + j.grupo + "</b> · " + j.rodada + "ª rodada" : "<b>" + esc(j.fase) + "</b>") + "<br>" + esc(fmtData(j.data)) + (j.local ? " · " + esc(j.local) : "") + "</div>" +
          '<button class="fechar" aria-label="Fechar">×</button>' +
        "</div>" +
        '<div class="modal-confronto">' +
          '<div class="modal-time"><div class="flag">' + ca.flag + '</div><div class="nome">' + esc(ca.nome) + '</div><div class="extra">' + esc(ca.conf) + " · força " + ca.nota + "</div></div>" +
          '<div class="modal-meio">' + meioHtml + "</div>" +
          '<div class="modal-time"><div class="flag">' + fo.flag + '</div><div class="nome">' + esc(fo.nome) + '</div><div class="extra">' + esc(fo.conf) + " · força " + fo.nota + "</div></div>" +
        "</div>" +

        '<div class="veredito-box">' +
          '<div class="titulo">🔮 Veredito da análise</div>' +
          '<div class="vencedor">' + (p.equilibrio ? "⚖️ Jogo equilibrado" : fav.flag + " " + esc(fav.nome)) + "</div>" +
          '<div class="conf">Confiança do palpite: <b>' + p.confianca + "</b> · Placar provável: <b>" + p.golA + " a " + p.golB + "</b></div>" +
          '<div class="barra-prob">' +
            (pa > 8 ? '<div class="pa" style="width:' + pa + '%">' + esc(ca.nome.split(" ")[0]) + " " + pa + "%</div>" : '<div class="pa" style="width:' + pa + '%"></div>') +
            (pe > 8 ? '<div class="pd" style="width:' + pe + '%">X ' + pe + "%</div>" : '<div class="pd" style="width:' + pe + '%"></div>') +
            (pb > 8 ? '<div class="pb" style="width:' + pb + '%">' + esc(fo.nome.split(" ")[0]) + " " + pb + "%</div>" : '<div class="pb" style="width:' + pb + '%"></div>') +
          "</div>" +
          '<div class="prob-legenda"><span>Vitória ' + esc(ca.nome) + "</span><span>Empate</span><span>Vitória " + esc(fo.nome) + "</span></div>" +
        "</div>" +

        '<div class="bloco">' +
          (j.placar ? "<h4>📋 Análise pré-jogo</h4>" : "<h4>📋 A análise</h4>") +
          '<div class="narrativa"><p>' + esc(t.narrativa) + "</p></div>" +
        "</div>" +

        '<div class="bloco">' +
          "<h4>⚔️ As duas seleções</h4>" +
          '<div class="duas-colunas">' + destaquesHtml(ca, t.desfalquesA) + destaquesHtml(fo, t.desfalquesB) + "</div>" +
        "</div>" +

        '<div class="bloco">' +
          "<h4>🔑 Fatores decisivos</h4>" +
          '<ul class="fatores">' + fatoresHtml + "</ul>" +
          '<div class="veredito-box" style="margin:14px 0 0"><div class="conf" style="color:var(--txt)">' + esc(t.veredito) + "</div></div>" +
        "</div>" +

        '<div class="aviso">Análise gerada por modelo a partir de dados pesquisados em ' + esc(D.TORNEIO.dataDados) + ". É uma estimativa de entretenimento — bola rolando, tudo pode acontecer. ⚽</div>" +
      "</div>"
    );

    var overlay = $("#overlay");
    overlay.innerHTML = "";
    overlay.appendChild(modal);
    overlay.classList.add("aberto");
    document.body.style.overflow = "hidden";
    $(".fechar", modal).addEventListener("click", fecharModal);
  }
  function fecharModal() {
    $("#overlay").classList.remove("aberto");
    document.body.style.overflow = "";
  }

  // Observação: a atualização "ao vivo" foi removida — não há API pública
  // gratuita e com CORS confiável para os placares da Copa 2026. Os resultados
  // são mantidos diretamente em dados.js (CALENDARIO), via pesquisa na internet.

  // ------------------------------- toast -----------------------------------
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 4200);
  }

  // ------------------------------- render ----------------------------------
  function render() {
    var main = $("#conteudo");
    main.innerHTML = "";
    // filtros aparecem nas abas de jogos e por rodada; as situações só em "jogos"
    var comFiltro = estado.aba === "jogos" || estado.aba === "rodadas";
    $("#barra-filtros").style.display = comFiltro ? "flex" : "none";
    var chips = $("#chips-status");
    if (chips) chips.style.display = estado.aba === "jogos" ? "flex" : "none";
    if (estado.aba === "jogos") renderJogos(main);
    else if (estado.aba === "rodadas") renderRodadas(main);
    else if (estado.aba === "grupos") renderGrupos(main);
    else if (estado.aba === "mata") renderMata(main);
    else renderSobre(main);
    // delegação de clique (cards e linhas compactas)
    main.querySelectorAll("[data-id]").forEach(function (c) {
      c.addEventListener("click", function () { abrirModal(c.getAttribute("data-id")); });
    });
  }

  // ------------------------------- init ------------------------------------
  function init() {
    JOGOS = gerarJogos();
    JOGOS_MATA = gerarJogosMata();
    calcularMomento();

    // selo de data (reflete a atualização automática dos resultados)
    var selo = $("#data-dados");
    if (selo) selo.textContent = D.TORNEIO.dataDados;

    // abas
    document.querySelectorAll(".aba").forEach(function (a) {
      a.addEventListener("click", function () {
        document.querySelectorAll(".aba").forEach(function (x) { x.classList.remove("ativo"); });
        a.classList.add("ativo");
        estado.aba = a.getAttribute("data-aba");
        render();
      });
    });

    // filtro de grupo
    var sel = $("#filtro-grupo");
    Object.keys(D.GRUPOS).forEach(function (g) {
      sel.appendChild(el('<option value="' + g + '">Grupo ' + g + "</option>"));
    });
    sel.addEventListener("change", function () { estado.grupo = sel.value; render(); });

    // busca
    $("#filtro-busca").addEventListener("input", function (e) { estado.busca = e.target.value; render(); });

    // chips de status
    document.querySelectorAll(".chip[data-status]").forEach(function (c) {
      c.addEventListener("click", function () {
        document.querySelectorAll(".chip[data-status]").forEach(function (x) { x.classList.remove("ativo"); });
        c.classList.add("ativo");
        estado.status = c.getAttribute("data-status");
        render();
      });
    });

    // fechar modal
    $("#overlay").addEventListener("click", function (e) { if (e.target.id === "overlay") fecharModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharModal(); });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
