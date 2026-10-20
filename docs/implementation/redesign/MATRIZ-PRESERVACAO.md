# Redesign da interface (2026-10): matriz de preservação

Branch `redesign-interface`, criada a partir de `87e47c9`. Nada foi publicado. Produção segue com os canais `planned`, as campanhas inativas, a cópia interna desligada e a T11 pendente.

## O que mudou

A mudança é só de organização e visual. As rotas, as regras do servidor e os bloqueios são os mesmos.

- **Menu lateral agrupado**: Visão geral · Descoberta (Rodadas, Radar Nacional, Radar Internacional) · Organização (Empresas) · Abordagem (Fichas, Tarefas, Envios e respostas, Campanhas) · Administração (Configurações, Compliance e auditoria).
  - As chaves de tela não mudaram, então todo `navigate()` interno continua funcionando.
  - Os nomes antigos (Início, Hoje, Radar, Internacional, Abordagem) continuam como apelidos.
- **Jornada em 6 etapas**: Descobrir → Organizar → Qualificar e priorizar → Identificar e preparar → Abordar → Acompanhar.
  - É só navegação: não cria estado comercial, não promove empresa e não libera ação.
  - O botão "Continuar em" volta à última rodada e à última empresa abertas.
- **Visão geral**:
  - a rodada em andamento, com continuidade;
  - o estado do canal, da parada automática e da leitura da ponte;
  - quatro colunas: disponível, aguardando, bloqueado e concluído;
  - empresas por estágio já existente, sem os testes internos;
  - prazos das listas de sanções, da validação de e-mail e da retenção A1;
  - atalhos.
- **Rodada**:
  - faixa de progresso: configuração, ciência, candidatas, execução (reaproveitadas, adiadas e falhas), conferência, cadastro e fase da pesquisa pública;
  - atalhos para cada painel;
  - criação em assistente de 4 passos sobre o mesmo formulário.
- **Empresa**: o resumo mostra primeiro a unidade (nome, município, CNPJ) e o que está comprovado.
  - Uso da commodity, compra de terceiros e importação do Brasil aparecem separados, cada um como confirmado, indício, conflito, refutado ou desconhecido, conforme a validação das evidências.
- **Compliance e auditoria**: tela nova, somente leitura (T11 por escopo, canais, listas de sanções, trilha de auditoria paginada). Ela não grava nada.
- **Backend** (somente leitura, com testes em `tests/painel-redesign.test.mjs`):
  - `/api/dashboard` ganhou `prospectPipeline` e `internalTests` (nome começando por TESTE); o `pipeline` original segue igual;
  - `/api/sending/today` ganhou `reader`: última leitura, se está no prazo de 10 minutos e a fonte. Isso só informa; não libera envio.

## Função atual → localização nova

| Função (tela antiga) | Onde fica agora |
|---|---|
| Início: aviso do canal, próximas ações, funil, retenção A1 | Visão geral: cartão "Canal e ponte", colunas Disponível/Aguardando/Bloqueado/Concluído, "Empresas por estágio", "Prazos e validade" (a linha da retenção A1 continua com o mesmo texto) |
| Radar Nacional, buscas, mapa, painel da empresa | Descoberta → Radar Nacional (sem mudança funcional) |
| Radar Internacional: países, análise, autorização de busca, empresas estrangeiras, revisão de decisão, GLEIF, pessoas | Descoberta → Radar Internacional (sem mudança funcional) |
| Lista mensal | Radar Internacional → "Abrir a lista mensal completa" (sem mudança) |
| Rodadas: lista, nova rodada | Descoberta → Rodadas; "Nova rodada" em 4 passos (objetivo e commodity → local e alcance → fontes e limites → revisar e criar). Todos os campos (variedade, país, UF, município, IBGE, coordenada, raio, unidade, perto do limite, idioma, fuso, escopo, fase da pesquisa e bloco avançado com especificação, segmentos, fontes e prioridades) foram mantidos |
| Rodada: limitações e ciência, área, candidatas (OSM, importação, pesquisa assistida), executar, filtro, decisão em lote, cadastro (descoberta/aceitas, triagem, autorização), exportação JSON/markdown, anotações, editar configuração | Na mesma tela da rodada, com a faixa de progresso e os atalhos. Ações, textos e confirmações não mudaram |
| Empresas: busca, filtros, contagem, exportação, cadastro | Organização → Empresas (sem mudança funcional). A etapa da jornada muda conforme o filtro, mas o filtro não altera nenhuma empresa |
| Empresa: resumo, abas, demandas, scores, evidências, contatos, pessoas, risco, exceção, perfil, ficha, validação de e-mail, histórico | Mesma tela e mesmas abas. O resumo ganhou "Unidade" e "O que está comprovado" |
| Fichas: lista, revisão, aprovação individual, nova versão, adiar, descartar, variantes de saudação e idioma | Abordagem → Fichas (é a mesma tela de abas Fichas/Envios/Tarefas) |
| Envios: canal, fila, resolver indeterminado (administrador), respostas | Abordagem → Envios e respostas |
| Tarefas: bloqueadas com motivo, suspensas, roteiro, telefone, oposição, resultado | Abordagem → Tarefas. Os motivos `compliance_unavailable` e `campaign_not_active` agora aparecem em texto |
| Campanhas: criar, ativar, pausar, ICP, declarações | Abordagem → Campanhas (continua também em Configurações) |
| Catálogo, Setores e CNAE, Parâmetros, Supressão, Pausas | Administração → Configurações (sem mudança) |
| T11, canais, listas de sanções, auditoria | Administração → Compliance e auditoria (só leitura; antes só havia acesso pela API) |

## Garantias mantidas

- **Servidor**: o servidor continua conferindo cada operação. Nenhum botão novo grava dado; o assistente, os filtros e a jornada só reorganizam a tela.
- **T11**: as tarefas bloqueadas pela T11 aparecem em "Bloqueado", com a explicação "Não são contatos prontos para hoje". Continuam acessíveis em Tarefas.
- **Testes internos**: ficam fora das contagens e têm etiqueta e atalho próprios.
- **Estados**: todo estado tem texto além da cor (etiquetas, pontos de status e "atenção" nos prazos).
- **Movimento**: `prefers-reduced-motion` desliga as animações.
- **Teclado e telas pequenas**:
  - foco visível;
  - alvos de 40–48 px;
  - sem rolagem horizontal em 390 px e em 1440 px (conferido nas capturas).

## Prévia local (dados fictícios)

```
node tests/preview-server.mjs            # interface nova em http://127.0.0.1:8790
```

O servidor da prévia usa um D1 em memória com todas as migrações. A rede fica bloqueada e a Receita é simulada.

Os dados são fictícios:
- empresas marcadas "(fictícia)" e um registro "TESTE INTERNO";
- fichas em aprovação, nenhuma aprovada;
- tarefas bloqueadas pela T11;
- duas rodadas;
- canal `planned`.

Para ver a interface anterior com os mesmos dados:

```
git worktree add ../compass-antes 87e47c9
PREVIEW_PUBLIC=../compass-antes/public PREVIEW_PORT=8791 node tests/preview-server.mjs
```

## Como voltar à interface anterior

- Antes de publicar: basta não fazer o merge da branch `redesign-interface`. Os arquivos visuais são `public/app.js`, `public/app.css` e `public/index.html`.
- Depois de um eventual merge: `git revert` dos commits do redesign, ou `git checkout 87e47c9 -- public/` seguido de commit.
- As adições de backend são só leitura e podem ficar.
