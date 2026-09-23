# EAG Compass v2.0 — Design (Fase 5)

**Data:** 2026-09-22 · **Status:** telas e design doc aguardando aprovação de Rogério.
**Base:** Spec v2.0 (com revisões pós-aprovação 1–3), Constituição v2.0, stack aprovada na Fase 4.
**Artefatos:** `design/fase5/direcoes-hoje.html` (4 direções comparadas), `design/fase5/compass-prototipo.html` (protótipo navegável da direção escolhida), capturas `design/fase5/p-*.png` e `shot-*.png`, `design/fase5/verificacao-mobile.html` (quadro de 390 px).
**Limite:** HTML de alinhamento, não código de produção. A interface real nasce na Fase 6, sobre a base 0.3.1 (Worker + Static Assets).

## 1. Caminho e direção

- **Caminho escolhido (5.1):** `design-lab`, por Rogério em 2026-09-22. Motivo: o Compass é ferramenta interna com dashboards, escopo declarado do `design-lab`; o `design-taste-frontend` exclui dashboards.
- **Briefing aprovado:** marca EAG como base; tema escuro; layout arejado; tela inicial = painel "o que precisa de mim hoje"; celular só com o básico (alertas, respostas, tarefas); aparência final; comparar direções.
- **Direções comparadas:** Talhão, Mesa de Operações, Editorial, Manifesto (`direcoes-hoje.html`).
- **Direção escolhida: Talhão** (Rogério, 2026-09-22). Verde-noite da marca, linhas de relevo ao fundo, número amarelo gigante só no que pede decisão, títulos condensados em caixa alta.
- **Calibragem:** densidade 4 (arejado), variância 4 (assimetria leve entre colunas), motion 3 (transições de 150–200 ms, sem coreografia).

## 2. Sistema visual (tokens)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `oklch(0.17 0.035 152)` | Fundo (verde-noite derivado de `#002F09`) |
| `--side` / `--surface` / `--surface-2` | `oklch(0.15 / 0.20 / 0.23 …)` | Barra lateral, campos, realce |
| `--text` / `--muted` | `oklch(0.95 0.015 120)` / `oklch(0.74 0.03 135)` | Texto principal e secundário |
| `--line` / `--line-strong` | `oklch(0.32 0.03 150 / .7)` / `oklch(0.45 0.03 150)` | Divisórias, bordas |
| `--accent` | `#F9D428` (amarelo EAG) | **Único acento**: CTA principal, contadores, o que pede decisão |
| `--on-accent` | `#002F09` (verde EAG) | Texto sobre o amarelo |
| `--danger` | `oklch(0.70 0.16 28)` | Só parar, bloquear, erro |
| Fontes | Barlow Condensed (títulos/números) · Roboto (corpo, marca EAG) · IBM Plex Mono (dados, códigos, distâncias) | Roboto não é usada como título (regra anti-slop do `design-lab`) |
| Escala de texto | 12 · 14 · 16 · 20 · 28 · 44 · 56 (título de tela) · 168 (número de decisão) | |
| Espaçamento | 8 · 16 · 24 · 40 · 64 | |
| Cantos | 0 em tudo (como o site da EAG) | Pinos do mapa são a única forma redonda |
| Alvo mínimo | 44 px (botões, links, itens de menu) | |
| Assinatura | Linhas de relevo em `repeating-radial-gradient` no fundo | Não usar em superfícies de leitura |

## 3. Componentes

- **Navegação lateral** (desktop) / **faixa horizontal** (≤ 900 px) com contadores em amarelo.
- **Número de decisão** (168 px, amarelo) + título em caixa alta — só na tela Hoje.
- **Lista de linhas** (`rows`): nome, sub-linha, metadados mono, etiqueta à direita (`tag`, `tag.warn`, `tag.stop`, `tag.fill`).
- **Lista de tarefas** (`list`): nível L0/L1/L2/IN/RESP, texto, ação.
- **Pares chave/valor** (`kv`) com barra de progresso.
- **Formulário:** rótulo acima, erro abaixo em `--danger`, campo inválido com borda vermelha.
- **Segmentado** (ordenação), **passos** (E-mail 1–4), **linha do tempo**, **rampa** de 4 degraus.
- **Diálogo de confirmação:** título com ação + objeto; botão com a ação; motivo obrigatório para descartar ou adiar.
- **Faixa de pausa** vermelha no topo quando os envios estão pausados.
- **Toast** amarelo para confirmação de ação.
- **Estados:** carregando (skeleton), parcial (cobertura com "Tentar de novo"), bloqueado (critério faltando), vazio (a construir por tela na Fase 6).

