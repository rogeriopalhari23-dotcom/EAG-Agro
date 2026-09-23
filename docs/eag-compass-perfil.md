# EAG Compass v2.0 — Perfil EAG e Catálogo Inicial (Fase 2B)

**Data da consulta:** 2026-09-22 (22:49 UTC) **Revisão deste documento:** 3 — corrigido em 2026-09-22; escopo permanece revisão 3 **Método relatado na pesquisa original:** `firecrawl map` + `firecrawl scrape` (conteúdo principal) das páginas públicas; leitura de documentos internos da EAG em `Desktop/EAG Agro/`. **Cópia local das páginas raspadas:** `eag-compass/.firecrawl/eagagro/*.md` (ignorado pelo git).

> **Regra da revisão 3:** a campanha inicial se vincula à **commodity e ao mercado**. Lote, preço, cotação e oferta específica **não** são exigidos para buscar, aprovar a ficha ou iniciar a sequência. A identidade e a variante do produto devem estar claras antes da abordagem. Características com fonte podem orientar aderência e texto aprovado. Mínimo, disponibilidade, preço e condições de transação serão confirmados quando uma proposta concreta for necessária; não se exige proposta para o primeiro contato. Presença no catálogo não significa lote ou preço disponível.

---

**Limite desta revisão:** referências a documentos internos e capturas Firecrawl preservam o relato recebido; esses arquivos não foram reinspecionados. Foram reconsultadas as páginas públicas `/portfolio`, `/portfolio-franquia`, `/graos` e `/quem-somos`. Não localizar café nessas páginas não comprova ausência em todo o site.

## 1. Fontes consultadas

