# T11: revisão para o piloto brasileiro por telefone manual

**Data:** 06/10/2026. **Estado:** proposta para decisão de Rogério.
- A Spec não foi alterada; esta proposta só entra nela depois de aprovada.
- A **T11 continua não validada.**

**Alcance:** ligações manuais de nível 0, feitas por Rogério, às 13 unidades aceitas no Brasil (`T11-VALIDACAO-PILOTO-BR.md`).

**Fora do alcance, e continuam bloqueados:**
- e-mail automático;
- campanhas e fichas de envio;
- WhatsApp;
- Snov;
- qualquer contato na Alemanha.

**Limites deste documento:**
- Não é parecer jurídico.
- Não registra autorização institucional da EAG.
- Não declara isenção da LGPD.
- As referências legais são leitura de trabalho. Em 06–08/10/2026 os textos de L4, L6 e L9 foram conferidos nas fontes oficiais: LGPD (planalto.gov.br), Res. CD/ANPD 2/2022, 15/2024 e 19/2024 (gov.br/anpd e DOU), Agenda Regulatória 2025–2026 (gov.br/anpd) e DPA da Cloudflare 6.4.

## 0. Decisão registrada nesta data

**Rogério aprovou (06/10/2026) o uso individual do Compass como ferramenta pessoal de apoio ao seu trabalho comercial.**

O que isso significa:
- Ele é o único usuário.
- Ele define finalidade e meios do tratamento feito no Compass e responde operacionalmente pelo cumprimento das obrigações da §2.

O que isso **não** significa:
- não é autorização da EAG para uso da ferramenta;
- não define a qualificação jurídica de controlador ou operador perante a EAG;
- não afasta a LGPD;
- não valida a T11;
- não libera nenhum canal.

## 1. Por que as ligações estão bloqueadas hoje

| Origem | Texto | Natureza |
|---|---|---|
| Spec, tabela de dependências | T11 "Não validado com responsável competente", exigida "Antes de contatos reais da Etapa 1" | Exigência da Spec |
| `DECISOES-PILOTO-2026-10-01.md`, correção de 06/10 | "T11 inteira, inclusive a política e os prazos de retenção, precisa estar validada antes do primeiro contato real" | Leitura da Spec vigente |
| R9.1 | "validação jurídica antes da implementação final" (da exclusão) | Exigência da Spec |
| R26.6 | testes controlados "antes de qualquer contato real" | Exigência da Spec, escrita para canais automáticos |
| Constituição P7 | tratamento "conforme LGPD/GDPR e política EAG"; "retenção definida" | Princípio da Constituição |

O bloqueio de hoje vem da Spec, não diretamente da lei. A lei impõe obrigações (§2), mas não exige parecer externo antes de cada ligação.

## 2. As três categorias

### 2.1 Decisões operacionais que Rogério pode aprovar

| # | Decisão | Recomendação |
|---|---|---|
| O1 | Escopo do piloto | Telefone manual, 13 unidades, números gerais das empresas; nada automático |
| O2 | Responsável pelo Compass e canal do titular | Rogério, com um endereço de contato escolhido por ele para pedidos de titulares (o mesmo que ele dirá na ligação, se perguntarem) |
| O3 | Base legal adotada e teste de balanceamento | Legítimo interesse, com o teste documentado da §4 (decisão de quem trata; revisável se houver orientação contrária) |
| O4 | Texto de transparência e oposição na ligação | Texto da §4 |
| O5 | Telefones do cadastro da Receita que parecem pessoais (celulares) | Não ligar para celular do cadastro sem indicação de que é comercial. Hoje afeta Rural Forte, (64) 99295-1212, e Super-Bovi, (62) 99468-9092 |
| O6 | Prazos de retenção A, B, C e D (`T11-VALIDACAO-PILOTO-BR.md` §3) | Escolher uma opção em cada. E e F são da ponte de e-mail e não entram no piloto por telefone. G (caixa da EAG) não é decisão de Rogério e não é usada nas ligações |
| O7 | Prazos para atender pedidos | Por tipo de pedido, conforme L4 (corrigido em 06/10/2026): não aplicar 15 dias a todos. Meta interna sugerida para pedidos sem prazo legal: resposta em até 15 dias, com execução da exclusão no mesmo dia da decisão |
| O8 | Incidente de segurança | Meta interna (escolha, não lei): avaliar em até 24 h do conhecimento. Obrigação legal separada em L6 (corrigido em 06/10/2026) |
| O9 | Triagem de sanções | Manter, como controle interno; refazer antes das ligações se elas ocorrerem depois de 24/10/2026 |

### 2.2 Obrigações legais aplicáveis

