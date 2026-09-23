# EAG Compass — Status do Planejamento v2.0

**Expansão:** Nacional + Internacional
**Iniciado:** 2026-09-22
**Atualização:** 2026-09-23 — revisão documental 23 do status — Fases 3–5 concluídas; **Fase 6: os três planos escritos; Spec com revisão pós-aprovação 4 (lista mensal do Internacional); aguardando revisão de Rogério**
**Revisões anteriores:** rev. 4 a 22 arquivadas em `docs/historico/v2.0-planejamento/`.
**Método:** `/planejar`
**Código-base:** 0.3.1. Os 14/14 testes são relato de leitura anterior; nesta fase não houve reexecução de testes nem alteração de código.

## Fases

| Fase | Status | Artefato / observação |
| --- | --- | --- |
| 0. Preflight | Verificado anteriormente | Integrações de produção pendentes (T1–T12). |
| Converge | `src/scoring.js` e `migrations/0001_initial.sql` consultados em 2026-09-22 para DS1/DS3 | Divergências de código em C8, C10 e C17. |
| 1. Brainstorm | Escopo rev. 3 entregue; **aprovação expressa não registrada** | `docs/eag-compass-v2-escopo.md` |
| 2A. Benchmark | Rev. 2 entregue; **aprovação expressa não registrada** | `docs/eag-compass-benchmark.md` |
| 2B. Perfil + catálogo | Rev. 3 entregue; **aprovação expressa não registrada** | `docs/eag-compass-perfil.md` |
| **T12** | Rev. 4: skill `33bd093f…9dd8` lida; PV1–PV12 e R28 aprovados na Spec; K1–K6 decididos. Implementação e amostras pendentes (Fase 6+). | `docs/eag-compass-t12-prospeccao-vendas.md` |
| **3. Spec + Constituição v2.0** | ✅ **Concluída em 2026-09-22 — aprovadas expressamente por Rogério** ("Aprovo a Spec e a Constituição, pode fechar a Fase 3"). | `docs/eag-compass-spec.md`, `docs/eag-compass-constituicao.md` |
| **4. Pesquisa técnica** | ✅ **Concluída em 2026-09-22 — stack aprovada por Rogério** ("aprovo a stack"). Detalhes e decisões G1–G11, volume e risco Hostinger em §11. Pendente para o plano: G6 | `docs/eag-compass-pesquisa-tecnica.md` |
| **5. Design** | ✅ **Concluída em 2026-09-22 — telas e design doc aprovados por Rogério** ("aprovo"). Caminho `design-lab`, direção Talhão, protótipo de 8 telas; lista de requisitos com UI ainda sem tela registrada no design doc §4 | `docs/eag-compass-design.md`, `design/fase5/` |
| **6. Plano** | **Em andamento (iniciada em 2026-09-22 com autorização de Rogério).** Dividida em 3 planos: **Plano 1 — Fundação (Etapa 0) escrito** (12 tarefas); **Plano 2 — Piloto Nacional (Etapa 1) escrito** (18 tarefas; migrações 0006–0008; primeiro e-mail externo só após o roteiro de T1 da tarefa 17 e liberação por escrito de Rogério); **Plano 3 — Internacional (Etapa 3), revisão 2 de 2026-09-23** (12 tarefas; migrações 0009–0011; refeito pela decisão de Rogério: lista mensal de compras agrícolas de todos os países, fonte do importador — UN Comtrade — mais exportações do Brasil — arquivo completo do MDIC; D1 e D2 a aprovar; conta Comtrade e termos de reutilização pendentes na tarefa 12). Planos 2 e 3 ainda **não revisados por Rogério**. **T6 (Comex Stat/MDIC) e T13 (UN Comtrade):** contratos conferidos por consulta real em 2026-09-23, a partir da rede doméstica; acesso pelo Worker e chamada com chave da Comtrade não testados; registro em `docs/eag-compass-t6-comexstat.md` rev. 2 (`a387c4c1…`). Linha de base medida: 14/14 testes; `npm run check` falha no Windows; migrações 0001–0002 aplicadas localmente. Ajuste da G5: identidade pelo JWT do Access (ctx.access não chega com Static Assets) | `docs/superpowers/plans/2026-09-22-eag-compass-fundacao.md` (`30dc72a5…`), `docs/superpowers/plans/2026-09-23-eag-compass-internacional.md` rev. 2 (`da71efa4…`), `docs/superpowers/plans/2026-09-22-eag-compass-piloto-nacional.md` (`8080a03e…`) |
| 7–9 | Pendentes | — |

