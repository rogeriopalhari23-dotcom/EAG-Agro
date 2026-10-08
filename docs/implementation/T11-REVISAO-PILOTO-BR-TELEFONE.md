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

**Rogério aprovou (06/10/2026) o uso individual do Compass como ferramenta pessoal de apoio ao seu trabalho comercial.** Finalidade esclarecida em 08/10/2026 (§16.1): ferramenta pessoal de apoio à pesquisa, à organização de informações e à preparação da prospecção. Não é ferramenta da EAG nem substitui sistemas ou procedimentos da rede.

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
- **Se perguntarem de onde veio o contato:** "Peguei o telefone geral da empresa no site [ou: no cadastro público da empresa]. Seu nome e cargo eu vi no perfil profissional público. Guardo só isso numa ferramenta pessoal que uso para pesquisa e organização da prospecção. Você pode pedir acesso, correção ou exclusão pelo e-mail rogeriopalhari@hotmail.com." *(Redação atualizada em 08/10/2026; ver §16.4.)*"
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

- **G1. Critério e revisão de A1** (implementado em 08/10/2026, não publicado; ver abaixo):
  - trocar o texto do critério das supressões para "Mantido enquanto houver prospecção no canal; revisão anual registrada (decisão de 08/10/2026)";
  - criar um registro de revisões de retenção (data, responsável, escopo, decisão de manter ou eliminar, fundamento), só inclusão;
  - lembrete na tela Início 30 dias antes de completar 12 meses desde a última revisão.
  - Até lá: registrar a revisão anual em EVIDENCIAS; a primeira vence em 08/10/2027.
- **G1b. Eliminação dos avisos e das supressões quando a revisão decidir:**
  - rotina acionada só pelo Administrador, com a revisão como fundamento;
  - migração que permita apagar avisos e supressões só por essa rotina, com auditoria, no padrão da 0032.
  - Não é necessária enquanto A1 vigorar.
- **G2. Prazo de prova de B1:** escolher só se a lista for eliminada. Até lá, nada a fazer.
- **G3. Eliminação no descarte (C1)** (implementado em 08/10/2026, não publicado; ver abaixo):
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

### Implementação de G1 e G3 (08/10/2026; **publicada em 08/10/2026**, Worker `663077c0`, migração 0038)

**G1, revisão anual de A1:**
- Migração **0038**, `retention_policies`, só inclusão: as cinco decisões de 08/10/2026 (A1, B1, C1, D1 e avisos seguindo A1), cada uma com dados abrangidos, critério, revisão, ação ao final, texto completo, responsável (Rogério Palhari) e data.
- `retention_reviews`, só inclusão: data, responsável, decisão (`keep` ou `elimination_to_assess`) e fundamento.
- **Registrar uma revisão não expira, não remove e não libera supressão nem ligação.** "Avaliar eliminação" só registra; G1b não existe.
- Rotas: `GET /api/retention` (políticas, revisões e situação) e `POST /api/retention/reviews` (só Administrador; recusa data futura e fundamento curto).
- **Início:** linha com a próxima revisão; item de atenção a partir de 30 dias antes do vencimento ou com a revisão atrasada. Vencimento: 12 meses depois da última revisão ou da decisão (primeiro em 08/10/2027).
- Texto do critério das supressões passou a citar A1. O valor gravado no banco não mudou.

**G3, eliminação no descarte (C1):**
- O descarte (`POST /api/companies/:id/discard`) passa a eliminar os dados pessoais **antes** de marcar a empresa como descartada.
- **Ordem:**
  1. marcador no R2 (`discards/<tenant>/<empresa>.json`, só id da empresa, data e id da requisição; sem motivo nem textos pessoais);
  2. eliminação de cada contato de pessoa pela mesma rotina da exclusão, **sem supressão** e apagando também o hash do e-mail;
  3. numa única gravação: pessoas de compras da empresa (com ou sem contato), tarefas (roteiro, canal, próxima ação, telefone, resultado e histórico de edição), aviso legal em cache **só se nenhuma outra empresa ativa usa o mesmo site**, envios cancelados, fichas descartadas, registro em `company_discard_ledger` e auditoria.
- **Falha no meio:** a empresa não fica descartada; o marcador no R2 trava envio e aprovação (`erasure_reapply_required`) até o pedido ser repetido ou a reaplicação rodar; a repetição retoma com a data original.
- **Restauração do banco:** `POST /api/erasures/reapply` refaz os descartes do R2 que o banco não tem.
- **Descarte repetido:** devolve "já descartada" sem regravar nem auditar.
- **Fica:** empresa, motivo (na auditoria e nas fichas), data, canais gerais da empresa (contato `company_channel`), avisos D-EXC, terceiros de outras empresas e conteúdo compartilhado (aviso legal de site usado por outra empresa ativa; mensagens de outros remetentes, listadas como hoje na exclusão).

