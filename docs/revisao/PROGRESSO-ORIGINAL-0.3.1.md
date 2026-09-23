# EAG Compass — Progresso de Construção

**Versão do produto:** 0.3.1  
**Data:** 2026-09-22  
**Base normativa:** Constituição v1.3 + Especificação v1.3

## Resultado deste incremento

O protótipo visual foi convertido na base de um produto Cloudflare full-stack. A interface funciona como demonstração quando aberta isoladamente e muda para modo conectado quando encontra a API do Worker.

## Implementado

- Interface responsiva com visão geral, pipeline, qualificação, compliance, dados, e-mails e planejamento.
- Cadastro inicial de prospect como `Descoberto`, exigindo nome, país e fonte do indício.
- Worker API nativo, sem framework adicional.
- Banco D1 versionado com 20 tabelas/estruturas, índices, constraints e auditoria append-only.
- Preparação mono-tenant para EAG com `tenant_id`, sem ativar multi-tenant.
- Quatro perfis fixos: Administrador, Gestor Comercial, Vendedor/Analista e Auditor/Visualizador.
- Evidências separadas em empresarial, mercado e indício comercial.
- Formulário de demanda com estados `Confirmado`, `Não confirmado` e `Não se aplica`.
- Cálculo de Potential, Confidence, Risk, Risk Coverage e Completude.
- Gate de qualificação com dez verificações da Spec v1.3.
- Estrutura de sanções com fontes, versões, entradas, aliases, triagens, matches e decisões.
- Configuração para Workers Static Assets, D1, R2, KV, Queues e Cron.
- Central de e-mails somente em rascunho; nenhum envio externo foi habilitado.
- Ficha operacional com inclusão de evidência, contato, demanda e observação de risco.
- Criptografia AES-GCM para nome, cargo, e-mail, telefone e LinkedIn dos contatos.
- Identificação do usuário pelo ambiente privado e bootstrap controlado do primeiro Administrador.
- Ferramentas estruturadas para listar e criar prospects quando o navegador oferecer suporte.
- Dashboard conectado aos estados reais do pipeline, com fallback demonstrativo explícito.
- Exportação do pipeline em CSV compatível com Excel, sem expor dados de contato protegidos.

## Testes verdes

- AT2 — Potential de açúcar: 85/100.
- AT3 — Potential de café FoodEra: 85/100.
- AT5 — Confidence independente da Completude.
- AT7 — Campo `Não se aplica` fora do denominador.
- AT10 — Risk parcial normalizado: 17,14 com Coverage 35%.
- AT11 — Risk 84 sem mitigação impede qualificação.
- AT1, AT4, AT6, AT8, AT9, AT12, AT13 e AT14 adicionados.
- Total: 14 cenários de aceite aprovados.
- Integridade do schema SQLite/D1: `ok`.
- Sintaxe do Worker, do motor de score e do frontend: válida.

## Em andamento

- Substituição completa dos registros demonstrativos por dados do D1 após provisionamento da conta Cloudflare.
- Tela de aprovação gerencial para exceções de volume, intermediário e mitigação de risco.
- Testes integrados de autorização e persistência via Worker publicado.
- Validação visual final nos navegadores desktop e móvel.

## Bloqueios externos

- Recursos D1, R2, KV e Queues ainda precisam ser criados na conta Cloudflare antes da publicação full-stack.
- OFAC requer download, checksum e importação reais testados.
- CGU requer token e teste de ingestão.
- Comex Stat requer resposta real e contrato técnico confirmado.
- Moody’s Orbis e Dun & Bradstreet dependem do envio dos RFQs e das respostas comerciais.
- Política de retenção depende de validação jurídica/DPO.

## Próximo incremento

1. Criar e vincular os recursos Cloudflare do ambiente de desenvolvimento.
2. Aplicar migrations e carregar os registros iniciais controlados.
3. Implementar a tela de aprovações e a triagem manual de sanções.
4. Testar autorização e persistência no ambiente Cloudflare.
5. Validar a experiência desktop e móvel com usuários EAG.
6. Executar varredura de segurança antes da publicação com dados reais.

## Comandos locais

```bash
npm install
npm run db:migrate:local
npm run dev
npm test
```

Nenhuma chave, senha ou token deve ser escrita no repositório. Valores locais ficam em `.dev.vars`; segredos de produção devem ser configurados no ambiente Cloudflare.
