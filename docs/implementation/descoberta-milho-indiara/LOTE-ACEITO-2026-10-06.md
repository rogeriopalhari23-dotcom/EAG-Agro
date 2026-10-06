# Lote aceito para qualificação: milho GMO, Indiara/GO (06/10/2026)

**Aceite de Rogério (06/10/2026):**
- Empresas: Cimilho, Cargill Uberlândia, São Martinho (Usina Boa Vista) e Cargill Bioenergia (Unidade São Francisco).
- O aceite autoriza **cadastro e pesquisa**. Não confirma compra atual, aceitação de milho GMO nem abordagem.
- As demais candidatas, incluindo as 152 ME/EPP, continuam visíveis em `CANDIDATAS.md` e `QUALIFICACAO-LOTES-2026-10-06.md`.

**O que não foi feito:**
- nenhum envio preparado;
- nenhum crédito Snov consumido;
- nenhuma campanha ativada;
- nenhum e-mail deduzido;
- nenhum representante legal (sócio, administrador) tratado como comprador.

## Bloqueio do cadastro no Compass (credencial)

| Acesso | Situação em 06/10/2026 |
|---|---|
| API de produção | Atrás do Cloudflare Access, sessão expirada. `cloudflared access token` respondeu: "Unable to find token… run login command" |
| D1 remoto pelo wrangler | Erro 7403 ("account is not authorized") |

Cadastrar direto no banco contornaria as regras da API (raiz de CNPJ única, e-mail só publicado, limite de 3 pessoas), por isso **não foi feito**.

**Pronto para aplicar:**
- `cadastro-lote-aceito.json`: empresa pela unidade e CNPJ, evidência pendente de validação, canal geral publicado e pessoas com fonte;
- `scripts/cadastrar-lote-aceito.mjs`: simula por padrão e só grava com `--apply`. Se a raiz de CNPJ já existir (outra unidade), não anexa nada e pede conferência.

