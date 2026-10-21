# Emenda proposta: prospecção automática sob política de pesquisa de rotina (2026-10-20)

**Estado (2026-10-20):** **aprovada em parte**, por instrução escrita de Rogério Palhari na sessão de 2026-10-20. A aprovação vale só para: seleção de commodity, mercado, segmentos e fontes; seleção R12.7 e autorização da busca no exterior pela política (texto da R12.7 atualizado na Spec, revisão pós-aprovação 6); encaminhamento de candidatas com identificador ou site para descoberta; ciência das limitações já aceitas pela política. **Não aprovado:** custos novos, ampliação de escopo, ambiguidade comercial, contato, fichas, T11, canais, campanhas ativas, envios e o plano de consultas fora da Cloudflare pela ponte (`PLANO-CONSULTAS-FORA-DA-CLOUDFLARE.md`, que segue como proposta). No código: `AMENDMENT` em `src/prospect/defaults.js`.

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

## Texto exato proposto (para aprovar ou recusar; nada foi alterado na Spec)

**R12.7, redação atual** (`docs/eag-compass-spec.md`, linha 404):

> **R12.7:** QUANDO o usuário selecionar uma ou mais commodities e autorizar a busca, o sistema DEVE registrar a seleção, o autor, a data e a análise que a fundamentou, e criar uma campanha por commodity (R16).

**R12.7, redação proposta:**

> **R12.7:** QUANDO o usuário selecionar uma ou mais commodities e autorizar a busca, o sistema DEVE registrar a seleção, o autor, a data e a análise que a fundamentou, e criar uma campanha por commodity (R16). A seleção e a autorização PODEM ser feitas pela política de pesquisa de rotina vigente, concedida por Administrador ou gestor comercial, quando a commodity tiver `compra identificada` no país (R12.14) e o país e o mercado estiverem no escopo da política. Nesse caso, o registro DEVE trazer a política (identificador, versão, quem concedeu e quando) como autorização e a pessoa que iniciou a prospecção como identidade autenticada. A campanha criada fica em rascunho, sem ficha, canal ou envio. A política NÃO DEVE autorizar fonte paga, consumo de créditos, contato nem envio.

R12.8 e R12.14 ficam sem mudança. A busca continua exigindo a seleção registrada; a emenda só muda quem pode registrá-la.

**Regra das rodadas, redação proposta** (`docs/implementation/rodadas/FLUXO-RODADAS.md`, ciência das limitações):

> A ciência das limitações de uma revisão PODE ser dada pela política de pesquisa de rotina vigente, quando cada limitação da revisão constar da lista aceita pela política no mesmo nível ou em nível mais brando. Limitação nova ou mais grave DEVE pedir a ciência de uma pessoa. O registro DEVE indicar "ciência coberta pela política vN" e nunca o nome de uma pessoa que não a deu.

**Aceite de candidata internacional, redação proposta** (Radar Internacional, `src/discovery.js`):

> Sob a política vigente, entra em descoberta, sem aceite individual, só a candidata com identificador cadastral oficial ou site próprio publicado. Nome parecido com empresa já cadastrada vai para a fila de exceções; nada é fundido sem decisão da pessoa (P13).

## Ponte (versão nova)

O uso da ponte para consultas públicas fora da Cloudflare é uma **proposta separada**, também não aprovada: `PLANO-CONSULTAS-FORA-DA-CLOUDFLARE.md`. A ponte em uso não foi alterada.
