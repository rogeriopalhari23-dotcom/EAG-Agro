# Redesign da interface (branch `redesign-ui`, 30/09/2026)

Reformulação da experiência e do visual do EAG Compass, sem mudar regras de negócio. Não publicado em produção.
Capturas antes/depois nesta pasta (`antes/`, `depois/`), desktop 1440 px e celular 390 px. Dados das capturas "depois":
ambiente local de teste (empresas marcadas "(teste)"), nunca produção.

## Problemas encontrados (antes)

- 13 itens de navegação no mesmo nível; no celular, faixa horizontal cortada; em páginas longas o menu caía abaixo do conteúdo.
- "Hoje" com um "0" gigante e painéis genéricos, sem próxima ação concreta.
- Página da empresa: ~14 blocos e formulários empilhados; o resumo (quem é, etapa, pendência) não aparecia.
- Busca internacional: métricas e ferramentas antes das empresas; cartão de empresa com ~10 linhas e 5 botões visíveis.
- Tema escuro com amarelo, títulos em caixa alta condensada, cartões e bordas em tudo.

## Navegação (6 itens)

| Item | O que reúne |
| --- | --- |
| Início | o que precisa de atenção agora: estado do envio, fichas a aprovar, tarefas, envios bloqueados, empresas em qualificação; atalhos para os dois radares; funil |
| Radar Nacional | commodity + cidade do fornecedor (campanha ativa) + raio → compradores em lista e mapa |
| Radar Internacional | buscas em andamento; países importadores do Brasil → commodity → empresas; fontes e lista mensal sob demanda |
| Empresas | lista e página da empresa (resumo + abas) |
| Abordagem | abas Fichas · Envios · Tarefas |
| Configurações | Campanhas, Catálogo, Setores e CNAE, Lista mensal, Parâmetros, Pausas, Supressão |

Nenhuma tela foi removida: as antigas continuam acessíveis pelos mesmos nomes internos (atalhos de código preservados).

## Composição

- **Uma ação principal por contexto** (botão verde); secundárias em "Mais ações" ou em blocos recolhidos.
- **Bloqueios visíveis**: estado do canal de e-mail no Início com o motivo; cobertura parcial da busca em destaque; Radar
  Nacional sem campanha ativa explica o motivo e oferece "Criar campanha"/"Ver campanhas".
- **Radar Nacional**: formulário curto (commodity e cidade, raio) → "Buscar compradores"; resultado em lista + mapa
  esquemático (centro, círculo do raio, posição relativa de cada unidade; ponto cheio = endereço, vazado = centro do
  município, estimativa). Sem mapa de fundo: a política de segurança do site só permite imagens locais; usar ladrilhos
  externos exigiria mudar essa política (decisão à parte).
- **Painel lateral**: "Abrir" em um comprador mostra a empresa sem sair da lista; ações registradas no painel atualizam o
  próprio painel; "Abrir em tela cheia" disponível; fecha com Esc.
- **Empresa**: resumo no topo (etapa, por que pode comprar, porte com indicação de incerteza, contato e responsável,
  evidências, pendência principal com a próxima ação) e abas Resumo e demanda · Contatos e pessoas · Evidências e perfil ·
  Ficha. Os blocos e formulários são os mesmos de antes, agrupados.
- **Busca internacional**: empresas primeiro; grupos vazios viram uma linha; candidata sem sinal próprio abre sozinha;
  "Descobrir mais empresas", "Cobertura, custo e rendimento", roteiro, fontes e registros recolhidos. Cartão compacto:
  status, por que pode comprar, porte, contato, próximo passo; "Abrir empresa" + "Mais ações" + "Detalhes, evidências e
  pessoas".
- **Estados distintos preservados**: contato encontrado, cargo, responsabilidade de compra e autorização continuam como
  estados separados (textos do servidor); dado do país continua sinalizado como não prova de importação da empresa;
  traders à parte; porte só ordena.

## Visual

Tema claro; verde EAG como único acento (amarelo só na marca); IBM Plex Sans + IBM Plex Mono (números), locais, OFL 1.1;
um só raio (8 px controles, 12 px painéis); estados sempre com texto; contraste AA; menu lateral fixo no desktop e gaveta
no celular (≤ 860 px). Fontes Roboto e Barlow removidas.

