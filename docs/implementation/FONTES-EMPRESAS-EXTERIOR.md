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
| **França — API Recherche d'entreprises** (data.gouv) | França | SIREN/SIRET, razão social, NAF, **faixa de efetivo INSEE** e ano, categoria PME/ETI/GE, endereço, dirigentes | HTTP público, sem chave | grátis | 7 req/s por IP e 30 req/s por ASN (nuvem pública pode bater o limite → 429 tratado); Licence Ouverte | NAF 10.83Z (café): 1.282 ativas; com filtro de efetivo 10–249: **73 PMEs**; atacado 46.37Z: 960 | **Implementado** (`fr_registry`; desde 2026-09-30 o porte-alvo só ordena: primeiro as faixas-alvo, depois todas as outras, sem excluir micro ou grandes) |
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

## 6. Fontes do governo brasileiro e diretório setorial — caso Alemanha + café verde SH 090111 (2026-09-28)

| Fonte (URL) | Resultado do teste | Cobertura / campos | Custo e acesso | Condições | Decisão |
|---|---|---|---|---|---|
| Catálogo de Empresas Estrangeiras (gov.br/…/catalogo-de-empresas-estrangeiras-1) | O link "Mais informações" leva a `…/invest-export-brasil/erro`: aviso oficial (atualizado em 14/09/2023) diz que o catálogo ficou **indisponível** na migração para o gov.br e voltaria pela plataforma Brasil Exportação; alternativa indicada: pedir contatos aos SECOMs | — | — | — | **Não utilizável**; nada implementado |
| Brasil Exportação — BRAEXP (brasilexportacao.com.br) | No ar; busca da própria plataforma (`/wp-json/wp/v2/search`) lista ~97 serviços; **"Listas de Empresas Importadoras"** de SECOMs de vários países (ex.: França, Itália, Polônia; importadores coreanos por produto, inclusive café). **Nenhum serviço de lista de importadores do SECOM Berlim** | Por NCM, sob demanda | Grátis; pedido por e-mail ao SECOM (ex.: Atenas: análise em até 2 dias úteis, prazo combinado) | Para empresas brasileiras | **Etapa humana** (Rogério pede; mensagem externa não foi enviada) |
| SECOM Berlim (secom.berlim@itamaraty.gov.br) | Contato oficial confirmado (gov.br/mre e BRAEXP); sem serviço publicado de lista | — | Grátis, por e-mail | — | **Etapa humana**: pedir lista NCM 0901.11 |
| Oportunidades de Negócios (gov.br/…/oportunidades-de-negocios-1) — Europa/Alemanha | IXPOS "community" **404**; BDEx 200, mas é a federação alemã do **comércio exportador** (fora do alvo); Europages 202 (desafio anti-robô; só consulta manual); TradersCity 403; Export Helpdesk UE 403 (substituído pelo Access2Markets, sem diretório de empresas); ECIB 200 sem busca pública verificada | — | — | Diretórios proíbem raspagem | Nada implementado |
| **Deutscher Kaffeeverband — Kaffeekontakte** (kaffeeverband.de/de/kaffeekontakte/) — achado na investigação | **Utilizável**: 151 membros; busca `?s=`; perfil com texto da própria empresa; alcançável do Worker (200) | Alemanha (+ alguns CH/AT/LU); nome, CEP/cidade, site, perfil | Grátis, sem chave | Sem robots.txt; Impressum/Nutzungsbedingungen sem cláusula contra coleta; uso pontual (1 requisição por busca, 1 por perfil, pausa de 0,5 s) | **Implementado** (`de_coffee_assoc`), com cache de 180 dias por empresa |
| Comex Stat / MDIC | Não consultado para empresas: o MDIC não fornece empresas por produto (sigilo fiscal) | — | — | — | Fora de escopo |

**Caso Alemanha + café verde (execução real, banco local temporário):**

