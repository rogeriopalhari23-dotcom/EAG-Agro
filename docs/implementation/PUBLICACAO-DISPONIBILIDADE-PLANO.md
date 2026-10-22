# Plano de publicação: filtro de disponibilidade e retomada dos resumos (preparado em 2026-10-22, não executado)

Aguarda autorização. Nesta etapa nada foi publicado, nenhuma migração remota foi aplicada e nenhuma pesquisa foi feita em produção.

## 1. O que vai

**Produção atual:** Worker `a74acf8e-79ef-4e01-94b9-3f5ca3d21e60`, código `1e7be00`, migrações até a 0048.

**Código.** Commits depois de `1e7be00` na `redesign-interface`:
- `3cc118c`: o filtro;
- `b00919c`: a prévia usa a mesma retomada do cron;
- os commits seguintes (ajustes e documentação; ver `git log 1e7be00..`).

O filtro faz o seguinte:
- **Relação única país × produto** (`src/availability.js`), nos dois sentidos: commodity → países e país → commodities ("Começar por: País"). Vale para o formulário, o Radar Internacional, a criação da pesquisa e a pesquisa automática.
- **Avaliação gravada ao fim de cada pesquisa internacional** (`market_assessments`):
  - empresas encontradas, inclusive já cadastradas: disponível;
  - busca real concluída sem candidatas: retirada temporária, por 90 dias ou até fonte nova, regra nova, empresa compatível cadastrada ou pedido de reavaliação;
  - pendência técnica: falha, fonte pendente ou pesquisa incompleta.
  - Execução simulada é registrada como simulada e não muda a disponibilidade.
- **Destino comprovado sem fonte de empresas** sai da seleção principal para a seção recolhida "Sem fonte de empresas coberta". Isso muda o que aparece na tela.
- **Resumos da lista de países** são retomados pelo cron de 5 minutos:
  - lotes de 20, com lease, cursor e falha registrada;
  - sem pendência, a próxima verificação só acontece 6 horas depois, ou antes se houver lista nova (limite de leituras do D1);
  - na tela, cada consulta refaz no máximo 10 resumos.

**Migração 0049** (`migrations/0049_disponibilidade_mercados.sql`): só cria tabelas, `market_assessments` e `maintenance_leases`, com seus índices. Não altera nem apaga nada.
- **Ensaio** sobre a cópia da produção (backup de 2026-10-22 mais 0045–0049, local): 37 empresas, 73 candidatas e 349 resumos mantidos; `integrity_check` ok; 0 pendências de chave estrangeira.
- **Compatibilidade da reversão:** o Worker `a74acf8e` não conhece as tabelas novas e não depende delas.

**Testes:** `npm run check` com 581 + 2 + 37 testes, 0 falhas; `npm run test:ui` OK.
- `tests/disponibilidade.test.mjs` cobre: dois sentidos, busca vazia válida, empresa já cadastrada de outra commodity, falha, simulação, reinclusão, preparação parcial com lease e cursor, avaliação pela prospecção e verificação guardada sem releitura.

## 2. O que acontece sozinho depois da publicação

- **Resumos:** no primeiro ciclo do cron, até 5 minutos depois, começa a retomada dos resumos que faltam. Em 22/10 eram 229 do MDIC de 12 meses, mais os de 24 meses e o histórico da Comtrade.
  - São 20 por ciclo, com gravação em `trade_country_summary` e `maintenance_leases`.
  - Só lê objetos oficiais já guardados no R2; nenhuma chamada externa.
  - Estimativa: cerca de 2 horas até zerar.
- **Avaliações:** nenhuma é criada sem pesquisa. Produção não tem prospecção internacional (0 trabalhos em 22/10), então nenhuma combinação é retirada na publicação.
  - Etanol — África do Sul e Milho — Albânia continuam disponíveis em produção. As buscas vazias desses casos aconteceram só na execução local real.

## 3. Passos (com autorização)

1. **Backup:**
   - `npx wrangler d1 time-travel info eag_compass`: anotar o marcador;
   - `npx wrangler d1 export eag_compass --remote --output C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0049-AAAAMMDD\eag_compass.sql`;
   - SHA-256 conferido.
2. **Pendências:** `npx wrangler d1 migrations list eag_compass --remote` deve mostrar só a 0049.
3. **Migração:** `npm run db:migrate:remote`. Conferir as tabelas novas, as contagens de antes mantidas e 0 pendências de chave estrangeira.
4. **Publicação:** `npm run deploy` (o `predeploy` roda `npm run check` e `validate-deploy`). Anotar a versão nova.
   - Se o consumidor da fila repetir o erro 10013: conferir pela API, só leitura, que o consumidor continua com as mesmas configurações. Não repetir o deploy.
5. **Conferência:**
   - **Retomada:** a cada ciclo, `SELECT last_finished_at,last_result_json,last_error FROM maintenance_leases` deve mostrar `remaining` caindo e nenhuma falha.
   - **Destinos:** a soja deve mostrar o Chile depois que o MDIC completar.
   - **Gravações:** abrir telas grava, e isso tem de ser registrado como tal. As gravações esperadas são os resumos e a verificação da retomada. Avaliações (`market_assessments`) só nascem de pesquisas, e nenhuma pesquisa será iniciada.
   - **Estado comercial e ponte:** os mesmos de antes, e uma leitura bem-sucedida da ponte depois da publicação.

## 4. Riscos e o que observar

- **CPU por execução:** no plano gratuito, uma execução de cron tem 10 ms de CPU. Os objetos do MDIC chegam a 1,4 MB. Se a execução for interrompida, o progresso não se perde: cada resumo é gravado ao ser feito, e o lote seguinte só pega o que falta.
  - **Sinal:** `last_started_at` avança e `last_finished_at` não.
  - **Ação:** reduzir o lote no código (nova publicação, com autorização).
- **Leituras do D1:** durante a retomada, cerca de 25 ciclos, cada um com as contagens e um lote. Sem pendência, uma verificação a cada 6 horas.

## 5. Reversão

- **Código:** `npx wrangler rollback a74acf8e-79ef-4e01-94b9-3f5ca3d21e60`. É compatível: o código anterior ignora as tabelas da 0049.
- **Banco:** não é preciso desfazer. As tabelas novas não afetam o código anterior, e os resumos refeitos vêm dos mesmos dados oficiais.
- **Restauração:** nunca automática. Antes de qualquer restauração:
  - determinar o estado efetivo;
  - considerar que restaurar descarta gravações posteriores (ponte, avaliações, resumos);
  - considerar que pode trazer de volta dados pessoais eliminados depois do backup.
