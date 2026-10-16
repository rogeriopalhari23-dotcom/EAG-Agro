# Rodada 1: rastreabilidade dos 10 cadastros

Rodada `dee25927-b941-48aa-a74f-7bc78a278fea`, "Rodada 1 — milho GMO, Indiara/GO, 100 km (16/10/2026)". Conferido em 16/10/2026 só por leitura do banco de produção; nenhum dado foi alterado.

## Cadeia de cada cadastro

| Empresa cadastrada | Estabelecimento (rodada) | Candidatas (importação, 16/10, UTC) | Cadastro (round_registrations) | Decisão |
|---|---|---|---|---|
| Coop. Mista dos Prod. Rurais de Pontalina `f46c0e88` | BR:17802890000239 | arquivo 00:37:09 (CNPJ) + SIPEAGRO 00:37:10 (GO0008702) | 00:52:17, descoberta | nenhuma (modo descoberta) |
| P&S Produtos Agropecuários `34f3f6eb` | BR:09276439000205 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0010286) | 00:52:19, descoberta | nenhuma |
| Yabagata Nutrição Animal `697a7287` | BR:21196572000168 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0012351) | 00:52:21, descoberta | nenhuma |
| Rural Cria `fd3bb583` | BR:54478827000134 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0022799) | 00:52:22, descoberta | nenhuma |
| VF Rações `b3fb678b` | BR:11595239000178 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0014010) | 00:52:24, descoberta | nenhuma |
| Coop. Agropecuária de Aurilândia `0c80efda` | BR:01225945000174 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0014729) | 00:52:25, descoberta | nenhuma |
| Campo Rações `bc68d221` | BR:05621758000160 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0010090) | 00:52:27, descoberta | nenhuma |
| SIAP Rações `e41f2793` | BR:43177285000143 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0017779) | 00:52:28, descoberta | nenhuma |
| Rações Herlan `9bb408cd` | BR:50478250000100 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0022594) | 00:52:30, descoberta | nenhuma |
| Rações Pérola `6c404026` | BR:41809266000167 | arquivo 00:37:09 + SIPEAGRO 00:37:10 (GO0013994) | 00:52:31, descoberta | nenhuma |

- **Candidatas:**
  - a do arquivo traz o CNPJ, da lista oficial do MAPA de 21/07/2026;
  - a do SIPEAGRO traz o registro e a máscara do CNPJ, e foi conciliada no mesmo estabelecimento;
  - as pesquisas assistidas de 01:18–01:19 são posteriores ao cadastro: qualificação, não cadastro.
- **Vínculos no banco:**
  - `round_registrations` liga rodada, estabelecimento e empresa (`company_id`), com modo `discovery`, `outcome` `created` e `decision_id` vazio;
  - o `detail_json.trace` repete rodada, estabelecimento e modo.
- **Operação que cadastrou:** uma única chamada à rota da rodada `POST /api/rounds/dee25927…/register`, modo descoberta, produto `product-03`, com triagem. A requisição **`a77a0236-8994-4cbb-b2e4-369d30931dae`** aparece em:
  - `round.registered` (00:52:31.717);
  - 10 `company.created`, 10 `evidence.created`, 10 `profile.saved` e 10 `sanctions.screened` (00:52:16–00:52:31).

  O mesmo identificador de requisição liga a operação de lote a cada registro criado.
- **Antes do cadastro, na auditoria:**
  - ciência das limitações às 00:36:50;
  - 2 importações (00:37:09 e 00:37:11);
  - 5 execuções (00:37 a 00:49);
  - nenhuma decisão (`round_decisions` = 0).

## Por que a rodada mostra "nenhuma decisão"

- **O cadastro foi feito no modo "descoberta".** Por regra do fluxo, esse modo cadastra, sem decisão individual, as unidades que não são exceção, fora do raio, separadas ou provisórias. As decisões em lote (aceitar, incluir, adiar, recusar) só existem quando alguém as registra no painel, e nenhuma foi registrada nesta rodada.
- **Os campos `decision: "discovery"`, `decidedBy` e `decidedAt` do `trace` não são uma decisão.** São o ator e o instante da montagem do lote (00:52:16.255). Os nomes são enganosos; correção proposta abaixo.