| Fonte | Tipo | URL / caminho | Situação |
| --- | --- | --- | --- |
| Home | Site público | [https://eagagro.com/](https://eagagro.com/) | Lida |
| Portfólio | Site público | [https://eagagro.com/portfolio](https://eagagro.com/portfolio) | Lida — fonte principal do catálogo |
| Grãos | Site público | [https://eagagro.com/graos](https://eagagro.com/graos) | Lida — única página que cita sorgo |
| Açúcar | Site público | [https://eagagro.com/acucar](https://eagagro.com/acucar) | Lida |
| Mobilidade | Site público | [https://eagagro.com/mobilidade](https://eagagro.com/mobilidade) | Lida |
| Quem somos | Site público | [https://eagagro.com/quem-somos](https://eagagro.com/quem-somos) | Lida |
| Contato | Site público | [https://eagagro.com/contato](https://eagagro.com/contato) | Lida |
| LP Soja | Site público | [https://eagagro.com/lp-soja](https://eagagro.com/lp-soja) | Lida |
| LP Etanol | Site público | [https://eagagro.com/lp-etanol](https://eagagro.com/lp-etanol) | **Indisponível na consulta** ("Error establishing a database connection") |
| Portfólio franquia | Site público | [https://eagagro.com/portfolio-franquia](https://eagagro.com/portfolio-franquia) | Lida — mesmo conteúdo do portfólio |
| Sitemap de páginas | Site público | [https://eagagro.com/page-sitemap.xml](https://eagagro.com/page-sitemap.xml) | Lido — 21 páginas; nenhuma de café |
| Ficha técnica açúcar | Documento interno | `Desktop/EAG Agro/ESPECIFICAÇÃO TÉCNICA AÇÚCAR _ SUGAR ICUMSA 45, ICUMSA 150 e VHP .docx.pdf` | Lida — tabela comparativa de especificações |
| Ficha técnica óleo de soja bruto | Documento interno | `Desktop/EAG Agro/Crude Soybean Oil (CSBO) - ÓLEO DE SOJA BRUTO - EAG AGRO.docx.pdf` | Lida — laudo de uma amostra ("significado restrito à amostra analisada") |
| Apresentação açúcar | Documento interno | `Desktop/EAG Agro/EAG AGRO-Açúcar.pdf` | Lida — institucional |

Documentos comerciais sensíveis encontrados na mesma pasta (LOIs, due diligence, preços indicativos) **não** foram lidos nem usados: não são necessários ao catálogo e contêm dados de contrapartes.

---

## 2. Perfil da EAG

| Aspecto | Informação | Fonte |
| --- | --- | --- |
| Posicionamento declarado | "Trading de grãos, Açúcar e Energia", fornecendo insumos a indústrias | eagagro.com/quem-somos |
| Identidade institucional declarada | Apresentação interna declara EAG-AGRO como marca de SUKSESS e atuação como corretora; natureza jurídica e poderes de representação não foram verificados em registro cadastral nesta revisão | Apresentação açúcar (interno) |
| Mercados | "Tanto para o mercado interno quanto para exportação"; clientes "no Brasil e no mundo" | eagagro.com/portfolio |
| Público declarado | Médias e grandes indústrias | eagagro.com/quem-somos |
| Endereços | Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP; 255 S Orange Ave, Suite 104, Orlando/FL, EUA | eagagro.com/contato |
| Canais públicos | WhatsApp +55 11 97679-3505; [suporte@eagagro.com](mailto:suporte@eagagro.com) | eagagro.com/contato |
| Outros e-mails em documentos | [Atendimento@eagagro.com.br](mailto:Atendimento@eagagro.com.br) (ficha açúcar); [rogeriopalhari@eagagro.com](mailto:rogeriopalhari@eagagro.com) (apresentação açúcar) | Documentos internos |
| Rede comercial | Páginas de franquia, calculadora de comissão e páginas individuais de franqueados (`/f/<nome>`) | eagagro.com/page-sitemap.xml |
| Referência de cliente citada | Dona Benta (açúcar) | eagagro.com/acucar — **declaração do site, não verificada** |
| Números institucionais | "Mais de 1800 operações em 2024"; "mais de 20 milhões de dólares economizados por clientes em 2024" | eagagro.com — **declarações do site, não verificadas; não usar em mensagens sem aprovação** |

### Observações relevantes para o Compass

1. **Dois domínios de e-mail** aparecem (`eagagro.com` e `eagagro.com.br`). A dependência T1 deve identificar o provedor e a autenticação (SPF/DKIM/DMARC) do domínio efetivamente usado para envio: `eagagro.com`.
2. **Franqueados/agentes** aparecem no material institucional. Sobreposição de prospecção é hipótese operacional a confirmar, não atividade da rede verificada nesta revisão. Fora do Compass, as mesmas empresas podem ser contatadas por outras pessoas da rede. Não amplia o escopo (sem usuários externos), mas é risco de duplicidade de abordagem a registrar como premissa na Spec.
3. O posicionamento público menciona **médias e grandes indústrias**; o Compass prioriza **pequenas e médias consumidoras finais** (decisão do escopo). A abordagem das mensagens deve refletir a decisão aprovada, não o texto do site.
4. Números institucionais do site não entram em textos de mensagem sem aprovação explícita (escopo §2.5: nada sem dado aprovado pela EAG).

---

## 3. Catálogo inicial

Legenda da coluna **Origem** — distingue informação **publicada pela EAG** de informação **fornecida por Rogério**:

- **SITE** — publicado pela EAG em eagagro.com (URL + consulta em 2026-09-22).
- **SOLICITAÇÃO** — solicitação expressa de Rogério (responsável comercial); não localizado no site.
- **PORTFÓLIO** — portfólio informado por Rogério; especificações, disponibilidade e siglas pendentes.

### Escopo nacional

Por decisão registrada no escopo (§2.2), **soja, café e etanol integram o escopo nacional** (Radar de Compradores). A escolha da commodity do piloto continua pendente (§5, P5). Os demais produtos do portfólio seguem elegíveis à busca conforme campanha e aderência, sem implicar disponibilidade, preço ou oferta confirmada.

Todos os códigos NCM/HS ficam **pendentes de confirmação** nesta fase (escopo §2.2: código não confirmado aparece como pendência, sem impedir o cadastro). A classificação será levantada na Fase 4 com a versão da NCM vigente.

| # | Grupo | Produto / variante | Origem | Onde aparece | Especificação disponível | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Soja | Soja GMO | SITE | /portfolio, /lp-soja | Não |  |
| 2 | Soja | Soja não GMO | SITE | /portfolio ("NON-GMO"), /lp-soja | Não |  |
| 3 | Milho | Milho GMO | SITE | /portfolio | Não |  |
| 4 | Milho | Milho não GMO | SITE | /portfolio ("N-GMO") | Não |  |
| 5 | Café | Café; Arábica e Robusta/Conilon como famílias previstas | SOLICITAÇÃO | Decisão de Rogério e planejamento anterior; não localizado nas páginas do site consultadas | Não confirmada para uma transação | Famílias já previstas, sem reabrir a decisão. Confirmar tipo, peneira e qualidade quando o texto ou cotação depender deles. |
| 6 | Açúcar | ICUMSA 45 | SITE | /portfolio, /acucar | **Sim — ficha interna** | Ficha interna: "ICUMSA 45 (Açúcar Refinado Branco)". |
| 7 | Açúcar | ICUMSA 150 | SITE | /portfolio, /acucar | **Sim — ficha interna** | Ficha interna: "ICUMSA 150 (Açúcar Cristal)". |
| 8 | Açúcar | VHP | SITE | /portfolio, /acucar | **Sim — ficha interna** | Apresentação cita "VHP 600". |
| 9 | Etanol | Etanol hidratado | SITE | /portfolio, /mobilidade | Não |  |
| 10 | Etanol | Etanol anidro | SITE | /portfolio, /mobilidade | Não | Site: "mais de 99% de etanol". |
| 11 | Álcool industrial | Álcool etílico neutro | SITE | /portfolio | Não | Pedido do responsável: "álcool industrial"; o site detalha 3 variantes. |
| 12 | Álcool industrial | Álcool etílico extra neutro | SITE | /portfolio | Não |  |
| 13 | Álcool industrial | Álcool etílico hidratado (industrial) | SITE | /portfolio | Não | Distinto do etanol hidratado combustível; diferença a confirmar com Rogério. |
| 14 | Cereais | Trigo | SITE | /portfolio, /graos | Não |  |
| 15 | Cereais | Sorgo | SITE + SOLICITAÇÃO | /graos (texto corrido); ausente da lista do /portfolio | Não | Mantido por solicitação expressa independentemente do site. |
| 16 | Farelos | Farelo de soja | SITE | /portfolio, /graos, /lp-soja | Não |  |
| 17 | Farelos | Farelo de canola | SITE | /portfolio, /graos | Não |  |
| 18 | Farelos | Farelo de algodão | SITE | /portfolio, /graos | Não |  |
| 19 | Óleos | Óleo de soja (bruto e refinado) | SITE | /portfolio | **Bruto: laudo interno de amostra** | Laudo vale só para a amostra analisada; não é especificação de oferta. |
| 20 | Óleos | Óleo de canola | SITE | /portfolio | Não |  |
| 21 | Óleos | Óleo de algodão | SITE | /portfolio | Não |  |
| 22 | Óleos | Óleo de palma (bruto e refinado) | SITE | /portfolio | Não |  |
| 23 | Derivados de soja | Lecitina de soja | SITE | /portfolio | Não |  |
| 24 | Coprodutos | DDGS | PORTFÓLIO | Não localizado nas páginas consultadas | Não |  |
| 25 | Coprodutos | CGF | PORTFÓLIO | Não localizado nas páginas consultadas | Não |  |
| 26 | Coprodutos | CGM | PORTFÓLIO | Não localizado nas páginas consultadas | Não |  |
| 27 | Óleos residuais | UCO | PORTFÓLIO | Não localizado nas páginas consultadas | Não |  |
| 28 | Óleos | CSO | PORTFÓLIO | Não localizado nas páginas consultadas | Não | **Sigla a confirmar com o responsável comercial.** O documento interno da EAG usa "CSBO" para óleo de soja bruto; não se presume que CSO seja o mesmo produto. |

**Contagem:** 28 entradas editoriais de catálogo — 22 com origem SITE (itens 1–4 e 6–23; sorgo também com origem SOLICITAÇÃO), 1 só por SOLICITAÇÃO (café), 5 de PORTFÓLIO (DDGS, CGF, CGM, UCO, CSO).

### Itens encontrados no site que **não** entram no escopo operacional

| Item | Onde | Tratamento |
| --- | --- | --- |
| Crédito de carbono | /portfolio | Registrado como observação; não entra no catálogo operacional nem amplia o escopo. |
| Diesel | /mobilidade ("distribuição e comercialização de etanol e diesel") | Registrado como observação; não entra no catálogo (não solicitado). |
| Rótulos "açúcar refinado" e "cristal" | Home | Tratados como equivalentes descritivos de ICUMSA 45 e ICUMSA 150 conforme ficha interna; equivalência a confirmar com Rogério. |

---

**Modelagem:** as 28 linhas não equivalem necessariamente a 28 variantes atômicas. Óleos bruto/refinado e famílias de café podem exigir variantes próprias, sem duplicar empresas, evidências ou estatísticas por códigos sobrepostos.

## 4. Implicações para a Spec v2.0

1. O catálogo nasce com **28 itens e nenhuma oferta específica**. Campanhas do piloto se vinculam à commodity e ao mercado; não dependem de oferta, lote ou preço.
2. **Oferta específica e cotação concreta** entram depois, quando uma negociação precisar delas, com fornecedor, especificação, versão e validade. Mudança ou vencimento dessa oferta afeta apenas as sequências que a utilizam.
3. A entidade Produto precisa de **variante** (GMO/não GMO, bruto/refinado, ICUMSA) e de **origem múltipla** (sorgo tem SITE e SOLICITAÇÃO).
4. Produto/variante pode guardar características técnicas com fonte e status de confirmação, sem depender de oferta. Uma proposta específica referencia a variante e suas condições; fichas internas podem servir de referência sem prometer disponibilidade. O laudo de amostra não substitui a especificação de uma oferta.
5. Textos citam a commodity identificada e perguntam sobre compra, uso ou revenda conforme o perfil. Característica confirmada pode ser citada; não prometer disponibilidade, volume ou condição sem dado aprovado (escopo §2.5; T12, PV7).
6. NCM/HS por variante fica pendente até a Fase 4. Não impede cadastro ou prospecção genérica de produto identificado, mas é necessário para atribuir estatísticas internacionais à commodity. Sem mapeamento validado, mostrar classificação pendente; não inferir especificação mais detalhada que o código.
7. CSO fica com identidade pendente. Não ativar busca ou mensagem específica desse item até confirmar o que representa; as demais commodities seguem normalmente. Não inferir CSO = CSBO.

---

**Internacional:** o país é a primeira entrada. Listar commodities agrícolas nas exportações brasileiras ao destino, com período e classificação, sem limitar a análise inicial ao catálogo EAG. O portfólio é destacado; Rogério seleciona commodities e autoriza busca de compradores. Correspondência com catálogo, importação pela empresa e consumo são verificações distintas.

## 5. Pendências reais

| # | Pendência | Responsável | Bloqueia? |
| --- | --- | --- | --- |
| P1 | Identidade de CSO e de qualquer sigla comercial ambígua | Rogério | Não bloqueia planejamento/cadastro pendente; bloqueia ativação da busca ou abordagem específica do item ambíguo. |
| P2 | Especificações e disponibilidade de DDGS, CGF, CGM, UCO e CSO | Rogério | Só para cotação/oferta específica, quando houver |
| P3 | Características concretas das variantes de café quando necessárias; famílias já previstas | Rogério | Não bloqueia campanha genérica; característica desconhecida não pode ser prometida. |
| P4 | NCM/HS por produto/variante, versão e vigência com mapeamento auditável | Fase 4 | Necessário para vincular histórico internacional à commodity; não bloqueia cadastro ou campanha nacional de produto identificado. |
| P5 | Commodity, cidade/UF do fornecedor já conhecido e raio inicial do piloto | Rogério | Não bloqueia Spec; bloqueia Etapa 1 |
| P6 | Página /lp-etanol indisponível na consulta | Nova consulta futura | Não |

## 6. Alterações desta revisão

Preservadas as 28 entradas e suas origens. Corrigidos cabeçalhos, identidade institucional e a separação entre característica do produto e oferta. Café mantém famílias já previstas; CSO segue pendente. Nenhuma oferta foi criada, disponibilidade confirmada ou documentação interna revalidada nesta revisão.
