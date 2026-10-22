# Plano de publicação: disponibilidade (empresas identificadas × mercados a investigar), exploração em segundo plano e retomada dos resumos

Preparado em 2026-10-22, revisado no mesmo dia. **Não executado.** Aguarda revisão e autorização. Nada foi publicado, nenhuma migração remota foi aplicada e nenhuma pesquisa foi feita em produção.

## 1. O que vai

**Produção atual:** Worker `a74acf8e-79ef-4e01-94b9-3f5ca3d21e60`, código `1e7be00`, migrações até a 0048.

**Código.** Commits de `1e7be00` até a ponta da `redesign-interface`; ver `git log 1e7be00..`.

**Seleção e disponibilidade** (`src/availability.js`). Uma relação país × produto, nos dois sentidos (commodity → destinos e destino → commodities). Vale para o formulário, o Radar Internacional, a criação da pesquisa, a pesquisa automática e a exploração em segundo plano.

| Grupo | Conteúdo | Onde aparece |
| --- | --- | --- |
| **Empresas identificadas** | Candidatas reais de uma pesquisa, ou empresas já cadastradas no país relacionadas ao produto ou com atividade compatível, inclusive de outra commodity. São mostradas como candidatas, não como compradoras confirmadas | Seleção principal |
| **Mercados a investigar** | Comércio comprovado sem candidata: ainda não pesquisado, consultas sem estabelecimentos, pendência técnica ou sem fonte de empresas | Seção recolhida, com filtro |

Para cada mercado a investigar aparecem:
- o fundamento da inclusão;
- as fontes consultadas, com cobertura e qualidade;
- o resultado;
- a próxima tentativa.

Regras de nova tentativa:
- **Consulta sem estabelecimentos:** comprova só aquela consulta. Nova tentativa em 90 dias quando a busca usou registro ou diretório da atividade, ou em 30 dias quando usou só o mapa colaborativo. Antes disso, se mudar a fonte ou a regra.
- **Falha técnica:** espera crescente, de 24 h até 30 dias.
- Nada vira conclusão de ausência. Execução simulada fica registrada como simulada e não muda nada.
- **Mesma consulta** (mesmas fontes e regras), para outro produto da commodity no mesmo país: o resultado vale para os dois, com a origem indicada.

**Exploração em segundo plano** (`src/prospect/explore.js`, cron de 5 minutos):
- uma pesquisa por vez, no máximo 6 por dia (`explorationPerDay` da política);
- só com política vigente que cubra o mercado internacional;
- progresso e falha registrados (`maintenance_leases`);
- quando não há nada devido, nenhuma leitura pesada por 6 horas, salvo mudança.
- **Identidade de automação** `system-exploration`: não é usuário e não entra no painel; age pela autorização delimitada da política. Para revisão: os registros de auditoria terão esse ator, com canal `automation`.

**Pesquisa automática (botão):**
- empresas identificadas sem pesquisa própria vêm primeiro;
- depois, mercados nunca pesquisados, pela qualidade da fonte e pelo valor de comércio;
- classificação fiscal automática antes de escolher.

**Correções de busca:**
- **Mapa:** a área do país agora vale em qualquer nível administrativo. Martinica, Guadalupe, Reunião e outros territórios ficam nos níveis 3 e 4; antes, a consulta buscava numa área vazia e respondia 0. Área inexistente vira falha da consulta.
- **Registro oficial francês:** aplicado aos departamentos ultramarinos (971, 972, 973, 974 e 976), filtrando pelo departamento e com a cidade do estabelecimento.

**Resumos da lista de países:**
- retomada no cron em lotes de 20, com lease, cursor e falha registrada;
- sem pendência, uma verificação a cada 6 horas ou com lista nova;
- na tela, no máximo 10 por consulta.

**Migração 0049:** só cria `market_assessments` e `maintenance_leases`.
- Ensaio na cópia da produção (backup de 22/10 mais 0045–0049): contagens mantidas, `integrity_check` ok, 0 pendências de chave estrangeira.
- A reversão para `a74acf8e` é compatível.

