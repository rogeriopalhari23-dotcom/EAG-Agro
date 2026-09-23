# EAG Compass — Status do Planejamento v2.0

**Expansão:** Nacional + Internacional
**Iniciado:** 2026-09-22
**Atualização:** 2026-09-22 — revisão documental 9 do status (Fase 3, rascunho 5: K1–K6 decididos)
**Revisões anteriores:** rev. 4 a 8 arquivadas em `docs/historico/v2.0-planejamento/`.
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
| **T12** | **Rev. 4: skill atual (`33bd093f…9dd8`) lida; PV1–PV12 e R28 especificados; K1–K6 decididos.** Implementação e amostras pendentes. | `docs/eag-compass-t12-prospeccao-vendas.md` |
| **3. Spec + Constituição v2.0** | **Rascunho 5. Sem conflito aberto com a skill. Aguardando aprovação integral de Rogério para fechar.** | `docs/eag-compass-spec.md`, `docs/eag-compass-constituicao.md` |
| 4. Pesquisa técnica | Pendente | Inclui limites de raio (B3), provedor de e-mail com validação e sinal de abertura (T1, K5) |
| 5–9 | Pendentes | — |

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

Estas mensagens **não** aprovaram integralmente a Spec e a Constituição nem encerraram a Fase 3. A decisão de K3 revisa a decisão 3 anterior ("traders elegíveis"); a de K4 revisa o piloto "somente por e-mail" do escopo rev. 3 (o envio automático continua só por e-mail; ligações e LinkedIn são tarefas manuais).

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

Todas as cópias foram conferidas por hash contra a origem no momento do arquivamento. Os originais v1.3 no Desktop não foram alterados.

Documentos vigentes após esta revisão: Spec rascunho 5 `52810ed4122be66220b15a28874f89aa94ff6319f46d33130b0a763acab81dc9`; Constituição rascunho 5 `14676d79544f4114b6c9af3b8fc68f47bd9a095d2e030f0dc0fde82d7d7498d1`; T12 rev. 4 `d1d18474455fab7fb58845a0b9be4e72e8805e948236985cbb5b744f4954a7e9`. Skill conferida no fim: `SKILL.md` ainda `33bd093f…9dd8`.

## Números (rascunho 5)

- 27 requisitos da v1.3 com numeração preservada (11 mantidos, 16 revisados); pipeline mantido (DS3).
- R10–R28 novos. Rascunho 4 acrescenta R28 (16 critérios), R3.1.5, R15.6, R18.10, R19.2 itens 11–12, e reescreve R3.4.2, R11.9, R14.3, R15.1, R17.1, R17.3, R17.4, R17.6 e R17.8. Nada renumerado.
- Rascunho 5 acrescenta R14.6–R14.8, R16.7–R16.8, R28.17–R28.19 e reescreve R2.4.2, R14.3, R28.5–R28.7. Nada renumerado.
- AT1–AT65 contínuos (AT51–AT60 no rascunho 4; AT61–AT65 no rascunho 5; AT59 reescrito).
- PV1–PV12 idênticos em identificador na Spec e no T12; texto canônico na Spec R17.3.
- Constituição: P1–P10 preservados, P11–P18 do produto (P16 e P17 revisados no rascunho 4), P19–P21 da metodologia.
- Verificação mecânica: 318 referências na Spec, 77 na Constituição e 28 no T12, todas resolvidas; nenhum ID duplicado; nenhum marcador de K pendente na Spec.

## Revisão de consistência — rascunho 5

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
| Aprovação integral | Spec e Constituição v2.0 | — | Encerramento da Fase 3 |
| Fases 1/2 | Aprovação expressa | — | Fechamento documental |
| Comerciais | Commodity, cidade/UF e raio do piloto; CSO; valores `M_N`; declarações aprovadas por campanha (K6) | — | Etapa 1 |
| T11 | Retenção/exclusão; base legal e aviso do rastreamento de abertura (K5) | — | Contatos reais |
| Git | Destino da troca da base 0.3.1 | — | Fase 6 |

## Próximo passo

1. Rogério aprova ou ajusta o rascunho 5 (B1 e os limites de raio podem seguir pendentes, com a regra vigente especificada).
2. Com aprovação expressa: marcar a Fase 3 como concluída.
3. Fase 4: stack e conta Cloudflare (T9/T10), provedor de e-mail com validação de endereço e sinal de abertura (T1, K5), fontes da lista pelo uso final (T4/T8), limites de raio (B3), pipeline de publicação.

**Limite desta atualização:** documentos de planejamento apenas. A skill `/prospeccao-vendas` foi somente lida, sem alteração. Nenhuma alteração de código, git, publicação, recurso Cloudflare, canal ou envio. Nenhuma aprovação registrada em nome do usuário.
