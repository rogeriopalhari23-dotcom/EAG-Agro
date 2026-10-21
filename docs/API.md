# API da fundação

Todas as rotas `/api/*`, exceto GET health, exigem identidade autenticada e usuário ativo. Mutações exigem `Content-Type: application/json`, `Origin` igual ao endereço da plataforma e corpo até 64 KB. IDs opacos não substituem autorização. Falhas usam `{error:{code,message,details},requestId}`. Paginação: `limit` 1–100, padrão 50; `offset` 0–100000; `nextOffset` ou paginação por coleção no detalhe.

| Rota | Contrato principal |
| --- | --- |
| GET /api/health | Liveness/versão, sem dados da operação. |
| GET /api/session | Usuário, ambiente e capacidades implementadas. |
| GET /api/dashboard | Contagens reais de pipeline e exceções. |
| GET/POST /api/companies | Lista por q (nome, CNPJ, ou nome/e-mail/telefone de pessoa vinculada; canal geral só por e-mail/telefone), status, country, contact, profile, decisor (confirmado/identificado/a_validar/sem), commodity e uf; cada empresa traz `decisors` (pessoas com situação e fonte; canais gerais à parte). Cria com legalName, countryCode ISO2, sourceLabel; registro com tipo opcional. |
| GET /api/companies/decisors?ids=a,b | Decisores e canais de até 100 empresas do próprio inquilino (resultados da prospecção). Só leitura; nada deduzido nem validado. |
| GET /api/companies/:id | Coleções paginadas e contatos decriptados; campos de cada demanda da página. |
| POST /api/companies/:id/evidence | Categoria/tipo/referência, consultedAt; prova empresarial exige productId e market, validationStatus; factDate opcional não pontua atualidade quando ausente. |
| POST /api/companies/:id/contacts | fullName, sourceLabel; campos opcionais jobTitle/email/phone/linkedinUrl criptografados. |
| POST /api/companies/:id/contact-verifications | contactId, demandId, type, status, method, sourceReference; append-only de decisões. |
| PUT /api/companies/:id/demand | productId, market, fields; edição exige id + expectedVersion. Campo: key, status, value, sourceReference (confirmado) ou reason (não aplicável). Volume: `{amount,unit}`; booleano real. Campos omitidos preservados. |
| POST /api/companies/:id/risk-observations | component, severity 0–20, sourceReference, observedAt. |
| POST /api/companies/:id/approvals | demandId, approvalType, status, reason; gestor/admin, decisão vinculada aos dados atuais. |
| POST /api/companies/:id/scores/recalculate | demandId; resultados/gate atuais, scoresReused indica ausência de nova gravação igual. |
| POST /api/companies/:id/qualify | demandId; gestor/admin; gate e revisões conferidos no commit. |
| GET /api/catalog[/id] | Produtos e `commodities` (lista única para radares, prospecção e rodadas: nome comercial, sigla como complemento, aliases sem sinônimos entre commodities); detalhe com códigos e características. Não existe edição de catálogo nesta entrega. |
| GET /api/parameters | Valores atualmente vigentes por chave:escopo. |
| PUT /api/parameters/:key | Admin, scope/value/reason. Apenas chaves explicitamente suportadas em operations.js. |
| GET/POST /api/campaigns | Lista/criação: name, productId, market, localização, ICP obrigatório. |
| GET/PATCH /api/campaigns/:id | Detalhe; edição de name/status/reviewDueAt com expectedVersion. ICP ainda não editável. |
| POST /api/campaigns/:id/activate | Gestor/admin, expectedVersion; active ou waiting por limite de commodities. |
| POST /api/campaigns/:id/declarations | Gestor/admin, expectedVersion, kind, valueBool ou text, reviewDueAt; substitui aprovação anterior do mesmo tipo. |
| GET/POST /api/suppression | Leitura admin; escrita operacional com channel/value/reason enumerado, idempotente. Não há DELETE. |
| GET/POST /api/pauses | Lista/escrita com scope/scopeRef/reason. Operação global exige gestor/admin. |
| POST /api/pauses/:id/resume | Motivo obrigatório; operação global exige gestor/admin; segunda retomada dá 409. |
| GET /api/audit | Eventos paginados; filtro opcional entityId. |
| GET/POST /api/prospect/profile | Perfil comprador padrão, versionado (POST: gestor/admin, com motivo e expectedVersion). |
| GET/POST /api/prospect/policy, POST /api/prospect/policy/revoke | Política de pesquisa de rotina: concessão (gestor/admin, confirm + referência; fonte paga recusada) e revogação. |
| POST /api/prospect/jobs/:id/act | { action } — a pessoa executa a ação concreta da pendência (select_authorize, accept_candidates, ack_limitations, request_indicators, retry), com a própria identidade e canal do painel; perfil exigido por ação (Administrador, aprovador ou escrita). |
| POST /api/prospect/auto | { market } — pesquisa automática: escolhe a combinação elegível pela rotação (perfil, origens e limites, evidência oficial com o Brasil, cobertura), reaproveita a em andamento e inicia sob a política, com a justificativa; sem política, 409. Sem contato. |
| POST /api/prospect/destinations | { commodity } ou { productId } — destinos com evidência oficial de comércio DO PRODUTO com o Brasil (MDIC: exportações do Brasil; Comtrade: importações declaradas com origem Brasil), pelas classificações verificadas e todas as subposições; cada país indica o produto que o fundamenta, fonte e período, e se há conector de empresas. Estados: ready, checking ("Verificando mercados compradores"), none_valid, none_incomplete (com motivos e nova tentativa). Refaz resumos do R2, pede a atualização de destino vencido (política de Administrador, R12.15) e classifica produto sem código sob a política. Nunca devolve todos os países. |
| POST /api/prospect/characteristic | { productId, key, value } — característica do produto que muda a classificação, respondida fora de uma prospecção; destrava as prospecções paradas na mesma pergunta. |
| POST /api/prospect/jobs (internacional) | Recusa (422 destination_not_eligible) país sem evidência oficial de comércio do produto com o Brasil; guarda a evidência do início. Pesquisas existentes e o histórico não mudam. |
| POST /api/companies/:id/relations | { productId, unit?, evidence?, channels?, profile? } — empresa já cadastrada encontrada de novo (importação de lote, outra commodity): acrescenta só o que falta para o produto (unidade, evidências, canal, relação), sem duplicar nem substituir; não cria pessoas. |
| POST /api/contacts/:id/products | { productId, role, sourceLabel, sourceUrl? } — a pessoa responde também por este produto (papel próprio, com fonte); repetido → 409. |
| GET /api/rounds/:id/existing | Empresas já cadastradas com atividade compatível com a commodity da rodada, no raio, ainda sem relação com o produto (só leitura). |
| GET /api/companies/decisors?ids=&productId= | Com productId, só conta como decisor quem está vinculado ao produto; os demais aparecem como "responde por outro produto" ou "produto não informado". |
| GET /api/prospect/connectors | Inventário completo dos conectores e quando cada um se aplica (só Administrador). |
| POST /api/sources/applicable | Fontes aplicáveis: { market: "national", segments } → items e config da rodada; { market: "international", iso2, productId } → items. Mesma regra do motor e das telas. |
| GET /api/prospect/coverage | Fontes aplicáveis à escolha (market + productId, + iso2 no internacional): só as do país, da commodity e dos segmentos; pertinente sem condição de rodar vem `pending` com nota; inclui a situação dos indicadores do país (pronto, vencido, aguardando geração, processando, aguardando limite, falha, sem fonte, não gerado). Não esconde país. |
| GET/POST /api/prospect/jobs | Prospecções; criar com market, productId e local (nacional: region, municipality, radius; internacional: iso3). Executa em segundo plano (fila e cron). |
| GET /api/prospect/jobs/:id; POST …/pause, …/resume, …/cancel, …/skip-browser, …/browser-osm, …/run | Andamento, etapas e registro; controles da pessoa; resposta do mapa obtida pelo navegador; execução imediata (diagnóstico). |
| GET /api/round-catalog | Fontes das rodadas (o que fazem, limites, regra por segmento) e segmentos sugeridos por commodity. Só leitura. |
| GET /api/geo/regions?country= | Estados com municípios na base oficial (só BR); fora do Brasil, `supported:false` e a limitação em texto. |
| GET /api/geo/municipalities?uf=&q= | Municípios oficiais (código IBGE, nome, UF) por estado e trecho do nome; sem estado, exige 3 letras. Só leitura. |