| # | Obrigação | Base (conferir) | Como o Compass atende hoje | Lacuna |
|---|---|---|---|---|
| L1 | A LGPD se aplica. Nome, cargo, perfil e telefone de pessoa são dados pessoais; a exceção para uso particular não econômico não cabe, porque a finalidade é comercial. Dados só da empresa (CNPJ, endereço) não são dados pessoais | Art. 3, Art. 4 I, Art. 5 I | Tratado como dado pessoal: cifrado, com acesso restrito | — |
| L2 | Base legal, finalidade e necessidade. Com legítimo interesse: finalidade legítima, situação concreta, só os dados necessários e transparência | Art. 6, Art. 7 IX, Art. 10 §§1–2 | Minimização praticada: nenhum e-mail ou telefone pessoal coletado ou deduzido | Teste de balanceamento não documentado (O3) |
| L3 | Informar quem pergunta e respeitar a oposição | Art. 9, Art. 10 §2, Art. 18 §2 | Supressão por telefone existe (`POST /api/suppression`, canal `phone`) | ~~A supressão de telefone não suspende a ligação de nível 0~~: corrigido e não publicado (`PUBLICACAO-SUPRESSAO-TELEFONE.md`). Texto de transparência não aprovado (O4) |
| L4 | Atender direitos do titular, com prazos diferentes por tipo (texto oficial conferido) | **Confirmação e acesso** (art. 19): formato simplificado imediatamente, ou declaração clara e completa (origem, critérios, finalidade) em até 15 dias do requerimento. **Agente de pequeno porte** (Res. CD/ANPD 2/2022, se enquadrado: art. 2º, I inclui pessoa natural; art. 3º exclui alto risco): simplificada em até 15 dias (art. 15) e completa em prazo em dobro, 30 dias (art. 14, III). **Correção, eliminação, anonimização, bloqueio, oposição e demais** (art. 18, §§ 3º–5º e § 2º): sem custo, "nos prazos e nos termos previstos em regulamento"; o regulamento de direitos dos titulares **não foi publicado** (Agenda Regulatória 2025–2026, item 1, "em andamento"): não há prazo legal fixo. Se não for possível atender de imediato, responder indicando as razões (art. 18, § 4º). Comunicar correção/eliminação a quem recebeu os dados por uso compartilhado (art. 18, § 6º) | Exclusão implementada; teste em produção com registro fictício pendente (§8) | Canal do titular (O2); enquadramento como pequeno porte não declarado |
| L5 | Segurança adequada | Art. 46 | Access, cifragem de dados pessoais, auditoria sem dados pessoais legíveis | — |
| L6 | Comunicar incidente relevante e manter registro (texto oficial conferido) | LGPD art. 48; Res. CD/ANPD 15/2024. **Quando:** incidente que possa afetar significativamente interesses e direitos fundamentais **e** envolva ao menos um critério: dados sensíveis; de crianças, adolescentes ou idosos; financeiros; de autenticação; protegidos por sigilo; ou em larga escala (art. 5º). **Prazo:** 3 dias úteis à ANPD (art. 6º) e aos titulares (art. 9º), contados do conhecimento pelo controlador de que o incidente afetou dados pessoais (art. 6º, § 1º); complementação fundamentada em até 20 dias úteis (art. 6º, § 3º); formulário eletrônico da ANPD, pelo encarregado ou representante constituído (art. 6º, §§ 4º–5º). **Exceção:** prazo diferente previsto em legislação específica (art. 6º); agente de pequeno porte tem prazos em dobro (art. 6º, § 8º; art. 9º, § 6º). **Registro:** todo incidente, comunicado ou não, registrado por no mínimo 5 anos a partir do registro (art. 10) | Sem procedimento escrito; sem registro de incidentes | O8 e opção I (§6) |
| L7 | Registro das operações de tratamento | Art. 37; Res. CD/ANPD 2/2022 (agente de pequeno porte: registro simplificado; encarregado dispensado, mas canal de comunicação obrigatório; prazos em dobro; não vale para tratamento de alto risco) | Não existe | Registro simplificado (§4) |
| L8 | Eliminar quando a finalidade acabar | Art. 15–16 | Rotina de exclusão existe | Prazos (O6) |
| L9 | Transferência internacional (conferida em 06/10/2026) | LGPD art. 33; Res. CD/ANPD 19/2024 (cláusulas-padrão da ANPD adotadas integralmente e sem alteração, em instrumento firmado entre exportador e importador, art. 16; prazo de incorporação de 12 meses, vencido em 08/2025); Res. CD/ANPD 32/2026 (UE adequada) | Banco D1 primário em **ENAM** (América do Norte, conforme "served_by_region" das consultas). **DPA da Cloudflare v6.4, de 03/04/2026**, faz parte do contrato da conta por incorporação (Self-Serve Subscription Agreement; página "Brazil LGPD FAQs" da Cloudflare). Mecanismos do DPA: cláusulas-padrão **europeias** (6.2), aditivo do Reino Unido, Suíça, Data Privacy Framework (6.4) e Global CBPR/PRP (7). **Não há cláusulas-padrão da ANPD**; o Brasil não participa do Global CBPR; a ANPD não reconheceu as cláusulas europeias como equivalentes (Res. 19/2024, arts. 18–20). A FAQ da Cloudflare afirma "proteção comparável", o que não é mecanismo do art. 33 | **Mecanismo do art. 33 não identificado** para a transferência aos EUA: decisão D-L9 (§3) |

**Não se aplicam ao piloto por telefone:**
- GDPR e UWG: Alemanha.
- Regras de e-mail comercial e da Hostinger: não há e-mail automático.

**A conferir, sem tratar como bloqueio:**
- se as regras de telemarketing ativo da Anatel (prefixo 0303) alcançam ligações B2B manuais e individuais. A leitura de trabalho é que se dirigem a telemarketing em escala, mas isso não foi verificado.

### 2.3 Exigências adicionais criadas pela Spec

