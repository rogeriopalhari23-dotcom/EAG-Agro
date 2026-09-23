# Revisão consolidada do EAG Compass — 23/09/2026

## Base e alcance

Entrada atual: `eag-compass-20ef963-2026-09-23.zip`, SHA-256 `f73211849191734fe34747c9f602580781466aeb8b1c537d2408cde97615ac49`. Manifesto fornecido: 100 hashes conferidos, sem divergência. O ZIP anterior tinha SHA-256 `b24c8f5d6eecba8a31e53ef3c7272ebab8777049689ac6f34a47f6d6b0115690`. As correções daquela revisão inacabada foram preservadas, relidas, complementadas e testadas. Código executável idêntico entre as duas entradas; diferenças na Spec, status, contrato Comex/Comtrade, Plano 3, exemplo de variáveis e histórico. Não houve acesso ao Git original para comprovar `20ef963`.

Foram revisados runtime, regras, frontend, esquema/migrações, scripts, dependências/lockfile, CI, configuração e os três planos vigentes. O histórico permanece evidência, não instrução executável. Nenhuma credencial/conta remota, publicação, envio, lista real de sanções ou migração remota foi usada. O pacote 0.3.2 citado em Downloads não foi fornecido nem mesclado.

## Achados e correções

| Gravidade | Falha observada na entrada ou revisão intermediária | Correção/evidência |
| --- | --- | --- |
| Crítica | Identidade e admin derivados de cabeçalho forjável | JWT RS256 com emissor, audience, expiração e claims; usuário/tenant ativos. Testes de assinatura, emissor, audience, expiração, iat e identidade. |
| Crítica | Modo local como padrão de publicação | Produção fechada, local explícito + loopback, usuário seed recusado em produção, deploy com guardas. |
| Alta | Bootstrap por requisição | Removido; provisionamento explícito do administrador real, documentado. |
| Alta | Assets copiavam código de backend e SQL | Build com allowlist de quatro arquivos públicos; validação da lista exata. |
| Alta | Mutação sem controle de origem/tamanho/tipo | Same-origin, limite real de streaming 64 KB, JSON objeto, validação por campo, CSP e erros sem stack/PII. |
| Alta | Referências entre tenants/empresas insuficientes | Filtros em todas as rotas e triggers de integridade, checagem da empresa de demanda/contato. |
| Alta | Escrita de dado e auditoria separadas | D1.batch transacional; rollback testado, auditoria append-only. |
| Alta | Atualização de demanda criava novo ID no conflito | ID estável, versão esperada, identidade produto/mercado imutável na edição. |
| Alta | Completude calculada apenas sobre campos enviados | Denominador integral de campos aplicáveis; atualização parcial preserva campos antigos. |
| Alta | Valor não confirmado pontuava ou virava zero | Confirmação com fonte e valor tipado; rascunhos preservados, desconhecido fora dos componentes conhecidos. |
| Alta | Qualificação usava score histórico | Snapshot atual por demanda; nenhuma autorização deriva de último score da empresa. |
| Alta | Exceções antigas sobreviviam a alterações/rejeições | Última decisão por tipo/demanda, versões de empresa/parâmetros e invalidação. |
| Alta | Revogação concorrente podia ocorrer depois da leitura do gate | Revisão de aprovação independente, guardada no commit de qualificação; teste injeta revogação no intervalo. |
| Alta | Listas ausentes podiam parecer sanções limpas | Política, fontes ativas, versões, identidade da empresa, data e triagem completa obrigatórias. |
| Alta | Datas inválidas/futuras e JSON ruim na triagem | Estado pendente explícito; testes negativos. |
| Alta | Verificação antiga do decisor permanecia válida após rejeição | Última verificação por contato/tipo/demanda; identidade e autoridade no mesmo contato. |
| Alta | Evidência agregada/errada e data de outra prova pontuavam | Prova empresarial validada por produto/mercado; atualidade da mesma evidência escolhida. |
| Alta | Migração ingênua quebrava filhos de demandas | Reconstrução coordenada, preservação de IDs, banco legado preenchido e foreign_key_check no workerd/D1. |
| Alta | Fila confirmava mensagem sem processar | Handler desconhecido pede retry; nenhuma fila/cron ligada enquanto não há implementação. |
| Alta | Simulação de e-mail enviado e empresas demonstrativas | Removidos; UI só representa dados da API, envio declarado indisponível. |
| Alta | CSV podia executar fórmulas em planilha | Escape de células perigosas; exportação paginada dos resultados filtrados. |
| Média | Banco limitado a café/açúcar e regra v1.3 | Migração com catálogo de 28 itens e regras v2; CSO permanece pendente. |
| Média | Gate bloqueava intermediário genericamente | Perfil comprador contextual; exigência de final buyer só quando registrada na demanda. |
| Média | Mínimo de fornecedor dependia de texto livre | Mínimo genérico por commodity/mercado; mínimo de fornecedor só entra após oferta versionada vinculada. |
| Média | Localização manual podia fabricar logística nacional | Pontos de localização aguardam adaptador de unidade/campanha, não flags do formulário. |
| Média | Edições concorrentes sobrescreviam dados | Revisões/CAS em empresa, demanda, campanha, parâmetros e decisões. |
| Média | Duas variantes consumiam duas vagas de commodity | Limite atômico por commodity e mercado; terceira commodity fica waiting. |
| Média | Dedup de registro tinha corrida | Normalização CNPJ e trigger no banco contra novas duplicações, além da checagem amigável da API. |
| Média | Consulta de 100 demandas exigia 101 binds | Subconsulta paginada com cinco parâmetros; regressão com limite de 100 imposto no adaptador de teste. |
| Média | Formulário mandava número de rascunho como texto | Conversão por tipo também para não confirmados; fluxo real de navegador testado. |
| Média | Paginação incompleta de campanhas/supressão/pausas | Controles anterior/próxima, sem instruir usuário a consultar API. |
| Média | Clique repetido duplicava ação enquanto aguardava | Botão fica indisponível durante a própria requisição; mutação sem retry automático. |
| Média | Recálculo igual multiplicava scores e auditorias | Compara snapshot/versão/componentes após recalcular gate; reutiliza registros idênticos. |
| Média | Setup podia produzir configuração inválida ou mudar material de chave | Chaves existentes preservadas, vazias completadas, inválidas/duplicadas recusadas; teste em diretório isolado. |
| Média | Import de caminho Windows inválido | pathToFileURL e subprocessos Node portáveis; CI com matriz Windows/Linux. Windows ainda precisa executar remotamente. |
| Média | Infraestrutura prevista era confundida com operação | Retirados bindings ociosos; capabilities e docs atuais distinguem runtime e planejamento. |
| Média | Documentos antigos diziam 14 testes e código sem revisão | README/status/relatório/fila atuais; originais arquivados; manifesto e commit de revisão. |