**Resíduos de auditoria que permanecem, e por quê:**
- `company.discarded`: motivo, situação anterior e contagens. O motivo é necessário para "manter motivo e data" (C1); **não escreva nomes de pessoas no motivo**.
- `contact.personal_data_deleted` por contato: id, base "Descarte da empresa (C1)" e contagens, sem nome, e-mail ou telefone (R8.1.1); prova a eliminação.
- Auditorias anteriores (`task.*`, `company.*`, `suppression.*`) só com ids, nomes de campos e códigos: o histórico de auditoria é imutável e não tem dado pessoal legível.
- `company_discard_ledger` e o marcador no R2: ids e data, para reaplicar a eliminação depois de uma restauração.
- Contato e pessoa ficam como linhas sem dados ("dados excluídos no descarte…", marca de conteúdo excluído), para não quebrar o histórico (R23.6).
- **Fora do alcance automático:** textos livres de evidências e do perfil comprador são dados da empresa e não são eliminados automaticamente. Quando contiverem dados pessoais, exigem **revisão manual**; sem ela, a eliminação no descarte **não pode ser declarada completa**. Cópias no Time Travel e nos backups seguem H e D1.

**Testes:** `tests/retencao-descarte.test.mjs`, 6 casos (falham com o código anterior):
- políticas e lembrete;
- revisão sem liberação;
- descarte completo com terceiros, canal geral e avisos preservados;
- aviso legal compartilhado;
- repetição;
- falha parcial;
- reaplicação após restauração.
- O teste de interface confere a linha da retenção no Início.
- Teste antigo de descarte ajustado: o descarte agora exige o R2, como a exclusão.

**Plano de migração e publicação (quando autorizado):**
1. Backup privado e bookmark do Time Travel.
2. `npm run db:migrate:remote`, que deve aplicar **só a 0038** (tabelas novas e as 5 decisões; nada existente muda). Conferir 5 políticas, 0 revisões, 0 descartes, supressões e pessoas idênticas.
3. `npm run deploy`.
4. Conferir: `/api/retention` com as 5 decisões e vencimento em 08/10/2027; Início com a linha da retenção; nenhuma empresa descartada nem supressão alterada.
- **Compatibilidade:** o código publicado (`bcaea9a`, Worker bccbfb21) passou nos 419 testes com a 0038 aplicada.
- **Reversão:** `npx wrangler rollback bccbfb21-5fe4-4b16-b36e-3eea8770d8ea`. As tabelas novas ficam e não são usadas pelo Worker anterior; com ele, o descarte volta a não eliminar dados pessoais. Não restaurar backup para reverter código.

## 13. Textos finais pendentes de decisão (08/10/2026)

Já concluídos e **não reabertos**:
- uso individual do Compass (06/10);
- retenção A1, B1, C1 e D1, com os avisos seguindo A1 (§12);
- D-EXC, opção (a) (§9);
- teste de exclusão em produção (§8);
- bloqueio T11 por escopo, supressão por telefone e eliminação no descarte (publicados).

Nada abaixo está aprovado.

### 13.1 Decisões O (texto para aprovação)

| # | Texto final proposto | O que falta |
|---|---|---|
| O1 | "Aprovo ligações manuais no Brasil, feitas por mim, às unidades aceitas no Compass, só pelo telefone geral de cada empresa ou pelo número definido na tarefa com fonte; sem e-mail automático, WhatsApp, LinkedIn, campanha ou Snov." | Aprovação |
| O2 | Redação final na §16.4: "Atendo pedidos de titulares sobre os dados guardados no Compass pelo e-mail rogeriopalhari@hotmail.com." | Endereço definido em 08/10/2026; frase de qualificação só depois da conferência do contrato (§16.3) |
| O3 | "Adoto o legítimo interesse (LGPD art. 7º, IX) para o piloto, com o teste de balanceamento da §4, revisável se houver orientação contrária." | Aprovação do texto da §4 |
| O4 | "Na ligação, se perguntarem: 'O telefone é o geral da empresa, publicado no site ou no cadastro público. Seu nome e cargo vieram do perfil profissional público. Guardo só isso numa ferramenta pessoal que uso para pesquisa e organização da prospecção; você pode pedir acesso, correção ou exclusão pelo e-mail rogeriopalhari@hotmail.com.' (redação da §16.4) Se a pessoa não quiser contato: 'Sem problema, registro agora e não volto a ligar.' Registro a oposição no mesmo dia, informando o tipo do número; se for o número geral, a empresa não é bloqueada." | O endereço de O2 e a aprovação. Depois, as falas entram nos roteiros pela edição auditada |
| O5 | "Não ligo para celular do cadastro da Receita sem indicação de que é comercial." Efeito: Rural Forte e Super-Bovi seguem sem número até haver telefone comercial | Aprovação, ou outra regra |
| O7 | "**Confirmação de existência e acesso:** resposta simplificada imediata, ou declaração completa (origem, critérios, finalidade) em até 15 dias do pedido (LGPD art. 19). **Correção, exclusão, oposição e demais pedidos:** sem prazo legal fixo enquanto a ANPD não regulamentar (art. 18, § 5º); meta interna de resposta em até 15 dias, com execução no mesmo dia da decisão; se não for possível atender de imediato, respondo com as razões (art. 18, § 4º). Prazos em dobro de pequeno porte só se o enquadramento for declarado e comprovável." | Aprovação; declarar ou não o enquadramento de pequeno porte |
| O8 | "**Meta interna:** avaliar um incidente em até 24 h do conhecimento. **Obrigação legal:** se o incidente puder afetar significativamente os titulares e envolver dados sensíveis, de crianças, adolescentes ou idosos, financeiros, de autenticação, sob sigilo ou em larga escala (Res. CD/ANPD 15/2024, art. 5º), comunico à ANPD e aos titulares em até 3 dias úteis do conhecimento de que afetou dados pessoais (arts. 6º e 9º), complementando em até 20 dias úteis. **Registro:** todo incidente, comunicado ou não, registrado e guardado por no mínimo 5 anos (art. 10)." | Aprovação; **o registro de incidentes ainda não existe** e precisa ser criado |
| O9 | "Mantenho a triagem de sanções como controle interno e a refaço antes das ligações se elas ocorrerem depois de 24/10/2026." | Aprovação |

