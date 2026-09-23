# Constituição — EAG Compass v2.0

**Versão:** 2.0
**Data:** 2026-09-22
**Status:** **APROVADA por Rogério Palhari (Administrador) em 2026-09-22.** Fase 3 encerrada. Conteúdo idêntico ao rascunho 5 (`historico/v2.0-planejamento/…-rascunho5.md`), exceto estas linhas de controle. **Acréscimo pós-aprovação:** exceção P19 (envio de prospecção via SMTP da Hostinger), registrada em 2026-09-22 por decisão G3 de Rogério; versão anterior em `historico/v2.0-planejamento/eag-compass-constituicao-v2.0-aprovada-2026-09-22.md`.
**Rascunhos anteriores:** `docs/historico/v2.0-planejamento/eag-compass-constituicao-v2.0-rascunho1.md`, `…-rascunho2.md`, `…-rascunho3.md` e `…-rascunho4.md`.
**Versão substituída:** Constituição v1.3, arquivada sem alteração em `docs/historico/v1.3/eag-compass-constituicao-v1.3.md`.
**Spec associada:** `docs/eag-compass-spec.md` (v2.0, aprovada em 2026-09-22).

Esta constituição governa produto, arquitetura, design, implementação e auditoria. Toda fase seguinte a lê antes de decidir; os auditores da Fase 7 cobram o plano contra ela. Princípio só muda por decisão explícita de Rogério, registrada aqui.

A numeração P1–P10 da v1.3 é preservada. P11–P18 são novos.

---

## Princípios do produto

### P1 — Evidência real, não dedução — **Revisado**

**Princípio:** nenhuma classificação de empresa, unidade, contato, perfil comprador ou oportunidade é apresentada como fato sem fonte citável. Evidência empresarial, evidência de mercado e indício comercial são categorias distintas. Cadastro, CNAE, base paga e dado agregado de país são indícios ou contexto, nunca prova de compra ou consumo.

**Por quê:** o Radar Nacional nasce de cadastros e o Internacional de estatística por país; nenhum dos dois comprova que uma empresa compra ou consome a commodity.

**Como auditar:**

- [ ] Toda afirmação registra fonte, data do fato quando conhecida, data da consulta e responsável (R13.2).
- [ ] Os três tipos de evidência estão separados no modelo de dados e na interface.
- [ ] `consumidor final confirmado` exige evidência empresarial ou confirmação direta (R14.2).
- [ ] No Internacional, `importa do Brasil`, `compra a commodity` e `consome como matéria-prima` são registrados separadamente e nunca preenchidos pelo dado do país (R12.10).
- [ ] Evidência de mercado e aprovação de ficha nunca pontuam em Confidence.

### P2 — Rastreabilidade completa — **Revisado**

**Princípio:** cada dado crítico registra origem, responsável, data, método e histórico. Buscas, análises de país, fichas, textos e envios são reproduzíveis.

**Como auditar:**

- [ ] Empresa, evidência, contato e score: mantidos os itens da v1.3.
- [ ] Busca: parâmetros, fontes, período, cobertura, custo e tempo (R13.5). Alterar o raio cria nova versão e nunca sobrescreve a anterior (R11.12).
- [ ] Ficha: versão, aprovador, textos congelados, SHA-256 da skill e versão do gerador (R17.1, R18).
- [ ] Envio: identificador estável do passo e estado informado pelo provedor (R19.4–R19.5).
- [ ] `audit_log` só aceita inserção e não copia conteúdo pessoal (R8.1.1).

### P3 — Registros rejeitados continuam valiosos — **Mantido**

Empresas bloqueadas, descartadas, adiadas ou abaixo do mínimo não são apagadas por motivo comercial; motivo e data ficam registrados; revisão exige justificativa e perfil autorizado. Exclusões legais de dados pessoais seguem P7.

