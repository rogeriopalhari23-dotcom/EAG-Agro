# EAG Compass — Status do Planejamento v2.0

**Expansão:** Nacional + Internacional
**Iniciado:** 2026-09-22
**Atualização:** 2026-09-22 — revisão documental 6 do status (Fase 3, rascunho 2)
**Revisões anteriores:** rev. 4 e rev. 5 arquivadas em `docs/historico/v2.0-planejamento/`.
**Método:** `/planejar`
**Código-base:** 0.3.1. Os 14/14 testes são relato de leitura anterior; nesta fase não houve reexecução de testes nem alteração de código.

## Fases

| Fase | Status | Artefato / observação |
| --- | --- | --- |
| 0. Preflight | Verificado anteriormente | Integrações de produção pendentes (T1–T12). |
| Converge | Leitura anterior; `src/scoring.js` e `migrations/0001_initial.sql` consultados em 2026-09-22 para DS1/DS3 | Divergências de código em C8 e C10. |
| 1. Brainstorm | Escopo rev. 3 entregue; **aprovação expressa não registrada** | `docs/eag-compass-v2-escopo.md` |
| 2A. Benchmark | Rev. 2 entregue; **aprovação expressa não registrada** | `docs/eag-compass-benchmark.md` |
| 2B. Perfil + catálogo | Rev. 3 entregue; **aprovação expressa não registrada** | `docs/eag-compass-perfil.md` |
| T12 | Registro rev. 2; regras especificadas em R17 | `docs/eag-compass-t12-prospeccao-vendas.md` |
| **3. Spec + Constituição v2.0** | **Rascunho 2, com decisões parciais. Não aprovadas integralmente; fase aberta.** | `docs/eag-compass-spec.md`, `docs/eag-compass-constituicao.md` |
| 4. Pesquisa técnica | Pendente | Inclui propor os limites de raio (B3) |
| 5–9 | Pendentes | — |

## Decisões de Rogério em 2026-09-22 (parciais)

| Tema | Decisão | Registro na Spec |
| --- | --- | --- |
| Perfil | Rogério é Administrador | R9.2, AT14 |
| B2 | Aprovada: saída clara em todos os e-mails, processamento do descadastro, mecanismo técnico aplicável ao provedor | R21.7, R21.9, R21.10, AT35 |
| B3 | Aprovada em parte: cidade/UF de referência + raio positivo em km; alterar o raio gera nova versão preservando a anterior. **Limites operacionais: pendentes, a propor na Fase 4 com justificativa técnica, sem copiar Econodata/Google.** | R11.11, R11.12, R11.14, R11.15, AT37, AT38 |
| B1 | **Pendente.** Até exceção aprovada: pausa por resposta da rev. 3 e nenhuma retomada automática | R20.7, R20.8, AT36 |
| DS1 | Pedida proposta com fórmulas e exemplos | Spec §6.1 (proposta, não vigente) |
| DS2 | USD base, BRL para visualização (taxa, fonte e data) | R3.1.4 |
| DS3 | Estados existentes preservados, salvo mudança necessária e justificada | Spec §1.2, R1.3, AT39 |

Esta mensagem **não** aprovou integralmente a Spec e a Constituição nem encerrou a Fase 3.

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

Todas as cópias foram conferidas por hash contra a origem no momento do arquivamento. Os originais v1.3 no Desktop não foram alterados.

Documentos vigentes após esta revisão: Spec rascunho 2 `b9a73b53…d81f5`, Constituição rascunho 2 `cb5a8bea…b492`.

## Números da Spec (rascunho 2)

- 27 requisitos da v1.3 com numeração preservada: 11 mantidos, 16 revisados. Pipeline da empresa mantido (DS3).
- R10–R27 novos (18 grupos). R11.14, R11.15, R20.9, R21.9, R21.10, R1.3.3 e R5.1.3 acrescentados no rascunho 2, sem renumeração.
- AT1–AT39, sequência contínua: AT12 substituído, AT1 e AT14 revisados, AT15–AT39 novos. AT40 em diante reservados para os exemplos DS1, se aprovada.
- Constituição: P1–P10 preservados (3 mantidos, 7 revisados), P11–P18 do produto, P19–P21 da metodologia.
- Verificação mecânica: 261 referências na Spec e 53 na Constituição, todas resolvidas; nenhum ID duplicado.

## Revisão de consistência — final do rascunho 2