O6 (retenção) está concluída e não entra aqui.

### 13.2 Emenda T11-BR-TEL (texto final para aprovação)

> **T11-BR-TEL — Contato manual por telefone no Brasil.** Ligação manual feita por Rogério a empresas no Brasil só fica liberada no Compass quando houver registro de validação do escopo `br_manual_phone`, com responsável, data, fundamento e evidências, e depois de cumpridos:
> 1. aprovação, por Rogério, das decisões O1–O5 e O7–O9 (§13.1), com o texto aprovado anexado; a retenção (O6) já foi decidida em 08/10/2026 (§12);
> 2. mecanismo de transferência internacional do art. 33 da LGPD identificado e registrado para os dados do Compass (L9), ou dados mantidos onde nenhum mecanismo adicional seja exigido, com processamento e transferências posteriores verificados;
> 3. registro de incidentes existente, com guarda mínima de 5 anos (O8);
> 4. canal do titular (O2) informado nos roteiros.
>
> Já cumpridos e mantidos: teste de exclusão com registro fictício (08/10/2026); supressão por telefone que suspende a tarefa; oposição com tipo do número e aviso na empresa para número geral (D-EXC); bloqueio T11 por escopo; eliminação de dados pessoais no descarte (C1); revisão anual da retenção (A1).
>
> A liberação não alcança e-mail automático, WhatsApp, LinkedIn, campanhas, outros países nem mudança de base legal, que continuam exigindo a T11 com responsável competente. Telefone ausente, divergente ou suprimido, pausas, triagem de sanções e demais bloqueios continuam valendo. A validação pode ser revogada por novo registro.

**Ajustes ligados:**
- R26.6: "para canais automáticos; na ligação manual vale o teste de supressão por telefone de R28.18";
- R28.18: "a supressão do telefone a ligar suspende a tarefa; o bloqueio T11 é calculado por escopo";
- premissa de uso: "uso individual por Rogério (06/10/2026); não é autorização da EAG".

**Registro da validação (proposta, a implementar só depois da aprovação):**
- rota só para o Administrador, com escopo de lista fechada (nunca "tudo"), responsável, data e fundamento;
- evidências obrigatórias, cada uma com referência e SHA-256: O aprovadas, emenda aprovada, documento do mecanismo de L9, registro de incidentes criado, teste de exclusão de 08/10;
- confirmação explícita dos itens 1–4;
- só inclusão; revogação é uma linha nova.

### 13.3 Pendências que não são texto

**Escolhas de Rogério:**
- números da Cimilho, Sociagro e Ração Ituiutaba;
- canal da BRF;
- ~~EAG: consultar e seguir sob sua responsabilidade, ou aguardar~~ (substituído pela §14.1: o controlador é identificado pelos fatos; a consulta à EAG é fonte opcional de fatos);
- declarar ou não o enquadramento de pequeno porte;
- D-L9, depois da resposta da Cloudflare.

**Comprovação externa:**
- Cloudflare: mecanismo do art. 33 (mensagem da §11, não enviada);
- EAG: posição sobre controlador e ferramenta pessoal, se você consultar.

**Implementação necessária antes da liberação:** rota de registro da validação (§13.2). O registro de incidentes é obrigação do controlador e pode ser documental (§14.2).

**Prazo:** as listas de sanções vencem em 24/10/2026.

## 14. Controlador e registro de incidentes (ajuste de 08/10/2026)

Este ajuste corrige a §13 em dois pontos e não reabre nenhuma decisão aprovada: uso individual, retenção A1–D1 e D-EXC continuam como estão. A transferência internacional (L9) segue pendente até haver comprovação. Nada aqui valida a T11 nem libera ligações.

### 14.1 Quem decide finalidades e meios

**Critério legal.**
- Controlador: "pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões referentes ao tratamento de dados pessoais" (LGPD art. 5º, VI).
- Operador: quem trata dados "em nome do controlador" (art. 5º, VII), segundo as instruções dele (art. 39).
- A qualificação decorre de **quem decide de fato** as finalidades e os elementos essenciais do tratamento: quais dados, de quem e por quanto tempo.
- Ela **não** decorre de declaração, de consulta nem de uma escolha de consultar ou esperar alguém.

**Fatos registrados até 08/10/2026:**

| Decisão de tratamento no Compass | Quem decidiu | Registro |
|---|---|---|
| Criar e usar o Compass como ferramenta pessoal de apoio à pesquisa, à organização e à preparação da prospecção (§16.1) | Rogério | Spec, decisões de 06/10/2026 e 08/10/2026 |
| Quais empresas buscar e aceitar; raio de 300 km, milho GMO | Rogério | aceites e ICP do piloto |
| Quais dados pessoais entram: nome, cargo e telefone com fonte; minimização | Rogério | §2.2 L2; Spec |
| Ferramentas e fornecedores: Cloudflare (Worker, D1, R2, Access), ponte local, caixa Hostinger | Rogério | Spec (R19.13, R19.14); publicações |
| Retenção A1–D1, supressão, exclusão e D-EXC | Rogério | Spec, decisões de 08/10/2026; §§9 e 12 |
| Infraestrutura, política de privacidade ou instruções da EAG sobre o Compass | Nenhuma registrada | a EAG não tem acesso nem dá instruções sobre o Compass |
| Apresentação na ligação: "da EAG Agro"; oferta de commodities da EAG; método do curso EAG | Fato externo ao Compass | PV1, R28; `T11-VALIDACAO-PILOTO-BR.md` linha 13 |

