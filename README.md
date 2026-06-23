# ⚽ Copa do Mundo 2026 — Central de Análises

Página web que analisa **jogo a jogo** a Copa do Mundo de 2026 (EUA · Canadá · México).
A tabela de partidas é preenchida automaticamente e, ao clicar em qualquer jogo, você vê
uma **análise completa** com o provável vencedor e a explicação do porquê.

![status](https://img.shields.io/badge/dados-23%2F06%2F2026-1db954) ![sem build](https://img.shields.io/badge/sem%20build-abre%20no%20navegador-f5c542)

## ✨ O que ela faz

- **Tabela automática** dos 72 jogos da fase de grupos, gerada a partir dos 12 grupos (rodízio), além do chaveamento do mata-mata (formato inédito de 48 seleções, com 32-avos de final).
- **Análise de cada jogo** ao clicar, contendo:
  - 🔮 **Provável vencedor** com probabilidades de vitória/empate/derrota e placar estimado;
  - ⚔️ **Forma de jogar** de cada seleção (estilo + formação);
  - 🚑 **Desfalques** por lesão e suspensão;
  - ★ **Destaques** (principais jogadores);
  - 🔑 **Fatores decisivos** que explicam o palpite (qualidade, momento, fator casa, desfalques, tradição).
- **Filtros** por seleção, grupo e situação (hoje / a disputar / encerrados).
- **Classificação projetada** por grupo e **chaveamento** do mata-mata.
- **Atualizar ao vivo** (best-effort): tenta buscar placares recentes em uma API pública e, se não conseguir, mantém os dados pesquisados.

## ▶️ Como usar

Não precisa instalar nada nem rodar servidor. Basta **abrir o `index.html`** no navegador.

```bash
# opcional: servir localmente
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

## 🧠 Como a análise é feita

Cada seleção tem um **perfil** construído a partir de **pesquisa na internet** (forma de jogar,
formação, destaques, desfalques, momento na competição e uma nota de força estimada).
O motor de análise (`assets/js/analise.js`) combina esses fatores em um modelo simples
(logístico sobre a diferença de força, ajustado por momento, fator casa e desfalques) para
estimar as probabilidades, o placar mais provável e o provável vencedor — sempre com a
explicação do porquê.

> É uma ferramenta **analítica e de entretenimento**. As previsões são estimativas e não garantem resultados.

## 🗂️ Estrutura

```
index.html                 # página
assets/css/estilo.css      # estilo (tema escuro)
assets/js/dados.js         # base: 48 seleções, 12 grupos, resultados, calendário
assets/js/analise.js       # motor de previsão e geração dos textos
assets/js/app.js           # interface: tabela, filtros, abas e modal
scripts/validar.js         # validação (node scripts/validar.js)
```

## ✅ Validação

```bash
node scripts/validar.js
```

## 📚 Fontes da pesquisa (jun/2026)

FIFA, ESPN, Sofascore, Olympics.com, Wikipedia, entre outras coletadas em 23/06/2026.

---
Feito com ⚽ e dados.