Perfis operacionais: admin, commercial_manager, seller_analyst. Auditor_viewer consulta e não altera. Parâmetros só admin; exceções/qualificação/declarações gestor ou admin. `finalBuyerRequired` é condição comercial da demanda: alterar exige gestor/admin e `conditionReason`.

Campanhas, fichas e mensagens planejadas não devem ser confundidas: não há endpoints de envio, ficha, pesquisa automatizada, geocodificação ou lista mensal nesta fundação. Os consumidores futuros devem aplicar os contratos atuais de autenticação, pausa, supressão, revisões e auditoria.

## Acréscimos de 2026-10-09 (não publicados)

| Rota | Contrato |
| --- | --- |
| GET /api/compliance/t11?scope=br_email_automatic | Admin, gestor e auditor: histórico, decisão vigente (`pending` sem registro) e evidências exigidas. |
| POST /api/compliance/t11 | Só admin; só `br_email_automatic`. `decision` validated/revoked, `responsible`, `decidedOn` (não futura), `basis`, `confirm: true` e `evidence[]` (`kind`, `reference`, `sha256`). Validar exige decisions, legal_basis, transfer_mechanism, incident_register e erasure_test. Só inclusão: revogação é linha nova. Não libera canal, campanha nem ficha. |
| PUT /api/parameters/email_copy_to | Admin, escopo `email`: `{"enabled":true,"address":"…","contractRef":"…"}` ou `{"enabled":false}`. Cópia interna separada (D5-a). |
| POST /api/bridge/claim | Ponte: corpo `{ copyAllow: [...] }`; com cópia ligada e endereço fora da lista, devolve `copy_target_not_allowed` sem reservar. |
| POST /api/bridge/copy-claim · /api/bridge/copy-result | Ponte: próxima cópia de passo aceito (sem link de descadastro do prospect, Message-ID determinístico) e resultado idempotente (accepted/temporary/permanent/indeterminate). Lease vencido vira indeterminado. |