| # | Exigência | Fonte | Proposta para o telefone manual no Brasil |
|---|---|---|---|
| S1 | Validação da T11 "com responsável competente" antes de qualquer contato real | Tabela de dependências | Dividir a T11. A **T11-BR-TEL** fica concluída quando Rogério aprovar O1–O9 e L2–L9 estiverem atendidos ou com ação registrada. A validação externa continua exigida para e-mail automático, Alemanha e mudança de base legal |
| S2 | Validação jurídica antes da implementação final da exclusão | R9.1 | Manter para a versão final. No piloto, aceitar a exclusão atual depois de um teste ponta a ponta em produção com registro fictício interno |
| S3 | "Política EAG" | Constituição P7 | Ler como: vale a política da EAG quando ela existir e for aplicável. Enquanto não for localizada, vale a política do Compass aprovada por Rogério (O1–O9). A consulta à EAG continua, sem bloquear o piloto por telefone |
| S4 | Testes controlados antes de qualquer contato real | R26.6 | Limitar aos canais automáticos. Para o telefone, exigir só o teste do item 1 da §3 (supressão de telefone suspende a ligação) |
| S5 | Retenção definida antes do contato | P7, premissas, R23.4 | Atendida por O6 (decisão de Rogério dentro da lei, L8), sem parecer externo |
| S6 | Triagem de sanções antes do contato, válida por 30 dias | R19.2 item 6, R28.18, decisão de 24/09/2026 | Manter (O9). Não é exigência legal para contato B2B privado; é controle interno barato |
| S7 | Tarefa manual suspensa por supressão, pausa ou triagem | R28.18 | Manter. Corrigir a implementação para telefone (§3, item 1) |

## 3. Decisões e ações concretas ainda necessárias

Em ordem. Nenhuma exige parecer externo.

1. **Corrigir a supressão por telefone (código).** *Implementada em 06/10/2026 na `v2-revisao-2` (migração 0034, testes em `tests/phone-suppression.test.mjs`); **não publicada**. Falta, depois da publicação, preencher o telefone de cada uma das 13 ligações pela edição auditada.*
   - Hoje uma oposição dita na ligação não suspende a tarefa de nível 0.
   - Proposta: a tarefa guarda o hash do telefone a ligar, e `restrictionsFor` passa a consultar também a supressão do canal `phone`.
   - Teste: suprimir o número deve suspender a tarefa, e a conclusão deve ser recusada.
   - Até a correção, o procedimento manual seria registrar a supressão **e** pausar a empresa e a commodity. Isso é mais sujeito a erro e não é recomendado.
2. **Aprovar O1–O9**, ou responder com outras escolhas.
3. **Aprovar o teste de balanceamento, o texto de transparência e o registro simplificado da §4.**
4. **Transferência internacional (L9): conferida; lacuna confirmada.** Escolher D-L9: (a) migrar D1 e R2 para a jurisdição `eu` da Cloudflare (definida só na criação; o Worker ainda acessa de qualquer lugar) e avaliar com base na adequação da UE (Res. 32/2026); (b) buscar com a Cloudflare a assinatura das cláusulas-padrão da ANPD; ou (c) não iniciar as ligações até haver mecanismo. Nenhuma das três foi testada.
5. **Teste de exclusão em produção** com registro fictício (S2): autorizado em 06/10/2026; registros criados; exclusão ainda não executada (sessão do Access vencida). Ver §8.
   - **D-EXC:** a exclusão de um contato suprime o e-mail, mas não o telefone. Decidir se a exclusão deve suprimir também o telefone do contato (mudança de código, com teste) ou se a oposição por telefone continua sendo registrada à parte.
6. **Aprovar a emenda da Spec da §5**, que separa a T11-BR-TEL.
7. **Relação com a EAG (decisão de Rogério):**
   - A ligação se apresenta "da EAG Agro" no trabalho comercial dele. A posição da EAG sobre a ferramenta pessoal não foi obtida.
   - Opções:
     - (a) enviar a mensagem da `T11-VALIDACAO-PILOTO-BR.md` como consulta e seguir com o piloto sob sua responsabilidade;
     - (b) aguardar a resposta antes de ligar.
   - Esta revisão não escolhe pela opção (a) nem registra autorização da EAG.

## 4. Textos para aprovação (rascunhos)

### Teste de balanceamento (legítimo interesse, Art. 10)

- **Finalidade:** identificar quem compra milho em empresas e propor uma conversa comercial B2B. É uma situação concreta: piloto de 13 unidades.
- **Necessidade:** só nome, cargo e perfil profissional público, mais canais gerais das empresas. Nenhum dado sensível, nenhum e-mail ou telefone pessoal, nenhuma dedução de endereço.
- **Expectativa do titular:** um profissional de compras espera ser procurado por fornecedores no canal geral da empresa.
- **Impacto e salvaguardas:**
  - uma ligação manual, sem automação;
  - identificação de quem liga;
  - oposição atendida na hora e registrada em supressão;
  - exclusão disponível;
  - dados cifrados;
  - prazos de retenção (O6).
- **Conclusão proposta:** o interesse comercial prevalece, desde que as salvaguardas sejam mantidas. Reavaliar se o escopo mudar (automação, dados de outra natureza, outro país).

### Transparência e oposição na ligação

