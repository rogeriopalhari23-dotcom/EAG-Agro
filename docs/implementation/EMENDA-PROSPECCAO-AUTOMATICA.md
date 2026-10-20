# Emenda proposta: prospecção automática sob política de pesquisa de rotina (2026-10-20)

**Estado:** proposta para decisão de Rogério Palhari. **Não aprovada.** O código da branch `redesign-interface` implementa a política, mas nenhuma prospecção pesquisa sem uma política concedida. Em produção não há política, e a versão nova não foi publicada.

## O que muda na prática

Hoje, cada pesquisa pede decisões manuais repetidas:
- ciência das mesmas limitações a cada rodada e revisão;
- seleção e autorização da busca no exterior a cada país e commodity;
- aceite individual de cada candidata internacional.

Com a política, o Administrador ou gestor autoriza **uma vez**, com referência e data, a pesquisa de rotina. A política cobre:
- descoberta;
- consulta cadastral;
- conciliação;
- triagem de sanções;
- cadastro em descoberta.

O motor executa sob essa autorização. Cada operação fica registrada com:
- canal `automation`;
- executor "Compass — prospecção automática";
- a política (identificador, versão, quem concedeu e quando) como autorização.

Nenhum clique, decisão humana ou aprovação individual é simulado.

## Requisitos afetados e redação proposta

| Requisito | Hoje | Proposta |
|---|---|---|
| **R12.7** (Spec) | "QUANDO o usuário selecionar uma ou mais commodities e autorizar a busca, o sistema DEVE registrar a seleção, o autor, a data e a análise…" | Acrescentar: "A seleção e a autorização PODEM ser feitas pela política de pesquisa de rotina vigente, concedida por Administrador ou gestor. O registro DEVE trazer a política (versão, responsável, data) como autorização e a pessoa que iniciou a prospecção como identidade autenticada." |
| Ciência das limitações por revisão (regra das rodadas, `FLUXO-RODADAS.md`) | Ciência de uma pessoa a cada revisão da configuração | A ciência PODE vir da política quando todas as limitações estão na lista aceita pela política, no mesmo nível ou mais brando. Limitação nova ou mais grave continua pedindo ciência da pessoa. O registro mostra "ciência coberta pela política", nunca um nome de pessoa. |
| Aceite de candidata no Radar Internacional (`src/discovery.js`, "nada entra no cadastro sem a pessoa aceitar") | Aceite individual pela pessoa | Sob a política, entra em descoberta só a candidata com identificador cadastral ou site publicado. Nome parecido com empresa já cadastrada continua indo para a fila de exceções; nada é fundido sozinho (P13). |

## O que não muda (continua exigindo a decisão apropriada)

- **Contato, comercial e envio:** contato de qualquer tipo, fichas e sua aprovação individual, ativação de campanha, liberação de canal e envio de mensagens.
- **Compliance:** T11 por escopo, supressões, pausas, triagem de sanções válida (R19.3) e permissões.
- **Despesas e escopo material:**
  - fontes pagas e consumo de créditos (Casa dos Dados, Snov, …): a política recusa fonte paga;
  - raio acima do limite da política;
  - mercado não coberto.
- **Regras de evidência:** busca no exterior só a partir de commodity com compra identificada no país (R12.14), e dado de comércio entre países não prova importação de uma empresa (R12.10, AT23).
- **Exceções e conflitos:** ficam na fila para análise da pessoa.

## Como desfazer

Revogar a política (Configurações → Prospecção automática → Revogar). As prospecções param antes de pesquisar; o que já foi cadastrado continua com o rastreio.