## Ferramentas do projeto (adicionadas por Rogério em 2026-09-22)

| Ferramenta | O que é | Situação | Uso previsto no Compass |
| --- | --- | --- | --- |
| **`/anthropic-skills:pesquisa`** | Pesquisa em funil (varredura → análise → aprofundamento), com aprovação humana entre níveis, fatos-chave em 2+ fontes e nota de confiabilidade das fontes (CRAAP). Relatórios em `~/pesquisas/` | Disponível na sessão (skill sincronizada) | Pesquisas com decisão em jogo nas próximas fases: provedor de envio (G3-c), fontes e custos. Complementa a skill `search` exigida pela `/planejar` |
| **`/search`** | Orquestrador de pesquisa Exa com subagentes (dedup, verificação por domínio). Relatórios em `~/pesquisas/` | Disponível; já usada na Fase 4 parte 2 | Varreduras amplas (fontes, fornecedores, limites) |
| **mcp-brasil** (`github.com/mcp-brasil/mcp-brasil`) | Servidor MCP em Python para 70 fontes públicas brasileiras; código MIT, com licença própria por fonte e política de uso aceitável (`ACCEPTABLE_USE.md`) | Configurado no escopo do projeto em `.mcp.json`, **fixado na versão 0.14.0**, sem chaves. Instalação testada (`uvx`, 82 pacotes). **Aguardando aprovação de Rogério** ao abrir o `claude` nesta pasta | Candidatos (a avaliar, não decididos): `brasilapi` (CEP e CNPJ — T4/T5); `ibge` (municípios); `compras` (PNCP — licitações e contratos como "registro público nominal" de compra, 30 pontos no DS1); `transparencia` (sanções CEIS/CNEP — T11; exige chave gratuita); `diario_oficial` |

**Diretriz de Rogério (2026-09-22):** sempre usar as skills e MCPs adicionados ao projeto, para facilitar o trabalho e consumir menos tokens. O método de prospecção continua sendo só a `/prospeccao-vendas`.

**Regras de uso do mcp-brasil (da política de uso aceitável dele):** manter o mascaramento de dados pessoais ativo (não definir `MCP_BRASIL_LGPD_ALLOW_PII` sem base legal documentada — compatível com P7); citar a fonte de cada dado (`SOURCES.md`; compatível com P1/P2); respeitar os limites das APIs de origem. Ele é **ferramenta de pesquisa e planejamento nesta sessão de trabalho**, não dependência do Worker em produção. Usá-lo dentro do Compass seria outra decisão, que passaria pela Constituição (P19).

## Decisões e diretrizes de Rogério em 2026-09-22

| Tema | Decisão | Registro |
| --- | --- | --- |
| Perfil | Rogério é Administrador | Spec R9.2, AT14 |
| B2 | Aprovada integralmente | R21.7, R21.9, R21.10, AT35 |
| B3 | Aprovada em parte (raio positivo; nova versão ao alterar). **Limites: Fase 4, com justificativa técnica, sem copiar Econodata/Google** | R11.11, R11.12, R11.14, R11.15, AT37, AT38 |
| B1 | **Pendente.** Até exceção: pausa por resposta da rev. 3; sem retomada automática | R20.7, R20.8, AT36 |
| DS1 | **Aprovada.** DS1-b não; DS1-c sim | Spec §6.1, R4.3.4–R4.3.6, R5.1.2, AT40–AT49 |
| DS2 | USD base; BRL para visualização | R3.1.4 |
| DS3 | Estados existentes preservados; duas mudanças justificadas | Spec §1.2, R1.3, AT39 |
| **T12** | **Fazer a nova leitura antes de fechar a Fase 3** | T12 rev. 3 |
| **K1–K6** | **Seguir as recomendações:** K1 porte médio/média-mais (pequenas/MEI fora; gigantes só com relacionamento prévio); K2 máximo 2 commodities ativas por mercado; K3 traders fora da prospecção ativa, ficha só por exceção registrada por empresa; K4 cadência completa (e-mails automáticos + tarefas manuais de ligação e LinkedIn assistido); K5 abertura sinalizada → "ligar agora", condicionada a T1 e T11; K6 declarações aprovadas por campanha | Spec §6.0; R2.4.2, R14.3, R14.6–R14.8, R16.7–R16.8, R28.5–R28.7, R28.17–R28.19; AT59, AT61–AT65; Constituição P16, P17 |
| **Diretriz** | **Todo trabalho de prospecção deve obedecer à `/prospeccao-vendas`** | Constituição P17 (revisado), Spec R28, R17, R14.3, R15, R3.1.5, R18.10, R19.2 itens 11–12, AT51–AT60 |

