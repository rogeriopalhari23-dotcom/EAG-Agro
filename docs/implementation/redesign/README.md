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

## O que ainda precisa melhorar

- Página da empresa: os formulários internos (demanda, evidência, contato) mantêm o desenho antigo; merecem revisão campo a campo.
- Mapa: sem mapa de fundo por política de segurança; decidir se vale liberar um provedor de ladrilhos.
- Lista de Empresas: ainda sem filtros por etapa/pendência.
- Revisão para decisão, análise do país e ficha: ganharam o tema, mas não foram recompostas.
- Tema escuro não incluído (pedido: tema claro).