- **Abertura (já no roteiro):** "Aqui é o Rogerio Palhari, da EAG Agro."
- **Se perguntarem de onde veio o contato:** "Peguei o telefone geral da empresa no site [ou: no cadastro público da empresa]. Seu nome e cargo eu vi no perfil profissional público. Guardo só isso numa ferramenta minha de apoio ao trabalho comercial. Você pode pedir acesso, correção ou exclusão por [canal de O2]."
- **Se a pessoa não quiser contato:** "Sem problema, registro agora e não volto a ligar." Registrar a supressão no mesmo dia. Não insistir nem mandar mensagem de despedida (R21.6).

### Registro simplificado de operações (Art. 37)

| Campo | Conteúdo |
|---|---|
| Responsável | Rogério Palhari (ferramenta pessoal, decisão de 06/10/2026) |
| Finalidade | Prospecção comercial B2B de milho, piloto Brasil |
| Titulares | Profissionais de compras e representantes das empresas-alvo |
| Dados | Nome, cargo, URL de perfil público, canal geral da empresa |
| Fontes | Sites das empresas, cadastro da Receita e do MAPA, LinkedIn (consulta manual) |
| Base legal adotada | Legítimo interesse (O3) |
| Compartilhamento | Nenhum. Provedor: Cloudflare (hospedagem, L9) |
| Retenção | Conforme O6 |
| Segurança | Access, cifragem, auditoria sem dados pessoais legíveis |

## 5. Emenda proposta à Spec (texto, para aprovação)

1. **Tabela de dependências, linha nova:**
   > "T11-BR-TEL | Compliance do piloto brasileiro por telefone manual | Concluída quando Rogério aprovar O1–O9 de `T11-REVISAO-PILOTO-BR-TELEFONE.md` e a supressão por telefone suspender a tarefa com teste | Antes de ligações reais no Brasil"
   - A linha T11 continua valendo para e-mail automático, campanhas e Alemanha.
2. **R26.6:** acrescentar "para canais automáticos; para ligação manual, vale o teste de supressão por telefone de R28.18".
3. **R28.18:** acrescentar "a supressão do telefone a ligar suspende a tarefa".
4. **Premissa de uso:** "Uso individual por Rogério, como ferramenta pessoal de apoio ao trabalho comercial (decisão de 06/10/2026); não é autorização da EAG".
5. **Constituição P7:** acrescentar a leitura de S3 sobre "política EAG", **somente** se Rogério aprovar.

## 6. Retenção: opções A–D e o que é prazo legal

**Prazo legal x escolha operacional.**
- **Prazos fixados por norma:**
  - registro de incidentes: no mínimo 5 anos (Res. CD/ANPD 15/2024, art. 10; opção I abaixo);
  - prazos de resposta ao titular (L4).
- **Retenção dos dados pessoais da prospecção:** nenhuma norma fixa prazo. Valem os limites gerais:
  - só o necessário à finalidade (LGPD art. 6º, III);
  - eliminação ao fim do tratamento (art. 15, art. 16 caput);
  - conservação depois disso só nas hipóteses do art. 16. A do inciso IV exige anonimização, e o hash de supressão é pseudonimizado (R9.1.1), não anônimo.
- **Por isso A–D são escolhas operacionais de Rogério**, a justificar pela finalidade. Fonte das opções: `T11-VALIDACAO-PILOTO-BR.md` §3. E e F tratam da ponte de e-mail e ficam fora do piloto por telefone.

| Item | Opção | Prazo ou critério | Finalidade | Efeito | Fundamento |
|---|---|---|---|---|---|
| **A. Hash da lista de supressão** | A1 | Sem prazo fixo enquanto houver prospecção no canal; revisão registrada a cada 12 meses | Não voltar a contatar quem se opôs | Ninguém é recontatado por esquecimento; exige revisão anual | Escolha; a finalidade (respeitar a oposição, art. 18, § 2º) justifica guardar o mínimo enquanto ela existir. Proposta T11 §2.1 |
| | A2 | Prazo fixo; exemplo: 5 anos após a última atividade de prospecção no canal | Idem, com fim certo | Apaga sozinho; depois disso, risco de recontato | Escolha; art. 15 (término do tratamento). O número é decisão, não lei |
| | A3 | Até o fim definitivo da prospecção no canal; então eliminar | Idem, com guarda mínima | Não protege numa retomada futura | Escolha; art. 15–16 |
| **B. Histórico de remoções de supressão** | B1 | Mesmo prazo da lista (A) mais um prazo de prova escolhido | Provar por que cada supressão foi removida | Prova disponível enquanto a remoção importa | Escolha; responsabilização (art. 6º, X) |
| | B2 | Prazo próprio, sem vínculo com A | Idem | Mais simples; pode apagar prova ainda útil | Escolha |
| **C. Dados de empresa descartada** (pessoas "a validar", notas) | C1 | Eliminar os dados pessoais no descarte; manter empresa, motivo e data | Não guardar o que não será usado | Atende R23.4 sem prazo a controlar | Escolha; necessidade (art. 6º, III); R23.4 |
| | C2 | Revisão periódica (ex.: semestral); eliminar descartados há mais de N meses | Permitir reconsiderar o descarte | Exige rotina e N escolhido | Escolha; R23.4 |
| **D. Exportações locais do D1** (`eag-compass-backups`) | D1 | Guardar só até a migração seguinte confirmada; apagar a anterior | Ponto de volta da última mudança | Menos cópias com dados pessoais; perde pontos antigos | Escolha; segurança e necessidade; EXCLUSAO-PURGA §2 |
| | D2 | Guardar N meses (ex.: 3) e apagar | Pontos de volta mais antigos | Mais cópias a proteger e a purgar em exclusões | Escolha |
| **I. Registro de incidentes** (novo) | — | **Mínimo de 5 anos a partir do registro**, inclusive dos não comunicados | Obrigação regulatória | Precisa existir um registro (hoje não existe) | **Prazo legal:** Res. CD/ANPD 15/2024, art. 10 |
| **H. Time Travel do D1** | — | Limite da plataforma (janela do plano) | Recuperação | Um ponto anterior não pode ser apagado; informar no atendimento de exclusão | Limite técnico (EXCLUSAO-PURGA §3) |