## Revisão dos planos futuros

A errata é obrigatória: `CORRECOES-DOS-PLANOS.md`. Nacional: KV não trava envio, IMAP vazio não comprova falha SMTP, hash por mensagem não é hash de ficha, pausas por commodity abrangem variantes e supressões precisam anteceder importação de contatos. A habilidade comercial original e validações externas não foram inventadas.

Internacional rev. 2: corrigido contrato de fronteira de CSV, consistência de versão da fonte, limite de memória, idempotência de fila e consolidação R2/D1, recuperação de cron incompleto, orçamento real incluindo retentativas, tratamento de zero/ausência e truncamento, reaproveitamento do MDIC no refresh manual e retenção de snapshots referenciados. Essas correções orientam implementação: **os adaptadores e a rotina mensal ainda não existem no runtime**. Os requisitos novos AT71–AT75 estão na fila, sem serem marcados como testes executados.

## Economia e eficiência

Nenhuma chamada a LLM existe no runtime; não há tokens por score, gate, filtro ou cadastro. A fila local de 42 tarefas e `CLAUDE.md` reduzem contexto repetido na continuação. Código foi formatado para revisão/manutenção; não há framework frontend novo. As únicas dependências de runtime são jose e suas necessidades transitivas registradas no lockfile. Ferramentas de navegador/formatação usadas nesta revisão ficaram fora das dependências do produto.

Cache local de chaves, lotes D1, paginação, índices e reutilização de scores iguais reduzem trabalho repetido. Permissões, supressão, sanções e aprovação não são caches permissivos. O job de CI cancela execuções superadas da mesma branch. Nenhuma porcentagem de economia financeira é afirmada: falta medir carga e conta reais. O custo antigo estimado de US$ 5/mês não foi validado.

## Limites conhecidos e sequência

- Cadastro básico por empresa; unidades, CNPJ raiz, perfil por commodity/campanha e fuzzy dedup permanecem no Plano 2. A migração preserva eventuais duplicações antigas em vez de apagar dados silenciosamente.
- Administrar catálogo/códigos/características, editar ICP pela interface e completar parâmetros operacionais são tarefas parciais explícitas. Catálogo inicial sem códigos inventados; identidade pendente bloqueia uso.
- O gate só terá utilidade operacional plena com sanções reais e política aprovada. Não existe importador de sanções nesta entrega. Fixture não substitui validação remota.
- Pausas/supressão são registradas; não há executor de mensagens para consumi-las ainda. Cadastro de campanha internacional não inicia busca e não comprova compra por país.
- Fontes tipográficas licenciadas e telas dos módulos futuros aguardam sua implementação; a UI atual usa fallback do sistema.
- A criptografia mantém o formato legado AES-GCM. Rotação/versionamento de chaves e retenção exigem política e migração próprias; não perder as chaves existentes.
- Migrações testadas localmente; produção precisa backup/restauração comprovados. 0003–0005 desta entrega são para banco na linha original 0001–0002; se outra revisão experimental já foi aplicada, produzir migração incremental.
- Não há promessa de sistema infalível. O que foi comprovado e o que falta estão registrados; não converter ausência de teste em aprovação.

## Fontes técnicas

Consultadas na revisão, aplicadas aos pontos técnicos correspondentes:
- JWT Access: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Lotes transacionais: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Limite de parâmetros D1: https://developers.cloudflare.com/d1/platform/limits/
- Consistência de KV: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- SMTP e respostas: https://www.rfc-editor.org/rfc/rfc5321.html (a ausência em Enviados não é confirmação SMTP; conclusão de desenho).
- Modelo de cobrança: https://developers.cloudflare.com/workers/platform/pricing/ e https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Limites gerais Comtrade: https://uncomtrade.org/docs/subscriptions/ (confirmar contrato, quota e termos da conta concreta antes da ativação).
