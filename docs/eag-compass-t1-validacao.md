# T1 — Teste interno do canal de e-mail (registro)

Roteiro da P2-T17 (R26.3, R26.6, R17.6). Cada item é executado com Rogério e registrado aqui com data, resultado e evidência (print ou cabeçalho copiado). **Nenhum destinatário externo recebe mensagem antes da seção "Liberação" preenchida e assinada por Rogério.** Resultados de testes automatizados não substituem este registro.

Estado atual: **não iniciado** (2026-09-24).

## Pré-requisitos (provisionamento, P1-T12)

- [ ] Worker publicado com Access validado; `/u/*` com aplicação Bypass Everyone só para esse caminho (`docs/OPERACAO.md`).
- [ ] Fila, DLQ e cron liberados (portão do `validate-deploy`), com autorização registrada.
- [ ] Segredos: `MAILBOX_USER`, `MAILBOX_PASSWORD`, `UNSUB_TOKEN_KEY`, `SNOV_CLIENT_ID/SECRET`, `CASADOSDADOS_API_KEY`, `LOCATIONIQ_KEY`; variáveis `PUBLIC_BASE_URL`, `EAG_POSTAL_ADDRESS`, `SENDER_NAME`, `INTERNAL_TEST_RECIPIENTS` (2–3 endereços de Rogério, inclusive fora do `eagagro.com`).
- [ ] Parâmetros aprovados: `send_timezone:national`, `send_window:national`, `email_validation_max_age_days:email`, setores → CNAE.
- [ ] Política de sanções (T11) e listas importadas das fontes ativas.

## Roteiro

| # | Passo | Resultado esperado | Data | Resultado / evidência |
| --- | --- | --- | --- | --- |
| 1 | Canal `email` → `internal_test` (`POST /api/channels/email/state`) | Estado registrado com autor | | |
| 2 | Campanha de teste + empresa fictícia + contato com e-mail interno; validar e-mail (Snov) | Endereço interno volta `valid`; custo da chamada anotado | | |
| 3 | Gerar ficha, revisar PV (sem violações) e aprovar | Outbox criada nas datas da cadência | | |
| 4 | Deixar o cron enviar o E-mail 1 | Chega na caixa interna; `Message-ID`, `List-Unsubscribe`, `List-Unsubscribe-Post` presentes; SPF e DKIM `pass` em `Authentication-Results` (Gmail); cópia na pasta Enviados da Hostinger | | |
| 5 | Endereço fora da lista interna | Não recebe nada (`channel_internal_test_only`) | | |
| 6 | Responder do endereço interno | Empresa+commodity pausadas; tarefa criada; nenhum e-mail automático de volta | | |
| 7 | Responder "sair" | Supressão por resposta; próximos passos cancelados, sem despedida | | |
| 8 | Clicar o link de descadastro no Gmail (e o botão de um clique) | Página sem login; supressão registrada | | |
| 9 | Enviar para endereço inexistente do domínio de teste | DSN classificado como bounce; supressão; resto cancelado | | |
| 10 | Interromper um envio (derrubar a execução) | Passo `indeterminate`; conferência na pasta Enviados; resolução registrada | | |
| 11 | Amostras R17.6 (`docs/implementation/AMOSTRAS-TEXTOS-PV.md`) revisadas, inclusive A-E3 e A-D14 | Aprovação ou correções registradas | 2026-09-24 | Aprovadas por Rogério (modelos `pv-1.1.0`, com a nova A-G1: break sem gênero); tradução `pv-en-1.0.0` aprovada no mesmo dia |
| 12 | Busca real de 5 km na Casa dos Dados | Filtro de município aplicado; consumo de saldo por consulta anotado; limite de nomes em `municipio[]` confirmado | | |
| 13 | Uma semana na rampa de 5/dia só com endereços internos | Hard bounce, spam e avisos da Hostinger zerados | | |
| 14 | (Internacional, Plano 3 T12 passo 6) Sequência em inglês para contato interno com fuso de outro país | Sai só na janela do fuso do destinatário; texto aprovado lado a lado | | |

## Liberação

Preencher só com os itens 1–13 registrados como OK.

- Autorização por escrito de Rogério ("liberar e-mail"): data, texto e canal em que foi dada.
- Admin grava `POST /api/channels/email/state` com `{"state":"enabled","evidenceRef":"docs/eag-compass-t1-validacao.md#liberacao"}`.
