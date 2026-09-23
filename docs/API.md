# API da fundação

Todas as rotas `/api/*`, exceto GET health, exigem identidade autenticada e usuário ativo. Mutações exigem `Content-Type: application/json`, `Origin` igual ao endereço da plataforma e corpo até 64 KB. IDs opacos não substituem autorização. Falhas usam `{error:{code,message,details},requestId}`. Paginação: `limit` 1–100, padrão 50; `offset` 0–100000; `nextOffset` ou paginação por coleção no detalhe.

| Rota | Contrato principal |
| --- | --- |
| GET /api/health | Liveness/versão, sem dados da operação. |
| GET /api/session | Usuário, ambiente e capacidades implementadas. |
| GET /api/dashboard | Contagens reais de pipeline e exceções. |
| GET/POST /api/companies | Lista por q/status; cria com legalName, countryCode ISO2, sourceLabel; registro com tipo opcional. |
| GET /api/companies/:id | Coleções paginadas e contatos decriptados; campos de cada demanda da página. |
| POST /api/companies/:id/evidence | Categoria/tipo/referência, consultedAt; prova empresarial exige productId e market, validationStatus; factDate opcional não pontua atualidade quando ausente. |
| POST /api/companies/:id/contacts | fullName, sourceLabel; campos opcionais jobTitle/email/phone/linkedinUrl criptografados. |
| POST /api/companies/:id/contact-verifications | contactId, demandId, type, status, method, sourceReference; append-only de decisões. |
| PUT /api/companies/:id/demand | productId, market, fields; edição exige id + expectedVersion. Campo: key, status, value, sourceReference (confirmado) ou reason (não aplicável). Volume: `{amount,unit}`; booleano real. Campos omitidos preservados. |
| POST /api/companies/:id/risk-observations | component, severity 0–20, sourceReference, observedAt. |
| POST /api/companies/:id/approvals | demandId, approvalType, status, reason; gestor/admin, decisão vinculada aos dados atuais. |
| POST /api/companies/:id/scores/recalculate | demandId; resultados/gate atuais, scoresReused indica ausência de nova gravação igual. |
| POST /api/companies/:id/qualify | demandId; gestor/admin; gate e revisões conferidos no commit. |
| GET /api/catalog[/id] | Produtos; detalhe com códigos e características. Não existe edição de catálogo nesta entrega. |
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

Perfis operacionais: admin, commercial_manager, seller_analyst. Auditor_viewer consulta e não altera. Parâmetros só admin; exceções/qualificação/declarações gestor ou admin. `finalBuyerRequired` é condição comercial da demanda: alterar exige gestor/admin e `conditionReason`.

Campanhas, fichas e mensagens planejadas não devem ser confundidas: não há endpoints de envio, ficha, pesquisa automatizada, geocodificação ou lista mensal nesta fundação. Os consumidores futuros devem aplicar os contratos atuais de autenticação, pausa, supressão, revisões e auditoria.