- [ ] Motivos padronizados de descarte/adiamento/bloqueio.
- [ ] Registros inativos ocultos por padrão, não deletados.
- [ ] Revisão manual exige justificativa e perfil autorizado.

### P4 — Completude é independente de confiança — **Mantido**

Completude mede dados comerciais confirmados; Confidence mede força das evidências. Um não altera o outro.

- [ ] Calculados separadamente e exibidos lado a lado.
- [ ] `Não confirmado` não conta como confirmado; `Não se aplica` justificado sai do denominador.

### P5 — Scores nunca são inventados — **Revisado**

Dados desconhecidos não recebem valores presumidos. Commodity ou mercado sem tabela aprovada produz intervalo e pendência, não pontos.

- [ ] Todo score informa componentes, regra e versão por commodity **e mercado**.
- [ ] Sem `M` nem tabela específica, Volume e Potencial anual são desconhecidos (R4.3.2); no Nacional isso não bloqueia a qualificação por si só (R4.3.6).
- [ ] O Nacional usa a pontuação da Spec §6.1: nenhum ponto de importação para compra doméstica; `M_N` é escala e mínimo (R4.3.5, R5.1.2).
- [ ] Risk Score sempre acompanhado de Risk Coverage.

### P6 — Diferenciação é hipótese — **Revisado**

O benchmark (BEN, revisão 2) não comprovou, nas páginas examinadas, uma solução que reúna descoberta por raio, evidência de consumo, aprovação individual e execução de sequência. Isso não prova exclusividade; permanece hipótese.

- [ ] Nenhum artefato promete superioridade, cobertura integral ou conversão.
- [ ] O piloto mede baseline (ESC §4.2) separado do aceite técnico.

### P7 — Segurança e privacidade por design — **Revisado**

Dados empresariais e pessoais são acessados por finalidade legítima, protegidos por perfil e tratados conforme LGPD/GDPR e política EAG.

- [ ] Mono-tenant EAG com quatro perfis fixos e menor privilégio; permissão verificada no servidor (R9.2.1).
- [ ] PII criptografada em trânsito e em repouso; logs sem PII em texto aberto.
- [ ] Supressão é pseudonimizada, com acesso restrito e retenção definida; nunca chamada de anônima (R9.1.1).
- [ ] Solicitações de titular alcançam índices, caches e embeddings.
- [ ] LinkedIn nunca por senha ou cookies (R15.2).
- [ ] Preparação para multi-tenant (`tenant_id`) não é apresentada como isolamento ativado.

### P8 — Qualificação consultiva, não automática — **Revisado**

Demanda, respostas SPIN/Gap e interesse são confirmados por humano. Automação sugere; não declara. O Compass não responde, negocia nem fecha com compradores.

- [ ] Extrações de resposta são sugestões com a mensagem de origem (R20.4).
- [ ] Oportunidade só por confirmação humana (R27.2).
- [ ] Nenhum caminho de código envia resposta automática a comprador (R19.9).

### P9 — Risco não é punição — **Mantido**

Risco orienta mitigação e decisão humana. Sanção confirmada é bloqueio separado do Risk Score.

- [ ] Risk ≥ 70 alerta; ≥ 80 exige plano de mitigação para qualificar.
- [ ] Correspondência só por nome exige revisão humana; sanção confirmada bloqueia ficha, envio e qualificação.

### P10 — Decisões comerciais transparentes — **Revisado**

Regras, parâmetros, classificações agrícolas e critérios de texto são documentados, versionados e com changelog.

- [ ] Alteração de parâmetro registra valor anterior, novo, motivo, usuário e vigência.
- [ ] Parâmetro sem valor aprovado bloqueia a funcionalidade dependente, sem valor implícito (R7.1.1). Limites de raio não são copiados de fornecedores (R11.14).
- [ ] USD é a moeda-base; BRL só aparece com taxa, fonte e data (R3.1.4).
- [ ] O pipeline da empresa mantém os estados v1.3/0.3.1; mudança de estado exige justificativa registrada na Spec (§1.2).
- [ ] Removido da v1.3: "pricing só na Fase 2" — pricing SaaS está fora do escopo v2.0.

