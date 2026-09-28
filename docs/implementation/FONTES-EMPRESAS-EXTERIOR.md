# Fontes para descobrir empresas importadoras no exterior (Radar Internacional)

Pesquisa e testes de 2026-09-27. Objetivo: gerar candidatas **importadoras** no país e na commodity escolhidos, priorizando pequenas e médias consumidoras finais, fábricas e processadoras, sem contratar base paga. Traders em grupo separado.

**Três níveis, nunca misturados:**

| Nível | O que exige | Quem sobe de nível |
|---|---|---|
| Empresa encontrada — importação não verificada | Apareceu numa fonte por atividade (cadastro, mapa) | ninguém: fica recolhida |
| **Potencial importadora** | Sinal **da própria empresa**: EORI ativo, registro de embarque visto, associação de importadores, site da empresa dizendo que importa | a pessoa registra o sinal (ou o EORI é conferido automaticamente) |
| **Importadora confirmada** | Documento da própria empresa conferido (registro aduaneiro, conhecimento de embarque, fatura) | só a pessoa, com a evidência |

Dados MDIC/Comtrade (agregado do país) **nunca** preenchem nenhum desses níveis (R12.10). Atividade no cadastro é indício de **uso**, não de importação (P1).

## 1. Fontes gratuitas testadas (implementadas quando viável)

| Fonte | Cobertura por país | Campos | Acesso | Custo | Limites e condições de uso | Teste concreto (2026-09-27) | No Compass |
|---|---|---|---|---|---|---|---|
| **OpenStreetMap — Overpass API** | Mundial, mas só o que foi mapeado (cobertura parcial e desigual) | nome, operador, cidade, site, e-mail/telefone comercial quando mapeados, etiqueta de atividade (ex.: `craft=coffee_roaster`) | HTTP público, sem chave | grátis | Servidor público "para projetos pequenos" (wiki OSM); atribuição ODbL obrigatória; espelhos testados: um regional devolveu **0** para a Alemanha (vazio falso) e outros não responderam — só o servidor principal é usado. **Recusa conexões vindas da Cloudflare** (521/522 a partir do Worker em produção); CORS aberto (`Access-Control-Allow-Origin: *`) | Alemanha/café: **58** torrefações, **49 com site**, 8–15 s; Chrome real a partir de outra origem: 200, 59 elementos, 8,3 s; uma vez 504 (sobrecarga) → vira erro, nunca "nenhuma empresa" | **Implementado**: a consulta é montada pelo Compass e **executada no navegador** (CSP libera só `overpass-api.de`); o Worker trata o resultado |
| **França — API Recherche d'entreprises** (data.gouv) | França | SIREN/SIRET, razão social, NAF, **faixa de efetivo INSEE** e ano, categoria PME/ETI/GE, endereço, dirigentes | HTTP público, sem chave | grátis | 7 req/s por IP e 30 req/s por ASN (nuvem pública pode bater o limite → 429 tratado); Licence Ouverte | NAF 10.83Z (café): 1.282 ativas; com filtro de efetivo 10–249: **73 PMEs**; atacado 46.37Z: 960 | **Implementado** (`fr_registry`, porte-alvo vira filtro) |
| **UE — validação EORI** (Comissão Europeia, serviço EOS) | UE (número precisa ser conhecido) | EORI válido/não válido | SOAP público, sem chave | grátis | lotes de até 10 números por chamada (implementação); sem busca por atividade; alcançável a partir do Worker (200) | 5 torrefações FR (EORI = FR+SIRET da sede): 3 ativos; no teste ponta a ponta **62 de 73** PMEs e **43 de 100** traders com EORI ativo | **Implementado** para França (sinal automático de importação) |
| **Noruega — Enhetsregisteret** (Brønnøysund) | Noruega | orgnr, nome, NACE (SN2007), nº de empregados, **site**, endereço | HTTP público, sem chave | grátis | NLOD 2.0 | NACE 10.830: 108 empresas, 17 com site, 25 com nº de empregados | **Implementado** (`no_registry`) |
| **GLEIF** (LEI) | Mundial, só entidades com LEI | nome legal, registro (ex.: HRB), endereço, situação, LEI | HTTP público, sem chave | grátis | dados abertos | "Rösterei" DE: 5 torrefações com HRB; "Wasserburger Bohnenröster": 0 (pequena sem LEI) | **Implementado** como conferência de identidade (não é descoberta nem prova de compra) |
| **Wikidata** | Mundial, viés para empresas conhecidas | nome, setor, site, nº de empregados às vezes | SPARQL público | grátis | CC0; consultas pesadas dão 504 | Torrefações na Alemanha: **6** (1 com nº de empregados) | Não implementado (cobertura baixa) |
| **Reino Unido — Companies House** | Reino Unido | nome, SIC (ex.: 10830), situação, endereço | API com **chave gratuita** | grátis (chave) | limites e licença a conferir no cadastro da chave (não verificados nesta pesquisa) | Não testado: exige cadastro de chave por Rogério | Pendente de chave |
| **ImportYeti** | **EUA** (embarques marítimos, conhecimento de embarque via FOIA) | importador, fornecedor, país de origem, HS, peso, portos | Site (sem API pública); login grátis após 25 páginas | grátis | busca livre por nome; consultas avançadas e downloads por pedido | Não automatizado (sem API) | Link na validação assistida quando o país é EUA |
| Diretórios (Europages, Kompass), listas públicas de compradores por SH (bases de comércio) | vários | nome, atividade declarada | sites | grátis para ver | termos proíbem raspagem | — | Links no roteiro (consulta manual) |
| Estatística aduaneira oficial (ex.: douane.gouv.fr / lekiosque) | França e UE | **só agregados** produto × país | download | grátis | — | não identifica empresa | Não serve para empresa |

