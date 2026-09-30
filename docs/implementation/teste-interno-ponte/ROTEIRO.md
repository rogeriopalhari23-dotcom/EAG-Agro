# Teste interno da ponte de e-mail — roteiro para execução e retomada

Autorização de Rogério (30/09/2026, mantida com ajustes na mesma data): testes internos exclusivamente para
`rogeriopalhari23@gmail.com` e aliases; cenários com envio em **01/10/2026 a partir das 9h de Cuiabá** (UTC−4); campanhas
comerciais desligadas; fichas da Alemanha intocadas. **Não registrar descadastro de `rogeriopalhari23@gmail.com`.**
Sem credenciais neste documento: IDs em `registros.json`; segredos só no DPAPI da conta de Rogério.

## Estado preparado (30/09)

- Canal `email`: `internal_test` (antes do teste: `planned`). O Compass recusa qualquer destinatário fora de
  `INTERNAL_TEST_RECIPIENTS` (`wrangler.jsonc`).
- Campanha "TESTE INTERNO — ponte de e-mail (não comercial)": ativa. Fichas de teste aprovadas para 01/10 (A, B, C, D, F).
- Casos: A `+ponte-a` (envio e resposta), B `+ponte-b` (queda depois do SMTP), C `+ponte-c` (queda antes do SMTP),
  D `+ponte-link` (descadastro por link, alias exclusivo), F `teste-externo@example.com` (externo, deve ser recusado).
- Prazo: **17h00 de 01/10 (Cuiabá)** — duas travas locais, independentes de sessão do Claude:
  1. `BRIDGE_TEST_DEADLINE=2026-10-01T21:00:00Z` na configuração local da ponte: depois do prazo a ponte nunca pede envio,
     desliga o canal no Compass (rota `/api/bridge/lockdown`, que só desliga) e encerra — a cada início. Comprovado em
     produção em 30/09 (prazo vencido de propósito → canal `planned`; depois restaurado).
  2. Tarefa agendada "EAG Compass - prazo do teste interno" (17h00, roda assim que possível se o computador estiver
     desligado): `bridge\deploy\windows\prazo-teste-interno.ps1` para a ponte, trava o canal, tenta encerrar a campanha e
     descartar as fichas de teste e grava `%LOCALAPPDATA%\eag-mail-bridge\encerramento-teste-interno.txt` com o que ficou
     pendente (se a sessão do Access tiver expirado, a campanha de teste fica ativa, mas o canal desligado: nada sai).

## Comandos (PowerShell, `C:\Users\Roger\eag-compass`)

- Um ciclo: `powershell -NoProfile -ExecutionPolicy Bypass -File bridge\deploy\windows\iniciar-ponte.ps1 -UmCiclo [-Falha after_smtp|before_smtp|imap_down]`
- Sem envio: `... iniciar-ponte.ps1 -TesteInterno claim|seguranca|bloquear`
- Contínuo: `bridge\ponte iniciar|parar|estado|registro`
- Administração (sessão do Access de Rogério): `node bridge/scripts/teste-interno-admin.mjs supressao|estado|reabrir-canal|encerrar`
- Consultas: `npx wrangler d1 execute eag_compass --remote --json --command "..."` (send_outbox, send_log, inbound_messages,
  suppression_entries, tasks, audit_log).

## Cenários

| # | Cenário | Como | Evidência esperada |
| --- | --- | --- | --- |
| 1 | Envio normal (A) | `-UmCiclo` às 9h | 1 e-mail em +ponte-a (De "EAG Agro - Brasil", assinatura com logo, rodapé, List-Unsubscribe); fila `accepted`; cópia em Enviados; ciclo seguinte `interval` |
| 2 | Resposta (A) | responder pelo Gmail ao e-mail de A (texto sem "sair"); `-UmCiclo` | `inbound_messages` `human`/`thread`; passos 2–4 de A `cancelled` `reply_human`; tarefa `reply_followup`; **nenhuma** supressão nova |
| 3a | Resposta "sair" | **pendente**: exige caixa interna dedicada e autorizada (o Gmail principal não pode ser descadastrado; a caixa `rogeriopalhari@eagagro.com` é o próprio remetente e suas mensagens são ignoradas por desenho) | — |
| 3b | Descadastro por link (D) | após o e-mail de D: POST one-click no `List-Unsubscribe` | supressão `opt_out` só de +ponte-link; `supressao` mostra o endereço principal **não** suprimido; passos seguintes de D cancelados |
| 4 | Queda depois do SMTP (B) | `-UmCiclo -Falha after_smtp`, depois `-UmCiclo` | evento `recovered accepted`; fila `accepted`; **um** e-mail em +ponte-b |
| 5 | Queda antes do SMTP (C) | `-UmCiclo -Falha before_smtp`, depois `-UmCiclo`; em seguida `ponte iniciar` | `recovered temporary`; `temp_failed` com nova tentativa em 1 h; depois **um** e-mail em +ponte-c |
| 6–8 | Caixa indisponível, segurança, destinatário externo | executados em 30/09 | ver EVIDENCIAS.md |

Ordem prevista: 1 → 2 → (intervalo) 4 → (intervalo) 5 → (intervalo) 3b → retentativa de C → encerramento. Intervalo do
Compass entre envios: 15–25 min; teto do dia: 5.

Antes e depois de 3b: `node bridge/scripts/teste-interno-admin.mjs supressao` (o principal deve seguir `suppressed:false`;
nenhum alias com o mesmo hash do principal).

## Encerramento

`bridge\ponte parar` → `node bridge/scripts/teste-interno-admin.mjs encerrar` (descarta A–F, encerra a campanha de teste,
canal volta a `planned`) → remover a tarefa do prazo se já concluído → registrar em `EVIDENCIAS.md` → relatório por cenário.
Se algo falhar: não improvisar envio; parar a ponte, registrar e relatar.

## Supressão e retenção (conferência de 30/09)

A Spec aprovada permite ao Administrador "Remover supressão" com motivo e base (matriz de permissões, R9.2), exige critério
de retenção por registro (R21.1) e deixa a política de retenção para T11 (R9.1, R9.1.2), ainda não validada. A
implementação não tem rota de remoção e não preenche `retention_until`: divergência registrada como pendência. Descadastros
reais são preservados; nada foi removido.