### P11 — Nenhum contato sem aprovação individual versionada — **Novo**

**Princípio:** nenhuma mensagem sai para destinatário externo sem ficha aprovada daquela empresa, com texto final, destinatário, canal, fuso e sequência congelados. O que se envia é byte a byte o que foi aprovado.

**Por quê:** a v2.0 passa a executar sequências. A aprovação humana por empresa é a única barreira entre um gerador de texto e um comprador real.

**Como auditar:**

- [ ] Não existe caminho de envio que não passe por R19.2.
- [ ] Nenhum gerador é chamado no disparo (R17.2; AT25).
- [ ] Mudança material gera nova versão e nova aprovação (R18.4).
- [ ] Aprovar exige Gestor Comercial ou Administrador.

### P12 — Interrupção prevalece sobre execução — **Novo**

**Princípio:** supressão > bloqueio de sanção/compliance > pausa > resposta > sequência. Na dúvida, o sistema para. Indisponibilidade de verificação nunca libera envio.

**Como auditar:**

- [ ] Mensagem não classificável e ausência automática são tratadas como resposta: pausa empresa + commodity (R20.6, R20.7).
- [ ] Nenhuma retomada automática de sequência pausada por mensagem recebida; exceção só com B1 aprovada (R20.8).
- [ ] Todo e-mail contém saída clara; descadastro é processado na supressão antes do próximo passo (R21.7, R21.9).
- [ ] Compliance indisponível segura o envio (R19.3).
- [ ] Nenhum encerramento após supressão, pausa ou resposta (R21.6, PV6).
- [ ] Retomada reexecuta todas as verificações e nunca reenvia passo aceito (R22.7, R19.4).

### P13 — Sem duplicidade — **Novo**

**Princípio:** reenvio, duplo clique, reexecução, reaprovação ou reimportação nunca geram envio, empresa ou aprovação duplicados. Estado incerto é reconciliado antes de nova tentativa.

**Como auditar:**

- [ ] Identificador estável por passo; restrição de unicidade no armazenamento.
- [ ] Uma sequência ativa por destinatário (R19.8).
- [ ] Testes de idempotência para aprovação, envio e busca (AT26, AT27, R23.2).

### P14 — Planejado não é comprovado — **Novo**

**Princípio:** integração, canal, fonte ou recurso de infraestrutura só é declarado funcional com evidência de teste (data, responsável, o que foi executado). Documentação lida, login feito ou requisito escrito não comprovam nada. Funcionalidade dependente não é ativada sem a evidência.

**Por quê:** revisões anteriores misturaram marco planejado com atividade executada (STA, correções). Um canal dado como pronto sem teste envia mensagens reais sem controle.

**Como auditar:**

- [ ] Cada requisito da Spec carrega marca de comprovação (Spec §0.2).
- [ ] Canal só `habilitado` com evidência registrada (R26.1).
- [ ] Relatórios de progresso separam "implementado e testado", "implementado sem teste" e "planejado".

### P15 — Prospecção por commodity, sem promessa comercial — **Novo**

**Princípio:** a prospecção inicial apresenta a commodity e levanta demanda. Lote, preço, estoque, cotação e oferta específica não são exigidos e não são prometidos. Nenhum texto afirma dado comercial não aprovado pela EAG.

**Como auditar:**

- [ ] Busca, ficha e envio não têm campo obrigatório de oferta (R16.2; AT15).
- [ ] Revisor aplica PV7 e bloqueia aprovação (AT24).
- [ ] Característica não confirmada não é citada (R10.6).
- [ ] Mínimo ou exigência de comprador final de um fornecedor não se aplica a outras campanhas (R3.3.3).