**Conclusão das gratuitas:** na França, o fluxo gratuito entrega candidatas importadoras reais (atividade + porte oficial + EORI ativo). Na **Alemanha não há sinal gratuito de importação por empresa**: o registro alemão não tem API aberta com atividade, o EORI alemão não deriva do registro e o OSM só dá atividade — as candidatas ficam como "importação não verificada" até a validação assistida ou uma base paga.

## 2. Comprovação por empresa: bases pagas (nada contratado)

Registro aduaneiro/conhecimento de embarque com nome do importador é a única fonte que prova importação por empresa sem documento da própria empresa. Na UE as declarações aduaneiras não são públicas; fornecedores cobrem países europeus principalmente por "dados espelho" — **a cobertura real de importadores alemães de café do Brasil precisa ser conferida numa amostra antes de contratar.**

| Fornecedor | Preço público (consultado em 2026-09-27) | Cobertura declarada | Acesso | Teste possível sem contratar | Fonte |
|---|---|---|---|---|---|
| **Export Genius** | Grátis (limitado); Starter **US$ 1.400/ano** (2 usuários, BL de 1 país, dados aduaneiros de 36 países); Essential **US$ 4.000/ano** (BL de 2 países, 58 países, dados espelho de 194); Expert **US$ 9.000/ano** | 229–247 países/territórios; API e licença de dados | plataforma, API | **Plano gratuito** (amostra) — exige cadastro de Rogério | exportgenius.in/company/plan-and-pricing.php |
| **Volza** | a partir de **US$ 1.500/ano** (Starter, pontos por download; fonte secundária) | 90+ países diretos + 119 por espelho; contatos de decisores | plataforma; API no Enterprise | **Teste gratuito de 7 dias** (volza.com) — exige cadastro | volza.com; valueaddvc.com/tools/volza |
| **ImportGenius** | EUA: Essentials **US$ 229/mês** (US$ 183 no anual), Pro **US$ 449/mês** (US$ 4.310/ano); países adicionais **a partir de US$ 159/mês por país** (anual) | EUA completo; 25+ países (Europa, Ásia, América Latina) por adição | plataforma; API no Enterprise | sem teste gratuito | importgenius.com/pricing; /features/multi-country-access |
| **TradeAtlas** | Professional **US$ 2.950/ano** (15 códigos SH), US$ 4.450 (25), Deluxe **US$ 9.950/ano** (60); com IA US$ 3.850–11.000 | "todos os países" (aduana e BL) | plataforma, 1 ano | não informado | tradeatlas.com/en/pricing-data-and-ai-package |
| **Panjiva (S&P Global)** | tipicamente US$ 5.000–50.000+/ano (fonte secundária) | global, empresarial | plataforma/API | via comercial | valueaddvc.com/tools/volza (comparativo) |
| **ImportYeti** | **grátis** (EUA) | só embarques marítimos para os EUA | site | sim | bellingcat toolkit; importyeti.com |

**Recomendação para decisão de Rogério (R13.7):** antes de contratar, pedir amostra com o caso real "importadores alemães de café verde (SH 090111) de origem Brasil" — Export Genius (plano gratuito) e Volza (7 dias) permitem isso sem pagamento. Se a amostra trouxer nomes de PMEs alemãs, o custo de entrada fica entre US$ 1.400 e US$ 1.500/ano. Sem essa conferência, nenhuma base paga deve ser dada como cobertura da Alemanha.

## 3. Resultado do fluxo com APIs reais (2026-09-27, banco local temporário, nada em produção)

| | Alemanha · café | França · café |
|---|---|---|
| Fontes | OpenStreetMap (1 chamada) | Registro FR processadoras (11 chamadas, incl. EORI), traders (14), OpenStreetMap (1) |
| Encontradas | 58 | 204 (104 processadoras, 100 traders) |
| **Candidatas importadoras (sinal próprio)** | **0** | **105** (62 processadoras PME + 43 traders com EORI ativo) |
| Importação não verificada | 58 | 96 |
| Possíveis duplicatas (não fundidas) | 0 | 3 |
| Importadoras confirmadas | 0 | 0 (exige documento da empresa) |
| Tempo | 15 s | 41 s |

## 4. Etapas que exigem Rogério

1. Aceitar/descartar empresas encontradas (nada entra no cadastro sozinho).
2. Validação assistida das que não têm sinal: site da empresa, associação de importadores, registro de embarque — registrar o sinal no cartão da empresa.
3. Confirmar importação só com documento da empresa (o Compass nunca confirma por agregado, atividade ou EORI).
4. Chave gratuita do Companies House (se o Reino Unido entrar).
5. Decidir sobre base paga (amostra primeiro, R13.7) — nada contratado.
6. Aprovar cada ficha individualmente antes de qualquer contato (P11).

## 5. Alcance a partir do Worker em produção (`POST /api/integrations/discovery/reach`, 2026-09-28)

| Fonte | Resultado |
|---|---|
| Registro da França | 200 · 1.282 empresas (NAF 10.83Z) · 2,2 s |
| EORI (Comissão Europeia) | 200 · 1 EORI ativo · 1,2 s |
| Registro da Noruega | 200 · 110 empresas · 0,9 s |
| GLEIF | 200 · 5 registros · 0,8 s |
| OpenStreetMap (Overpass) | **521/522** (recusa a Cloudflare) → executado no navegador |
