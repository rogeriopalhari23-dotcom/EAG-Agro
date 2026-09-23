# EAG Compass — Status do Planejamento v2.0

**Expansão:** Nacional + Internacional
**Iniciado:** 2026-09-22
**Atualização:** 2026-09-22 — revisão documental 5 do status (Fase 3 redigida)
**Revisão anterior:** revisão 4, arquivada em `docs/historico/v2.0-planejamento/eag-compass-planejamento-status-rev4.md` (SHA-256 `688ffd85…d4a1d4`).
**Método:** `/planejar`
**Código-base:** 0.3.1. Os 14/14 testes são relato de leitura anterior; esta fase não reexecutou testes nem alterou código.

## Fases

| Fase | Status | Artefato / observação |
| --- | --- | --- |
| 0. Preflight | Verificado anteriormente | Integrações de produção pendentes (T1–T12). |
| Converge | Leitura anterior (2026-09-22) | Divergências v1.3 × v2.0 abaixo; código não reinspecionado. |
| 1. Brainstorm | Escopo revisão 3 entregue; **aprovação expressa não registrada** | `docs/eag-compass-v2-escopo.md` |
| 2A. Benchmark | Revisão 2 entregue; **aprovação expressa não registrada** | `docs/eag-compass-benchmark.md` |
| 2B. Perfil + catálogo | Revisão 3 entregue; **aprovação expressa não registrada** | `docs/eag-compass-perfil.md` |
| T12 | Registro revisão 2; regras especificadas na Spec (R17) | `docs/eag-compass-t12-prospeccao-vendas.md` |
| **3. Spec v2.0 + Constituição v2.0** | **Redigidas (rascunho 1); aguardando aprovação** | `docs/eag-compass-spec.md`, `docs/eag-compass-constituicao.md` |
| 4. Pesquisa técnica | Pendente | T1–T12, conta Cloudflare, auth por modelo de uso |
| 5. Design | Pendente | Dois dashboards, ficha, linha do tempo, mapa |
| 6. Plano | Pendente | `docs/superpowers/plans/` |
| 7–9. Auditoria, correção, montagem | Pendente | — |

Em 2026-09-22 Rogério informou que os quatro documentos revisados foram substituídos em `docs/` e conferidos por SHA-256, e pediu o avanço para a Fase 3. Isso foi registrado como **autorização para redigir a Fase 3**, não como aprovação formal das Fases 1 e 2.

## Arquivo histórico

| Arquivo | Origem | SHA-256 (conferido na cópia) |
| --- | --- | --- |
| `docs/historico/v1.3/eag-compass-spec-v1.3.md` | `Desktop/eag-compass-spec-v1.3.md` | `01022bc95f78193b44fd940e87d678a9521e6f81024f268f5906d73c5d7890e1` |
| `docs/historico/v1.3/eag-compass-constituicao-v1.3.md` | `Desktop/eag-compass-constituicao-v1.3.md` | `f6cc9a213af81d28bed9d301fd4168e31b6e2c50d070f0c8cadf0f50e691c588` |
| `docs/historico/v1.3/eag-compass-status-planejamento-v1.3.md` | `Desktop/eag-compass-status-planejamento-v1.3.md` | `b85c351f6b374cd67e4343f3297a201405ede37967d984d50fddc92f5b2a77d1` |
| `docs/historico/v2.0-planejamento/eag-compass-planejamento-status-rev4.md` | `docs/eag-compass-planejamento-status.md` rev. 4 | `688ffd85029ef0ff0ea76fca31093bd9fda98bb390ab4cd7c90eeeb08cd4a1d4` |

Originais no Desktop não foram alterados nem removidos. Cópias mais antigas (Spec v1.2 e Constituição v1.1 em `Desktop/imersão claude/docs/`) não foram arquivadas: estão superadas pela v1.3.

## Decisões preservadas na Fase 3

| Decisão | Onde está na Spec |
| --- | --- |
| Nacional: commodity + cidade/UF do fornecedor + raio ajustável → compradores | R11, AT15–AT19 |
| Internacional: país → histórico agrícola Brasil → commodities → empresas | R12, R1.4, AT20–AT23 |
| Consumidores finais prioritários; traders elegíveis | R2.4, R14, AT12 (substituído), AT19 |
| Prospecção por commodity, sem lote, preço ou oferta | R16, R11.1, R12.1, R7.2.2, AT15 |
| Textos finais aprovados por empresa; execução e interrupções | R17–R22, AT24–AT33 |