**Leitura dos fatos:**
1. **Meios e elementos essenciais do tratamento no Compass.** Pelos registros, quem decide é Rogério: dados, fontes, prazos, ferramentas e fornecedores. Não há instrução da EAG sobre nenhum desses pontos.
2. **Finalidade.** Rogério fixou a finalidade do Compass: ferramenta pessoal de apoio à pesquisa, à organização e à preparação da prospecção, auxiliar aos canais oficiais da EAG (§16.1). Os registros **não** mostram se a prospecção dessas empresas é decidida por ele, por conta própria, ou determinada pela EAG. Exemplos: contrato de franquia ou representação que reserve contatos e oportunidades à EAG, ou que defina alvos e uso de dados.
3. **Conclusão atual, condicionada às respostas da §14.3:**
   - Se a prospecção é decisão de Rogério e o contrato com a EAG não determina a finalidade nem o uso desses dados, **Rogério é o controlador** do tratamento feito no Compass.
   - Se o vínculo com a EAG determina a finalidade, a EAG pode ser controladora, ou ambos podem ser. Rogério ainda responde pelas decisões de meios que tomou.
   - Se Rogério atua como **empregado** da EAG, quem trata os dados é a empresa, e não ele como agente próprio.
4. **Papel da EAG.** Consultar a EAG é opcional. A resposta dela é evidência de fato: contrato, instruções, titularidade dos contatos. Ela **não** cria nem transfere, por si só, a condição de controlador. Esperar ou não esperar a resposta também não define quem é o controlador.
5. **Efeitos práticos:**
   - o texto de O2;
   - quem guarda o registro de incidentes (art. 10: "o controlador");
   - quem comunica incidentes à ANPD;
   - se cabe a análise de pequeno porte.

### 14.2 Registro de incidentes: obrigação separada da implementação

**Obrigação, que não é escolha.**
- O controlador mantém o registro de todo incidente de segurança, comunicado ou não à ANPD e aos titulares.
- A guarda é de no mínimo 5 anos, contados da data do registro, ou mais, se outra obrigação exigir (Res. CD/ANPD 15/2024, art. 10, caput; texto conferido no DOU em 08/10/2026).
- Incidente de segurança é "qualquer evento adverso confirmado, relacionado à violação das propriedades de confidencialidade, integridade, disponibilidade e autenticidade da segurança de dados pessoais" (art. 3º, XII).
- A obrigação existe independentemente do Compass e vale desde já, para qualquer incidente com dados pessoais do Compass.

**Implementação, que é escolha.**
- Pode ser um procedimento documental, fora do Compass, ou uma função no Compass.
- Nenhuma tela ou rota nova nesta etapa.
- O procedimento abaixo atende a obrigação **sem implementar nada no Compass**.
- Implementar no Compass depois continua opcional e exigiria decisão e publicação próprias.

**Procedimento documental mínimo (proposta para aprovação):**

