# Descoberta no Brasil — próximo passo com os recursos disponíveis (2026-10-06)

Nada aqui contrata serviço, ativa campanha ou envia mensagem.

## 1. Descobrir não é abordar

| | Descoberta | Abordagem (contato real) |
| --- | --- | --- |
| O que é | Buscar e cadastrar empresas, registrar evidências, perfil comprador e pessoas com fonte | E-mail, ligação ou LinkedIn para a empresa ou pessoa |
| Exige T11 validada | Não pela Spec ("Antes de contatos reais da Etapa 1"). Os dados pessoais coletados (sócios, pessoas) seguem P7/R9, sem prazo de retenção até a T11 | **Sim**, inteira, inclusive a política de retenção (Spec, tabela T11; §6.0.1; R9.1; R23.4) |
| Outros bloqueios | Fonte de empresas (T4) e mapeamento setor → CNAE (R28.2) | OpenClaw (R21.8/R25.2), canal (R26.1), campanha ativa e aprovação individual de cada ficha |

## 2. A Casa dos Dados é indispensável?

**Para o radar nacional automático (R11: commodity + cidade/UF + raio, todos os candidatos no raio), sim, no código atual:**
- R11 e R13 dependem de T4;
- a única fonte nacional aprovada é a Casa dos Dados (G8, 2026-09-22), e é a única que cria as **unidades** (CNPJ, município, porte, CNAE) que o radar usa para distância e prioridade;
- sem a chave, o radar não roda. Hoje há 0 buscas nacionais.

**Para descobrir empresas sem contratar, há um caminho manual que funciona hoje** (conferido localmente em 2026-10-06, com dados fictícios e sem rede):

| Passo | Funciona sem contratação? | Observação |
| --- | --- | --- |
| Cadastrar a empresa por CNPJ, com fonte (lista de associação setorial, site, feira, indicação) | Sim | R13.1/R13.2: fonte e data registradas; a raiz de CNPJ não duplica |
| Perfil comprador da commodity | Sim | Fica `pending_size` (porte desconhecido não impede, R14.8) |
| Evidência (indício comercial ou documento) | Sim | Indício nunca confirma condição (R14.2) |
| Pessoa de compras registrada à mão, com fonte | Sim | Registro manual com fonte obrigatória |
| Sócios pelo QSA (BrasilAPI, gratuita, já em produção) | **Não, nesse caminho** | A pesquisa de pessoas exige uma unidade com CNPJ, e só a busca da Casa dos Dados cria unidades. Resultado: "Sem CNPJ de unidade cadastrado" |
| Distância ao ponto de referência | **Não** | Sem unidade e município, a empresa aparece como "Localização pendente" (R11.6) |
| Validação de e-mail (Snov) | Consome créditos | Não usar sem decisão |

**Outras fontes:**
- **Dados Abertos do CNPJ da Receita:** gratuitos, mas não implementados (na pesquisa técnica ficaram como "adaptador futuro"). O endereço registrado (`arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/`) devolveu **404** em 2026-10-06, ou seja, mudou.
- **OpenStreetMap:** recusado a partir do Worker (522), por isso só no navegador.
- Nenhuma das duas está aprovada como fonte do radar nacional.

## 3. Propostas (decisão de Rogério)

| Opção | Proposta exata | Efeito | Custo |
| --- | --- | --- | --- |
| **A — manual, já disponível** | Descobrir as primeiras empresas pelo método da skill: setor usuário → lista → site → CNPJ. Cadastrar cada uma com a fonte; registrar perfil, evidência e pessoa com fonte. | Começa já. Sem radar, sem distância, sem cobertura medida (R13.5) e sem QSA automático | Nenhum |
| **B — Casa dos Dados em avaliação** | Rogério cria a conta e usa as 200 consultas gratuitas de 7 dias (pesquisa técnica, §7.2). Grava `CASADOSDADOS_API_KEY` no Worker. | Radar R11 completo numa busca real, com unidades, distância, QSA e cobertura. **É cadastro em serviço: decisão de Rogério** | Grátis por 7 dias; depois R$ 29,90–59,90/mês (preço registrado em 2026-09-22, a reconferir) |
| **C — completar o caminho manual** | Ao cadastrar empresa brasileira por CNPJ, criar a unidade a partir da BrasilAPI (município, porte, CNAE, situação), que é fonte gratuita e já usada. | QSA e distância no caminho manual, sem contratar | **Funcionalidade nova**: só com aprovação, depois em tarefa própria com testes |

**Recomendação:** começar por **A**. Com a commodity e a cidade definidas, decidir entre **B** (melhor cobertura, exige cadastro no serviço) e **C** (sem serviço, exige desenvolvimento aprovado).

## 4. Dados comerciais que Rogério precisa fornecer para iniciar a busca

**Para a campanha nacional e a busca** (R11.1, R28.1):
1. **Commodity** (1 ou 2), do catálogo: soja, milho, café, açúcar (ICUMSA 45, ICUMSA 150, VHP), etanol, entre outras.
2. **Cidade e UF de referência** do fornecedor, que é o centro da busca e nunca o endereço do fornecedor (R11.3).
3. **Raio:** 5 km (padrão) ou de 100 a 1.500 km em passos de 100 (R11.14).
4. **ICP da campanha** (R28.1):
   - setores usuários (uso final; ex.: açúcar → refrigerante, bala, chocolate, sorvete, panetone);
   - porte-alvo (pequena e média por padrão; porte só desempata);
   - região;
   - cargo do decisor e do influenciador;
   - dores de fornecimento conhecidas;
   - ciclo médio de compra.
5. **Aprovação da lista setor → CNAE** (R28.2). Depois da escolha da commodity, preparo a proposta de subclasses CNAE com a fonte CONCLA/IBGE de cada uma. Nada entra sem a aprovação de Rogério.

**Só para a opção A (manual):** as fontes que Rogério aceita para montar a lista (ex.: associação setorial, feira, diretório, indicação), porque cada empresa cadastrada leva a sua fonte.

**Não são necessários para descobrir, só para abordar depois:**
- declarações da campanha (volume disponível, prova social; R16.7);
- T11;
- OpenClaw;
- liberação do canal.

## 5. O que já está pronto em produção para a descoberta

- 5.570 municípios com centroide (cálculo de raio).
- Parâmetros de raio aprovados (`radius_allowed_km`, `radius_default_km`).
- Cadastro de empresa, perfil, evidência e pessoas.
- Triagem de sanções: listas válidas até 2026-10-24. Depois disso, reimportar antes de aprovar fichas.

**Faltam:** a chave da Casa dos Dados (opção B), as linhas setor → CNAE e a campanha nacional com o ICP.