**Testes:** `npm run check` com 586 + 2 + 37 testes, 0 falhas; `npm run test:ui` OK.

## 2. O que acontece sozinho depois da publicação (para revisão)

1. **Resumos:** a retomada começa no primeiro ciclo. Só lê o R2 e não faz chamada externa. Estimativa de cerca de 2 horas.
2. **Exploração:** começa no primeiro ciclo em que houver política vigente. Em produção já há a política v1 (22/10).
   - Até 6 pesquisas internacionais por dia, uma por vez, sobre mercados a investigar, nesta ordem: primeiro os que têm registro oficial ou diretório (ex.: França, Noruega, Alemanha para café, Chile para ração), depois pelo valor de comércio.
   - **Cada pesquisa consulta fontes externas gratuitas:** registros oficiais, diretórios e OpenStreetMap. O OpenStreetMap recusa a Cloudflare, então nesses casos a fonte fica como pendência técnica.
   - **Cada pesquisa também grava:** cadastra candidatas em descoberta, faz a triagem de sanções e grava a avaliação. Isso está dentro da política: descoberta, consulta cadastral, triagem e cadastro em descoberta, sem contato.
   - **Nada de** contato, ficha, campanha ativa ou envio. Campanhas criadas pela seleção nascem em rascunho, como já acontece hoje.
   - **Se a revisão preferir não ligar a exploração na publicação:** gravar `international.exploration: false` numa nova versão da política antes de publicar, ou publicar com o limite diário menor. Exige decisão.
3. **Avaliações:** só nascem de pesquisas, sejam da exploração, do botão ou de uma pessoa.

## 3. Passos (com autorização)

1. **Backup:**
   - `npx wrangler d1 time-travel info eag_compass`: anotar o marcador;
   - `npx wrangler d1 export eag_compass --remote --output C:\Users\Roger\eag-compass-backups\d1-remoto-antes-0049-AAAAMMDD\eag_compass.sql`;
   - SHA-256 conferido.
2. **Pendências:** `npx wrangler d1 migrations list eag_compass --remote` deve mostrar só a 0049.
3. **Migração:** `npm run db:migrate:remote`. Conferir as tabelas novas, as contagens mantidas e 0 pendências de chave estrangeira.
4. **Publicação:** `npm run deploy`. Se o consumidor da fila repetir o erro 10013: conferir pela API, só leitura, e não repetir o deploy.
5. **Conferência:**
   - **Resumos:** `maintenance_leases` (`trade_summary_catchup`) com `remaining` caindo.
   - **Exploração:** `market_exploration` com o último ciclo, `today`/`perDay`, nenhuma falha e uma pesquisa por vez.
   - **Pesquisas:** `prospect_jobs` com `created_by='system-exploration'`.
   - **Estado comercial e ponte:** os mesmos de antes, e uma leitura bem-sucedida da ponte depois da publicação.
   - **Gravações:** registradas como tal, sem chamar a conferência de "só leitura".

## 4. Riscos e o que observar

- **CPU por execução:** no plano gratuito, uma execução de cron tem 10 ms de CPU. A retomada e a exploração podem ser cortadas. O progresso persiste, mas é preciso observar `last_started_at` × `last_finished_at`.
- **Leituras do D1:** o cálculo da disponibilidade lê os resumos e as avaliações. Ele só roda quando há algo a fazer, ou a cada 6 horas.
- **Fontes externas:** o limite diário da política define o ritmo. O registro francês tem limite de requisições por IP e responde 429, que é tratado com nova tentativa.

## 5. Reversão

- **Código:** `npx wrangler rollback a74acf8e-79ef-4e01-94b9-3f5ca3d21e60`. O código anterior ignora as tabelas da 0049 e não tem exploração.
- **Banco:** não é preciso desfazer. As candidatas cadastradas pela exploração ficam em descoberta, como as de qualquer pesquisa.
- **Restauração:** nunca automática. Antes de qualquer restauração:
  - determinar o estado efetivo;
  - considerar que restaurar descarta gravações posteriores;
  - considerar que pode trazer de volta dados pessoais eliminados depois do backup.
