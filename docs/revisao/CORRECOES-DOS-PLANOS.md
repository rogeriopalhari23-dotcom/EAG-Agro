# Correções transversais dos planos — 23/09/2026

Estas correções técnicas acompanham a autorização atual de revisar e corrigir o projeto. Não registram novas aprovações comerciais nem conclusão dos planos futuros. Ler este documento antes de executar contratos antigos dos três planos.

## Fundação

- O artefato real é JS nativo, não o esqueleto TypeScript do último commit informado. Não mesclar a versão 0.3.2 sem recebê-la e comparar seu conteúdo.
- Produção deve começar fechada: JWT Access validado, usuário explicitamente cadastrado no D1, nenhum bootstrap por cabeçalho. O usuário `system-admin` só é utilizável na autenticação local explícita e em loopback. Primeiro usuário real é provisionado por SQL revisado, não pela primeira requisição.
- Migração 0003 precisa reconstruir demandas **e tabelas filhas**, preservar dados e testar chaves estrangeiras. Apenas diferir FKs não passou no teste preenchido. O SQL entregue é a referência executável; o código SQL ilustrativo do plano não deve substituí-lo.
- Na versão de Wrangler fixada, `CASE … END` dentro de trigger foi dividido incorretamente pelo separador SQL. Os triggers da migração usam instruções separadas, testadas em workerd/D1.
- Demandas identificadas por tenant, empresa, produto e mercado; atualização com ID estável e versão esperada. Não reutilizar a UNIQUE antiga só por commodity.
- O máximo ativo é por **commodity**, não por variante/produto. Milho GMO e não GMO não consomem duas vagas.
- Fórmulas v2 não autorizam usar evidência de mercado como compra, data de um documento para outro, mínimo de fornecedor sem oferta vinculada, valor sem fonte ou decisão revogada.
- Auditoria e mutação devem confirmar ou reverter juntas. Supressão e alterações concorrentes também.
- Chave HMAC de supressão inclui tenant e canal. Nunca trocar a chave sem estratégia de consulta às versões antigas/reindexação; isso faria descadastros desaparecerem das consultas.
- Uma característica com `sample_only=1` não é mencionável como característica de oferta, mesmo se seu laudo estiver confirmado. O contrato original de `mentionableCharacteristics` filtrava só `confirmed` e deve filtrar também o escopo/amostra.
- Este pacote usa testes nativos Node, SQLite real e workerd/D1, em vez do harness Vitest proposto. Objetivo e casos são preservados, com menos dependências diretas. O script de importação usa `pathToFileURL`.

## Piloto nacional

1. **Travas KV não são exclusão mútua.** Implementar aquisição condicional e atômica em D1 para o remetente/rodada, com proprietário, validade, contagem do dia e próximo horário. Testar múltiplos consumidores. Não usar leitura+gravação KV como trava de SMTP ou IMAP. Caso a transação D1 não cubra a coordenação necessária, avaliar um Durable Object por remetente com custo medido.
2. **Ausência na pasta Enviados não prova que o SMTP não aceitou.** `indeterminate` continua bloqueado para reconciliação; não voltar automaticamente a `pending` por resultado IMAP vazio. Registrar confirmação SMTP, falha definitiva anterior à aceitação ou decisão humana auditada. Message-ID estável ajuda rastreabilidade, mas não garante deduplicação no destinatário.
3. **Hash do texto aprovado:** distinguir hash da versão completa da ficha e hash do conteúdo exato de cada mensagem/recipiente. O teste deve comparar os bytes realmente submetidos ao SMTP com os aprovados, sem regeneração no envio.
4. **Pausa por resposta:** usar empresa + commodity, abrangendo variantes dessa commodity, não só `product_id`. Resposta automática ou ilegível mantém pausa até decisão; não inventar B1.
5. **Sanções:** não adotar 30 dias só porque o plano os chamou de “decisão”. A validade e fontes exigem parâmetro aprovado. Todas as fontes necessárias precisam estar disponíveis/atuais; uma lista qualquer não satisfaz o conjunto. No pacote, a ausência de política/listas/triagem bloqueia o gate.
6. **Tarefas e canais:** supressão, sanção e pausas devem valer também para tarefas manuais. Remoção de supressão, retenção e processamento de PII aguardam política T11.
7. **Resposta/remetente:** correlação deve considerar múltiplas campanhas e aliases; mensagem ambígua não pode liberar envio. Não confiar apenas no texto do remetente para executar ações administrativas.
8. **Descadastro público:** manter GET de confirmação e POST de um clique; validar token, tornar persistência idempotente e não exigir login. A exceção de Access deve ser estritamente `/u/*`, testada sem ampliar o bypass para API/arquivos internos.
9. **Busca por raio:** guardar origem, raio, versões das fontes, precisão, partições e falhas. Centróide de município é estimativa, não localização exata. Fonte parcial não vira “nenhuma empresa”.
10. **Dados externos e habilidades:** adaptadores precisam de fixtures e teste real das credenciais/limites. `/prospeccao-vendas` não foi fornecida; geração e aprovação de fichas comerciais permanecem pendentes. A licença e o método da habilidade não são substituídos por texto inventado.
11. **OpenClaw:** inventário/exportação reais ausentes. Importar supressões antes dos contatos e registrar retirada do sistema anterior antes de ativar a nova operação.

## Internacional — Plano 3 revisão 2 vigente

A consulta sob demanda à API Comex Stat foi substituída pela lista mensal MDIC + Comtrade. Não implementar novamente a arquitetura antiga de análise externa a cada país aberto. Preservar R12.11–R12.15 e AT71–AT75 da Spec vigente.