Demais decisões da revisão 4 (usuários, e-mail, WhatsApp, LinkedIn, OpenClaw, supressão, uma sequência por destinatário, compliance) estão em R9.2, R15, R19, R21, R23, R25, R26 e na Constituição P11–P14.

## Números da Spec v2.0

- R1.1–R9.2 e AT1–AT14 da v1.3 mantidos na numeração: 27 requisitos — 11 mantidos, 16 revisados; estado `Prospectado` substituído; AT12 substituído, AT1/AT14 revisados.
- R10–R27: 18 novos grupos de requisitos.
- AT15–AT34: 20 novos cenários.
- Constituição: P1–P10 preservados (3 mantidos, 7 revisados); P11–P18 novos do produto; P19–P21 defaults da metodologia.
- Verificação mecânica: toda referência R/AT citada na Constituição existe na Spec.

## Revisão de consistência (Spec × Constituição × Status × insumos)

| # | Achado | Situação |
| --- | --- | --- |
| C1 | Escopo rev. 3 §2.11 item 6 e §5 T12 dizem que a skill não estava disponível; o T12 rev. 2 registra leitura posterior. | A Spec segue o T12. O escopo fica como está (revisão congelada); esta linha registra a defasagem. |
| C2 | Escopo lista soja, café e etanol no Nacional; a Spec permite qualquer commodity do catálogo no Nacional. | Compatível: o escopo diz que os demais produtos seguem elegíveis (PER §3). |
| C3 | B3 sem valores → R7.1.1 bloqueia busca nacional real. | Intencional: não há raio implícito. B3 precisa ser decidido antes da Etapa 1. |
| C4 | R9.2 exige Gestor ou Administrador para aprovar ficha; o escopo não diz qual perfil Rogério usa. | Derivação a confirmar: Rogério como Administrador. |
| C5 | Constituição P19 (Cloudflare-first) × `.openai/hosting.json` no repositório (T10 manda reavaliar). | Fica para a Fase 4; nenhuma exceção registrada. |
| C6 | Spec v1.3 usava USD como base única; R3.1.4 propõe BRL no Nacional. | Decisão pendente DS2. |
| C7 | `PROGRESSO.md` e `README.md` citam a "base normativa v1.3". | Atualizar só depois da aprovação da v2.0; não alterado nesta fase. |
| C8 | Código 0.3.1: AT12 e o gate atual bloqueiam intermediários; `demands.commodity` só aceita açúcar/café. | Esperado: divergências de código tratadas no plano (Fase 6). Marcadas na Spec como "0.3.1 exige alteração". |
| C9 | Nenhuma contradição encontrada entre as cinco decisões preservadas e a Spec/Constituição. | — |

## Decisões realmente pendentes

| ID | Decisão | Bloqueia |
| --- | --- | --- |
| **B1** | Ausência automática e resposta incerta (R20.7) | Só R20.7; R20.6 já trata a dúvida como resposta |
| **B2** | Saída clara e descadastro técnico (R21.7) | Habilitação do e-mail |
| **B3** | Limites de raio, nova busca ao alterar raio (R11.11–R11.12) | Busca nacional real |
| **DS1** | Confidence/Potential no Nacional | Qualificação Nacional (não bloqueia busca, ficha nem envio) |
| **DS2** | Moeda-base BRL no Nacional | Formulário de demanda Nacional |
| **DS3** | Nomes dos estados da prospecção; aposentadoria de `Prospectado` | Design (Fase 5) |
| C4 | Perfil de Rogério (Administrador) | AT14 |

Fora da Spec, pendências comerciais: commodity, cidade/UF e raio do piloto; identidade de CSO; valores dos parâmetros pendentes; validação jurídica de retenção (T11).

## Dependências e marcos

T1–T12 sem alteração em relação à revisão 4, exceto T12: regras especificadas em R17 (PV1–PV8). Estado comprovado de cada uma está na Spec §0.2. **Nenhuma integração foi testada.**

## Próximo passo

1. Rogério revisa Spec e Constituição e decide B1–B3, DS1–DS3 e C4 (ou as adia registrando o bloqueio).
2. Com aprovação expressa: marcar Fase 3 concluída, e registrar também o fechamento das Fases 1/2 se aprovado.
3. Fase 4: stack e comprovação de T9/T10, auth pelo modelo de uso (time interno pequeno), cobertura de skills.

**Limite desta atualização:** só documentos de planejamento. Nenhuma alteração de código, publicação, recurso Cloudflare, conexão de canal, teste de ferramenta ou envio de mensagem. Nenhuma aprovação registrada em nome do usuário.
