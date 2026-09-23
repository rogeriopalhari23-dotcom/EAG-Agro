# EAG Compass — Status do Planejamento v2.0

**Expansão:** Nacional + Internacional
**Iniciado:** 2026-09-22
**Atualização:** 2026-09-22 — revisão documental 13 do status — Fase 3 concluída; **Fase 4 em andamento (partes 1 e 2 entregues)**
**Revisões anteriores:** rev. 4 a 12 arquivadas em `docs/historico/v2.0-planejamento/`.
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
| **4. Pesquisa técnica** | **Em andamento — iniciada em 2026-09-22 com autorização de Rogério.** Partes 1 e 2 entregues. **Aprovadas: G1, G5.** **Limites de raio decididos por Rogério** (5 km e 100–1.500 km em passos de 100; Spec revisão pós-aprovação 1: R11.14, R11.16, R11.17, AT66–AT67). **G2 encerrada** (Compass na conta de Rogério, sem a zona `eagagro.com`). **G3 reaberta** (termos da Hostinger, §12) e **G4 reaberta** (R1 exigia a zona). Pendentes: G3, G4, G6–G11. | `docs/eag-compass-pesquisa-tecnica.md` |
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

Todas as cópias foram conferidas por hash contra a origem no momento do arquivamento. Os originais v1.3 no Desktop não foram alterados.

**Documentos aprovados (vigentes):** Spec v2.0 `77cb42594bee8a2267d488c00d67a1d9f689a584c0ea126e32cc1e66fe0f1edf`; Constituição v2.0 `a4b80ae84140cfcf56125b1488e2ab9d7702ae4fdaab4248eb5514553cf48a11`; T12 rev. 4 `0101217dcb8be8776c7c751c16800c606f869c5e2658e4734535df7afee7200b`. O conteúdo aprovado é o do rascunho 5; mudaram só as linhas de controle e a ativação de R17.8 (hash de referência `33bd093f…9dd8`, conferido no fechamento).

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