**Aprovação final (2026-09-22):** Rogério aprovou a Spec v2.0 e a Constituição v2.0 e autorizou o fechamento da Fase 3. A aprovação não abrange as Fases 1 e 2, que seguem sem aprovação expressa registrada. A decisão de K3 revisa a decisão 3 anterior ("traders elegíveis"); a de K4 revisa o piloto "somente por e-mail" do escopo rev. 3 (o envio automático continua só por e-mail; ligações e LinkedIn são tarefas manuais).

## Nova leitura T12 — resumo

- **O que foi lido:** a skill atual (versão 1.0.0, destilada em 2026-09-22 do curso de franqueados da EAG Agro, de Anderson Ramos). `SKILL.md` e todas as referências integralmente, `conselho.json`, e os 36 casos de `evals.json`.
- **O que não foi lido:** as 8 transcrições, que a própria skill proíbe ler inteiras (a procedência foi conferida pelo `knowledge-audit.md`), e as duas imagens.
- **Mudança de fundo:** a v1.0 anterior era genérica (SPIN/Gap por módulos). A atual é o método da EAG Agro: ICP estreito, lista pelo uso final, cadência de 2 semanas multicanal, cold call por levels, e cada toque vende a reunião — nunca preço, PDF ou proposta.
- **Precedência invertida:** a skill governa o método de prospecção; os controles do Compass (aprovação, supressão, LGPD, compliance, veracidade, integração comprovada) continuam como complemento. Em choque literal, vale o mais restritivo até decisão de Rogério.
- **Critérios:** PV1–PV8 reescritos, PV9–PV12 novos. Adaptações A7, A9 e A10 retiradas (o "Modelo EAG" da v1.0 não existe; EAG é a EAG Agro).

## Arquivo histórico

