# ⚽ Copa do Mundo 2026 — Central de Análises

Página web que analisa **jogo a jogo** a Copa do Mundo de 2026 (EUA · Canadá · México).
A tabela de partidas é preenchida automaticamente e, ao clicar em qualquer jogo, você vê
uma **análise completa** com o provável vencedor e a explicação do porquê.

![status](https://img.shields.io/badge/dados-23%2F06%2F2026-1db954) ![sem build](https://img.shields.io/badge/sem%20build-abre%20no%20navegador-f5c542)

## ✨ O que ela faz

- **Tabela automática** dos 72 jogos da fase de grupos, gerada a partir do calendário real, além do chaveamento do mata-mata (formato inédito de 48 seleções, com 16-avos de final).
- **Análise de cada jogo** ao clicar, contendo:
  - 🔮 **Provável vencedor** com probabilidades de vitória/empate/derrota e placar estimado;
  - ⚔️ **Forma de jogar** de cada seleção (estilo + formação);
  - 🚑 **Desfalques** por lesão e suspensão;
  - ★ **Destaques** (principais jogadores);
  - 🔑 **Fatores decisivos** que explicam o palpite (qualidade, momento, fator casa, desfalques, tradição).
- **Filtros** por seleção, grupo e situação (hoje / a disputar / encerrados).
- **Classificação** por grupo (com base nos resultados reais) e **chaveamento** do mata-mata.
- **Atualização automática de placares** via GitHub Actions agendado (ver abaixo).

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

## 🔄 Atualização automática de placares

Os placares ficam em `assets/js/dados.js` (lista `CALENDARIO`). Um GitHub Actions
agendado (`.github/workflows/atualizar.yml`) busca os resultados numa API de futebol,
atualiza o arquivo e republica o site sozinho — **sem backend**.

**Como ativar:**

1. Crie uma conta gratuita em **[football-data.org](https://www.football-data.org/)** e copie seu token de API.
2. No repositório: **Settings → Secrets and variables → Actions → New repository secret**
   - **Name:** `FOOTBALL_API_KEY`
   - **Secret:** seu token
3. Pronto. O workflow roda a cada 15 min (junho/julho) e também pode ser disparado em
   **Actions → Atualizar resultados → Run workflow**.

Detalhes:
- Só aplica placares de jogos **finalizados** (não marca jogo em andamento como encerrado).
- Também traz automaticamente os **confrontos do mata-mata** assim que são definidos — cada um ganha análise e provável vencedor na hora (o motor já cobre as 48 seleções).
- À prova de falhas: sem chave / erro de rede / sem novidades ⇒ **não altera nada** (o site mantém os dados atuais).
- Atualização "quase em tempo real" (atraso de minutos; o GitHub pode atrasar agendamentos).
- Para usar **outra API**, edite a função `buscarPlacares()` em `scripts/atualizar-resultados.js`.
- Teste local sem rede: `MOCK=1 node scripts/atualizar-resultados.js` (lembre de `git checkout` depois).

### Atualização pontual (gatilho externo)

O `cron` do GitHub é "melhor esforço" e pode atrasar/pular execuções. Para
disparos pontuais (~5 min), use um agendador externo gratuito chamando o
`workflow_dispatch` da API do GitHub:

1. **Crie um token** em GitHub → Settings → Developer settings → Personal access
   tokens → **Fine-grained tokens**:
   - Repository access: somente `copadomundo`
   - Permissions → **Actions: Read and write**
   - Gere e **copie o token** (mantenha em segredo).
2. **Num cron externo** (ex.: [cron-job.org](https://cron-job.org)), crie um job:
   - **URL:** `https://api.github.com/repos/evandrolgp-web/copadomundo/actions/workflows/atualizar.yml/dispatches`
   - **Método:** `POST`
   - **Headers:**
     - `Authorization: Bearer SEU_TOKEN`
     - `Accept: application/vnd.github+json`
     - `X-GitHub-Api-Version: 2022-11-28`
     - `Content-Type: application/json`
   - **Body:** `{"ref":"main"}`
   - **Intervalo:** a cada 5 min (ou só nas horas de jogo)
3. Sucesso = **HTTP 204**. Uma nova execução aparece em **Actions** como `workflow_dispatch`.

> O token fica guardado no serviço de cron — use um PAT restrito a este repo,
> com expiração, e **nunca** o compartilhe em prints/chat. O `cron` interno do
> GitHub continua ativo como reserva.

## 🗂️ Estrutura

```
index.html                          # página
assets/css/estilo.css               # estilo (tema escuro)
assets/js/dados.js                  # base: 48 seleções, 12 grupos, calendário + placares
assets/js/analise.js                # motor de previsão e geração dos textos
assets/js/app.js                    # interface: tabela, filtros, abas e modal
scripts/validar.js                  # validação (node scripts/validar.js)
scripts/atualizar-resultados.js     # atualizador de placares (via API)
.github/workflows/deploy.yml        # publica no GitHub Pages a cada push na main
.github/workflows/atualizar.yml     # busca placares e republica (agendado)
```

## ✅ Validação

```bash
node scripts/validar.js
```

## 📚 Fontes da pesquisa (jun/2026)

FIFA, ESPN, Sofascore, Olympics.com, Wikipedia, entre outras coletadas em 23/06/2026.

---
Feito com ⚽ e dados.