### P16 — Compradores, não fornecedores; ICP da skill — **Novo (revisado no rascunho 5: K1, K2, K3)**

**Princípio:** o Compass procura compradores. A cidade do fornecedor conhecido é só referência logística. A prospecção ativa mira o ICP da `/prospeccao-vendas`: indústrias que usam a commodity, de porte médio ou média-mais, com no máximo 2 commodities ativas por mercado. Todas as empresas encontradas continuam visíveis e classificadas. Traders, pequenas/MEI e gigantes sem relacionamento prévio ficam fora da prospecção ativa; trader só entra por exceção registrada por empresa.

**Como auditar:**

- [ ] Nenhuma funcionalidade pesquisa ou sugere fornecedores (AT16).
- [ ] Nenhuma empresa é ocultada ou desclassificada por perfil ou porte; o critério 7 do gate segue R2.4 (AT12).
- [ ] Ficha fora do ICP só com o registro exigido: relacionamento prévio (gigante) ou exceção com autor, data e motivo (trader) (R14.6, R14.7; AT59, AT63).
- [ ] No máximo 2 commodities com campanhas ativas por mercado (R28.17; AT61).

### P17 — Todo trabalho de prospecção obedece à `/prospeccao-vendas` — **Novo (revisado no rascunho 4)**

**Princípio (diretriz de Rogério, 2026-09-22):** ICP, lista, cadência, abordagem, ligações, qualificação inicial e agendamento seguem a `/prospeccao-vendas` na versão efetivamente lida e registrada no T12. Os invioláveis da skill (⚡, NUNCA, SEMPRE) são invioláveis também no Compass. Padrões da skill só cedem com justificativa registrada. Nada é atribuído à skill sem leitura registrada.

**Relação com os demais princípios:** a skill governa o **método**; P7, P11–P15 e P18 governam os **controles** (aprovação, supressão, LGPD, compliance, veracidade, integração comprovada). Os dois se somam. Quando colidem literalmente, vale o mais restritivo até decisão de Rogério registrada na Spec. K1–K6 foram decididos em 2026-09-22 (Spec §6.0). Descumprir um inviolável da skill exige exceção registrada nesta Constituição.

**Por quê:** a skill é o método comercial da própria EAG Agro (curso de Anderson Ramos). O Compass automatiza esse método; não cria outro.

**Como auditar:**

- [ ] SHA-256 da skill, versão dos critérios e do gerador em cada texto (R17.1); hash diferente bloqueia nova geração (R17.8).
- [ ] PV1–PV12 verificados antes da aprovação (R17.3); roteiros de `scripts-abordagem.md` como base (R17.4).
- [ ] Nenhum preço, PDF, anexo, apresentação ou proposta antes da reunião (I2, I7; AT24, AT54).
- [ ] Campanha sem ICP registrado não gera ficha (R28.1; AT51).
- [ ] E-mail só para endereço validado; nunca em dias seguidos (R19.2 itens 11–12; AT52, AT53).
- [ ] Break encerra a cadência; retorno só por nova ficha (R28.11; AT56).
- [ ] Toda tarefa, tela e texto que usa o método cita a regra da skill aplicada; lacunas 🔴 e apoio 📚 aparecem identificados como tais.
- [ ] Tarefas manuais de ligação e LinkedIn obedecem às mesmas interrupções dos envios (R28.18; AT65).
- [ ] Frases de volume disponível e prova social só com declaração aprovada da campanha (R16.7, R16.8; AT62).
- [ ] Rastreamento de abertura só com T1 e T11 comprovados (R28.7; AT64).
- [ ] Amostras internas revisadas antes da primeira ficha real (R17.6).
- [ ] SHA-256 da skill disponível diferente do incorporado bloqueia nova geração até nova leitura T12 (R17.8).

### P18 — Cobertura e incerteza sempre visíveis — **Novo**