## 4. Telas × requisitos

| Tela | Cobre | Observações |
| --- | --- | --- |
| **Hoje** | R24.1–R24.2, R24.6, R18 (entrada), R20 (respostas), R28 (tarefas), R19.10 (envio do dia), R11.8 (busca parcial) | Tela inicial; celular mostra só este bloco, tarefas e respostas |
| **Radar Nacional** | R11.1–R11.17, R28.2–R28.4, R14.3, R14.6–R14.8, R24.3 | Raio 5 e 100–1.500; nova versão ao mudar o raio; ordenação por aderência ou distância; precisão "endereço/estimado"; trader e MEI visíveis sem ficha |
| **Internacional** | R12.1–R12.10, R1.4.2, R28.17 | Estados compra identificada / nenhum registro / dados indisponíveis; aviso de evidência de mercado; máximo 2 campanhas ativas |
| **Ficha de aprovação** | R17 (PV1–PV12), R18.1–R18.10, R19.13, R16.7–R16.8, R21.7 | Sequência congelada E-mail 1–4; revisor bloqueia a aprovação; prova para Rogério; adiar/descartar com motivo |
| **Empresa + linha do tempo** | R24.4, R20.1, R20.4, R20.5, R28.10, R28.13, R4/R5 (scores com intervalo) | Orientação da `/prospeccao-vendas` quando pedem preço; Compass não responde |
| **Envios** | R19.2, R19.10–R19.12, R22.1, R22.7–R22.8, R26 | Rampa 5→20; fila com bloqueio "sem e-mail validado"; pausar operação com confirmação e retomada |
| **Tarefas** | R28.5–R28.9, R28.18–R28.19, R3.1.5, R15.3–R15.5 | Roteiros L0/L2 e LinkedIn assistido; 3 perguntas registradas como "Confirmado" com método e data |
| **Parâmetros e supressão** | R7.1, R9.2 (só Admin), R21.1, R21.5, R9.1.1 | Parâmetros sem valor aparecem como pendência; identificadores de supressão pseudonimizados |

**Requisitos com UI ainda sem tela desenhada** (desenhar na Fase 6 dentro deste sistema, sem nova direção): cadastro manual de empresa (R1.1), evidências e contatos (R1.3, R2.1, R15.1), formulário de demanda completo (R3), gate de qualificação (R7.2), campanha e declarações aprovadas (R16), catálogo (R10), importação do OpenClaw (R25), estado dos canais (R26.1), triagem em lote do Radar. O analyze da Fase 7 deve cobrar essa lista.

## 5. Regras responsivas

- **Desktop (≥ 900 px):** barra lateral fixa de 240 px; conteúdo até 1.360 px; telas em duas colunas assimétricas.
- **≤ 900 px:** uma coluna; navegação vira faixa horizontal rolável; itens de menu secundários ocultos; metadados de linha ocultos; número de decisão cai para 96 px e títulos para 38 px.
- **Celular (390 px), escopo básico:** Hoje, respostas e tarefas. Aprovação de ficha e Radar são de desktop no piloto.
- Verificado em 1440 px e em quadro de 390 px (`verificacao-mobile.html`). O Chrome headless impõe largura mínima de janela; capturas de celular devem usar o quadro.

## 6. Acessibilidade e textos

- Foco visível amarelo em todo interativo; alvos de 44 px; `prefers-reduced-motion` respeitado.
- Contraste: texto `--text` e `--muted` sobre `--bg` acima de 4,5:1 (a conferir com ferramenta na Fase 7); amarelo com texto verde EAG no CTA.
- Botões nomeiam a ação ("Aprovar ficha v1", "Pausar todos os envios", "Buscar compradores"); erros dizem o que houve e como resolver.
- Dados de exemplo sempre marcados "fictícios"; números sem fonte aparecem como placeholder (`[t]`, `[US$]`, `—`).

## 7. Insumo da Fase 6

- Os HTML e capturas acima são referência visual. Os tokens da §2 viram as CSS custom properties do `public/`.
- O protótipo usa JS vanilla, coerente com a base 0.3.1 (sem framework); o plano decide a organização real.
- O mapa esquemático é substituído por MapLibre + PMTiles no R2 (G10), com atribuição "© OpenStreetMap".