| # | Achado | Situação |
| --- | --- | --- |
| C1 | Escopo rev. 3 (§2.11 item 6, §5 T12) diz que a skill não estava disponível; o T12 rev. 2 registra a leitura. | Spec segue o T12. Escopo congelado; defasagem registrada aqui. |
| C2 | O escopo cita soja, café e etanol no Nacional; a Spec aceita qualquer commodity do catálogo. | Compatível (PER §3: demais produtos seguem elegíveis). |
| C3 | Sem limites de raio, R11.14 e R7.1.1 impedem a busca nacional real. | Intencional e conforme B3: os limites vêm da Fase 4, antes da Etapa 1. Testes com dublês não dependem deles. |
| C4 | Perfil de Rogério. | **Resolvido:** Administrador. |
| C5 | P19 (Cloudflare-first) × `.openai/hosting.json` no repositório (T10). | Fase 4. Nenhuma exceção registrada. |
| C6 | Moeda do Nacional. | **Resolvido:** USD base (DS2). |
| C7 | `PROGRESSO.md` e `README.md` citam a base normativa v1.3. | Atualizar só após aprovação da v2.0. |
| C8 | Código 0.3.1: gate/AT12 bloqueiam intermediário; `demands.commodity` aceita só açúcar/café. | Fase 6. Marcado na Spec como "0.3.1 exige alteração". |
| C9 | Cinco decisões preservadas × Spec/Constituição. | Nenhuma contradição (Spec §8). |
| C10 | `src/scoring.js`: (a) mínimo padrão de 500 para açúcar quando não há parâmetro; (b) tabela relativa só para café; (c) Atualidade como entrada independente da evidência. | (a) conflita com R3.3.2 no Nacional; (b) e (c) divergem de R4.3.1 e R5.1.3. Fase 6. Não alterado. |
| C11 | R23.2 (reenvio da mesma busca = uma busca) × R11.12 (alterar raio = nova versão). | Compatíveis: parâmetros idênticos × parâmetros alterados. |
| C12 | R20.6/R20.7/R20.8 × escopo rev. 3 × P12. | Alinhados: regra conservadora vigente; B1 isolada como proposta não vigente. |
| C13 | Pipeline preservado × primeiro contato sem evidência. | Resolvido pela mudança justificada 1 (§1.2) e AT39. |
| C14 | Remoção de `.github/workflows/deploy.yml` no git. | Anterior a esta etapa; ver seção abaixo. |

## Origem da remoção de `.github/workflows/deploy.yml`

- **Não veio desta etapa.** A remoção já aparecia no `git status` do início da sessão. A sessão da Fase 3 alterou apenas arquivos em `docs/`.
- **Origem provável:** a árvore de trabalho foi substituída pelo pacote `eag-compass-mvp-0.3.1-clean.zip` (Downloads, 2026-09-22 13:16). Esse pacote traz apenas `.github/workflows/ci.yml`, sem `deploy.yml`. A pasta `workflows/` foi modificada às 13:18. Na mesma troca saíram `src/index.ts`, `tsconfig.json`, `wrangler.toml` e `migrations/0001_init_schema.sql`, e entraram `src/worker.js`, `wrangler.jsonc` e as novas migrações.
- **O arquivo existe em dois lugares:** no commit `4edff05` (HEAD) e no backup `eag-compass-backup-20260922-124606/.github/workflows/deploy.yml`, modificado às 11:18.
- **Conteúdo removido:** deploy automático na Cloudflare a cada push em `main`, via `wrangler-action`. Ele depende de `npm run build` e `wrangler.toml`, do projeto TypeScript anterior.
- **Não foi revertido.** Restaurar o arquivo quebraria o build, porque a base 0.3.1 não tem mais esse projeto, e publicaria sem T9/T10 comprovados (P14). O pipeline de publicação fica para a Fase 4 (stack/conta) e a Fase 6 (plano).
- Nenhuma mudança anterior foi desfeita. A consolidação da base 0.3.1 no git, com commit ou restauração, é decisão de Rogério.

## Decisões realmente pendentes

| ID | Pendência | Bloqueia |
| --- | --- | --- |
| **B1** | Exceção para ausência automática | Nada; regra conservadora vigente |
| **B3 — limites** | Valores de raio mínimo/máximo, a propor na Fase 4 | Busca nacional real (Etapa 1) |
| **DS1** | Aprovar, ajustar ou recusar a proposta §6.1, com as subquestões DS1-b (exigir `M_N` para qualificar) e DS1-c (`M_N` como escala e mínimo) | Só a qualificação Nacional |
| Aprovação integral | Spec e Constituição v2.0 | Encerramento da Fase 3 |
| Fases 1/2 | Aprovação expressa do escopo, benchmark e perfil | Fechamento documental |
| Comerciais | Commodity, cidade/UF e raio do piloto; identidade de CSO; valores `M_N` e parâmetros pendentes | Etapa 1 / itens específicos |
| T11 | Validação jurídica de retenção e exclusão | Contatos reais |
| Git | Destino da troca da base 0.3.1 (C14) | Fase 6 |

## Próximo passo

1. Rogério revisa o rascunho 2, decide DS1 (e, se quiser, B1) e aprova ou ajusta Spec e Constituição.
2. Com aprovação expressa: marcar a Fase 3 como concluída.
3. Fase 4: stack e conta Cloudflare (T9/T10), autenticação para time interno pequeno, proposta dos limites de raio com justificativa técnica, pipeline de publicação.

**Limite desta atualização:** documentos de planejamento apenas. Nenhuma alteração de código, git, publicação, recurso Cloudflare, canal ou envio. Nenhuma aprovação registrada em nome do usuário.