## Mudanças fora da interface (somente leitura)

- `src/search.js`: candidatos da busca nacional devolvem `lat`/`lon` da unidade (para o mapa).
- `src/companies.js`: contatos da empresa devolvem `contactKind` (pessoa × canal geral) para o resumo.
- `scripts/validate-site.mjs`: licença exigida para cada família de fonte presente (antes, lista fixa).

## Validação

- `npm run check`: 362 + 2 testes, build e validação do site.
- `tests/ui-smoke.mjs` (Playwright + Chrome): fluxo completo com a nova navegação, sem erros de JavaScript, 390 px com menu.
- `tests/ui-preview.mjs`: capturas de 11 telas em desktop e celular, sem rolagem horizontal e sem erros no console.
- `tests/ui-keyboard.mjs`: atalho "Pular para o conteúdo", navegação, foco visível, painel lateral (Esc), abas, menu no celular.

## Fase 2 (30/09/2026)

Capturas em `fase2/antes/` (interface original, mesmos dados de teste) e `fase2/depois/`, desktop e 390 px.

- **Ficha para aprovação**: resumo (situação, aprovações x de y, finalidade e idioma, revisor); lista "Antes de aprovar"
  com as condições que o servidor confere (revisor, ficha aberta, campanha ativa e sem mudança, canal de e-mail) e o
  motivo de cada pendência; um bloco por destinatário e canal com estado (aguardando/aprovado/invalidado), fuso visível,
  primeira mensagem aberta, aviso de fuso não confirmado e a frase "a aprovação vale exatamente para os N textos acima
  (versão X)". Gerar nova versão, Adiar e Descartar foram para "Outras ações". O servidor continua sendo quem decide.
- **Formulários da empresa**: demanda em grupos (Produto e volume aberto; Entrega, Pagamento, Comprador e compliance
  recolhidos com "x de y preenchidos"); a fonte só aparece quando o campo deixa de ser "Não confirmado". Evidência: a
  categoria explica o que conta como prova e filtra o tipo (rótulos em português); produto e mercado só para prova de
  compra; data do fato e validação recolhidas. Contato: "Quem é", "Como falar" (e-mail e fuso com sugestões) e "Outros
  canais" recolhido.
- **Empresas**: filtros por etapa, país (Brasil/exterior), contato (com/sem) e perfil ICP; aplicam ao escolher, valem na
  paginação e na exportação; linha com etapa, perfil e contato; "Abrir" usa o painel lateral. Backend: parâmetros de
  leitura em `GET /api/companies` (`country`, `contact`, `profile`) e colunas `contacts_count`, `profile_class`, `icp_status`.
- **Análise do país**: etapas País › Escolher commodity › Buscar empresas; commodities como lista marcável (linha
  inteira clicável, valor à direita, "no catálogo EAG"); barra fixa com o que está marcado e "Escolher commodity".
- **Revisão para decisão**: cinco decisões numeradas com estado em texto (verde só quando o servidor diz aprovada/
  configurada), conteúdo completo ao abrir; candidatas em linhas compactas com recomendação, porte, contato e "por que e o
  que falta"; reclassificação e sites inacessíveis recolhidos.
- **Resumo da empresa**: se já existe ficha aguardando aprovação, a pendência principal passa a ser "Revisar e aprovar".
- **Mapa**: proposta em [MAPA.md](MAPA.md) (Protomaps/OpenStreetMap no R2 da própria conta; CSP: só `blob:` em `img-src`). Não implementado.

Validação: `npm run check` (363 + 2), `tests/ui-smoke.mjs`, `tests/ui-keyboard.mjs`, `tests/ui-preview.mjs` (25 telas, sem erro de console e sem rolagem horizontal). Teste novo: filtros da lista de empresas (`tests/api.test.mjs`).

## O que ainda precisa melhorar

- Mapa de fundo: decisão pendente (ver MAPA.md).
- Tema escuro não incluído (pedido: tema claro).
- Telas de Configurações (Campanhas, Catálogo, Parâmetros, Pausas, Supressão) e Tarefas/Envios ganharam o tema, mas não foram recompostas.
- Ícones: nenhum (só texto); se desejado, adotar uma família única depois.