| Arquivo | SHA-256 |
| --- | --- |
| `historico/v1.3/eag-compass-spec-v1.3.md` | `01022bc95f78193b44fd940e87d678a9521e6f81024f268f5906d73c5d7890e1` |
| `historico/v1.3/eag-compass-constituicao-v1.3.md` | `f6cc9a213af81d28bed9d301fd4168e31b6e2c50d070f0c8cadf0f50e691c588` |
| `historico/v1.3/eag-compass-status-planejamento-v1.3.md` | `b85c351f6b374cd67e4343f3297a201405ede37967d984d50fddc92f5b2a77d1` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev4.md` | `688ffd85029ef0ff0ea76fca31093bd9fda98bb390ab4cd7c90eeeb08cd4a1d4` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rascunho1.md` | `b3d53761fb858acff8d00a9671b7fc1f9a9f46823e251a82417833fad51ed62e` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-rascunho1.md` | `6ed6588b32b180aee7866b079bd7e7192cada224894d81a3b8c222ed46da2567` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev5.md` | `b3e4db546874b630cf63166dc6b395962c360d3f0f388d60b91ec7cf8cfc7bee` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rascunho2.md` | `b9a73b53f27d1642b4a56fbcfdd332297108bf95e75b0a899c062f96568d81f5` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-rascunho2.md` | `cb5a8bea76b723a367aec7d7ebd6562b0efab0d27b4af7ff7c78e2aaee1fb492` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev6.md` | `d0e97087ede4757373b1f831de9142ce3341d9c4d8b7c48bc879e0c948c510b8` |
| `historico/v2.0-planejamento/eag-compass-t12-prospeccao-vendas-rev2.md` | `d6c80a5d7bc71ed20eb2dbe40a9ccfb4a94eb5233216b6a1757e80a470a7bbe7` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rascunho3.md` | `d678bb89d61402b29d74c844f07116f2b0b6112b6e0ecb939452fdddc813937b` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-rascunho3.md` | `7a998af0c9cac3d60b590ff0751ea67a8a7ad8da852d9c67cc7bec5792871faf` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev7.md` | `2b92f8fb1954c39abed61f6d8dbcad3ddb585820907ec5d1e6da6dd669b8a439` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rascunho4.md` | `fc7c59a866befa19c401043b5f25cc7b8edf7748ed14045d68188a4601e0e935` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-rascunho4.md` | `0795a490b4c4cbc19589c44f5b315f2f9d2827c37286e1b87a447a9df7d61d23` |
| `historico/v2.0-planejamento/eag-compass-t12-prospeccao-vendas-rev3.md` | `120157c2293a4d14081103e118f160327c73959934b8ed8d3d2b1c825b91f1ec` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev8.md` | `14127018290dcf498588bb36532f24a9e1dbb123b804f0e7af59191d28afc8a9` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rascunho5.md` | `52810ed4122be66220b15a28874f89aa94ff6319f46d33130b0a763acab81dc9` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-rascunho5.md` | `14676d79544f4114b6c9af3b8fc68f47bd9a095d2e030f0dc0fde82d7d7498d1` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev9.md` | `bd0cad55448d1c9912c2d7305d8ad6f17d4a09d1cdb997e9a638f3c33d7862cb` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-aprovada-2026-09-22.md` | `a4b80ae84140cfcf56125b1488e2ab9d7702ae4fdaab4248eb5514553cf48a11` |
| `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-pre-g3-risco.md` | `9d9d52ab43bca12cdf3cba82b5436ea4f2519241801c5ccd09ac464f2fbd3136` |
| `historico/v2.0-planejamento/eag-compass-design-pre-aprovacao.md` | `04b7755bae2fc9ced066ea2ece5c1d46e25fa4163ecc3b170003cc9d1b0a9754` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte1-rev1.md` | `66a00bdf684598c4478d3e84c74a90cdef2b6f8f1173ac2a43e673afc268575b` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte1-rev2.md` | `ccd02dcae87e533f8899e47bafe7749419a885b01eadf6bcbeb2ba03a09b3faa` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte2-rev1.md` | `f5b61fa2c285e62de9cb0747b39fbbf5419951073d2512aa417be382ba5d65cd` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte2-rev2.md` | `73fd88aeea2240ae07a5112936145303d488c565ea586951f9f1d16e5f15ec80` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte2-rev3.md` | `d5857588b2a27b2dc64b08b59505090bd1ea5cf00b1229c649dac2184de35d1b` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte2-rev4.md` | `a33ca33e81bc4b63a29a9ac28013ee97d78ceb7e1799230bda8deea6be2dd746` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-parte2-rev5.md` | `98a24e2ad0bb934924d0f2fce383e2f960aa33375f60257227166ccfa42c75a1` |
| `historico/v2.0-planejamento/eag-compass-pesquisa-tecnica-pre-aprovacao.md` | `41019e18169735a6bbebd62f25639efa7b01d0353b598828ab9c69f01118e200` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev10.md` | `ff127a97d6235c73299d9f2099ba74a261079c0dec1f8dab7581c39062bed76a` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev11.md` | `faf2bb6211f82e02fefe2baf40456d22d2afcbf2e70337e59f51d90630b0b530` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev12.md` | `5e8eef692f6a30d486f3c2437397f752e2149f5cc711bc2b5278c8353b4918ab` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev13.md` | `93d79bc8321f63e86c14b04e0abfb63567c6882d5a2541cb53567a7358bd623f` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev14.md` | `194259a55b087e23efa1f1c168aad7f3a83556141352885e6c1256a13f28a044` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev15.md` | `69e79e48b26330b3cd26cbc01a847c686483ca75c73729bda3410326ba32e1de` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev16.md` | `c455b1b34bb99d10d807dd2ea32fa12fcf210285c8869b271d6a8bae54e9127d` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev17.md` | `b6e4b37764284c256b9e9919bd3ffeb1b36f530b507fb26989a3b5a12546d454` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev18.md` | `0dc1260fb85165d30f7ae548313f1d38a7c67174be83b88179768120c40313b7` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev19.md` | `5bada5918e75f27f2765b3445c9109ce9d278ce0a428e847135c3eb58c3456da` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev20.md` | `1efb4e0084cabc170f4d78e56a117c40a9406e648c76eed3bcaa97a4b3878272` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-aprovada-2026-09-22.md` | `77cb42594bee8a2267d488c00d67a1d9f689a584c0ea126e32cc1e66fe0f1edf` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rev-pos-aprovacao-1.md` | `8de80be0a950535bd4d0cad002ac122b2be361ab9043f1101ff865e96d2d2649` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rev-pos-aprovacao-2.md` | `a387646655d61e6f3d313d448c946e0fdc3e4e935217f9dd51d8c15c0790b299` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev21.md` | `2f9b14177f91a00d16d5325ac57d9496ef56cab633a7f4696cdcaf471afafec4` |
| `historico/v2.0-planejamento/eag-compass-planejamento-status-rev22.md` | `234c2923cbe0eb40279be874852d70e940b71eedde8f62bfdf019ca3624eb4cb` |
| `historico/v2.0-planejamento/eag-compass-spec-v2.0-rev-pos-aprovacao-3.md` | `12a646ac9f78367d8c32b8bcebca19ffb3cb0cb31e92b9f1543e5258ef822448` |
| `historico/v2.0-planejamento/eag-compass-t6-comexstat-rev1.md` | `ae43cb86a0592aa345e5e8defb36e9119e9b27bc7108d64c5618209ccdffdeb0` |
| `historico/v2.0-planejamento/plano3-internacional-rev1.md` | `50bc9286bebfea13f1f3e9e01646b9aac7532a6f75a772e5ae06280f5945a921` |

Linhas após rev9 acrescentadas na rev. 21 (hashes calculados em 2026-09-23 sobre os arquivos do histórico, que não são alterados depois de arquivados).

Todas as cópias foram conferidas por hash contra a origem no momento do arquivamento. Os originais v1.3 no Desktop não foram alterados.

**Spec vigente (revisão pós-aprovação 4, 2026-09-23):** `766ee039885aba5550fee7e6d43b077af4e0790cb6c63b1348e59810fb03c3d6`. **Documentos aprovados (originais):** Spec v2.0 `77cb42594bee8a2267d488c00d67a1d9f689a584c0ea126e32cc1e66fe0f1edf`; Constituição v2.0 `a4b80ae84140cfcf56125b1488e2ab9d7702ae4fdaab4248eb5514553cf48a11`; T12 rev. 4 `0101217dcb8be8776c7c751c16800c606f869c5e2658e4734535df7afee7200b`. O conteúdo aprovado é o do rascunho 5; mudaram só as linhas de controle e a ativação de R17.8 (hash de referência `33bd093f…9dd8`, conferido no fechamento).

## Números (Spec v2.0 aprovada)

- 27 requisitos da v1.3 com numeração preservada (11 mantidos, 16 revisados); pipeline mantido (DS3).
- R10–R28 novos. Rascunho 4 acrescenta R28 (16 critérios), R3.1.5, R15.6, R18.10, R19.2 itens 11–12, e reescreve R3.4.2, R11.9, R14.3, R15.1, R17.1, R17.3, R17.4, R17.6 e R17.8. Nada renumerado.
- Rascunho 5 acrescenta R14.6–R14.8, R16.7–R16.8, R28.17–R28.19 e reescreve R2.4.2, R14.3, R28.5–R28.7. Nada renumerado.
- AT1–AT65 contínuos (AT51–AT60 no rascunho 4; AT61–AT65 no rascunho 5; AT59 reescrito).
- PV1–PV12 idênticos em identificador na Spec e no T12; texto canônico na Spec R17.3.
- Constituição: P1–P10 preservados, P11–P18 do produto (P16 e P17 revisados no rascunho 4), P19–P21 da metodologia.
- Verificação mecânica: 318 referências na Spec, 77 na Constituição e 28 no T12, todas resolvidas; nenhum ID duplicado; nenhum marcador de K pendente na Spec.

## Revisão de consistência — final da Fase 3

| # | Achado | Situação |
| --- | --- | --- |
| C1 | Escopo rev. 3 diz que a skill não estava disponível, usa "PMEs" e "piloto somente por e-mail". | Escopo congelado. Skill: resolvido pelo T12. Porte e canais: **revisados por decisão de Rogério (K1, K4)**, registrada na Spec §6.0 e nas Clarifications. |
| C2 | Soja, café e etanol no Nacional × qualquer commodity do catálogo. | Compatível. Com a skill, cada ICP tem 1–2 commodities (K2). |
| C3 | Sem limites de raio, busca nacional real impedida. | Intencional (B3, Fase 4). |
| C4, C6 | Perfil; moeda. | Resolvidos. |
| C5 | P19 × `.openai/hosting.json`. | Fase 4. |
| C7 | `PROGRESSO.md`/`README.md` citam v1.3. | Após aprovação da v2.0. |
| C8, C10, C17 | Divergências do código 0.3.1 (gate/AT12, `demands.commodity`, mínimo fixo de 500 para açúcar, tabela relativa só para café, Atualidade independente). | Fase 6. |
| C9 | Cinco decisões preservadas × Spec. | Decisões 1, 4 e 5 intactas. **Decisão 2** mantida para a análise e a seleção, com no máximo 2 campanhas ativas por mercado (K2). **Decisão 3** revisada por Rogério (K1, K3). Spec §8 atualizada. |
| C11–C13 | Busca repetida × nova versão; regra de resposta; pipeline × primeiro contato. | Alinhados. |
| C14 | `deploy.yml`. | Anterior a esta etapa; não revertido (ver rev. 7, arquivada). |
| C15 | Skill substituída às 20:10. | **Resolvido pela leitura (T12 rev. 3).** R17.8 passa a referenciar `33bd093f…9dd8` na aprovação da Spec. |
| C16 | DS1-c × porte-alvo. | Com K1, o porte-alvo é médio/média-mais; os valores de `M_N` devem ser calibrados para esse porte (pendência comercial). |
| C18 | Frases de volume disponível e prova social nos roteiros. | **Resolvido (K6):** declarações aprovadas por campanha (R16.7–R16.8). |
| C19 | "Abriu → ligar na hora" exige rastreamento de abertura. | **Decidido (K5):** implementar condicionado a T1 e T11; desligado até lá (R28.7). T11 passa a incluir base legal e aviso do rastreamento. |
| C20 | Skill recomenda Gemini, Casa dos Dados e Snov.io (validação de e-mail). | Entradas para a Fase 4 (T4, T8, validação de e-mail de R19.2 item 11). Nenhuma ferramenta escolhida ou testada. |
| C21 | Skill manda usar `milho-brasil-prospeccao` para levantamento em massa de milho por estado. | Fase 4: avaliar como adaptador/fonte da busca de milho, mantendo o método desta skill. |
| C23 | Tarefas manuais (K4) poderiam furar pausas e supressão. | Coberto por R28.18 (mesmas interrupções dos envios; AT65). |
| C24 | Constituição apontava "Spec rascunho 1" no cabeçalho desde o rascunho 1. | Corrigido para rascunho 5. |
| C22 | "Enviar para si mesmo antes" × aprovação individual. | Compatível: R18.10 (prova para Rogério, sem contar como passo). |

## Decisões realmente pendentes

| ID | Pendência | Regra vigente até decidir | Bloqueia |
| --- | --- | --- | --- |
| **B1** | Exceção para ausência automática | Regra conservadora | Nada |
| **B3 — limites** | Raio mínimo/máximo (Fase 4) | Busca real impedida | Etapa 1 |
| Fases 1/2 | Aprovação expressa do escopo, benchmark e perfil (a Spec aprovada já incorpora e revisa o que deles se aplica) | — | Fechamento documental |
| Comerciais | Commodity, cidade/UF e raio do piloto; CSO; valores `M_N`; declarações aprovadas por campanha (K6) | — | Etapa 1 |
| T11 | Retenção/exclusão; base legal e aviso do rastreamento de abertura (K5) | — | Contatos reais |
| Git | Destino da troca da base 0.3.1 | — | Fase 6 |

## Próximo passo

**Fase 4 — Pesquisa técnica.** Stack Cloudflare já definida (ESC D5); o trabalho é comprovar e completar:

1. Auditoria da conta Cloudflare real (T9) × recursos da 0.3.1 (`wrangler.jsonc`: Workers, D1, R2, KV, Queues, Cron) — plano, limites e custo.
2. Autenticação e perfis para time interno pequeno (T10); destino de `.openai/hosting.json` (C5); pipeline de publicação (C14).
3. Provedor de e-mail `eagagro.com`: envio, recebimento, correlação, SPF/DKIM/DMARC, descadastro em um clique, validação de endereço e sinal de abertura (T1, B2, R19.2 item 11, K5).
4. Fontes da lista pelo uso final e geocodificação (T4, T5, T8), incluindo as ferramentas citadas pela skill e a `milho-brasil-prospeccao` (C20, C21); proposta dos limites de raio com justificativa técnica (B3).
5. Comex Stat e fontes internacionais (T6, T7) — podem ficar para depois, pois a Etapa 3 vem após o piloto nacional.
6. Cobertura de skills da stack.

Pela metodologia, a Fase 4 só começa com confirmação de Rogério.

**Limite desta atualização:** documentos de planejamento apenas. A skill `/prospeccao-vendas` foi somente lida, sem alteração. Nenhuma alteração de código, git, publicação, recurso Cloudflare, canal ou envio. Nenhuma aprovação registrada em nome do usuário.
