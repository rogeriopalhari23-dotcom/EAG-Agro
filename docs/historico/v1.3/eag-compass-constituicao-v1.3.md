# Constituição — EAG Compass v1.3

## Princípios invioláveis

Esta constituição governa as decisões de produto, arquitetura, design, implementação e auditoria do EAG Compass. Cada princípio contém sua justificativa e critérios verificáveis.

### P1 — Evidência real, não dedução

**Princípio:** nenhuma classificação de empresa, contato ou oportunidade pode ser apresentada como fato sem fonte citável. Evidência empresarial, evidência de mercado e indício comercial são categorias distintas.

**Por quê:**

- Comex Stat contextualiza fluxos entre Brasil e mercados-alvo, mas não prova que uma empresa específica importou.
- Registro alfandegário nominal, BL, documento empresarial ou confirmação direta podem comprovar atividade da empresa.
- Website, LinkedIn, notícia e marketplace são indícios até validação.

**Como auditar:**

- [ ] Toda empresa possui origem e tipo de fonte registrados.
- [ ] Os três tipos de evidência estão separados no modelo de dados e na interface.
- [ ] O estado `Prospectado` exige evidência empresarial.
- [ ] Evidência de mercado nunca pontua como prova de compra empresarial.

### P2 — Rastreabilidade completa

**Princípio:** cada dado crítico registra origem, responsável, data, método e histórico de alteração.

**Por quê:** scores, decisões comerciais e verificações de compliance precisam ser reproduzíveis.

**Como auditar:**

- [ ] Empresa: fonte, tipo de evidência, data da descoberta e usuário responsável.
- [ ] Evidência: referência ou URL, data do fato, data da consulta e validador.
- [ ] Contato: fonte, método e data de verificação.
- [ ] Scores: versão da regra, parâmetros, componentes e fontes utilizados.
- [ ] Alterações: valor anterior, valor novo, usuário, timestamp e motivo.

### P3 — Registros rejeitados continuam valiosos

**Princípio:** empresas bloqueadas, desqualificadas ou abaixo do mínimo não são apagadas por motivo comercial. O motivo e a data ficam registrados e a revisão é controlada.

**Por quê:** volume, risco, sanções e adequação ao ICP podem mudar; preservar o histórico evita retrabalho e decisões contraditórias.

**Como auditar:**

- [ ] Há motivos padronizados de bloqueio ou desqualificação.
- [ ] Registros inativos são ocultados por padrão, não deletados.
- [ ] A revisão manual exige justificativa e perfil autorizado.
- [ ] Exclusões legais de dados pessoais seguem P7 e não são impedidas por este princípio.

### P4 — Completude é independente de confiança

**Princípio:** Completude mede dados comerciais confirmados; Confidence Score mede força das evidências. Um indicador não altera o outro.

**Por quê:** uma empresa pode ter prova forte de importação e ainda não ter sua demanda comercial qualificada.

**Como auditar:**

- [ ] Completude e Confidence são calculados separadamente.
- [ ] Ambos aparecem lado a lado.
- [ ] Campo `Não confirmado` não é tratado como dado confirmado.
- [ ] Campo `Não se aplica`, com justificativa, é retirado do denominador da Completude.

### P5 — Scores nunca são inventados

**Princípio:** dados desconhecidos não recebem valores presumidos. O sistema apresenta cobertura, pendências e, quando aplicável, intervalo de score.

**Por quê:** ausência de informação não equivale a baixo potencial, alta confiança ou baixo risco.

**Como auditar:**

- [ ] Todo score informa componentes utilizados e regra vigente.
- [ ] Dados desconhecidos reduzem cobertura, sem assumir resultado favorável ou desfavorável.
- [ ] Potential incerto é exibido como intervalo mínimo–máximo.
- [ ] Risk Score sempre é acompanhado de Risk Coverage.

### P6 — Diferenciação é hipótese

**Princípio:** o benchmark preliminar não identificou uma solução que reúna evidência empresarial, qualificação EAG, SPIN, risco e próximo passo no mesmo fluxo. Isso permanece hipótese até validação com usuários e dados reais.

**Como auditar:**

- [ ] A especificação não promete superioridade ou conversão garantida.
- [ ] O piloto mede baseline e resultado pós-MVP.
- [ ] A auditoria testa se a diferenciação é percebida e útil.

### P7 — Segurança e privacidade por design

**Princípio:** dados empresariais e pessoais são acessados somente por finalidade legítima, protegidos por perfil e tratados conforme LGPD/GDPR e política EAG.

**Como auditar:**

- [ ] MVP mono-tenant possui quatro perfis fixos e menor privilégio.
- [ ] PII é criptografada em trânsito e em repouso.
- [ ] Logs não armazenam PII em texto aberto.
- [ ] Solicitações válidas de titular são processadas também em índices, caches e embeddings.
- [ ] Retenção, base legal e descarte estão documentados.
- [ ] A preparação para multi-tenant não é apresentada como isolamento já ativado.

### P8 — Qualificação consultiva, não automática

**Princípio:** dados de demanda e respostas SPIN/Gap são confirmados em diálogo. Automação pode sugerir perguntas, mas não declarar respostas.

**Como auditar:**

- [ ] Campos comerciais registram responsável, data e status de confirmação.
- [ ] Dados externos não preenchem silenciosamente respostas do comprador.
- [ ] Sugestões automáticas são identificadas como sugestões.
- [ ] Alterações críticas exigem nova confirmação.

### P9 — Risco não é punição

**Princípio:** risco comercial orienta mitigação e decisão humana. Sanção confirmada por identificador confiável ou país bloqueado pela política EAG é um bloqueio legal separado do Risk Score.

**Como auditar:**

- [ ] Risk Score alto não apaga nem rejeita automaticamente a oportunidade.
- [ ] Risk Score a partir de 70 gera alerta e ação recomendada.
- [ ] Risk Score a partir de 80 exige plano de mitigação para qualificação.
- [ ] Correspondência de sanção apenas por nome exige revisão humana.
- [ ] Sanção confirmada bloqueia avanço, independentemente do score.

### P10 — Decisões comerciais transparentes

**Princípio:** regras, termos e modelo econômico são documentados, versionados e comunicados claramente.

**Como auditar:**

- [ ] Alterações de regras e parâmetros possuem changelog.
- [ ] Termos de serviço e política de dados são acessíveis.
- [ ] Pricing e empacotamento comercial só são definidos na Fase 2.

## Limite entre MVP e Fase 2

| Item | MVP | Fase 2 |
|---|---|---|
| Multi-tenant | Preparação arquitetural; não ativado | Isolamento por organização ativado e testado |
| Reconvocação | Manual | Automática por critérios |
| CRM | Sem integração | Salesforce/HubSpot |
| RBAC | Quatro perfis fixos | Permissões customizadas |
| Modelo comercial | Não definido | Planos e pricing SaaS |
| Diferenciação | Hipótese em teste | Validada ou reformulada com evidência |

## Controle do documento

- **Versão:** 1.3
- **Data:** 2026-09-21
- **Status:** pronta para aprovação formal

