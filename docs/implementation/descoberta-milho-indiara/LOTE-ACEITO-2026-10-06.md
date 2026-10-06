# Lote aceito para qualificação: milho GMO, Indiara/GO, 300 km (06/10/2026, revisão 2)

**Aceite de Rogério (06/10/2026):**
- Empresas: Cimilho, Cargill Uberlândia, São Martinho (Usina Boa Vista) e Cargill Bioenergia (Unidade São Francisco).
- O aceite autoriza cadastro e pesquisa. Não confirma compra atual, aceitação de milho GMO nem abordagem.
- As demais candidatas, incluindo as 152 ME/EPP, continuam visíveis.

**O que não foi feito:**
- nenhum e-mail deduzido;
- nenhum crédito Snov consumido;
- nenhum telefonema nem mensagem;
- nenhum representante legal tratado como comprador.

## 1. Situação no Compass (leitura de 06/10/2026)

| Item | Resultado |
|---|---|
| Leitura do D1 de produção (`wrangler d1 execute --remote`, só SELECT) | **Funcionou**: 11 empresas no total, 6 brasileiras |
| Empresas com as raízes 19980044, 60498706, 51466860 ou 10249419 | **Nenhuma** |
| Empresas com "Cargill", "Martinho" ou "Cimilho" no nome | **Nenhuma**: não há duplicação a evitar |
| Unidades em `company_units` com os 4 CNPJs | **Nenhuma** |
| **Conclusão** | As 4 unidades **não estão cadastradas**. Existem só o arquivo `cadastro-lote-aceito.json` e o script `scripts/cadastrar-lote-aceito.mjs`, testado apenas em simulação |
| O que bloqueia a gravação | A API exige sessão do Cloudflare Access, e `cloudflared access token` responde "Unable to find token". A gravação direta no banco não foi feita, porque pularia as regras da API |
| Revisão 2 do pacote | Retirado o canal `coprodutos@saomartinho.com.br`, que atende vendas. Cargos e responsabilidades corrigidos. Incluído Valter Junior (ver 3.3). Método de distância explicitado na fonte |

