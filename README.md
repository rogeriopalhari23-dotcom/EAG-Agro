# EAG Compass — revisão consolidada 0.3.1-review.2

Código revisado sobre o ZIP `eag-compass-20ef963-2026-09-23.zip`. Mantém JavaScript nativo, Cloudflare Worker, D1 e interface Talhão. Reaproveita a revisão anterior e incorpora a Spec vigente com a lista mensal internacional. Esta entrega contém a fundação operacional corrigida e a sequência verificável para concluir os módulos ainda planejados. **Não é a v2 completa nem uma publicação em produção.**

## Executar localmente

Requisito: Node.js 24, npm e acesso ao registro npm na instalação.

```sh
npm ci
npm run setup:local
npm run db:migrate:local
npm run check
npm run dev
```

Abra o endereço local informado pelo Wrangler. A identidade local é `admin@local.eag`, exclusivamente em loopback, com `--env local`. `setup:local` gera chaves apenas quando ausentes/vazias, preserva as existentes e recusa chaves inválidas. Proteja o backup de `.dev.vars.local`; perder a chave AES impede recuperar contatos. As migrações 0001–0002 são as originais; 0003–0005 formam a fundação nova. Não reaplicar SQL manualmente em banco já migrado.

## Retomar no Claude sem reiniciar o projeto

```sh
npm run next
npm run next -- --all
npm run next -- --task=P2-T1
```

Leia `CLAUDE.md`, `AGENTS.md` e `docs/CONTINUAR-NO-CLAUDE.md`. A fila em `docs/implementation/sequence.json` cobre as 42 tarefas dos três planos atuais. O comando é local e determinístico: não chama modelo, API comercial ou fonte de pesquisa. Ele não marca tarefas como concluídas e não executa deploy. Modifique o estado só com evidências.

## O que funciona neste pacote

- API autenticada por JWT do Access em produção; RBAC, tenant, CSRF e limites de entrada.
- Cadastro de empresas, contatos criptografados, fontes, demandas por produto/mercado com versão, observações de risco, verificações do decisor e decisões de exceção.
- Scores v2 e gate calculado sobre dados atuais, com desconhecidos explícitos e sanções pendentes bloqueando qualificação.
- Catálogo inicial de 28 itens, parâmetros numéricos versionados, campanhas/ICP, declarações via API, supressão HMAC e pausas.
- Interface real, sem dados demonstrativos, com paginação, CSV protegido contra fórmulas e mensagens de erro.

## O que falta para o produto completo

Busca por raio/unidades; integrações de dados e sanções reais; ficha versionada; modelos da habilidade comercial original; sequência e envio SMTP; leitura IMAP, descadastro público, tarefas e migração OpenClaw; lista mensal MDIC/Comtrade e telas correspondentes. Cron, filas, R2 e KV não ficam ociosos na configuração atual. Os planos e contratos corrigidos estão em `docs/CONTINUAR-NO-CLAUDE.md` e `docs/revisao/CORRECOES-DOS-PLANOS.md`.

A ausência de mínimos nacionais mantém componentes de volume desconhecidos. A ausência de listas/triagem/política de validade de sanções bloqueia o gate. A logística nacional não ganha pontos por flags manuais; depende da unidade e localização ainda pendentes.

## Testes e evidências

`npm run check` valida a sequência, sintaxe recursiva, testes Node/SQLite, build estático e integração workerd/D1. Resultados desta entrega: `docs/revisao/VALIDACAO.json`. O Windows e o CI remoto precisam executar a matriz entregue; não foram declarados testados nesta máquina Linux.

O teste opcional de interface usa Playwright e um Chromium disponíveis na máquina de QA, sem dependência de navegador no produto. Configure `EAG_PLAYWRIGHT_PATH` com o módulo instalado fora do projeto e, se necessário, `EAG_CHROMIUM_EXECUTABLE` com o executável; execute `npm run test:ui`. Capturas são geradas em `review-output/`, excluído da entrega.

## Preparar produção

Leia `docs/OPERACAO.md`. Preencha D1, domínio protegido pelo Access, emissor e audience; configure as chaves como secrets e cadastre um administrador real explicitamente. `npm run deploy` é bloqueado enquanto a configuração está incompleta. Os comandos não comprovam política do Access, migração remota, entrega de e-mail ou custo real. Não há bootstrap de administrador pela primeira requisição.

## Integridade

`MANIFEST-SHA256.txt` identifica os arquivos desta entrega; `npm run verify:package` os verifica. `REVISAO.json` identifica as duas entradas e o commit local de revisão. O bundle Git permite importar o commit de revisão sem reescrever o histórico do repositório original. Não contém `.git`, dependências, bancos, segredos ou resultados locais de navegador. `docs/revisao/RELATORIO.md` registra achados, cobertura e limitações.