## 7. Emenda T11-BR-TEL (texto final para aprovação) e registro da validação

**Texto da emenda à Spec** (tabela de dependências, linha nova; a linha T11 continua valendo para o resto):

> **T11-BR-TEL — Contato manual por telefone no Brasil.** Contato real por ligação manual feita por Rogério a empresas no Brasil fica liberado, no Compass, somente quando houver registro de validação do escopo `br_manual_phone` contendo responsável, data, fundamento e evidências, e somente depois de cumpridos:
> 1. aprovação, por Rogério, das decisões O1–O9 de `T11-REVISAO-PILOTO-BR-TELEFONE.md`, com o texto aprovado anexado;
> 2. mecanismo de transferência internacional do art. 33 da LGPD identificado e registrado para os dados do Compass (L9), ou dados mantidos onde nenhum mecanismo adicional seja exigido;
> 3. teste de exclusão em produção com registro fictício concluído e registrado (S2);
> 4. supressão por telefone, oposição e bloqueio de tarefas comprovados por teste (R28.18; já implementados).
>
> A liberação não alcança e-mail automático, WhatsApp, LinkedIn, campanhas, outros países nem mudança de base legal, que continuam exigindo a T11 com responsável competente. Telefone ausente ou suprimido, pausas, triagem de sanções e demais bloqueios continuam valendo. A validação pode ser revogada a qualquer momento por novo registro.

**Ajustes ligados à emenda:**
- R26.6: acrescentar "para canais automáticos; na ligação manual vale o teste de supressão por telefone de R28.18".
- R28.18: acrescentar "a supressão do telefone a ligar suspende a tarefa" (já implementado).
- Premissa de uso: "uso individual por Rogério, como ferramenta pessoal (decisão de 06/10/2026); não é autorização da EAG".

**Proposta de registro administrativo da validação** (não implementado; a tabela `compliance_validations` já existe, vazia, só com inclusão):
- **Quem grava:** só o perfil Administrador, por rota própria (`POST /api/compliance/validations`). Nunca há botão de "validar a T11".
- **Campos obrigatórios:**
  - escopo, de uma lista fechada, sem "tudo": `br_manual_phone`;
  - responsável: nome e papel (ex.: "Rogério Palhari, responsável pelo tratamento no Compass");
  - data da decisão;
  - fundamento: texto da decisão;
  - evidências, cada uma com referência e SHA-256 do documento: O1–O9 aprovadas, emenda aprovada, registro do teste de exclusão e documento do mecanismo de L9;
  - confirmação explícita de que os itens 1–4 da emenda estão cumpridos.
- **Comportamento:**
  - a gravação recusa evidência faltando;
  - a auditoria guarda escopo e referências, sem dados pessoais;
  - a revogação é uma linha nova, com motivo;
  - a tela de Configurações mostra o histórico de validações, só para leitura.
- **Efeito:** só o motivo "T11 pendente" sai das ligações do Brasil; os demais bloqueios continuam.

## 8. Teste de exclusão em produção (registros fictícios)

- **Autorização:** Rogério, 06/10/2026, só com registros fictícios, sem envio, sem dados reais e sem alterar supressões existentes.
- **Criados em 06/10/2026:**
  - empresa `98a50482` "TESTE EXCLUSÃO 2026-10-06 — registro fictício (não é prospect)";
  - contato A `0c19f5d6`: nome, cargo, e-mail `@exemplo.invalid`, telefone fictício;
  - pessoa de compras `af217a7e` aceita, que virou o contato B `c27b4aca` (nome, cargo, telefone fictício, fonte `teste.exemplo.invalid`).
- **Exclusão executada em 08/10/2026** (18:37 UTC), depois de novo login no Access, pelos mesmos ids, sem recriar registros. Resultado na subseção abaixo.
- **Tentativa anterior (06/10):** não executada. A sessão do Access tinha vencido. As chamadas receberam a página de login (200, não JSON), e o banco confirmou que nada foi apagado. O script agora recusa resposta que não seja da API.
- **Pendente:** novo login no Access, exclusão de A e B e conferência.
- **Resíduos esperados depois da exclusão (pelo código):**
  - contatos A e B sem nome, cargo, e-mail, telefone e fonte, com marca "dados excluídos em <data>";
  - pessoa de compras com nome substituído pela marca, sem cargo, telefone e fontes, e status "descartada";
  - **uma supressão nova** do hash do e-mail fictício de A (motivo `personal_data_deleted`), sem tocar nas 2 supressões existentes;
  - duas linhas em `erasure_ledger` e dois registros de exclusão no R2;
  - auditoria `contact.personal_data_deleted` sem dados pessoais;
  - a empresa fictícia permanece (dado de empresa);
  - cópias anteriores no Time Travel do D1. Os backups privados de 06/10 são anteriores à criação dos registros e não os contêm.
