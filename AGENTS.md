# EAG Compass — orientações permanentes

No início da sessão, leia `README.md` e execute `npm run next`. Antes de alterar comportamento, leia as seções relevantes da Spec v2.0/Constituição v2.0 e a errata; consulte o relatório apenas para os achados do domínio. Evite carregar histórico e código completo indiscriminadamente. A revisão de 23/09/2026 é uma base corrigida; os Planos 2 e 3 não estão implementados.

## Prioridades de execução

1. Segurança e dados: autenticação JWT, origem das mutações, RBAC, tenant, transações, revisão otimista, proteção dos contatos e fontes verificáveis. Nunca use cabeçalhos de e-mail como autenticação.
2. Correção: escreva regressão para falha observada ou regra comercial relevante; preserve desconhecido como desconhecido. Teste migrações em banco vazio e preenchido. Não marque fase ou validação externa como aprovada sem evidência.
3. Custo: mantenha JS nativo, Worker e D1. Meça antes de adicionar infraestrutura. Sem IA no caminho de cálculo ou envio. Não use cache eventual como trava, nem como fonte autoritativa de supressão, permissões ou aprovação.
4. Interface: aplique Talhão, mensagens diretas, fonte/data visíveis, estados de erro e vazio reais, foco visível e alvos de 44 px. Use `textContent` para dados; não recrie fallbacks com exemplos comerciais.
5. Modularidade: módulos pequenos por domínio, composição por funções, consultas paginadas e em lote. Não introduza React para usar habilidades de React.

## Habilidades e limites

- `docs/habilidades-prioridades.md` registra o que é aplicável. As orientações deste projeto complementam as habilidades disponíveis no ambiente; não afirmam instalação de pacotes externos.
- Não usar Vercel, Next.js, React Native ou infraestrutura de Sites neste projeto.
- `posts-linkedin-agro` é para conteúdo institucional, não para regras de qualificação nem sequências comerciais.
- `/prospeccao-vendas` precisa de seu conteúdo original e hash validado antes dos modelos comerciais. Não substituí-la pela habilidade de LinkedIn.

## Verificação e entrega

Use Node 24: `npm ci`, `npm run check`, `npm run db:migrate:local`. O check inclui testes puros, API/SQLite, workerd/D1 e artefatos públicos. Para mudanças visuais, rode o teste opcional de navegador descrito no README.

Nunca publique, envie mensagens ou habilite canais só para testar. Para mudanças no banco real, faça backup e valide restauração antes da migração. Não rotacione chaves existentes sem migrar os dados. Não inclua segredos, `.wrangler`, `node_modules` ou `.dev.vars*` na entrega. Mantenha manifesto e registro de versão rastreáveis.