| Etapa | Resultado |
|---|---|
| Descoberta (2 buscas: Rohkaffee, Rösterei) | 73 empresas únicas em 2 s |
| Descarte automático com motivo | 4 fora da Alemanha; 9 prestadores (logística, armazém, máquinas, consultoria) |
| Validação por perfil (69 consultas, cache gravado) | 60 mantidas para revisão humana: 36 torrefações/processadoras sugeridas, 16 traders, 8 a classificar (perfil vazio ou sem indicação) |
| **Candidatas com sinal próprio** (declaração da empresa em 1ª pessoa, com URL e data) | **6**: List + Beisler, Touton Specialties, EthioCo, Sandtorkai Handel Papenhagen, Café Chavalo (traders/importadores) e Dethlefsen & Balk (importador e fabricante) |
| **Prova individual de importação** (documento da empresa) | **0** — exige documento da empresa ou base paga de registros aduaneiros |
| Menção a Brasil nos perfis | 0 |
| Custo e tempo | US$ 0; 71 consultas; ~100 s no total; ~14–17 s por candidata válida |

As regras de classificação foram definidas antes da consulta e corrigidas no mesmo dia com os textos reais guardados em cache (sem nova coleta): importador que abastece torrefações é trader; rodapé do site não conta; declaração de importação só em primeira pessoa ("Kooperationen mit Importeuren" não conta); descarte automático só para prestador; o resto fica para revisão humana com papel sugerido.

## 7. Pessoas de compras — fontes, estados e teste real (2026-09-28)

**Fluxo** (referência Harpor: empresa-alvo → cargo-alvo → contato → ficha → acompanhamento): só empresas que passam na triagem (perfil no ICP ou porte a confirmar; nunca trader, gigante ou micro) → até 3 pessoas por empresa → "contato de compras a validar" → aceito como contato → "cargo verificado" (verificação `job_title`) → "decisor de compras confirmado" (`decision_authority`). E-mail e telefone são avaliados separadamente; nenhum autoriza envio.

| Fonte | Uso | Limites e regras |
|---|---|---|
| Impressum (DE/AT/CH/LI) | Representante legal (Geschäftsführer, Inhaber, "vertreten durch", Vorstand), telefone e e-mail publicados | Aviso legal obrigatório (DDG §5); respeita robots.txt (RFC 9309, com curingas); até 5 requisições por empresa; cache de 180 dias |
| QSA da Receita via BrasilAPI | Sócios-administradores, matriz/filial, município, CNAE, situação | Grátis; o e-mail do cadastro costuma ser do contador (marcado "cadastro", nunca da pessoa); cache de 90 dias; aviso quando só há o endereço da sede |
| Site da empresa, diretório, LinkedIn | Registro manual pela pessoa, com URL da fonte | LinkedIn proíbe bots, extensões e automação de visitas, convites, mensagens e extração (User Agreement §8.2): só links de busca para consulta manual |

Regras: e-mail só se publicado numa fonte com URL (nunca deduzido do padrão do domínio); é "pessoal" apenas quando a caixa contém o nome da pessoa, caso contrário é caixa geral da empresa e não vai para o contato; telefone publicado é da empresa e não autoriza WhatsApp; nome duplicado (inclusive invertido) não entra duas vezes; vínculo vencido aparece como "fonte vencida — reconferir".

**Harpor** (harpor.com.br, conferido em 2026-09-28): SPA; os termos descrevem automação de prospecção B2B **pelo LinkedIn** ("cadências de visita → conexão → mensagens"); teste de 14 dias exige cartão; planos mensal/trimestral/semestral sem preço público; sem documentação pública de API ou exportação. Por depender de automação que o LinkedIn proíbe, não foi integrado; o Compass copia só o fluxo (alvo → cargo → contato → ficha → acompanhamento) com fontes permitidas.

**Teste real — Alemanha + café verde (48 empresas relevantes do diretório do Kaffeeverband, com site):** Impressum localizado em 37; representantes identificados em 21 empresas (24 pessoas, precisão conferida manualmente após correções: 24/24 nomes plausíveis); e-mail pessoal publicado: 0 (35 empresas só com caixa geral); telefone da empresa: 31; 130 requisições, 253 s (≈12 s por empresa com pessoa), custo US$ 0. Nenhum cargo de compras (Einkauf) publicado nos avisos legais: são representantes legais, portanto "a validar".

**Teste real — Brasil (café, Franca/SP, 3 torrefações com CNPJ público):** BrasilAPI respondeu 3/3 (0,8–3,3 s); 5 sócios-administradores; todas matriz ativa, CNAE 1081-3/02; nenhum e-mail no cadastro; telefone em 3. A descoberta nacional de empresas continua bloqueada (chave da Casa dos Dados não configurada; dados abertos da Receita a ~220 KB/s daqui e conexão recusada a partir do GitHub).