- **Lacuna observada no código:** a exclusão suprime o e-mail, mas não o telefone da pessoa. Uma oposição por telefone precisa ser registrada à parte. Decisão D-EXC (§3).

### Resultado do teste (08/10/2026)

- **Conferido antes:** nenhuma exclusão anterior (registro de exclusões vazio, nenhuma auditoria de exclusão, dados presentes).
- **Eliminado:**
  - contatos A e B: nome, cargo, e-mail, telefone, LinkedIn e fonte; o rótulo passou a "dados excluídos em 2026-10-08";
  - pessoa de compras: nome trocado pela marca "[conteúdo excluído a pedido do titular]", cargo, telefone e as duas fontes apagados; status "descartada" (`personal_data_deleted`).
- **Supressões:** 2 → 3. A nova é só do hash do e-mail fictício de A (motivo `personal_data_deleted`). B não tinha e-mail e não gerou supressão. As 2 supressões existentes não mudaram.
- **Registros:**
  - `erasure_ledger` com 2 linhas;
  - R2 `erasures/eag-internal/<id>.json` com id, hash do e-mail (ou nulo), data e id da requisição;
  - 2 auditorias `contact.personal_data_deleted` sem dados pessoais.
- **Resíduos:**
  - hash do e-mail no contato A (pseudônimo, necessário à supressão);
  - **hash do nome** na pessoa de compras (pseudônimo);
  - **texto livre "relevância" da pessoa mantido**, que pode conter dados pessoais em caso real (achado);
  - empresa fictícia;
  - cópias no Time Travel do D1.
- **Fora do Compass:** nada (sem e-mail enviado, sem ponte envolvida).
- **Achados:** a exclusão não apagava "relevância" nem o hash do nome. **Corrigido em 08/10/2026** na `v2-revisao-2`, não publicado: a exclusão passa a apagar os dois, e a migração 0036 corrige as linhas já excluídas, inclusive a do teste fictício, quando for aplicada. Pendente: D-EXC (§9).

## 9. D-EXC: telefone depois da exclusão (aprovada em 08/10/2026 com a opção (a); publicada em 08/10/2026, Worker `bccbfb21`)

- **Exclusão x oposição:**
  - a exclusão (LGPD art. 18, IV e VI) apaga os dados da pessoa;
  - a oposição (art. 18, § 2º) é a recusa ao tratamento ou ao contato e não exige apagar.
  - Depois de uma exclusão, só se guarda o mínimo necessário para não voltar a contatar a pessoa (R9.1.2), e não o motivo nem a conversa.
- **Telefone pessoal da pessoa** (celular ou ramal direto, com fonte que o ligue a ela):
  - na exclusão, gravar a supressão do número (HMAC do E.164 normalizado, canal `phone`, motivo `personal_data_deleted`, data);
  - alcance: esse número em todas as tarefas e empresas, que ficam suspensas (já implementado);
  - finalidade: não recontatar;
  - retenção: a mesma escolhida para a lista de supressão (opção A).
- **Número compartilhado da empresa** (recepção, telefone geral):
  - não suprimir, porque suprimir bloquearia a empresa inteira, além do que a pessoa pediu;
  - gravar na empresa um aviso sem identidade: "pedido de exclusão de uma pessoa desta empresa em <data>; ao ligar, pedir o setor sem citar nomes antigos";
  - não usar nome nem hash do nome para bloquear um novo cadastro (R21.3 proíbe inferir identidade pelo nome).
  - Retenção: a mesma da opção A.
- **Classificação:** o pedido de exclusão passa a exigir que o Administrador marque cada telefone do contato como "pessoal" ou "compartilhado", com a fonte. Sem marcação, a exclusão não conclui; nada é decidido automaticamente.
- **Oposição sem exclusão:** continua como está. "Registrar oposição" grava o resultado e a supressão do número da ligação. Se o número for compartilhado, o mesmo aviso na empresa é recomendado.

### Implementação da D-EXC (08/10/2026, não publicada)

**Regras aplicadas:**
- **Pessoal ou ramal com discagem direta (número próprio):** supressão do número normalizado pelo fluxo existente. As ligações abertas a ele ficam suspensas e a auditoria não guarda o número.
- **Número geral ou ramal atrás do número geral:** não suprime. O vínculo pessoal sai na exclusão: telefone do contato, da pessoa de compras e das ligações dele. Fica um **aviso na empresa**.
- **Sem classificação (opção a):** tratado como compartilhado, com "classificação não confirmada", fonte "não informada" e pendência. Não é apresentado como prova de que o número é comercial. Os demais dados são excluídos normalmente.
- **Marcado como pessoal, mas usado por terceiros** (outra ligação ou outro contato da empresa): não suprime; aviso de conflito com pendência.
- **Oposição:** pelo fluxo próprio, com o tipo do número. Só "pessoal" ou "ramal direto" suprime; número geral, ramal atrás do geral ou tipo não confirmado viram aviso, sem ampliar o pedido à empresa.