**Para aplicar** (Rogério, no PowerShell):

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" access login https://eag-compass-production.rogeriopalhari23.workers.dev
$env:CF_ACCESS_TOKEN = & "C:\Program Files (x86)\cloudflared\cloudflared.exe" access token -app=https://eag-compass-production.rogeriopalhari23.workers.dev
node --use-system-ca scripts/cadastrar-lote-aceito.mjs docs/implementation/descoberta-milho-indiara/cadastro-lote-aceito.json --base https://eag-compass-production.rogeriopalhari23.workers.dev --apply
```

**Limitação conhecida:**
- O cadastro manual grava o CNPJ da unidade na empresa (`registration_id`), mas não cria a linha em `company_units`. Só a busca da Casa dos Dados cria essa linha.
- Por isso a distância e o QSA automático não aparecem na tela. A distância conferida está nesta página e na fonte da empresa (opção C de `DESCOBERTA-BRASIL-PROXIMO-PASSO.md`, ainda não aprovada).

## Resumo por empresa

### 1. Cargill — complexo de Uberlândia/MG

**Grupo:** compra de milho de terceiros comprovada.

| Campo | Situação |
|---|---|
| Unidade e CNPJ | 60.498.706/0134-88. Rua Will Cargill, 880, Distrito Industrial. **Confirmado**: CNPJ, endereço e coordenada publicados no parecer SUPRAM; endereço igual ao da Receita |
| Distância | **256,5 km** pela coordenada oficial do parecer (18°50'57"S, 48°17'17"O) |
| Evidência de milho | Planta de milho de 60 mil t/mês de capacidade. Milho "fornecido por fazendeiros, cooperativas e corretores" [Parecer SUPRAM TM 0138312/2021, 25/01/2021] |
| Operação atual | Vaga "Operador III — Envase de Amido, Uberlândia" publicada em 09/2026 (careers.cargill.com, vaga 333840) |
| Milho GMO | **A confirmar.** O perfil público de um originador cita milho waxy e **Non-GMO**, além de "milho regular" para moagem: há linha Non-GMO, sem prova de que todo o milho seja Non-GMO |
| Canal profissional público | Nenhum canal comercial de compra de milho publicado. O telefone e o e-mail da Receita são cadastrais e não foram usados |

**Pessoas:**

| Pessoa | Cargo (fonte) | Responsabilidade de compra | Unidade | Canal disponível |
|---|---|---|---|---|
| Vinicius de Carvalho Figueiredo | Origination Manager — Corn CSSTSA, desde 05/2022 (LinkedIn público, 09/2026) | Indicada: gerente de originação de milho do negócio de amidos. **Decisor não confirmado** | Uberlândia | Só o perfil do LinkedIn |
| Paulo Henrique Borges Silva | Originação de milho para as fábricas, desde 12/2023 (LinkedIn público, 08/2026) | Indicada: origina milho waxy e Non-GMO e garante milho regular para moagem. Influenciador | Uberlândia | Só o perfil do LinkedIn |

**Não incluídos:**
- comprador de MRO (peças e serviços);
- originadores da área de grãos e insumos (CASC), que compram soja e milho de produtores para outra operação, não para a fábrica.

**Próximo passo:**
- confirmar com fonte se o gerente de originação de milho decide a compra para a fábrica de Uberlândia;
- confirmar se a fábrica aceita milho GMO (linha regular);
- conciliar o registro MAPA MG0001937.

### 2. São Martinho — Usina Boa Vista, Quirinópolis/GO

**Grupo:** passa para **compra de milho de terceiros comprovada** (antes estava no grupo 2).

| Campo | Situação |
|---|---|
| Unidade e CNPJ | 51.466.860/0062-78. Rod. GO-164 km 10, Fazenda Boa Vista. **Confirmado** por cadastro oficial (Receita, CNAE álcool, e MAPA) |
| Distância | 151,4 km pelo centroide; a usina é rural, longe do limite |
| Evidência de compra | Em 31/03/2024 a companhia havia comprado cerca de 439 mil t de milho para a safra 24/25 [carta financeira, 17/06/2024]. Milho "adquirido de cooperativas e tradings" e "diretamente dos produtores"; 120 fornecedores de milho homologados [relatório de sustentabilidade da São Martinho] |
| Operação atual | 495 mil t de milho previstas na safra 2026/27 [RPAnews, 27/05/2026]. Unidade coletora de 240 mil t em Montividiu em construção (Kepler Weber, 12/2025) |
| Milho GMO | **A confirmar** |
| Canal profissional público | `coprodutos@saomartinho.com.br` e (64) 3615-9704, publicados no site. É canal de **venda de coprodutos**, não de compra de milho |

**Pessoas:**

| Pessoa | Cargo (fonte) | Responsabilidade de compra | Unidade | Canal disponível |
|---|---|---|---|---|
| Luciano Jorge Silva | Gerente de Originação de Milho e Comercialização de Coprodutos (LinkedIn público, 08/2026) | Indicada: lidera a originação de milho e a segurança de abastecimento. **Decisor não confirmado** | Boa Vista, única planta de milho do grupo (BNDES). O perfil não mostra a localização | Só o perfil do LinkedIn |
| Helder Gosling | Diretor Comercial e de Logística (Portal GHF, 01/12/2025) | Nível de diretoria; citado sobre o abastecimento de milho da Boa Vista. Compra direta não confirmada | Corporativo / Boa Vista | Nenhum canal público pessoal |

**Não incluídos:** compradores de MRO e materiais da unidade.

**Próximo passo:**
- confirmar o canal de cadastro de fornecedor de milho (homologação);
- confirmar se aceita milho GMO.

### 3. Cargill Bioenergia — Usina São Francisco, Quirinópolis/GO

**Grupo:** uso de milho comprovado; compra de terceiros com indício forte, a confirmar.

| Campo | Situação |
|---|---|
| Unidade e CNPJ | 10.249.419/0002-16. Rod. GO-206 km 18, Fazenda São Francisco. **Confirmado** pelo nome fantasia "USF Usina São Francisco" na Receita e pelo registro MAPA |
| Distância | 151,4 km pelo centroide |
| Evidência de milho | Processa cana e milho em 2025/26 (etanol, óleo, DDG) [STG News, 01/09/2026]; maceração de 600 mil t de milho/ano [Globo Rural, 11/06/2025] |
| Indício de compra | Perfil público de analista de "originação de grãos (milho/sorgo)" na SJC Bioenergia (2022–09/2025). A pessoa saiu em 02/2026 e por isso **não** foi registrada |
| Milho GMO | **A confirmar** |
| Canal profissional público | Nenhum canal comercial publicado. O e-mail fiscal da Receita não foi usado |

**Pessoas:**

| Pessoa | Cargo (fonte) | Responsabilidade de compra | Unidade | Canal disponível |
|---|---|---|---|---|
| Evandro Rogério Zanini | Gerente de Suprimentos Corporativo (LinkedIn público, 09/2026, ainda com o nome SJC) | Compras, contratos e almoxarifado das usinas e da unidade de grãos. **Compra de milho não declarada** | Quirinópolis e Cachoeira Dourada | Só o perfil do LinkedIn |

**Ponto a verificar:** quem origina milho hoje para a unidade de grãos depois da integração à Cargill. Pode ser a originação regional da Cargill. Um perfil de "Diretor Comercial … originação de milho" em Quirinópolis aparece como cargo anterior e **não** foi registrado.

**Próximo passo:** identificar o originador de milho atual da Cargill Bioenergia por fonte pública.

### 4. Cimilho — Uberlândia/MG (EPP)

**Grupo:** uso e processamento de milho comprovados; compra de terceiros a confirmar.

| Campo | Situação |
|---|---|
| Unidade e CNPJ | 19.980.044/0001-53. Rua Grécia, 1000, Tibery. **Confirmado**: endereço do site igual ao da Receita |
| Distância | **263,0 km** pela rua (OpenStreetMap, sem o número: precisão de ±1 km). Antes era 268,1 km pelo centroide; está dentro do raio |
| Evidência de milho | Fabrica derivados de milho para ração e indústria, vende milho em grão e armazena grãos [cimilho.com.br, consultado em 06/10/2026] |
| Operação atual | Receita ativa; página da empresa no LinkedIn com 3 funcionários (+1 no ano); anúncio ativo no MF Rural. Sem fonte datada da produção |
| Milho GMO | **A confirmar** |
| Canal profissional público | `cimilho@cimilho.com.br` e (34) 3213-4242 / 3213-4251, publicados no site. Canal geral, não comprador |

**Pessoas:** nenhuma identificada. O perfil "Gerente na Cimilho" no LinkedIn é uma conta com o nome da empresa, não de uma pessoa. Os sócios da Receita são representantes legais e **não** foram tratados como compradores.

**Ponto a verificar:** quem compra o milho e de quem (o site cita "fornecedores").

**Próximo passo:** confirmar o responsável pela compra e o volume pelo canal geral, só quando o contato for autorizado.