## Decisão pelo painel × cadastro por script ou importação autorizada

- **Decisão pelo painel:** a pessoa seleciona estabelecimentos e clica "Registrar decisão em lote". Isso cria linhas em `round_decisions` com responsável, data, observação e foto do resultado, e o cadastro em modo "aceitas" fica ligado a essa decisão (`decision_id`). **Não aconteceu nesta rodada.**
- **O que aconteceu:**
  - criação da rodada, importações, execuções, cadastro e qualificação foram feitos **por Claude, com o script `r1.mjs`** (`.claude/jobs/…/tmp/rodada1/r1.mjs`). O script chama as mesmas rotas do painel, com a sessão do Access de Rogério renovada por `cloudflared access login`;
  - só a **ciência das limitações** (00:36:50) foi registrada pelo botão da tela, também por automação do navegador conduzida por Claude, não por clique de Rogério;
  - por isso o banco registra o ator `user-rogerio-palhari` em tudo, sem distinguir clique de script.
- **Autorização que fundamentou a operação:** instrução de Rogério nesta conversa, em 16/10/2026: "Autorizo concluir a conferência da tela e executar a primeira rodada real conforme o plano …", e depois "Cadastre em descoberta somente as candidatas aptas, sem duplicidade, e faça a triagem de sanções". Está registrada em `EVIDENCIAS.md` (seções da primeira rodada real), **não no banco**.

## Lacunas e correção proposta (não aplicada)

1. **Autorização fora do banco.** Proposta, regra geral:
   - a rota de cadastro da rodada passa a aceitar e gravar `authorization` (`{ reference, grantedBy, grantedAt, channel }`) em `round_registrations.detail_json` e na auditoria;
   - o modo "aceitas" continua exigindo a decisão em lote.
2. **Clique × script indistinguíveis.** Proposta:
   - gravar a origem da operação (`via: "panel" | "script"`), informada pelo painel ou pelo script, no `trace` e na auditoria;
   - o painel exibe "Cadastro em descoberta (sem decisão individual), operação de <data> por <ator>, via <origem>, autorização <referência>".
3. **Nomes enganosos no `trace`.** Proposta: `decision: null`, `basis: "discovery_mode"`, `operatedBy` e `operatedAt` no lugar de `decidedBy` e `decidedAt`. Os registros antigos são lidos com os dois nomes.
4. **Histórico real da Rodada 1:**
   - não reescrever as 10 linhas nem criar decisões ou cliques retroativos;
   - depois de aprovadas as mudanças acima, acrescentar **uma** anotação de auditoria nova (`round.registration_annotated`), com a data em que for gravada. Ela referencia a requisição `a77a0236`, a autorização de 16/10/2026, a execução por Claude via script e esta conferência.
   - Isso exige rota nova e publicação: não foi feito.

## Versão publicada e testes

- **Worker em produção:** `aefbf8b7-5c99-439c-8da2-356cf258b79f` (16/10/2026, 16:33 UTC; commit `896ef25`).
  - A rodada foi executada e cadastrada antes, no Worker `4d7cfa4c-5511-4b3c-82e0-2e2cf5dec7d0`.
  - Reversão: `wrangler rollback 4d7cfa4c-5511-4b3c-82e0-2e2cf5dec7d0`.
- **Testes da publicação:** predeploy completo com 501 + 2 + 37 testes, 0 falhas, e `validate-deploy` ok.
  - `rodada-fechamento`: 6 testes;
  - tela de Rodadas conferida no Chrome sem interface (`ui-rodadas`).
- Esta conferência é só documental: a suíte não foi rodada de novo, nenhuma pesquisa foi repetida e nada foi publicado.

## Encerramento da etapa

- Esta etapa da Rodada 1 está encerrada.
- As 10 empresas seguem em "Descoberta", sem promoção.
- As pendências de contato futuro aguardam a liberação aplicável (T11 pendente, canais `planned`, campanhas inativas, cópia desligada).