**O aviso** (tabela `company_notices`, migração 0037):
- só campos fechados: tipo, classificação, fonte, URL, motivo, pendência e o hash do número geral (dado da empresa);
- **sem nome, hash do nome ou texto pessoal**;
- só inclusão;
- orienta o operador e não garante que a pessoa não será reencontrada;
- retenção pendente da decisão A.

**Rotas:**
- `GET /api/contacts/:id/erasure-phones` (só Administrador): telefones do contato, com origem, ramal e uso por terceiros, para classificar antes;
- `POST /api/contacts/:id/delete-personal-data` aceita `phones: [{ phone, kind, sourceKind, sourceUrl }]`.

**Tela:**
- o formulário de oposição pede o tipo do número (padrão "não confirmado");
- os avisos aparecem na ligação e na ficha da empresa.
- A ficha da empresa mostra os avisos com ou sem tarefa aberta (corrigido em `bcaea9a`).

**Testes** (`tests/dexc-telefone.test.mjs`, 7 casos):
- número pessoal, número geral com terceiros, dúvida, conflito;
- ramal atrás do geral e ramal direto;
- exclusão repetida;
- supressões existentes preservadas;
- aviso sem identidade e imutável;
- oposição pelo número geral e sem tipo;
- rota só para Administrador.

## 10. Retenção: avisos da empresa e o que cada opção exige (08/10/2026)

- **Mesmo critério da lista de supressão (A):**
  - as supressões de telefone e e-mail, inclusive as criadas por exclusão (`personal_data_deleted`);
  - os hashes do registro de exclusões (`erasure_ledger` e cópia no R2), que servem para não recontatar e para reaplicar exclusões depois de uma restauração.
- **N. Avisos da empresa (`company_notices`)**:
  - só campos fechados e o hash do número geral (dado da empresa);
  - hoje **só inclusão**: gatilhos impedem alterar e apagar.
  - Proposta: seguir o prazo escolhido em A.
- **Execução de cada opção** (nenhuma implementada):

| Opção | Sem código novo | Exige implementação |
|---|---|---|
| A1 | Supressões ficam; a revisão anual seria um registro manual em EVIDENCIAS | Registro da revisão no Compass (opcional) |
| A2 / A3 | Remoção manual de supressão (rota existente, Administrador, motivo e base), uma a uma | Rotina de expiração das supressões, do registro de exclusões e dos avisos; permitir apagar aviso só pela rotina, com auditoria (migração que troca o gatilho, como na 0032) |
| B1 / B2 | Nenhuma | Expiração do histórico de remoções (`suppression_removals`) |
| C1 | Excluir manualmente os contatos da empresa descartada pela rota de exclusão | Exclusão automática dos dados pessoais no descarte |
| C2 | Revisão manual periódica | Rotina com prazo N |
| D1 / D2 | Apagar exportações locais à mão, em `eag-compass-backups` | Nenhuma |
| N (com A1) | Nada a fazer enquanto houver prospecção | Revisão registrada (opcional) |
| N (com A2/A3) | Impossível: o gatilho impede apagar | Rotina de expiração e troca do gatilho |

## 11. Mensagem à Cloudflare (pronta para envio por Rogério; não enviada)

**Caminho sugerido:**
- e-mail para `privacyquestions@cloudflare.com`, com cópia para `dpo@cloudflare.com`;
- enviado a partir do e-mail cadastrado como dono da conta Cloudflare, para que possam verificar a conta;
- substituir `[Account ID]` pelo ID da conta (painel da Cloudflare, Workers & Pages, coluna da direita).
- Não aceitar nem assinar nada em resposta sem nova análise.
- Texto: o mesmo apresentado a Rogério em 08/10/2026 (cinco perguntas: mecanismo do art. 33 com cláusula, versão e data; aditivo com as cláusulas-padrão da ANPD para conta self-serve; serviços abrangidos; locais e suboperadores; efeito da jurisdição `eu` com Regional Services).

## 12. Decisão de retenção (Rogério Palhari, 08/10/2026)

**Decisão:** Rogério Palhari escolheu, em 08/10/2026, as opções **A1, B1, C1 e D1**, e decidiu que os **avisos da empresa seguem A**. Textos das opções escolhidas, na versão apresentada em 08/10/2026:
- **A1, lista de supressão:** "Sem prazo fixo enquanto houver prospecção no canal; revisão registrada a cada 12 meses. Ninguém é recontatado por esquecimento; exige revisão anual."
- **B1, histórico de remoções de supressão:** "Mesmo prazo da lista (A) mais um prazo de prova escolhido. Prova disponível enquanto a remoção importa."
- **C1, dados pessoais de empresa descartada:** "Eliminar os dados pessoais no descarte; manter empresa, motivo e data. Atende R23.4 sem prazo a controlar."
- **D1, exportações locais do D1:** "Guardar só até a migração seguinte confirmada; apagar a anterior. Menos cópias com dados pessoais; perde pontos antigos."
- **Avisos da empresa:** seguem A (A1).

**Alcance:** esta decisão resolve só as escolhas de retenção. A T11 continua pendente, as 13 ligações bloqueadas, os canais `planned` e as campanhas inativas. Fundamento: §6, e LGPD arts. 6º, III, 15 e 16. O único prazo fixado por norma neste conjunto é o do registro de incidentes (5 anos, item I), que não é escolha.

