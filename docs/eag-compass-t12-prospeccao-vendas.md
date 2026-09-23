# EAG Compass v2.0 — T12: Leitura da skill `/prospeccao-vendas`

**Revisão deste registro:** 4 — em 2026-09-22: nova leitura da skill substituída (rev. 3) e decisões K1–K6 de Rogério (rev. 4). Rev. 3 arquivada em `docs/historico/v2.0-planejamento/eag-compass-t12-prospeccao-vendas-rev3.md`.
**Registro anterior:** revisão 2 (leitura da v1.0, SHA-256 `94544246…acd0`), arquivada em `docs/historico/v2.0-planejamento/eag-compass-t12-prospeccao-vendas-rev2.md`. A v1.0 foi substituída e **não vale mais** para o Compass.
**Diretriz de Rogério (2026-09-22):** todo trabalho de prospecção deve obedecer à skill `/prospeccao-vendas`.
**Referência de escopo:** `docs/eag-compass-v2-escopo.md` rev. 3; Spec v2.0 aprovada em 2026-09-22.

---

## 1. Identificação do conteúdo lido

Leitura feita nesta sessão, direto dos arquivos em `C:\Users\Roger\.claude\skills\prospeccao-vendas\`. Os hashes foram calculados na leitura.

| Arquivo | Linhas | SHA-256 | Leitura |
| --- | ---: | --- | --- |
| `SKILL.md` | 214 | `33bd093f5dcb87a7d4aa51d31597c6d6ddfc637097693e3830a38f9b219f9dd8` | Integral |
| `references/scripts-abordagem.md` | 102 | `21c01f7d8aca91f3b4ff5a96d8e35da23f8b466c667853f9de44b7be72f37761` | Integral |
| `references/lista-prospeccao.md` | 43 | `589b19395398787bcf6c0ef84c77771795f81f9e76fce5f41ceafd453abc4866` | Integral |
| `references/knowledge-audit.md` | 71 | `8ee1e78eaffb64fcc30297cde93156170e368d56bf22cb3bae9342b773e310cb` | Integral |
| `references/frameworks-livros.md` | 59 | `69859235c9207569cbc269c783829b6031106ffdd51357e2224d1362dc7026d4` | Integral |
| `references/contexto-mercado.md` | 18 | `fb28c472faca9c63d18fd6ce05b2dbb43e83ab4c7d79eaa1ae3f6d8666171a77` | Integral |
| `references/glossario.md` | 42 | `ff0a6e4a292a44461f72b7723fdc90e46e28b436e98324acf4ef5e8a1a16d048` | Integral |
| `references/UPDATING.md` | 13 | `bef496513ccc733ab556d5203bb04adb4734f2315c6d781afd50816cc6990619` | Integral |
| `references/transcricoes/INDEX.md` | 15 | `18aab7ca4ffff551c97aa9e58f554d1c21be551586c6ea594c565665fafb2110` | Integral |
| `assets/planilha-prospeccao.csv` | 2 | `ab3ba94a0866be9627ced8f8b20454cb19f2a4d5eaf6a05540804de3890cba64` | Integral |
| `conselho.json` | 63 | `acdf8a8fe58f4f4aecc2de5765f532962eea067f708637b18b3b5b62ae39598f` | Integral |
| `evals/evals.json` | 448 | `1d48b6f43e1fa5709001964dd63f049196a466a6aeb51897a32806dce7d06828` | 36 casos: prompts e expectativas |
| `references/transcricoes/aula-01…08` | 2.869 no total | ver inventário do diretório | **Não lidas integralmente**: a própria skill manda "NUNCA leia a transcrição inteira". Procedência verificada pelo `knowledge-audit.md` (aula e minuto de cada regra). |
| `assets/infografico-mercado-mai-2026.png`, `assets/mind-map-curso.png` | — | `2c338659…fdcbd`, `d05b220f…b253a` | Não abertas. O conteúdo do infográfico está resumido em `contexto-mercado.md` (🔴, datado de maio/2026). |

**Versão:** `conselho.json` 1.0.0, destilada em 2026-09-22. Fonte: curso "Treinamento de prospecção para franqueados EAG — Prospecção B2B de Commodities Agrícolas", de Anderson Ramos (EAG Agro), 8 aulas, ~57 min. `UPDATING.md` registra que esta versão substituiu a genérica anterior, sem base em transcrição.

**Correção sobre a revisão 2:** o "Modelo EAG (Estrutura, Análise, Gestão)" lido na v1.0 não existe nesta versão. EAG aqui é a EAG Agro. As adaptações A9 e A10 da revisão 2 perdem o objeto.

## 2. O método, em resumo

**Força normativa declarada pela skill:** NUNCA/SEMPRE e todo ⚡ são invioláveis. O restante é padrão, que só cede com justificativa. Procedência: 🟢 dito · 🟡 demonstrado · 🔴 inferido · 📚 livro (não é método do instrutor).

**Invioláveis (⚡ / NUNCA / SEMPRE):**

| # | Regra | Tag |
| --- | --- | --- |
| I1 | Todo toque vende o **próximo passo** (reunião de 20–30 min), nunca o produto | 🟢⚡ |
| I2 | NUNCA preço, PDF, anexo, apresentação ou proposta antes da reunião; nem quando o comprador pede preço | 🟢⚡ |
| I3 | ICP estreito: 1–2 commodities; indústrias médias e média-mais (~50+ funcionários); comprador + gestor de compras. Gigantes trocados por médias; muito pequenas/MEI fora | 🟢⚡ |
| I4 | Saber parar: a cadência termina no e-mail de break; voltar em 6–12 meses | 🟢⚡ |
| I5 | Abertura do e-mail (Mailtrack) → quebrar a cadência e ligar na hora | 🟢⚡ |
| I6 | SEMPRE validar o e-mail antes de enviar | 🟢 |
| I7 | NUNCA anexar apresentação ou proposta ao cold e-mail; só texto | 🟢⚡ |
| I8 | Título do e-mail diz o que o comprador busca ("Fornecedor [commodity]"), não um gancho estatístico | 🟡⚡ |
| I9 | Na cold call: pedir permissão; ligar primeiro para os piores leads | 🟢⚡ |
| I10 | NUNCA inventar dado na lista ("não encontrado"); NUNCA citar número de mercado sem fonte e data | 🟢 |

**Padrões (cedem com justificativa):** workflow de 6 passos (ICP → lista → semana → cadência de 2 semanas → cold call por levels → travar a reunião); lista a partir do **uso final** da commodity; leitura da ficha do CNPJ; decisor provisório = sócio-administrador; cadência semiautomática de 10–15 empresas por lote, com e-mails 1–4, LinkedIn e ligações; o fluxo começa pelo e-mail e, sem e-mail do decisor, pela cold call Level 0; nunca e-mail em dias seguidos; 3 perguntas de qualificação (usina ou trading? spot ou contrato? volume mensal?) + teste condicional; roteiros L0/L1/L2; enviar para si mesmo antes; testar horário manhã × tarde; métrica prospectadas → reuniões → negócios.

**Lacunas declaradas pela skill:** internacional (🔴: "o processo é o mesmo, só que em inglês", mirando os países que mais compram do Brasil); reunião, proposta e negociação (📚, não é método do instrutor); contexto de mercado só com fonte e data. Para levantamento em massa de milho por estado, a skill aponta a `milho-brasil-prospeccao` ("esta skill dá o método; aquela executa a busca").

## 3. Relação com o Compass — nova regra de precedência

Na revisão 2, a regra do Compass prevalecia sobre a skill. **Pela diretriz de 2026-09-22, isso se inverte para o método de prospecção:** ICP, lista, cadência, abordagem, qualificação inicial e agendamento seguem a skill.

Os controles do Compass que **não são método de prospecção** continuam valendo como complemento: aprovação individual, texto congelado, supressão/descadastro, sanções/compliance, LGPD, pausas, integração comprovada, veracidade. A própria skill proíbe inventar dados, então veracidade é convergente.

Onde há **choque literal** entre um inviolável da skill e uma decisão do escopo, ou um controle legal/técnico, o conflito **não é resolvido em silêncio**: vai a Rogério (K1–K6 abaixo). Enquanto pendente, vale a leitura mais restritiva, e nada é enviado com base nela.

### 3.1 Compatível sem decisão (incorporado na Spec rascunho 4)

| Regra da skill | Onde entra |
| --- | --- |
| I1, I2, I7: próximo passo; sem preço/PDF/anexo/proposta | PV1, PV2, PV3, PV7 revisados |
| I4: break e parar; retorno em 6–12 meses | PV6; R28.11 (retorno por nova ficha, R17.7) |
| I6: validar e-mail | R19.2 item 11 |
| I8: título direto | PV9 |
| I10: nada inventado; mercado com fonte e data | PV4, R13.3, R28.14 |
| Lista pelo uso final da commodity | R28.2 (Radar busca setores usuários) |
| Colunas da lista, "não encontrado", fonte do dado | R28.3 |
| Ficha do CNPJ como sinal (ativa, abertura, natureza jurídica, porte, CNAE, sócios; matriz baixada → filiais) | R28.4 |
| Decisor + influenciador; sócio-administrador provisório; evitar CEO/diretoria sem relação | PV8, R15.1 |
| Sem e-mail do decisor → cold call Level 0 (tarefa manual) | R28.6 |
| Nunca e-mail em dias seguidos; 3–4 e-mails | PV5, R19.2 item 12 |
| 3 perguntas de qualificação | R3.1.5, R28.9 |
| Agendar reunião: 2 opções de dia, invite na hora, confirmação no dia | R28.10 |
| Enviar para si mesmo antes (revisão de título e português) | R18.10 |
| Métrica prospectadas → reuniões → negócios | R28.12 |
| Internacional: mesmo processo no idioma do país (inglês por padrão), lacuna 🔴 sinalizada | PV12, R28.15 |
| "Estou em contato com ele por e-mail" / "ele sabe do que se trata" só depois do e-mail enviado (eval 21) | PV4 |

### 3.2 Conflitos — **decididos em 2026-09-22: Rogério seguiu as recomendações** (K3 = opção a)

| ID | Skill | Escopo / controle do Compass | Decisão (= proposta) | Regra de transição (substituída) |
| --- | --- | --- | --- | --- |
| **K1** | I3: médias e média-mais (~50+ funcionários); gigantes trocados; muito pequenas/MEI fora | Decisão 3 e ESC §1: prioridade a **PMEs** consumidoras finais; empresas maiores permanecem | Priorizar médias/média-mais; pequenas/MEI marcadas "fora do ICP", sem ficha; gigantes visíveis, com ficha só havendo relacionamento prévio (eval 2). O Radar continua mostrando todos (decisão 1). | Ficha permitida só para médias/média-mais; demais apenas visíveis |
| **K2** | I3: 1–2 commodities no ICP | Decisão 2: "uma ou mais commodities" no Internacional | Seleção livre no Internacional, mas no máximo 2 commodities com campanhas **ativas** por mercado; as demais ficam em espera | Máximo de 2 ativas por mercado |
| **K3** | I3: ICP = indústrias que **usam** a commodity; trader não é alvo | Decisão 3: traders permanecem elegíveis conforme o contexto | **(a)** traders visíveis e classificados, fora do ICP de prospecção ativa, com ficha só por exceção registrada por empresa. A opção (b) foi descartada. | Traders visíveis, sem ficha |
| **K4** | Cadência de 2 semanas multicanal: e-mails + LinkedIn + ligações | ESC Etapa 1: piloto "somente por e-mail" | E-mails automáticos + tarefas manuais de LinkedIn (modo assistido, R15.3) e de ligação L0/L1/L2 para Rogério, no dia da cadência; WhatsApp segue fora | Só os e-mails; tarefas manuais não geradas |
| **K5** | I5: abertura do e-mail → ligar na hora | R19.5 (aceite ≠ leitura); rastreamento de abertura envolve pixel (LGPD, T11) e o provedor (T1); sinal não confiável em alguns clientes de e-mail | Registrar "abertura sinalizada", nunca "lido", e gerar tarefa "ligar agora"; condicionado a T1 + T11 | Sem rastreamento; regra I5 inativa com aviso |
| **K6** | Estrutura do E-mail 1: "volume relevante de [commodity] disponível", "já atendemos empresas de grande porte"; na ligação: "reduz custo de aquisição", "se tivermos preço competitivo… topariam um teste?" | ESC §2.5 e PV7: nada de disponibilidade, quantidade ou prova social sem dado aprovado; decisão 4: sem exigir lote/preço/oferta | "Declarações aprovadas" por campanha: volume disponível (sim/não, data, autor) e prova social (texto). Sem aprovação, a frase é omitida e a estrutura mantida. Não exige lote, preço nem oferta. | Frases omitidas |

## 4. Critérios PV para o gerador e o revisor — revisão 3

PV1–PV8 foram mantidos como identificadores e reescritos para a skill nova. PV9–PV12 são novos. **O texto canônico é o da Spec R17.3**; a tabela abaixo detalha a origem. Nenhuma mensagem foi gerada com eles ainda.

| ID | Critério verificável | Origem na skill |
| --- | --- | --- |
| PV1 | O E-mail 1 segue a estrutura: saudação → como achou o contato (fato registrado) → quem é (EAG Agro, commodities) → [volume disponível e prova social **só** se aprovados, K6] → objetivo apenas de iniciar conversa → pedido de ~20 min | `scripts-abordagem.md` §1; knowledge-audit passo 4 |
| PV2 | Uma commodity por sequência; sem lista de portfólio; sem PDF, anexo, link de apresentação ou proposta | I2, I3, I7 |
| PV3 | O objetivo de cada toque é o próximo passo (conversa/reunião de 20–30 min) ou descobrir a pessoa certa; nenhum toque tenta vender o produto | I1 |
| PV4 | Toda afirmação é verdadeira e registrada: como o contato foi achado, fatos da empresa, contexto de mercado (fonte + data). "Estou em contato por e-mail" só após e-mail enviado | I10; eval 21; `contexto-mercado.md` |
| PV5 | Sequência de 3–4 e-mails em dias diferentes, nunca seguidos: E-mail 2 "chegou a ver? a melhor forma de falar é por aqui?"; E-mail 3 reaparece com ângulo curto novo (e mensagem ao influenciador, se houver); E-mail 4 = break | `scripts-abordagem.md` §1; cadência |
| PV6 | O break ("acho que agora não é o melhor momento… vou encerrar por aqui… se fizer sentido, é só responder") só é enviado ao fim da sequência sem resposta, supressão, bloqueio ou pausa; depois dele, parar | I4; A11 da rev. 2 |
| PV7 | Nenhum texto contém preço, cotação, lote, estoque, prazo, certificação, condição de pagamento, concorrente ou fornecedor atual do comprador; volume disponível e prova social só por declaração aprovada (K6) | I2; ESC §2.5 |
| PV8 | Destinatários: comprador (decisor) e gestor de compras (influenciador); CEO/diretoria só com relacionamento prévio registrado; sócio-administrador marcado "provisório"; sem afirmar autoridade não confirmada | I3; decision table de lista |
| PV9 | O assunto diz o que o comprador busca, ex. "Fornecedor [commodity]"; sem título estatístico ou "criativo" | I8 |
| PV10 | Tom de consultor, direto, sem formalidade de vendedor e sem pedido de desculpas; português (ou idioma da campanha) revisado | Voz do instrutor; eval 36 |
| PV11 | Mensagem ao influenciador (E-mail 3) tem o mesmo pedido de conversa e não repete o texto enviado ao decisor | Cadência semana 2 |
| PV12 | Internacional: mesma estrutura no idioma do país (inglês por padrão), com a lacuna 🔴 registrada na ficha | Lacuna declarada |

**Retiradas da rev. 2:** A7 (exemplos SaaS: a skill agora é de commodities) e A9/A10 (framework "EAG" inexistente; a pergunta por perfil é substituída pelas 3 perguntas de qualificação e por K3).
**Mantidas como controles do Compass, fora do método:** A2 (evento realizado), A4 (concorrente), A5 (retorno exige nova ficha), A8 (supressão, LGPD, idioma), A11 (interrupção prevalece).

## 5. Situação de T12

- ✅ Leitura da versão atual registrada, com hashes (§1).
- ✅ Compatibilidade analisada; conflitos K1–K6 identificados.
- ✅ PV1–PV12 especificados (Spec R17.3).
- ✅ K1–K6 decididos (Spec §6.0; R14.6–R14.8, R16.7–R16.8, R28.5–R28.7, R28.17–R28.19).
- ⏳ Implementação no gerador/revisor, e amostras internas cobrindo E-mails 1–4, influenciador, sequência interrompida antes do break e um caso internacional em inglês, revisadas por Rogério antes da primeira ficha.
- R17.8: o bloqueio por hash diferente passa a comparar com `33bd093f…9dd8` desde a aprovação da Spec v2.0 em 2026-09-22.
- Nenhuma abordagem foi gerada ou enviada.