1. **Local protegido:**
   - pasta própria fora do repositório e fora da Cloudflare, `C:\Users\Roger\eag-compass-registros\incidentes\`;
   - permissão de acesso restrita ao usuário `ROGERIONOTE\Roger`, como nos backups;
   - **cópia cifrada** em um segundo local escolhido por Rogério, para a guarda de 5 anos não depender de um só computador;
   - o registro **nunca** vai para o Git: o repositório tem remoto no GitHub.
2. **Sem dado pessoal em texto aberto:**
   - números, categorias e referências internas (IDs do Compass ou caminhos de evidência);
   - nunca nomes, telefones, e-mails ou conteúdo de mensagens.
3. **Abertura:**
   - ao saber de um evento suspeito, abrir o registro no mesmo dia;
   - concluir a avaliação dentro da meta interna de O8 (24 h);
   - eventos avaliados e descartados como não incidentes podem ser anotados no mesmo arquivo, marcados assim. Isso é opcional: o art. 10 cobra os incidentes confirmados.
4. **Campos obrigatórios** (art. 10, § 1º, texto conferido):
   - I. data de conhecimento do incidente;
   - II. descrição geral das circunstâncias;
   - III. natureza e categoria dos dados afetados;
   - IV. número de titulares afetados;
   - V. avaliação do risco e possíveis danos aos titulares;
   - VI. medidas de correção e mitigação, quando aplicável;
   - VII. forma e conteúdo da comunicação, se houve comunicação à ANPD e aos titulares;
   - VIII. motivos da ausência de comunicação, quando for o caso.
5. **Campos de controle** (não exigidos pelo art. 10; servem à prova):
   - número sequencial;
   - data do registro;
   - "guardar até" (data do registro + 5 anos, no mínimo);
   - controlador identificado (§14.1);
   - quem registrou;
   - critérios do art. 5º avaliados;
   - prazo de comunicação calculado (3 dias úteis, ou em dobro se o enquadramento de pequeno porte estiver comprovado);
   - referências às evidências.
6. **Só acréscimo:**
   - não editar nem apagar entradas;
   - correção é uma entrada nova que cita a anterior;
   - a cada entrada, anotar o SHA-256 do arquivo num índice separado da mesma pasta.
7. **Guarda e eliminação:**
   - nada é eliminado antes do "guardar até";
   - depois disso, eliminar só por revisão registrada, verificando antes se há processo, pedido ou outra obrigação que exija prazo maior (art. 10, caput, parte final).
8. **Cumprimento do item 3 da emenda:** existirem a pasta, o arquivo modelo vazio com os campos acima e a cópia cifrada.

**Exigências adicionais da Spec e da Constituição.** A Spec não tem requisito próprio sobre registro de incidentes. Aplicam-se:
- Constituição P7: dados pessoais protegidos, acesso restrito, "logs sem PII em texto aberto". Isso justifica os itens 1 e 2.
- R8.1.1: o `audit_log` não copia conteúdo pessoal. A regra é do `audit_log`, e o procedimento a segue por analogia; não é exigência direta para um registro documental.
- `OPERACAO.md`: em incidente, suspender alterações, restaurar o banco e o código da mesma versão em ambiente separado, validar e reabrir. É um passo de resposta operacional, não um campo do registro.
- A guarda de 5 anos já constava da decisão de retenção como item I, prazo de norma e não escolha (§12).

### 14.3 Respostas que faltam para finalizar O2, os textos operacionais e a emenda

1. **Vínculo com a EAG** (§14.1): você atua como empregado, franqueado, representante ou autônomo?
2. **Contrato e instruções:** algum contrato ou instrução da EAG define:
   - quais empresas prospectar;
   - de quem são os contatos e as oportunidades;
   - como usar ou guardar dados de contatos?

   Responda sim ou não e, se sim, indique o documento.
3. **Decisão de prospectar:** a decisão de prospectar estas 13 unidades foi sua, por conta própria?
4. **Canal do titular (O2):** qual endereço de e-mail atende pedidos de titulares?
5. **Textos de O1, O3 (com o teste da §4), O4, O5, O7, O8 e O9:** aprova como estão na §13.1 ou indica mudanças?
6. **Pequeno porte:** declarar ou não o enquadramento? Responda depois da resposta 1.
7. **Registro de incidentes** (§14.2):
   - aprova o procedimento documental?
   - qual é o segundo local para a cópia cifrada?
8. **Números das ligações:** qual número usar na Cimilho, na Sociagro e na Ração Ituiutaba, e qual canal para a BRF.
9. **Emenda (§13.2 com os ajustes desta seção) e proposta de registro da validação:** aprova?

**Continua pendente de comprovação, sem resposta sua que a substitua:**
- transferência internacional (L9): mecanismo do art. 33 para os serviços da Cloudflare usados. A mensagem da §11 está pronta e não foi enviada.

### 14.4 Ajustes na §13 (prevalecem sobre o texto anterior)

- **O2:** *(substituído pela §16.4)* "Sou o controlador do tratamento feito no Compass e atendo pedidos de titulares pelo endereço [ENDEREÇO]." Esse texto vale só se as respostas 1–3 confirmarem a primeira hipótese do item 3 da §14.1. Nas outras hipóteses, o texto indica o controlador identificado e o canal dele.
- **O8, registro:** "Registro todo incidente conforme o procedimento da §14.2, por no mínimo 5 anos."
- **Emenda §13.2, novo item 0:** "controlador do tratamento no Compass identificado pelos fatos de quem decide finalidades e meios (§14.1), com as respostas registradas".
- **Emenda §13.2, item 3:** "registro de incidentes existente, documental (§14.2) ou no Compass, com guarda mínima de 5 anos".
- **§13.3:**
  - deixam de valer a linha "EAG: consultar e seguir sob sua responsabilidade, ou aguardar" e a pendência "Implementação necessária antes da liberação: registro de incidentes";
  - a consulta à EAG passa a ser só uma fonte opcional de fatos para a §14.1;
  - a única implementação ainda necessária antes da liberação é a rota de registro da validação, depois da aprovação da emenda.

## 15. Vínculo com a EAG: franquia (fato informado por Rogério em 08/10/2026)

**Fatos informados por Rogério:**
- Ele é **franqueado da EAG**.
- A decisão de prospectar as 13 unidades foi dele.

**Situação dos documentos:**
- O contrato principal de franquia **ainda não foi conferido**. *(Lido em 08/10/2026: §17.)*
- Um modelo de aditivo sem assinatura **não comprova** as obrigações contratuais de Rogério e não foi usado nesta análise.

**Efeito na §14.1:**
- A hipótese de empregado está afastada.
- Continua em aberto se o contrato de franquia atribui à EAG a finalidade ou o uso dos contatos e dados da prospecção. Se não atribuir, Rogério é o controlador do tratamento no Compass. Se atribuir, a EAG pode ser controladora, sozinha ou junto com ele.
- Nada se presume sobre o conteúdo do contrato.

### 15.1 Pontos a conferir no contrato principal

Para cada item, anotar o número da cláusula e a transcrição literal, ou "não há".

1. **Contatos e oportunidades:**
   - de quem são os contatos, oportunidades e clientes gerados pelo franqueado;
   - se há obrigação de registrá-los ou repassá-los à franqueadora e em que prazo;
   - o que acontece com eles ao fim da franquia.
2. **Conduta comercial:**
   - quem conduz negociação, proposta e fechamento com compradores;
   - território, segmento e regras entre franqueados.
3. **Uso dos dados:**
   - cláusula de proteção de dados ou LGPD;
   - papéis declarados de controlador e operador;
   - instruções sobre coleta, guarda e prazo;
   - confidencialidade e devolução ou eliminação ao fim do contrato;
   - comunicação de incidentes entre as partes.
4. **Ferramentas:**
   - se é obrigatório usar sistema, CRM, e-mail ou telefone da rede;
   - se ferramentas próprias do franqueado são permitidas ou vedadas;
   - se há exigências de segurança.
5. **Apresentação em nome da EAG:**
   - uso da marca "EAG Agro" na prospecção;
   - forma de identificação do franqueado;
   - roteiros ou materiais obrigatórios;
   - aprovação prévia de textos.
6. **Remuneração:** como a origem da oportunidade é comprovada e se isso exige compartilhar dados de contato.
7. **Aditivos:** quais aditivos foram efetivamente assinados, com data.

**Uso das respostas:**
- itens 1 e 3 → controlador (§14.1) e texto de O2;
- item 3 → também o registro de incidentes (§14.2);
- item 4 → dúvida sobre o uso auxiliar a anotar com a cláusula (§16.2), sem virar regra ou bloqueio automático;
- item 5 → texto de O4 e a emenda.

Nada disso muda as decisões aprovadas. A transferência internacional (L9) segue pendente de comprovação.

### 15.2 Respostas que faltam (substitui a lista da §14.3)

1. **Contrato principal de franquia:** disponibilizar o arquivo ou transcrever as cláusulas dos itens 1–7 da §15.1.
2. **O2:** qual e-mail atende pedidos de titulares.
3. **Textos de O1, O3 (com o teste da §4), O4, O5, O7, O8 e O9:** aprovar como estão ou indicar mudanças. O texto de O4 depende do item 5 da §15.1.
4. **Pequeno porte:** declarar ou não o enquadramento. Responder depois de identificado o controlador.
5. **Registro de incidentes (§14.2):** aprovar o procedimento e indicar o local da cópia cifrada.
6. **Números das ligações:** Cimilho, Sociagro e Ração Ituiutaba; canal da BRF.
7. **Emenda e registro da validação:** aprovar a emenda (§13.2 com os ajustes da §14.4) e a proposta de registro da validação.

## 16. Finalidade do Compass, responsabilidade pelos dados e pendências da T11 (esclarecimento de 08/10/2026)

Os três assuntos ficam separados. Uma resposta em um deles não decide os outros.

### 16.1 Finalidade da ferramenta (fato declarado por Rogério)

- O Compass é a **ferramenta pessoal** de Rogério para apoiar a pesquisa, organizar informações e preparar a prospecção.
- **Não é ferramenta da EAG**, não é implantação de sistema oficial da franquia e **não substitui** nenhum sistema, CRM ou procedimento da rede.
- O cadastro oficial, a comunicação das oportunidades e os demais procedimentos contratuais continuam pelos **canais da EAG**.
- O cadastro no Compass é apenas a organização auxiliar de Rogério.
- Não há integração do Compass com sistemas da EAG. A integração com CRM externo já estava fora do escopo da Spec.

Esta seção substitui, para descrever a finalidade, a expressão "apoio ao trabalho comercial" usada nas §§0, 4, 13 e 14.

### 16.2 Responsabilidade pelo tratamento dos dados

- Quem decide os meios do tratamento no Compass é Rogério (§14.1). A decisão de prospectar as 13 unidades também foi dele (§15).
- ~~A qualificação final como controlador depende só de o contrato de franquia atribuir ou não à EAG a finalidade ou o uso desses dados.~~ *Corrigido em 08/10/2026 (§17.2): a qualificação é feita por operação, pelas decisões efetivas de cada parte; o contrato foi lido e é uma das fontes.*
- **Dúvidas contratuais sobre o uso auxiliar.** *Substituídas pelos achados A1–A12 e dúvidas D1–D4 da §17.* Texto anterior: nenhuma cláusula específica foi identificada, porque o contrato não foi lido. As dúvidas a conferir são:
  - (a) se o contrato restringe o franqueado de manter registros próprios de pesquisa e contatos fora dos sistemas da rede (§15.1, item 4);
  - (b) se há dever de confidencialidade, devolução ou eliminação de informações ao fim da franquia que alcance esses registros (§15.1, item 3);
  - (c) se o contrato declara papéis de controlador e operador (§15.1, item 3).
- Cada dúvida será anotada com o número da cláusula e a transcrição literal quando o contrato for conferido.
- Enquanto isso, **nenhuma interpretação não confirmada vira regra nova nem bloqueio automático** no Compass.
- **Canal do titular (O2), definido:** `rogeriopalhari@hotmail.com`.
  - Esse endereço só recebe pedidos de titulares, atendidos manualmente por Rogério; o Compass não lê essa caixa.
  - A supressão desse endereço no Compass, vinda do teste interno de 01/10, só impede envios para ele e não afeta o recebimento de pedidos.

### 16.3 Pendências efetivas da T11-BR-TEL

*Substituída pela §17.3, que separa as pendências do piloto das pendências por ligação.* O bloqueio vigente continua sendo o mesmo: `t11_pending` nas 13 tarefas.

| # | Pendência | Tipo |
|---|---|---|
| 1 | Aprovar O1, O3 (com o teste da §4), O4, O5, O7, O8 e O9, com O2 e O4 na redação desta seção | Decisão de Rogério |
| 2 | Conferir o contrato principal para concluir a qualificação de controlador (emenda, item 0) | Comprovação documental |
| 3 | Mecanismo do art. 33 para a Cloudflare (L9) | Comprovação externa |
| 4 | Aprovar e criar o registro documental de incidentes (§14.2) e indicar o local da cópia cifrada | Decisão de Rogério e execução |
| 5 | Números da Cimilho, Sociagro e Ração Ituiutaba; canal da BRF | Decisão de Rogério |
| 6 | Aprovar a emenda e a proposta de registro da validação; implementar a rota só depois | Decisão de Rogério |

Pequeno porte é decisão opcional e só depois do item 2.

**Não são pendências:**
- A finalidade da ferramenta (16.1).
- O canal O2 (16.2).
- As decisões já aprovadas: uso individual, retenção A1–D1 e D-EXC.

### 16.4 Redação final de O2 e O4 (prevalece sobre §§13.1 e 14.4)

**O2:**
> "Atendo pedidos de titulares sobre os dados guardados no Compass pelo e-mail rogeriopalhari@hotmail.com."

A frase sobre a qualificação ("sou o controlador…") só entra depois do item 2 da §16.3.

**O4, se perguntarem:**
> "O telefone é o geral da empresa, publicado no site ou no cadastro público. Seu nome e cargo vieram do perfil profissional público. Guardo só isso numa ferramenta pessoal que uso para pesquisa e organização da prospecção. Você pode pedir acesso, correção ou exclusão pelo e-mail rogeriopalhari@hotmail.com."

O restante de O4 não muda: oposição registrada no mesmo dia, com o tipo do número.

## 17. Contrato de franquia lido: achados, responsabilidade por operação e pendências (08/10/2026)

O contrato principal foi lido diretamente em 08/10/2026. Rogério confirmou que o texto corresponde ao contrato dele.
- O texto completo, as páginas e os trechos ficam numa **análise privada** fora do Git (`C:\Users\Roger\eag-compass-registros\contrato\`, acesso só do usuário `ROGERIONOTE\Roger`).
- Aqui ficam só os achados, numerados A1–A12 como na análise privada.

A finalidade definida na §16.1 continua valendo: ferramenta pessoal auxiliar, sem substituir sistemas da rede. As decisões concluídas não mudam.

Esta seção corrige a §16.2: a qualificação **não** depende só da leitura do contrato. Ela depende das decisões efetivamente tomadas em cada operação (14.1). O contrato é uma das fontes desses fatos.

### 17.1 Achados concretos

| # | Achado | Efeito |
|---|---|---|
| A1 | A operação da franquia é negócio independente e de responsabilidade exclusiva do franqueado; não há subordinação nem representação comercial | Reforça que as decisões de pesquisa e prospecção são de Rogério |
| A2 | O contrato é com a pessoa física, com previsão de passar a operação a uma empresa indicada por ele, por aditivo | Se uma empresa de Rogério já opera a franquia, ela pode ser a parte responsável na operação da franquia (pergunta 1 da §17.4) |
| A3 | Antes do **primeiro contato** com um potencial cliente, o franqueado registra CNPJ e nome na plataforma (CRM) da EAG. CNPJ já registrado por outro franqueado não pode ser registrado de novo. A exclusividade depende de iniciar as tratativas em até 3 dias após o registro | Passo **por ligação**, feito no canal da EAG e não no Compass (§17.3) |
| A4 | O registro oficial de clientes e as disputas entre franqueados usam o sistema oficial da EAG | O Compass não substitui nem prova esse registro |
| A5 | Etapas da operação e da negociação são reportadas no CRM da EAG ou pelo e-mail de vendas da EAG; comunicações com clientes vão com cópia para esse e-mail | Passo **por ligação**, depois do contato, pelo canal da EAG |
| A6 | Orçamento, oferta, aprovação e emissão do contrato e pós-venda são feitos ou aprovados pela EAG | Na negociação e no fechamento, quem decide é a EAG |
| A7 | O franqueado deve usar exclusivamente os sistemas e plataformas homologados ou fornecidos pela EAG | **Dúvida D1** (17.2) |
| A8 | A confidencialidade alcança as informações **transmitidas pela EAG**, inclusive listas e dados de clientes; uso só na franquia e sem compartilhar com terceiros sem autorização escrita | Os dados do Compass vêm de fontes públicas pesquisadas por Rogério. **Dúvida D2** se informação fornecida pela EAG entrar no Compass |
| A9 | Ao fim do contrato: devolver o que a EAG forneceu, sem cópias; não contatar clientes indicados pela EAG por 60 meses; há proteção de clientes prospectados durante a vigência | Afeta só o fim da franquia; não afeta o piloto |
| A10 | A única menção à LGPD é o compromisso da EAG de proteger o que o franqueado fornece. Não há definição de controlador e operador nem instrução de tratamento ao franqueado | O contrato não decide a qualificação; valem as decisões efetivas (17.2) |
| A11 | Uso da marca só para as finalidades do contrato e dos manuais; não usar a marca nem elemento semelhante como domínio sem autorização; sem site próprio nem divulgação na internet sem consentimento | **Dúvida D3** (17.2). Não há divulgação: o Compass é privado, atrás do Access |
| A12 | O franqueado comunica à EAG notificações e comunicações recebidas em razão da atividade, sobretudo as que possam afetar a marca, e fatos que possam abalá-la; reclamações relevantes de clientes também | **Dúvida D4** (17.2) |

Manuais e procedimentos operacionais citados no contrato não foram lidos.

### 17.2 Quem decide em cada operação

| Operação | Quem decide finalidade e meios | Base |
|---|---|---|
| Pesquisa e organização no Compass: busca, fontes, campos, retenção, supressão, exclusão | **Rogério**. A EAG não instrui nada sobre esse tratamento (A1, A10) | §14.1; decisões de 06/10 e 08/10 |
| Cadastro da empresa no CRM da EAG antes do contato, relatórios e cópias por e-mail | **EAG** decide o sistema, os campos e o uso (exclusividade, acompanhamento, disputas). Rogério decide apenas quando e o que comunica, dentro do exigido (A3–A5) | Contrato; canal oficial da EAG |
| Ligação de prospecção: identificação, perguntas, oposição | **Rogério** conduz e decide, seguindo o método da rede; a oposição e o O2 ficam com ele | A1; O1–O5 |
| Negociação, contrato e pós-venda | **EAG** decide e aprova (A6) | Contrato |

**Consequências:**
- O controlador do tratamento no Compass é Rogério, na pessoa física, ou a empresa dele, se ela já opera a franquia (A2).
- O tratamento no CRM e nos canais da EAG é responsabilidade da EAG.
- A passagem de dados do Compass para o CRM é feita manualmente por Rogério, no limite do que o contrato exige (CNPJ e nome antes do contato; relatórios depois).

**Dúvidas contratuais.** São registradas sem virar regra nova nem bloqueio automático:
- **D1 (A7):** o uso exclusivo de sistemas homologados alcança uma ferramenta pessoal só de pesquisa e organização, que não substitui o CRM? A leitura atual é que a cláusula trata da operação e do registro, que seguem no CRM. Não foi confirmada.
- **D2 (A8):** informação fornecida pela EAG, como listas, leads ou dados de clientes, pode ficar no Compass, hospedado na Cloudflare? Até haver esclarecimento, a prática segura é não colocá-la lá. Hoje o Compass não tem dados vindos da EAG.
- **D3 (A11):** o nome "EAG Compass" e o endereço `eag-compass-…workers.dev` podem ser lidos como uso da marca ou de elemento semelhante em domínio. É uma questão de marca, não de LGPD nem de T11.
- **D4 (A12):** pedidos de titulares e eventuais incidentes ligados à atividade precisam ser comunicados à EAG? Não está confirmado se o dever alcança esses casos.

### 17.3 Pendências separadas

**Para liberar o piloto** (requisito da T11-BR-TEL; o bloqueio `t11_pending` continua até tudo isto ser cumprido):
1. Aprovar O1, O3 (com o teste da §4), O4, O5, O7, O8 e O9. O2 já está definido.
2. Comprovar o mecanismo do art. 33 para a Cloudflare (L9).
3. Aprovar e criar o registro documental de incidentes (§14.2).
4. Aprovar a emenda e a proposta de registro da validação; implementar a rota só depois.

**Por ligação.** Valem para cada uma das 13, sem impedir a avaliação das outras:
- **telefone definido com fonte:**
  - as 7 com número já definido podem ser avaliadas e liberadas juntas quando os requisitos do piloto estiverem cumpridos: Cargill Uberlândia, São Martinho Boa Vista, Cargill Bioenergia São Francisco, Nutrir, Rações VR, Rei do Milho e Caramuru Itumbiara;
  - nas 6 sem número, cada uma segue `phone_missing` até a escolha: Cimilho, Sociagro e Ração Ituiutaba (escolher o número), BRF (canal), Rural Forte e Super-Bovi (dependem de O5);
- **antes do primeiro contato, no CRM da EAG:** registro do CNPJ e do nome (A3), de preferência até 3 dias antes da ligação. Fica fora do Compass e é conferido por Rogério; o Compass não bloqueia por isso;
- **depois do contato:** relatório no CRM ou pelo e-mail de vendas da EAG (A5);
- **sanções:** refazer a triagem se a ligação for depois de 24/10/2026 (O9);
- supressões e demais bloqueios por tarefa, que continuam como estão.

**A qualificação de controlador** (emenda, item 0) fica resolvida por esta seção. A ressalva é a empresa operadora (A2), que só muda o nome do responsável, não o que é feito.

## 18. Mudança de escopo: piloto por e-mail (08/10/2026)

- **Decisão de Rogério:** o piloto brasileiro passa a ser exclusivamente por e-mail. As ligações não serão executadas.
- As 13 tarefas de ligação e o histórico delas ficam **preservados como estão**. Nada foi fechado nem apagado, e o bloqueio `t11_pending` continua nelas.
- Esta revisão (§§0–17) fica como registro. A conclusão do piloto telefônico **saiu da prioridade**.
- A emenda T11-BR-TEL e a proposta de registro de validação da §13.2 valem só para ligação manual. **Não servem para liberar e-mail.**
- **A2 resolvido:** a franquia continua em nome de Rogério, pessoa física. O controlador do tratamento no Compass é Rogério, pessoa física (§17.2).
- A prontidão do e-mail está em `PRONTIDAO-PILOTO-BR-EMAIL.md`.