| Item | Dados abrangidos | Prazo ou critério | Revisão | Ação ao final | A implementação cumpre hoje? |
|---|---|---|---|---|---|
| **A1** | Hashes de e-mail e telefone suprimidos (3 hoje, inclusive os criados por exclusão); hashes do registro de exclusões (`erasure_ledger`, 2 hoje, e cópias no R2) | Enquanto houver prospecção no canal; sem prazo fixo | A cada 12 meses, registrada; primeira até 08/10/2027 | Se a revisão concluir que a prospecção no canal acabou: eliminar os itens do canal | **Em parte.** Retenção sem expiração: sim. Revisão: não há registro nem lembrete. O critério gravado em cada supressão ainda diz "até a política T11" (lacuna G1) |
| **Avisos (seguem A1)** | `company_notices`: tipo, classificação, fonte, motivo, pendência, hash do número geral (0 hoje) | Igual a A1 | Junto com A1 | Eliminar com A, quando a revisão decidir | **Em parte.** Guarda: sim (só inclusão). Eliminação: **impossível hoje**, porque o gatilho impede apagar (lacuna G1b, só relevante quando a revisão decidir eliminar) |
| **B1** | `suppression_removals`: hash, motivo, base, autor e data de cada remoção (0 hoje) | Enquanto existir a lista (A1), mais um prazo de prova | Junto com A1 | Ao fim do prazo de prova depois da eliminação da lista: eliminar | **Sim, por ora:** nada expira enquanto A1 vigorar. **O prazo de prova ainda não foi escolhido** (G2); só será necessário se a lista for eliminada |
| **C1** | Dados pessoais de contatos, pessoas de compras, roteiros e textos de fichas de empresa descartada | Eliminar no ato do descarte; manter empresa, motivo e data | Não se aplica | Eliminação imediata | **Não.** O descarte (`discardCompany`) cancela tarefas, envios e fichas, mas **não elimina** os dados pessoais (G3). Hoje há **0 empresas descartadas**, então não há pendência acumulada |
| **D1** | Exportações do D1 em `C:\Users\Roger\eag-compass-backups` | Só até a migração seguinte confirmada | A cada migração | Apagar a exportação anterior quando a migração seguinte estiver confirmada | **Não automaticamente** (manual). Hoje existem 6 exportações remotas (antes da 0032 até antes da 0037) e 9 cópias locais `d1-local-*` de 23 a 25/09. Pela D1, ficaria só a anterior à 0037 (G4). **Nada foi apagado nesta etapa** |

**Fora de A–D (sem decisão nova):**
- **Diário e registro da ponte** (`%LOCALAPPDATA%\eag-mail-bridge`: `journal.sqlite`, `ponte.log`, `estado.json`): opções E e F, do canal de e-mail, ainda não decididas; ficam para quando o e-mail for considerado.
- **Time Travel do D1** (H): janela da plataforma, não apagável; informado no atendimento de exclusão.
- **Registro de incidentes** (I): 5 anos por norma; ainda não existe (pendência já registrada).
- **Arquivo de segredos** (`segredos-producao-2026-09-24.txt`): não contém dados de titulares; segue procedimento próprio.

### Lacunas e propostas (não executadas)

- **G1. Critério e revisão de A1** (código e migração, com testes):
  - trocar o texto do critério das supressões para "Mantido enquanto houver prospecção no canal; revisão anual registrada (decisão de 08/10/2026)";
  - criar um registro de revisões de retenção (data, responsável, escopo, decisão de manter ou eliminar, fundamento), só inclusão;
  - lembrete na tela Início 30 dias antes de completar 12 meses desde a última revisão.
  - Até lá: registrar a revisão anual em EVIDENCIAS; a primeira vence em 08/10/2027.
- **G1b. Eliminação dos avisos e das supressões quando a revisão decidir:**
  - rotina acionada só pelo Administrador, com a revisão como fundamento;
  - migração que permita apagar avisos e supressões só por essa rotina, com auditoria, no padrão da 0032.
  - Não é necessária enquanto A1 vigorar.
- **G2. Prazo de prova de B1:** escolher só se a lista for eliminada. Até lá, nada a fazer.
- **G3. Eliminação no descarte (C1)** (código, com testes):
  - ao descartar uma empresa, apagar nome, cargo, e-mail, telefone, LinkedIn e fonte dos contatos; dados das pessoas de compras (incluindo relevância e hash do nome); roteiros das tarefas; textos congelados das fichas (marcador de purga, como na exclusão);
  - manter empresa, motivo, data e auditoria sem dados pessoais;
  - **sem criar supressão**: descarte não é oposição;
  - registro no R2 para reaplicar depois de uma restauração.
  - Até a implementação: **não descartar empresa que tenha pessoas ou contatos**. Usar a pausa da empresa e, se for preciso eliminar, tratar caso a caso. Hoje não há empresa descartada.
- **G4. Backups (D1)** (procedimento manual, sem código):
  - depois de cada migração confirmada, apagar a exportação anterior;
  - aplicado agora, ficaria só `d1-remoto-antes-0037-20261008`; as 5 exportações remotas anteriores e as 9 cópias locais `d1-local-*` seriam apagadas;
  - executar só com confirmação de Rogério;
  - um script de conferência pode listar o que a regra manda apagar, sem apagar.
