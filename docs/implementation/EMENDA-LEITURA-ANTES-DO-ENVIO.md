# Emenda pendente: leitura das respostas antes do envio (2026-10-01)

Situação: **comportamento implementado e publicado; texto documental ainda não aprovado.** Este documento só descreve o que
existe e propõe a redação que falta. Nenhuma decisão aprovada foi alterada; a Constituição e a Spec continuam como estão
até a sua aprovação.

## 1. O que está implementado (código atual; publicado, versão em produção 9054e359)

| Ponto | Comportamento | Onde |
| --- | --- | --- |
| Portão no Compass | Antes de escolher qualquer passo de e-mail, o Compass exige uma leitura bem-sucedida da caixa nos últimos **10 minutos** (relógio do Worker). Sem ela, recusa com `reply_reader_unavailable`. Vale para qualquer transporte (ponte ou direto), depois do teto do dia e do intervalo e antes da escolha do destinatário. | `src/sending.js` (`READER_MAX_AGE_MS = 10 * 60000`, `readerHealthy`, `prepareNext`) |
| O que conta como leitura boa | A ponte informa o fim de um ciclo de leitura; só vale se o cursor do Compass já chegou ao maior UID lido (as respostas daquele ciclo já foram processadas). | `src/bridge.js` (rota `read-status`), `src/inbound.js` |
| Erro de leitura | Um erro informado pela ponte apaga a última leitura boa **na hora**: o envio para no mesmo instante, sem esperar os 10 minutos. | `src/inbound.js` (`last_read_ok_at = NULL`) |
| Ponte | Cada ciclo lê a caixa antes de pedir mensagem; ao iniciar ou voltar da suspensão, lê primeiro. A primeira leitura só marca a posição (o histórico da caixa não entra). | `bridge/src` |
| Registro | `bridge.reader_ok` (quando volta a ficar saudável) e `bridge.reader_error`, sem conteúdo de mensagem. | trilha de auditoria |
| Testes | "sem leitura de respostas bem-sucedida, nada sai", "erro de leitura depois de uma leitura boa suspende o envio na hora", primeira leitura sem histórico. Em produção, cenário 6 (caixa indisponível simulada) em 30/09: ciclo sem pedido de envio, pedido direto recusado com `reply_reader_unavailable`, leitura seguinte restabeleceu (EVIDENCIAS.md). | `bridge/test/ponte.test.mjs` |

## 2. O que os documentos dizem hoje

- **Constituição, exceção P19 (2026-09-22):** descreve o transporte como "SMTP pela caixa do remetente na Hostinger (porta 465,
  via `connect()` do Worker)". Isso deixou de ser verdade: o Worker não alcança SMTP/IMAP da Hostinger (endereços resolvem para
  a rede da Cloudflare) e, por decisão sua de 30/09 (opção B), o transporte passou a ser a **ponte no seu computador**. A
  justificativa, o risco do §12 da Hostinger assumido por você, o volume baixo e o "Worker continua dono de fila, verificação
  pré-envio, idempotência, supressão e registro" **continuam iguais**.
- **Spec:** não há requisito nem teste de aceitação para "sem leitura recente das respostas, nenhum envio". A regra existe só no
  código e na proposta da ponte (`PONTE-EMAIL-PROPOSTA.md`, seção 6).

## 3. Texto proposto (para sua aprovação; não aplicado)

**Constituição — substituir, na linha da exceção P19, só a frase do transporte:**

> transporte SMTP pela caixa do remetente na Hostinger (`rogeriopalhari@eagagro.com`), executado por uma **ponte local no
> computador de Rogério** (SMTP 465 e IMAP 993), porque Workers não alcançam os servidores da Hostinger (decisão de 2026-09-30,
> opção B). A ponte recebe do Worker apenas mensagens congeladas e aprovadas, autenticada por token de serviço do Access e
> assinatura HMAC; o Worker continua dono de fila, verificação pré-envio, idempotência, supressão e registro.

O restante da linha (justificativa, risco do §12, gatilho de reabertura, data) permanece igual, com a data da emenda acrescentada.

**Spec — novo requisito em R19 (depois de R19.13):**

> **R19.14:** SE a última leitura bem-sucedida da caixa de respostas tiver mais de 10 minutos, ou se a última leitura tiver
> falhado, ENTÃO nenhum e-mail DEVE ser enviado; o envio só volta depois de uma leitura bem-sucedida em que as respostas lidas
> já tenham sido processadas (R20).

**Spec — novo teste de aceitação:**

> | AT76 | R19.14 | DADO a última leitura boa há mais de 10 minutos, ou um erro de leitura informado depois dela, QUANDO há passo aprovado na janela, ENTÃO nada é enviado e o motivo registrado é "leitura de respostas indisponível"; após uma leitura boa, o envio volta respeitando intervalo e teto. |

**Spec — R26.3 (T1):** acrescentar ao fim "…e mecanismo de descadastro de R21.10, **pela ponte de e-mail**".

## 4. O que não muda

Aprovação individual por destinatário e canal; textos congelados (nada é gerado no envio); janela, rampa, teto e intervalo;
supressão e descadastros reais; canal de e-mail em `planned`/`internal_test` até a habilitação; teste interno de 01/10 e suas
travas.
