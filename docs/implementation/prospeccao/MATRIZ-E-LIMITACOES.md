# Prospecção automática: funções preservadas e limitações (2026-10-20)

Branch `redesign-interface`. Não publicado. A migração `0045_prospeccao_automatica.sql` existe só no repositório e não foi aplicada no D1 remoto.

## Percurso principal

- **O que a pessoa informa** (Prospecção, Radar Nacional, Radar Internacional ou Rodadas → "Iniciar prospecção"):
  - commodity e produto (seleção pesquisável; o produto só é pedido quando há variedades);
  - mercado;
  - estado, cidade e raio (nacional) ou país (internacional).
- **O que o servidor faz sozinho, em segundo plano**, com estado persistente, sem depender do navegador (exceto o mapa, abaixo):

| Etapa | Nacional | Internacional |
|---|---|---|
| 1. Segmentos compradores | Perfil comprador (versionado) ou sugestões por commodity | Fontes previstas pelo perfil |
| 2. Fontes | Receita e mapa colaborativo, conforme os segmentos | Cobertura real por país (FR, NO, DE café, mapa) |
| 3. Descoberta | Mapa colaborativo no raio | Fontes gratuitas do país |
| 4. Consulta cadastral e conciliação | **Site da empresa:** CNPJ publicado (dígitos conferidos) e Receita | Registro do país quando a fonte é oficial |
| 5. Deduplicação e reaproveitamento | Estabelecimento por CNPJ; reexecução e nova prospecção reaproveitam | Busca por campanha; candidatas não duplicam |
| 6. Evidências e canais | Canal geral do próprio domínio, com a página como fonte (e-mail com nome de pessoa fica de fora) | Aviso legal (Impressum) quando há site; a pessoa encontrada aguarda aceite |
| 7. Compatibilidade e prioridade | Médias > pequenas > grandes com canal > micro; operação comprovada antes | Mesma ordem de porte |
| 8. Triagem de sanções | No cadastro | Por empresa |
| 9. Cadastro em descoberta | Pela rodada (modo descoberta), com rastreio da política | Candidata com identificador ou site |
| 10. Relatório | Andamento, candidatas, cadastradas, prioridade, fila de exceções, próxima ação | O mesmo, com as fontes pendentes |

- **Comportamentos do motor:**
  - limite por fonte compartilhado (Receita 3/min), com espera e retomada automáticas;
  - 429 e indisponibilidade com até 2 novas tentativas;
  - etapa sem suporte fica pendente, e as independentes seguem;
  - pausa, retomada e cancelamento;
  - lease impede execução duplicada;
  - limite de 80 ciclos por prospecção;
  - cron de 5 minutos e fila retomam o que venceu.

## Funções preservadas (fora do percurso principal)

| Função | Onde fica |
|---|---|
| Rodada manual: configuração em 4 passos, ciência, área, importação de arquivo (MAPA SIPEAGRO, CSV, JSON), pesquisa assistida, OSM pelo navegador, execução, decisão em lote, cadastro em descoberta ou só aceitas, triagem opcional, exportação, anotações | Rodadas → "Recursos complementares"; cada rodada criada pela prospecção abre na mesma tela |
| Radar Nacional por campanha (Casa dos Dados, paga) e mapa | Radar Nacional → "Recursos complementares" |
| Radar Internacional: indicadores por país, análise, seleção, autorização manual, descoberta, aceite e descarte, validação assistida, GLEIF, pessoas, lista mensal | Radar Internacional → "Indicadores por país, análises, buscas e lista mensal" |
| Revisão de exceções e conflitos | Prospecção → "Pendências para análise" → rodada (Conferir) ou busca do país |
| Auditoria, procedência e anotações | Registro das etapas na prospecção; Compliance e auditoria; anotações na rodada |
| Perfil comprador e política | Configurações → Prospecção automática (versões, concessão e revogação) |
| Fichas, T11, supressões, pausas, canais, campanhas, envios | Sem mudança: nenhuma ficha é criada nem aprovada, nenhuma campanha ativada, nenhuma mensagem enviada pela prospecção |

## Limitações concretas restantes

1. **Mapa colaborativo pelo servidor:** o servidor público recusa a Cloudflare (521/522, registrado em 27/09). Em produção, a etapa ficaria "depende do navegador":
   - o painel faz a consulta quando a prospecção está aberta, e isso é dito na tela;
   - ou a pessoa escolhe "Seguir sem a busca no mapa".
   - **Alternativa proposta, não implementada:** fila própria de consultas executada pela ponte, separada do e-mail (`../PLANO-CONSULTAS-FORA-DA-CLOUDFLARE.md`). Exige versão nova da ponte e decisão.
2. **Café no Brasil: o mapa não basta, mas a cobertura não é zero** (correção de 20/10; a conclusão anterior, "a descoberta gratuita não encontra candidatas", generalizava uma consulta só):
   - verificação real em 20/10, deste computador (não da Cloudflare): etiqueta de torrefação no mapa a 150 km de Guaxupé deu **0 objetos**. A busca por nome ("torrefa…") **passou de 90 s** e não foi repetida, para respeitar o servidor público;
   - isso mostra só a falta de candidatas **naquela consulta e naquela fonte**, mais um tempo esgotado. Não prova ausência de compradores;
   - **fonte complementar implementada:** ABIC, produtos certificados (`src/adapters/abic.js`). É a lista pública na página de certificações: 312 industrializadores em 20/10 (MG 91, SP 62), com nome e estado da fábrica. O robots.txt permite;
   - limite da ABIC: **sem CNPJ nem município**. Cada torrefadora entra como candidata provisória ("compradores prováveis a identificar"), com o estado. Sem CNPJ nada é cadastrado e a distância fica desconhecida;
   - o relatório mostra o resultado e a situação de cada fonte (mapa, ABIC, site da empresa, Receita) e marca a pesquisa como **parcial** quando alguma etapa ou fonte falta.
3. **Sem busca de CNPJ por nome gratuita:** Receita e publica.cnpj.ws só consultam o CNPJ. Candidata do mapa sem site, ou com site sem CNPJ publicado, fica na fila de exceções.
4. **MAPA SIPEAGRO:** o portal recusou acesso automatizado (HTTP 403 em 20/10). Continua como importação manual.
5. **Canais no Brasil:** só e-mail geral publicado no site da própria empresa. Telefone, LinkedIn e pessoas de compras no Brasil continuam pelos fluxos existentes.
6. **Internacional:**
   - cobertura gratuita só onde há fonte implementada (França e Noruega por registro; Alemanha/café por diretório; mapa conforme o país);
   - fora disso, a etapa fica pendente;
   - o idioma e o fuso por país usam a tabela de países (fuso UTC quando não há base).
7. **Testes:**
   - motor, interface e prévia usam fontes **simuladas** (`tests/helpers/simulated-world.mjs`);
   - consultas reais feitas deste computador: 2 ao Overpass (item 2), 5 à ABIC (página inicial duas vezes, associados, certificações, robots.txt) e 1 ao SIPEAGRO (403). Nenhuma consulta real à Receita.
   - O comportamento da Cloudflare (recusa do mapa) não pôde ser verificado sem publicar.
8. **Emenda:** a seleção e a busca no exterior pela política dependem da emenda proposta da R12.7 (`EMENDA-PROSPECCAO-AUTOMATICA.md`).
