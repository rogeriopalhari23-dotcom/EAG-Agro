# Plano proposto: consultas públicas da prospecção fora da Cloudflare (2026-10-20)

**Estado:** proposta para decisão de Rogério Palhari. **Nada foi implementado na ponte, e a ponte não foi atualizada.**
A ponte em uso (`bridge/`, versão atual) continua como está.

## Problema

Algumas fontes públicas recusam ou limitam pedidos que saem da rede da Cloudflare:
- o servidor público do mapa colaborativo (Overpass) respondeu 521/522 ao Worker em 27/09;
- o portal SIPEAGRO respondeu 403 a acesso automatizado (20/10, deste computador; não é exclusivo da Cloudflare);
- a ABIC e a Receita (publica.cnpj.ws) ainda não foram testadas a partir do Worker publicado.

Hoje a etapa recusada fica como "depende do navegador": a consulta só roda com o painel aberto, ou a pessoa segue sem ela. O relatório informa a etapa e a fonte indisponíveis; a pesquisa não é apresentada como completa.

## Proposta: fila de consultas própria, executada pela ponte, separada do e-mail

A ponte já roda no computador de Rogério, com token de serviço do Access e HMAC. A proposta acrescenta **um ciclo independente** que busca pedidos de consulta pública e devolve a resposta bruta. O Worker continua decidindo tudo (o que consultar, como interpretar, o que cadastrar).

```
 Compass (Worker)                                   Ponte (mesmo processo, ciclo novo e separado)
 motor da prospecção grava pedido  ──► fila D1      1. query-claim → UM pedido (host, caminho, corpo)
 (host da lista permitida, motivo,     prospect_    2. confere host na lista local e robots.txt
  job, limite de tamanho)              queries      3. GET/POST público, sem cookie nem credencial
                                    ◄──────────────  4. query-result → status, tipo, corpo (limitado)
 o motor retoma a etapa com a resposta, como se tivesse consultado direto
```

### Regras

| Item | Regra |
| --- | --- |
| Separação | Rotas novas `/api/bridge/query-claim` e `/api/bridge/query-result`. Tabela nova `prospect_queries`. Diário local separado (`queries.sqlite`). Nada do ciclo de e-mail é chamado, alterado ou reaproveitado além da autenticação. |
| Leitura de e-mails, diários e proteção contra duplicidade | **Preservados integralmente.** O ciclo de e-mail (`cycle.js`: cursor → inbound → read-status → claim → SMTP → Sent → result), o diário `claimed → smtp_started → smtp_done → reported`, o lease, o `Message-ID` fixo e o portão de leitura ficam sem mudança. Uma falha no ciclo de consultas não bloqueia nem atrasa o ciclo de e-mail (processos e temporizadores separados; exceção isolada). |
| Autenticação | A mesma da ponte: token de serviço do Access só para `/api/bridge/*` + HMAC-SHA256 do corpo, carimbo de tempo (±5 min) e nonce de uso único (tabela com índice, migração 0040). Chave HMAC própria para consultas (`BRIDGE_QUERY_HMAC_KEY`), para revogar uma sem afetar a outra. |
| Lista de hosts permitidos | Fixa no código das duas pontas: `overpass-api.de`, `www.abic.com.br`, `publica.cnpj.ws`. Host novo exige versão nova revisada. Sem redirecionamento para outro host. |
| Volume | 1 consulta por vez; mínimo de 10 s entre consultas ao mesmo host; Overpass com o limite de tempo da própria consulta (≤ 90 s) e nenhuma repetição automática depois de tempo esgotado; no máximo 200 consultas por dia. |
| Conteúdo | Só GET/POST públicos, sem cookie, sem credencial e sem dado pessoal no pedido. Resposta limitada a 2 MB, guardada só até o motor processar (apagada em 7 dias). |
| robots.txt | Conferido pela ponte antes de cada host (cache de 24 h); recusa vira "fonte indisponível" no relatório. |
| Rastreio | Worker: `bridge.query_claimed`, `bridge.query_result` com job, etapa, host, status e tamanho. Ponte: só ids, host, status e duração. |
| Falha | Ponte desligada, host fora da lista ou erro: a etapa fica "pendente: consulta fora da Cloudflare indisponível", com a fonte nomeada. O motor nunca conclui a pesquisa como completa. |

### Implantação proposta (depois da aprovação, em passos separados)

1. Migração local da tabela `prospect_queries` e testes do motor com a ponte simulada.
2. Versão nova da ponte com o ciclo de consultas desligado por padrão (`QUERIES_ENABLED=0`). Teste local: o ciclo de e-mail produz exatamente os mesmos passos e diários com o ciclo de consultas ligado e desligado.
3. Publicação do Worker e da migração remota, cada uma com autorização própria.
4. Atualização da ponte no computador, com autorização própria; ligar `QUERIES_ENABLED=1` só depois de conferir um ciclo de e-mail normal.

### Como desfazer

`QUERIES_ENABLED=0` na ponte (efeito imediato) ou revogar a chave `BRIDGE_QUERY_HMAC_KEY` no Worker. A versão anterior da ponte volta pelo mesmo procedimento de atualização. As etapas voltam a "depende do navegador".

## Alternativas consideradas

- **Navegador do painel (atual):** sem infraestrutura nova, mas só com o painel aberto.
- **Servidor próprio (VPS):** independe do computador de Rogério; tem custo mensal e exige decisão de despesa (ver `PONTE-VPS.md`).
- **Espelho Overpass pago ou próprio:** mais volume; custo e manutenção sem justificativa no piloto.