**Comando para gravar** (Rogério, PowerShell; a simulação vem antes, sem `--apply`):

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" access login https://eag-compass-production.rogeriopalhari23.workers.dev
$env:CF_ACCESS_TOKEN = & "C:\Program Files (x86)\cloudflared\cloudflared.exe" access token -app=https://eag-compass-production.rogeriopalhari23.workers.dev
node --use-system-ca scripts/cadastrar-lote-aceito.mjs docs/implementation/descoberta-milho-indiara/cadastro-lote-aceito.json --base https://eag-compass-production.rogeriopalhari23.workers.dev --apply
```

## 2. Distâncias (mesma metodologia para todas)

**Método:**
- distância **geodésica em linha reta** (fórmula de haversine, Terra com raio de 6.371 km);
- **não** é percurso rodoviário: a estrada é mais longa, e não foi calculada;
- Indiara entra sempre pelo centroide do município (IBGE, -17,1852; -49,9682), referência do Compass (R11.3/R11.6);
- no outro extremo, o melhor ponto disponível da unidade.

| Unidade | Ponto usado | Precisão | Linha reta até o centroide de Indiara | Comparação: sede urbana de Indiara (OSM, -17,1387; -49,9862) | Comparação: centroide × centroide |
|---|---|---|---|---|---|
| Cargill Uberlândia | 18°50'57"S, 48°17'17"O (coordenada de referência do complexo no parecer SUPRAM 2021) | Oficial | **256,5 km** | 261,6 km | 268,1 km |
| Cimilho | Rua Grécia, Tibery, Uberlândia (OSM, rua inteira; o número 1000 não está no mapa) | Rua, ±1 km | **263,0 km** | 268,1 km | 268,1 km |
| São Martinho Boa Vista | Centroide de Quirinópolis; não há coordenada pública da usina, e as outorgas da SEMAD trazem só pontos de captação de irrigação | Município | **151,4 km** | 155,4 km | 151,4 km |
| Cargill Bioenergia São Francisco | Centroide de Quirinópolis, pelo mesmo motivo | Município | **151,4 km** | 155,4 km | 151,4 km |

**Os 263 km da Cimilho** são distância geográfica em linha reta, não percurso rodoviário. As 4 unidades ficam dentro dos 300 km em qualquer das três referências.

## 3. Tabela por unidade

### 3.1 Cargill — complexo de Uberlândia/MG (CNPJ 60.498.706/0134-88)

**Evidências, separadas por tipo:**

| Tipo | Conteúdo [fonte, data] |
|---|---|
| Compra histórica | Milho "fornecido por fazendeiros, cooperativas e corretores" [Parecer SUPRAM, 25/01/2021] |
| Capacidade | 60 mil t/mês de milho (nominal, não é consumo) [mesmo parecer] |
| Operação atual | Vaga de envase de amido em Uberlândia [careers.cargill.com, 09/2026]. Matéria sobre o complexo [Hosa, 11/08/2026] |
| Previsão de volume | Não encontrada |

**Pessoas:**

| Campo | Vinicius de Carvalho Figueiredo | Paulo Henrique Borges Silva |
|---|---|---|
| Vínculo atual | Cargill, cargo atual desde 05/2022 [LinkedIn, 04/09/2026] | Cargill, cargo atual desde 12/2023 [LinkedIn, 19/08/2026] |
| Cargo | Origination Manager — Corn CSSTSA (amidos e adoçantes América do Sul). Local do cargo: Uberlândia. Residência no perfil: Maringá/PR | Merchant, Starches & Sweeteners. Local: Uberlândia |
| Responsabilidade de compra | Gerencia a originação de milho do negócio de amidos. **Se decide a compra desta unidade: a confirmar.** O escopo "South America" pode incluir outras fábricas | Origina milho **waxy e Non-GMO**. Para o milho **regular**, "garante a disponibilidade… em alinhamento com a CASC" (originação de grãos da Cargill). A compra do milho regular parece passar pela CASC: **a confirmar** |
| Unidade atendida | Uberlândia (local do cargo); outras fábricas a confirmar | "As fábricas" de amidos; Uberlândia é o local do cargo |
| Canal profissional | Só o perfil do LinkedIn | Só o perfil do LinkedIn |

**Canal da empresa e da unidade:**
- telefone oficial publicado da unidade Amidos e Adoçantes Uberlândia: (34) 3218-4900 [cargill.com.br/localidades]. É canal geral e não foi usado;
- fornecedores de materiais e serviços: Central de Fornecedores, portal Aravo, só por convite;
- produtores: GPS Cargill, cadastro por link enviado por um representante comercial;
- **não há canal público específico de venda de milho para a fábrica**.

**Milho GMO:** **a confirmar.** Existe uma linha Non-GMO e waxy; "regular" não prova GMO. Nenhum rótulo ou ficha técnica com o símbolo de transgênico foi encontrado.

**Pendência:** quem compra o milho regular para Uberlândia (gerente de originação CSSTSA ou mesa regional da CASC). Um perfil público antigo de "Merchant Regional MG GO Leste" descreve a mesa regional "visando atender a originação de grãos para a Fábrica de Uberlândia", mas a pessoa está hoje em outra função e não foi registrada.

**Próximo passo:** depois do cadastro, registrar a dúvida CSSTSA × CASC como ponto a verificar e buscar fonte sobre GMO no milho regular. Nenhum contato antes da T11.

### 3.2 São Martinho — Usina Boa Vista, Quirinópolis/GO (CNPJ 51.466.860/0062-78)

**Evidências, separadas por tipo:**

| Tipo | Conteúdo [fonte, data] |
|---|---|
| Compra histórica | Cerca de 439 mil t de milho compradas até 31/03/2024 para a safra 24/25 [carta financeira, 17/06/2024]. Milho "adquirido de cooperativas e tradings" e "diretamente dos produtores" [relatório de sustentabilidade, sem data no trecho] |
| Previsão de volume | 495 mil t na safra 2026/27 [RPAnews, 27/05/2026]. Segunda fase com +635 mil t/ano a partir de 2027 |
| Operação atual | "Processa 500 mil t de milho anualmente" [RPAnews, 01/04/2026]. Unidade coletora de 240 mil t em Montividiu contratada [Portal GHF, 01/12/2025] |
| Homologação de fornecedores | **De milho:** "homologação de 120 fornecedores aptos ao fornecimento de milho" com critérios socioambientais (Agrotools e Neoway); contratos com cláusulas de legislação, trabalho, anticorrupção e LGPD [relatório]. **De materiais e serviços:** Portal de Compras Paradigma mais cadastro no SAP, este só por solicitação do comprador responsável [manual "Cadastro de Novo Fornecedor", site]. O manual cobre Suprimentos; **se a homologação de milho usa o mesmo portal: a confirmar** |

**Pessoas:**

| Campo | Luciano Jorge Silva | Helder Gosling |
|---|---|---|
| Vínculo atual | São Martinho, desde 01/2026 [LinkedIn, 27/08/2026] | Diretor citado em 01/12/2025 [Portal GHF] |
| Cargo | Gerente de Originação de Milho e Comercialização de Coprodutos; base em Rio Verde/GO | Diretor Comercial e de Logística |
| Responsabilidade de compra | Lidera a originação de milho e a segurança de abastecimento. **Decisor não confirmado** | Falou sobre o abastecimento de milho da Boa Vista e os fornecedores. Compra direta não confirmada |
| Unidade atendida | Operação de etanol de milho; a Boa Vista é a **única** planta de milho do grupo [BNDES; RPAnews 01/04/2026] | Boa Vista, citada na matéria; função corporativa |
| Canal profissional | Só o perfil do LinkedIn | Nenhum canal público pessoal |

**Canal da empresa:**
- não há canal público de compra de milho;
- `coprodutos@` atende **vendas** de coprodutos e foi retirado do pacote de cadastro;
- o Portal de Compras é para Suprimentos.

**Milho GMO:** **a confirmar.** As certificações citadas são ISCC, Halal e Kosher; nenhuma é Non-GMO. Nenhum rótulo com o símbolo de transgênico foi encontrado.

**Pendência:** o canal de homologação de **fornecedor de milho** e se Luciano atende a Boa Vista diretamente (o perfil indica base em Rio Verde).

**Próximo passo:** depois do cadastro, registrar o gerente de originação como decisor provável, ainda não confirmado. Nenhum contato antes da T11.

### 3.3 Cargill Bioenergia — Usina São Francisco, Quirinópolis/GO (CNPJ 10.249.419/0002-16)

**Evidências, separadas por tipo:**

| Tipo | Conteúdo [fonte, data] |
|---|---|
| Operação atual | Cana e milho na safra 2025/26 [STG News, 01/09/2026] |
| Capacidade | Maceração de 600 mil t de milho/ano [Globo Rural, 11/06/2025] |
| Compra histórica | Originação de milho e sorgo "para abastecimento das operações de bioenergia da Cargill", com "negociação e fechamento de contratos de compra de milho e sorgo" com produtores e cooperativas, de 01/2025 a 09/2025 [perfil público de ex-originador, 17/08/2026]. **A pessoa não está mais no cargo** |
| Previsão de volume | Não encontrada |

**Pessoas:**

| Campo | Valter Junior | Evandro Rogério Zanini |
|---|---|---|
| Vínculo atual | Cargill, Coordenador de Negócios II em Quirinópolis desde 09/2025 [LinkedIn, 12/09/2026] | Perfil ainda com o nome SJC Bioenergia [LinkedIn, 21/09/2026] |
| Cargo | Coordenador de Negócios II. Antes, de 07/2022 a 09/2025: originação de milho e sorgo e venda de coprodutos na SJC | Gerente de Suprimentos Corporativo |
| Responsabilidade de compra | **A confirmar:** o perfil não descreve o cargo atual. Na Cargill, "coordenador de negócios" costuma originar grãos, mas isso é hipótese, não confirmação | Compras, contratos e almoxarifado. **Responsabilidade por milho não declarada**; suprimentos, sozinho, não comprova a compra da commodity |
| Unidade atendida | Quirinópolis; se atende a Usina São Francisco: a confirmar | As usinas e a unidade de grãos (genérico) |
| Canal profissional | Só o perfil do LinkedIn | Só o perfil do LinkedIn |

**Correção da revisão anterior:** o texto anterior dizia que o ex-analista de originação "saiu em 02/2026". Errado: a postagem "encerro meu ciclo na Cargill Bioenergia" é de **outra pessoa**, que Valter apenas curtiu. Valter segue na Cargill, em outro cargo.

**Canal da empresa:**
- telefone oficial publicado da unidade Quirinópolis: (64) 3615-9500 [cargill.com.br/localidades]. É canal geral e não foi usado;
- não há canal público de compra de milho.

**Milho GMO:** **a confirmar.** Nenhuma fonte encontrada.

**Pendência:** **responsável atual pela originação de milho da unidade não identificado.** A busca pública ficou nos dois perfis acima. Outros perfis de originação em Quirinópolis são de 2025 e já encerrados.

**Próximo passo:** a pesquisa pública chegou ao limite. Depois do cadastro, registrar o ponto a verificar "originador de milho atual da Usina São Francisco" para confirmar no primeiro contato autorizado.

### 3.4 Cimilho — Uberlândia/MG (CNPJ 19.980.044/0001-53, EPP)

**Evidências, separadas por tipo:**

| Tipo | Conteúdo [fonte, data] |
|---|---|
| Uso e processamento | Fabrica derivados de milho; vende milho em grão; armazena grãos [cimilho.com.br, consultado em 06/10/2026, página sem data] |
| Compra de terceiros | **Não comprovada.** O site cita "fornecedores" e milho "provindo da zona rural", sem dizer de quem compra. Os serviços de **armazenagem e moagem para terceiros** usam milho do cliente: isso **não** é compra |
| Operação atual | Receita ativa. Licença ambiental simplificada (LAS Cadastro) deferida em 21/04/2018 [SEMAD MG]. LinkedIn da empresa com 3 funcionários. Anúncio ativo no MF Rural. Não há fonte datada de produção recente |
| Previsão de volume | Não encontrada |

**Pessoas e canal:**

| Campo | Situação |
|---|---|
| Pessoa identificada | **Nenhuma.** A conta "Gerente na Cimilho" no LinkedIn usa o nome da empresa e não identifica uma pessoa |
| Cargo, responsabilidade, unidade | — (a confirmar) |
| Canal profissional | Canal **geral** da empresa, publicado no site: `cimilho@cimilho.com.br`, (34) 3213-4242 e (34) 3213-4251. Preservado como canal geral, não como comprador |
| Milho GMO | **A confirmar** |

**Pendência:**
- responsável pela compra de milho e evidência de compra de terceiros: **busca pública esgotada**;
- sócios da Receita são representantes legais e não foram usados como compradores.

**Próximo passo:** depois do cadastro, registrar o ponto a verificar "quem compra milho e de quem", para o primeiro contato autorizado pelo canal geral.

## 4. Resumo para decisão

| Unidade | Responsável encontrado | Canal apropriado hoje | Evidência mais forte | Pendência principal |
|---|---|---|---|---|
| Cargill Uberlândia | Gerente de originação de milho CSSTSA (decisor não confirmado); merchant de milho Non-GMO e waxy | Nenhum canal de compra público; telefone geral da unidade publicado | Compra de produtores, cooperativas e corretores (2021) e operação em 2026 | Milho regular comprado via CASC? GMO? |
| São Martinho Boa Vista | Gerente de originação de milho (desde 01/2026; decisor não confirmado) | Nenhum canal de compra de milho público (coprodutos@ é vendas) | Compra de cerca de 439 mil t (2024); 120 fornecedores de milho homologados; 495 mil t previstas (2026/27) | Canal de homologação de fornecedor de milho; GMO |
| Cargill Bioenergia São Francisco | **Nenhum confirmado.** Coordenador de Negócios em Quirinópolis (função atual não descrita) e gerente de suprimentos (milho não declarado) | Telefone geral da unidade publicado | Compra de milho e sorgo por originação própria até 09/2025; operação em 2026 | Originador atual; GMO |
| Cimilho | **Nenhum** | E-mail e telefone gerais do site | Processa e vende milho (site sem data); LAS 2018 | Quem compra e de quem; GMO |