1. **Fronteira do CSV:** descartar sempre a primeira linha do pedaço `n > 0` perde uma linha quando `start` já é início de registro. Solicitar também o byte anterior; descartar somente se ele não encerra uma linha. Testar fronteira exatamente após LF/CRLF, no meio de registro, última linha sem newline e cabeçalho. Uma linha maior que a margem de 64 KB exige extensão controlada ou erro explícito; jamais truncamento silencioso.
2. **Versão consistente do arquivo:** guardar ETag/Last-Modified e tamanho; validar 206/Content-Range e usar condição de versão entre pedaços. Se a fonte mudar durante a leitura, descartar a tentativa e recomeçar só a versão afetada. Não combinar partes de duas publicações.
3. **Memória/CPU:** 8 MB é tamanho de entrada, não limite do Map/JSON agregado. Medir pior caso no workerd e particionar staging também por país/bloco quando necessário. Não presumir que `cpu_ms: 300000` resolverá memória, nem que aumentá-lo reduzirá preço.
4. **Idempotência real:** UNIQUE de job não torna processamento/totalização idempotente. Adquirir trabalho atomicamente com lease e fencing token. Resultado por chave determinística e hash; publicar o objeto completo antes de avançar o ponteiro D1 por CAS. A mesma mensagem entregue duas vezes deve produzir o mesmo total. R2 e D1 não formam uma transação única.
5. **Cron recuperável:** encontrar a versão do mês existente deve retomar os jobs pendentes e a outbox ainda não publicada. Sair simplesmente porque a versão existe deixa a rotina incompleta após uma queda entre criar versão e enfileirar. Testar queda nesse intervalo e durante consolidação.
6. **Orçamento Comtrade:** três chamadas por país é hipótese até validar combinações/parceiros/anos/tamanho de código com a chave real. Contar disponibilidade, referências, retentativas e atualização manual conforme a política efetiva do provedor. Reserva global persistente/atômica; `delaySeconds` não controla quantas chamadas os consumidores realmente fazem por janela. Ao esgotar o orçamento, manter `next_attempt_at` em D1 e reativar depois, sem busy loop ou mensagens que só esperam.
7. **Ausência e zero:** `netWgt || null` apaga um zero declarado. Preservar valor e indicador de estimativa/ausência da fonte; converter zero em ausência somente quando o contrato oficial comprovar esse significado. `count == limite` é suspeita de truncamento, não prova de completude para contagens menores. Validar paginação, metadados, filtros totais e todas as partições esperadas.
8. **Cobertura temporal:** período nacional/mensal e Comtrade anual precisam de rótulos distintos. País atrasado continua com o último ano disponível. Denominador zero/ausente na participação do Brasil gera participação desconhecida; nunca divisão infinita nem soma de CIF com FOB. Não duplicar agregado SH6 quando múltiplas variantes do catálogo correspondem à mesma linha.
9. **Custo do refresh manual:** não apagar imediatamente todo o staging que o próprio contrato pretende reutilizar. Manter agregados por fonte/versão e validadores de arquivo por retenção explícita. Atualização manual de um país deve reutilizar MDIC já completo, baixando novamente só quando a fonte mudou ou expirou conforme a política aprovada.
10. **Retenção e auditoria:** a poda protege versões referenciadas por `trade_list_current`, `country_analyses`, seleções e fichas, além dos jobs ainda em execução. Uma análise imutável não pode apontar para objeto removido. Snapshot/hash não substitui o conteúdo necessário para reproduzi-la.
11. **Segredos:** preferir header oficial de chave quando suportado e comprovado. Se a API exigir query string, retirar o segredo de URLs, exceções e tracing antes de qualquer persistência; não registrar o corpo bruto da falha.
12. **Seleção comercial:** a checagem de lista deve existir no serviço, incluindo chamadas diretas à API; não só no botão. `identity_status=pending` impede ativação até identidade e oferta aprovadas. Agregado de país não confirma comprador nominal nem alimenta Confidence.
13. **Migrações de fontes:** nomes/países/códigos versionados com origem e classificação. Adaptar ISO3 dos relatórios ao ISO2 de empresas por tabela oficial, não por truncamento. Confirmar a compatibilidade temporal dos códigos históricos antes de somar sob o país atual.
14. **Fusos e canais:** limite diário único do remetente para Nacional + Internacional; janelas e intervalo por destinatário; testar viradas de data e DST. Feriados continuam limitação declarada até existir fonte aprovada.

## Consistência documental

O AT37 usava raio 150 km, incompatível com os passos de B3/AT66 vigentes. Foi corrigido para 200 km. EX-PN1 passa a raio 100 km com endereço a 80 km; EX-PN5 usa 180 km fora desse raio. Os resultados numéricos dos exemplos não mudam.

Fontes técnicas consultadas em 23/09/2026:
- https://developers.cloudflare.com/kv/concepts/how-kv-works/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://www.rfc-editor.org/rfc/rfc5321.html (em especial responsabilidade pela mensagem e respostas SMTP; conclusão sobre a pasta Enviados é uma inferência de desenho, não uma garantia do provedor).

Referências adicionais conferidas na consolidação:
- https://developers.cloudflare.com/d1/platform/limits/ (limite de 100 parâmetros por consulta)
- https://uncomtrade.org/docs/subscriptions/ (limites gerais da modalidade gratuita; validar conta e contrato concreto antes da ativação)
