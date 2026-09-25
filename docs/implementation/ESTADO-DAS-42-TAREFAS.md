# Estado das 42 tarefas — 2026-09-24 (reconciliado)

Fonte da verdade da fila: `docs/implementation/sequence.json` (`npm run next`). Evidências: `docs/implementation/EVIDENCIAS.md`.
Branch `v2-revisao-2`, sincronizada com o GitHub; CI (Ubuntu e Windows) verde. `npm run check`: 306 testes + 2 workerd/D1; UI smoke com 13 telas.
Produção: **https://eag-compass-production.rogeriopalhari23.workers.dev** atrás do Access. O domínio `eagcompass.com` **não** está ligado ao Compass: zona `pending` no Cloudflare, DNS ainda na Hostinger (conferido em 2026-09-25). Estado das integrações: `GET /api/integrations` (admin).

Três dimensões, avaliadas separadamente:
- **Implementação** — código e testes automatizados no repositório.
- **Publicação** — no ar em produção (Worker, D1 migrado, configuração).
- **Validação operacional** — comprovada com o serviço real (provedor, caixa, conta), não com fixture.

**Resumo da fila:** 38 `implemented` · 2 `partial` (P1-T12, P2-T15) · 2 `external` (P2-T17, P3-T12). Correções desta reconciliação: P1-T12 voltou a parcial (faltam os quatro perfis e o domínio próprio); P2-T16 passou a implementada (importação e validação em produção feitas).

| Tarefa | Implementação | Publicação | Validação operacional |
| --- | --- | --- | --- |
| P1-T1 Linha de base no git | ok | — | ok |
| P1-T2 Harness e CI | ok | — | ok — CI Ubuntu/Windows verde (runs 36021958011, 36046577955) |
| P1-T3 Conta alinhada | ok | ok — Worker `eag-compass-production`, D1 `eag_compass` | ok |
| P1-T4 Access/JWT e HTTP | ok | ok | ok — login de Rogério pelo Access, `/api/session` responde admin em produção |
| P1-T5 Migração 0003 | ok | ok (0001–0017 no remoto) | ok |
| P1-T6 Scores e gate | ok | ok | testes |
| P1-T7 Catálogo | ok | ok | testes |
| P1-T8 Parâmetros | ok | ok | testes; valores pendentes na Spec continuam ausentes (janela e fuso nacional de envio) |
| P1-T9 Campanhas | ok | ok | testes |
| P1-T10 Supressão e pausas | ok | ok | testes |
| P1-T11 Interface Talhão | ok | ok | UI smoke local |
| **P1-T12 Provisionamento e deploy** | ok | ok — Access, fila, DLQ, cron, segredos de cifra | **parcial**: Access/JWT real e login ok; recuperação por Time Travel disponível (não restaurado); **faltam** os três perfis além do admin (e-mails) e o domínio próprio |
| P2-T1 Esquema do piloto | ok | ok | testes |
| P2-T2 Municípios e distância | ok | ok (5.570 municípios) | testes |
| P2-T3 Casa dos Dados | ok | ok (sem chave) | **não** — falta `CASADOSDADOS_API_KEY` |
| P2-T4 Buscas nacionais | ok | ok | depende de P2-T3 |
| P2-T5 LocationIQ | ok | ok (sem chave) | **não** — falta `LOCATIONIQ_KEY` |
| P2-T6 Empresas e contatos | ok | ok | testes |
| P2-T7 Snov.io | ok | ok (sem chave) | **não** — falta `SNOV_CLIENT_ID/SECRET` |
| P2-T8 Modelos e revisor PV | ok | ok | textos aprovados por Rogério (pv-1.1.0) |
| P2-T9 Fichas | ok | ok | testes |
| P2-T10 Envio SMTP | ok | ok (sem senha da caixa) | **não** — falta `MAILBOX_PASSWORD` e o T1 |
| P2-T11 Respostas IMAP | ok | ok; cron `*/5` roda e registra `auth` (sem senha) | **não** — idem |
| P2-T12 Descadastro | ok | ok | ok — `/u/*` sem login em produção, só descadastro; token inválido recusado |
| P2-T13 Pausas e mudanças | ok | ok | testes |
| P2-T14 Tarefas | ok | ok | testes |
| **P2-T15 OpenClaw** | parcial (importador pronto) | — | **não** — VPS com chave de host alterada; dados não estão na máquina local |
| P2-T16 Sanções | ok | ok — OFAC, CEIS, CNEP importadas em 2026-09-24 | ok — contagens conferidas no D1; triagem controlada (exato → bloqueio, raiz → revisão, nome → revisão, sem relação → nada); reimportar até 2026-10-24 |
| **P2-T17 Canais e T1** | ok (canais, roteiro) | ok — canal `planned`; remetente, endereço físico, base pública e lista interna configurados | **não** — T1 não executado: faltam senha da caixa, Snov e janela/fuso de envio |
| P2-T18 Interface do piloto | ok | ok | UI smoke local |
| P3-T1 a P3-T11 Internacional | ok | ok (código e parâmetros aprovados) | **não** — R2 desabilitado, sem chave Comtrade; lista mensal nunca gerada em produção |
| **P3-T12 Validação internacional** | — (só roteiro) | — | **não** — depende de R2, Comtrade e do T1 |

## Infraestrutura em produção (conferida em 2026-09-24)

- Fila `eag-compass-async` + DLQ `eag-compass-dlq` (5 tentativas, lote 10): mensagem `ping` confirmada uma vez; tipo desconhecido esgotou as tentativas e foi para a DLQ (2 mensagens de verificação ficam lá como registro).
- Cron `*/5 * * * *` (respostas e envio) e `17 2 * * *` (rampa e lista mensal): execução observada às 19:45 UTC com `ok`; nenhum envio (canal `planned`, sem fichas, sem senha).
- Segredos no Worker: só `PII_ENCRYPTION_KEY` e `UNSUB_TOKEN_KEY`.
- Domínio `eagcompass.com`: registrado na Hostinger (2026-09-24), zona criada no Cloudflare (`pending`, plano Free); aguardando a troca dos DNS no hPanel para `joyce.ns.cloudflare.com` e `yoxall.ns.cloudflare.com`.

## Decisões e desvios registrados (para Rogério conferir)

- Numeração real das migrações (0014 esquema internacional, 0015 países, 0016 parâmetros aprovados, 0017 política T11).
- Lista mensal com um objeto por país **e por fonte** no R2 (o plano previa um por país).
- Chave da Comtrade no cabeçalho do gateway; filtros de total pedidos e conferidos linha a linha (hipóteses a confirmar com a chave).
- Campanha internacional só a partir de seleção registrada; aprovação e envio internacionais exigem `international_enabled`.
- Prova social declarada em português não entra nos e-mails em inglês (A-EN1); break sem gênero (A-G1).
- 11 países com mais de um código MDIC somados e Guiné Equatorial em inglês — conferir.
- `system-admin` (usuário de sistema da migração 0002) inativo em produção, mantido como autor dos registros semeados.
