# Estado das 42 tarefas — 2026-09-24

Fonte da verdade: `docs/implementation/sequence.json` (`npm run next`). Evidência de cada item: `docs/implementation/EVIDENCIAS.md`.
Branch `v2-revisao-2`, publicada no GitHub em 2026-09-24. `npm run check` no Windows: 294 testes + 2 workerd/D1 passando; UI smoke (Playwright + Chrome) com 13 telas.

**Resumo:** 36 implementadas · 2 parciais · 4 externas (portões humanos). Nenhuma mensagem externa foi enviada, nenhum deploy, nenhuma conta criada, nenhum recurso Cloudflare criado ou apagado.

## Implementadas (36)

Fundação: P1-T1, P1-T2 (CI Ubuntu e Windows verde, run 36021958011), P1-T4 a P1-T11. Piloto nacional: P2-T1 a P2-T14, P2-T18. Internacional: P3-T1 a P3-T11 (D1/D2, rotina e tradução aprovados por Rogério em 2026-09-24).

Implementadas, mas **só com fixtures** (a validação real do provedor é externa e não foi feita):
- P2-T3 Casa dos Dados, P2-T5 LocationIQ, P2-T7 Snov.io, P2-T10 SMTP e P2-T11 IMAP da Hostinger — dependem das credenciais e do teste T1.
- P3-T3 MDIC — leitura real por Range conferida da rede doméstica; pelo Worker não (certificado incompleto do servidor, ver EVIDENCIAS P3-T2).
- P3-T4 Comtrade — `getDA` e `HS.json` conferidos sem chave; a chamada de dados precisa da chave de Rogério.
- P3-T5 rotina mensal — precisa do bucket R2 (`FILES`), da fila e do cron liberados.

## Parciais (2) — o que falta

| Tarefa | Falta | Quem |
| --- | --- | --- |
| P2-T15 Migração do OpenClaw | Exportação real do OpenClaw e inventário do executor antigo para o corte | Rogério |
| P2-T16 Triagem de sanções | Política de compliance T11 (fontes exigidas, validade, pessoas físicas, raiz de CNPJ) e rodar `scripts/import-sanctions.mjs` em produção — os leitores de OFAC, CEIS e CNEP já estão prontos e conferidos nos arquivos reais | Rogério |

## Externas (4) — portões humanos

| Tarefa | Portão | Roteiro |
| --- | --- | --- |
| P1-T3 | `wrangler.jsonc` conferido na conta real | `docs/OPERACAO.md` |
| P1-T12 | Provisionamento, Access, fila, cron, R2 e deploy com autorização | `docs/OPERACAO.md` |
| P2-T17 | Teste interno de T1 com a caixa real e liberação por escrito do e-mail | `docs/eag-compass-t1-validacao.md` |
| P3-T12 | Conta e chave da Comtrade, termos, chamada real, teste pelo Worker, rotina medida, amostra em inglês, liberação | `docs/eag-compass-t6-comexstat.md` seção 9 |

## Decisões e desvios registrados nesta rodada (para Rogério conferir)

- Numeração real das migrações (0014 esquema internacional, 0015 países), aplicadas no D1 local após cópia de segurança.
- Lista mensal com um objeto por país **e por fonte** no R2 (o plano previa um por país): cada fonte tem seu próprio ponteiro e sua própria falha.
- Chave da Comtrade no cabeçalho do gateway, não na URL; filtros de total pedidos e conferidos linha a linha (hipóteses a confirmar com a chave).
- Cron: nenhum novo; o diário existente começa a versão do mês no dia configurado e retoma o pendente.
- Campanha internacional só ativa, gera ficha e aprova a partir de seleção registrada na lista do país; aprovação e envio internacionais exigem `international_enabled`.
- Prova social declarada em português não entra nos e-mails em inglês (A-EN1).
- 11 países com mais de um código MDIC somados (ex.: Madeira em Portugal, Canárias em Espanha, Dubai nos Emirados) e Guiné Equatorial em inglês — conferir.