**Princípio:** toda busca e análise exibe fontes, cobertura, falhas, truncamentos e precisão geográfica. Resultado parcial nunca vira ausência; localização aproximada nunca vira "dentro do raio" comprovado.

**Como auditar:**

- [ ] Três estados no Internacional: compra identificada / nenhum registro / dados indisponíveis (AT21).
- [ ] Precisão de ponto e candidato exibida (R11.2, R11.5–R11.6; AT17).
- [ ] Nenhuma tela declara cobertura integral.

---

## Princípios da metodologia

### P19 — Cloudflare-first — **Novo (default da metodologia)**

Toda camada nasce na Cloudflare; saída só por falta de cobertura ou custo inviável, justificada por escrito nesta constituição. A hospedagem Cloudflare já é decisão do escopo (ESC D5); plano, recursos e custos continuam por comprovar (T9, P14).

- [ ] Tabela de decisão da Fase 4 com coluna "plano exigido / status na conta".
- [ ] Toda fonte externa (Comex Stat, bases de empresas, geocodificação, provedor de e-mail) entra como integração justificada por cobertura, não como troca de camada.

### P20 — Testes antes da implementação de cada módulo — **Novo (default da metodologia)**

- [ ] Toda tarefa de módulo no plano começa pelos testes dos seus critérios EARS/AT.
- [ ] Integrações testadas contra dublês com fixtures copiados da documentação oficial até que Tn seja comprovado em ambiente real.

### P21 — Human-in-the-loop nos gates — **Novo (default da metodologia)**

Nenhuma fase do planejamento avança sem aprovação expressa de Rogério; nenhuma aprovação é presumida ou registrada em seu nome.

- [ ] Status do planejamento registra data e forma de cada aprovação.

---

## Limite desta versão

| Item | v2.0 | Futuro |
| --- | --- | --- |
| Multi-tenant | `tenant_id` preparado; não ativado | Isolamento por organização testado |
| Usuários | Internos EAG, quatro perfis fixos | Externos, permissões customizadas |
| Canais | E-mail após T1; WhatsApp após T2; LinkedIn assistido | Automação LinkedIn só se T3 comprovar |
| Reconvocação | Nova ficha manual | Automática por critérios |
| CRM | Sem integração | Avaliar |
| Bases pagas | Adaptador opcional após decisão registrada | — |
| Diferenciação | Hipótese | Validada ou reformulada |

## Exceções aprovadas

| Princípio | Exceção | Justificativa | Data |
| --- | --- | --- | --- |
| P19 | **Envio de e-mail de prospecção fora da Cloudflare:** transporte SMTP pela caixa do remetente na Hostinger (`rogeriopalhari@eagagro.com`, porta 465, via `connect()` do Worker). O Worker continua dono de fila, verificação pré-envio, idempotência, supressão e registro; só o transporte é externo. | **Cobertura:** a FAQ oficial do Email Service diz "intended only for transactional emails" (`developers.cloudflare.com/email-service/reference/faq/`, consultada em 2026-09-22), e prospecção não é transacional. A caixa própria é o que a `/prospeccao-vendas` pressupõe. Limites e termos da Hostinger ficam a comprovar em T1 (P14). Aprovada por Rogério (G3). **Destino "Hostinger" SUSPENSO em 2026-09-22:** os Termos de Serviço da Hostinger, §12, proíbem mensagem comercial não solicitada sem consentimento prévio "regardless of […] the recipient being relevant" (`https://www.hostinger.com/legal/universal-terms-of-service-agreement`). A saída da Cloudflare por cobertura continua válida; o provedor de transporte volta à decisão (G3 reaberta, `docs/eag-compass-pesquisa-tecnica.md` §7.1). | 2026-09-22 |

## Controle do documento

- **Versão:** 2.0
- **Data:** 2026-09-22
- **Status:** aprovada em 2026-09-22 por Rogério. Novo princípio ou exceção: registrar aqui antes de implementar.
