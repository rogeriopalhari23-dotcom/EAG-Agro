# T11 — Proposta de política de ciclo de vida e de primeiro contato

**Estado:** proposta para decisão, 2026-10-01. **Não é validação jurídica** e não substitui a análise de quem responde
juridicamente pelo tratamento. Fontes consultadas nesta data, listadas no §6.

Legenda usada em cada ponto:
- **Exigência**: texto da norma ou orientação oficial, citado.
- **Interpretação**: leitura feita aqui, que o validador deve confirmar ou corrigir.
- **Escolha**: decisão de política que cabe a Rogério. A lei não fixa o valor.

## 1. O que a T11 cobre e o que já está comprovado

Definição vigente: Spec, tabela de dependências, T11 "Compliance pré-envio e política de ciclo de vida", estado "Não
validado com responsável competente", limite "Antes de contatos reais da Etapa 1". Dependem dela os requisitos R9.1
(LGPD/GDPR), R9.1.2, R19 (compliance), R23 (retenção), R28.7 e AT64 (abertura). Na Constituição, P7: "tratados
conforme LGPD/GDPR e política EAG".

| Parte da T11 | Comprovado (com evidência) | Pendente |
| --- | --- | --- |
| Triagem de sanções antes do envio | Política decidida por Rogério em 2026-09-24: OFAC + CEIS + CNEP, validade de 30 dias, sem pessoas físicas, raiz de CNPJ vai para revisão (EVIDENCIAS, "Política de sanções T11"). Listas importadas em produção em 2026-09-24 e vencem em **2026-10-24**. | As 3 empresas alemãs **nunca foram triadas**: não há `screening_runs` para elas. O pré-envio as segura com `compliance_unavailable`. |
| Supressão pseudonimizada | Guarda só o hash do identificador, com canal, motivo, data, alcance `channel_all` e critério `until_t11_policy` (migração 0031, publicada). Acesso só do Administrador. Remoção exige motivo, base e confirmação, e fica auditada; tentativas negadas também. Reimportação não remove supressão (`tests/openclaw.test.mjs`). | Prazo de retenção, fundamento jurídico e validação. |
| Exclusão a pedido do titular | `deletePersonalData` (Admin): apaga os campos cifrados do contato, mantém o hash, cancela fila e tarefas, audita a base legal. | Não purga os textos congelados das fichas (`ficha_messages`), as mensagens recebidas nem os snapshots, que podem conter nome ou endereço. R9.1 pede essa purga ("conteúdo, índices e referências"). Também não grava a supressão automaticamente. |
| Informação ao titular | Nada implementado. | GDPR Art. 14 (§4). |
| Regra por país para o primeiro contato | Nada implementado. | Alemanha (§5). |
| Validação por responsável competente | Não houve. | §3. |

## 2. Política proposta

### 2.1 Retenção do identificador de supressão
- **Exigência:**
  - GDPR Art. 21(3): após a objeção ao marketing direto, os dados "deixam de ser tratados para esse fim".
  - GDPR Art. 5(1)(c) e (e): minimização e limitação da conservação.
  - LGPD Art. 15 e 16: eliminação após o término do tratamento. As conservações autorizadas são obrigação legal (I), pesquisa (II), transferência (III) ou uso exclusivo do controlador "desde que anonimizados" (IV).
- **Interpretação:**
  - Alemanha: a DSK (Orientierungshilfe Werbung, fev. 2022, §5.1) admite a *Werbesperrdatei* com base em Art. 21(3) e Art. 6(1)(f), combinados com Art. 17(3)(b). A própria DSK limita isso: a lista "só pode ser lícita" quando a publicidade que ela impede se apoia em Art. 6(1)(f). A pessoa também deve ser informada do sentido e da finalidade da inclusão na lista.
  - Brasil: o hash é pseudonimizado, não anonimizado (R9.1.1), e por isso o Art. 16 IV não serve. A base provável é o legítimo interesse (Art. 7 IX e Art. 10) de respeitar a oposição. Isso exige registro (Art. 37), transparência (Art. 10 §2) e o teste de balanceamento do Guia da ANPD (fev. 2024).
- **Escolha (proposta):**
  - manter só hash + canal + motivo + data + alcance + origem, sem texto claro, enquanto o Compass fizer prospecção no canal;
  - revisão registrada pelo Administrador a cada 12 meses. Esse intervalo é escolha administrativa, não prazo legal;
  - nunca expirar automaticamente;
  - se a prospecção no canal acabar definitivamente, eliminar a lista. O validador confirma se há base para guardá-la além disso.

### 2.2 Histórico de remoções e auditoria
- **Exigência:** GDPR Art. 5(2) (responsabilidade demonstrável); LGPD Art. 6 X (responsabilização) e Art. 37 (registro das operações, "especialmente quando baseado no legítimo interesse").
- **Escolha (proposta):**
  - guardar a remoção (hash, motivo, base, autor, data, pedido de origem) enquanto existir a lista de supressão, mais um prazo de prova **a definir pelo validador**. Não proponho número;
  - auditoria sem PII em texto claro, como já ocorre.

### 2.3 Remoção administrativa de uma supressão
Proposta: a rota já existente aceita só estes casos, com evidência anexada por referência.

| Motivo | Evidência mínima |
| --- | --- |
| Erro de registro: endereço interno de teste ou supressão do identificador errado | Registro do teste ou do erro (ex.: EVIDENCIAS, data) |
| Pedido expresso do próprio titular para sair da lista, depois de avisado de que pode voltar a receber mensagens (DSK §5.1) | Mensagem do titular, guardada fora do Compass ou por referência |
| Determinação de autoridade ou ordem judicial | Número do documento |

- **Proibido:** conveniência comercial, nova campanha, reimportação, mudança de cargo ou de empresa.
- Remoção sempre pelo Administrador, com motivo de 10 ou mais caracteres, base e confirmação; registro de tentativas negadas. Isso já está implementado.
- **Melhoria opcional:** trocar a base livre por uma lista fechada com estes três motivos, mantendo o texto. Depende de decisão.

### 2.4 Acesso, finalidade e pedidos de exclusão
- **Acesso e finalidade (já implementado):** acesso só do Administrador (R9.2, AT14). Finalidade única: não voltar a contatar. Sem exportação.
- **Pedido de exclusão, roteiro proposto:**
  1. confirmar a identidade pelo próprio endereço;
  2. excluir os dados do contato;
  3. **purgar também os textos congelados e as mensagens recebidas**, que hoje é uma lacuna;
  4. manter o hash na supressão e informar a pessoa disso (DSK §5.1);
  5. responder.
- **Exigência de prazo:** GDPR Art. 12(3), em até um mês. No Brasil, o prazo de resposta para eliminação fica para o validador confirmar.
- **Reimportação:** não remove supressão, pausa nem resposta (R21.5, testado). Proposta: manter como regra inviolável, sem exceção por fonte.

## 3. Quem valida e o que depende de cada um

Fato relevante: os e-mails saem de `rogeriopalhari@eagagro.com`, com assinatura "Broker | EAG AGRO", texto "ich bin bei
EAG Agro tätig" e rodapé com o endereço da EAG. Rogério usa essa caixa por conta própria e não administra a
infraestrutura da EAG. O Compass roda numa conta Cloudflare pessoal. Para quem recebe, quem fala é a EAG.

| Quem | Por quê | Perguntas que só essa pessoa responde |
| --- | --- | --- |
| **Responsável jurídico ou encarregado (DPO) da EAG**, ou a diretoria que responde pela marca e pela caixa | Nome, caixa e endereço da EAG aparecem em cada mensagem. A P7 manda seguir a "política EAG". | (1) Quem é o controlador: EAG, Rogério ou os dois? (2) A EAG autoriza prospecção em seu nome por uma ferramenta pessoal? (3) Existe política de privacidade e encarregado da EAG? Em 2026-10-01, `eagagro.com/politica-de-privacidade` e `/privacidade` retornaram 404, e o rodapé cita a política sem link. Isso não prova que ela não exista. (4) Há registro das operações (LGPD Art. 37)? (5) Pode haver transferência internacional para Cloudflare e Snov (LGPD Art. 33; Res. CD/ANPD 19/2024)? |
| **Advogado com prática em UWG/DSGVO na Alemanha** | O §5 depende de direito alemão. | (1) O e-mail de identificação é "Werbung" no sentido do §7 UWG? (2) Existe algum caminho de e-mail sem consentimento prévio? (3) A ligação B2B para a 24grad tem consentimento presumido? (4) É preciso representante na UE (GDPR Art. 27)? (5) Que texto do Art. 14 usar? |
| **Rogério** | Escolhas de política | Os itens marcados "Escolha" nos §2.1–2.4 e a decisão do §5.3. |

## 4. Informação ao titular (GDPR Art. 14)
- **Exigência:** Art. 14(3)(b). Se os dados forem usados para comunicar com o titular, a informação deve ser dada "o mais tardar no momento da primeira comunicação". A DSK (2022, §2.2) exige isso também na publicidade e pede a informação separada do texto comercial, com o aviso do direito de objeção.
- **Interpretação:**
  - os e-mails atuais vão a endereços gerais de empresa, e um endereço genérico pode não ser dado pessoal;
  - quem responde é uma pessoa, e a ficha guarda seu nome;
  - se o validador entender que o GDPR se aplica (Art. 3(2)), falta esse bloco nos textos.
- **Escolha:** nenhuma ainda. O texto do bloco depende do §3.

## 5. Primeiro contato comercial por e-mail na Alemanha

### 5.1 Exigência
- **UWG §7(2) Nr. 2** (texto vigente, gesetze-im-internet.de, consultado em 2026-10-01): há sempre importunação inaceitável "bei Werbung unter Verwendung … elektronischer Post, ohne dass eine vorherige ausdrückliche Einwilligung des Adressaten vorliegt". Não há exceção para empresas.
- **UWG §7(3):** a única exceção é para cliente que deu o endereço numa venda.
- **UWG §7(2) Nr. 1:** só o **telefone** B2B aceita consentimento "zumindest mutmaßlich".
- **BGH, I ZR 218/07 (20.05.2009, "E-Mail-Werbung II"):** um único e-mail publicitário a uma empresa, sem consentimento, já pode ser ilícito.
- **BGH, VI ZR 225/17 (10.07.2018):** "Werbung" tem sentido amplo; até uma pesquisa de satisfação conta.
- **DSK (2022, §1.4):** sem §7(3) UWG, "bedarf es für die Nutzung von E-Mail-Adressen zu Werbezwecken grundsätzlich einer Einwilligung". Se o canal não é permitido pelo UWG, "fehlt es bereits an einem berechtigten Interesse".
- **Diretiva 2002/58/CE (ePrivacy), Art. 13:** consentimento prévio para e-mail de marketing direto a pessoas físicas. Para pessoas jurídicas, cada país decide, e a Alemanha exige consentimento pelo UWG.

### 5.2 Interpretação
- Os textos de Amori e BLACK & YUM dizem "Wir vermitteln Agrarrohstoffe, darunter brasilianischen Rohkaffee" e pedem o comprador responsável. Pela leitura ampla do BGH, isso **muito provavelmente é Werbung**.
- O direito alemão provavelmente se aplica, mesmo com envio do Brasil, porque o mercado afetado é o alemão (Roma II, Art. 6).
- Nada disto é consentimento: endereço publicado no site ou no Kaffeeverband, resultado `valid` da Snov, link de descadastro, ou empresa pequena ou média.
- **Telefone (24grad):** a DSK, citando o BGH I ZR 191/03, diz que a mera pertinência do assunto não basta. É preciso interesse concreto e presumível do destinatário. Não há esse indício registrado.
- **Carta pelo correio:** o §7 UWG não exige consentimento para carta (vale o §7(1): não insistir se for recusada). É o caminho de menor risco para identificar o comprador. Precisa de confirmação do validador e da informação do Art. 14.

### 5.3 Consequência proposta (decisão de Rogério)
- Enquanto o validador alemão não disser o contrário, **nenhum e-mail de prospecção para empresas na Alemanha**: Amori, BLACK & YUM e 24grad ficam sem aprovação, mesmo com o canal habilitado.
- Alternativas que não usam e-mail sem consentimento:
  - carta de identificação do comprador;
  - contato em feira ou associação;
  - resposta a iniciativa da empresa.
  
  Qualquer uma pede ao comprador **consentimento expresso** para e-mail, e o registro desse consentimento vira condição da ficha.
- Mudança de sistema, se aprovada: uma regra por país (`email_first_contact:DE = consent_required`). Ela recusaria a aprovação de ficha de e-mail sem consentimento registrado. Não implementada.

## 6. Fontes (consultadas em 2026-10-01)

| Fonte | Endereço | Uso |
| --- | --- | --- |
| UWG §7 (texto vigente) | https://www.gesetze-im-internet.de/uwg_2004/__7.html | §5.1 |
| BGH I ZR 218/07, 20.05.2009 | https://www.bundesgerichtshof.de/SharedDocs/Entscheidungen/DE/Zivilsenate/I_ZS/2007/I_ZR_218-07.pdf | §5.1 |
| BGH VI ZR 225/17, 10.07.2018 | https://dejure.org/dienste/vernetzung/rechtsprechung?Gericht=BGH&Datum=10.07.2018&Aktenzeichen=VI+ZR+225%2F17 | §5.1 |
| DSK, Orientierungshilfe Direktwerbung, Stand Februar 2022 | https://www.datenschutzkonferenz-online.de/media/oh/OH-Werbung_Februar%202022_final.pdf | §1.4, §2.2, §5.1 |
| GDPR (Reg. UE 2016/679), Art. 3, 5, 6, 12, 14, 17, 21, 27 | https://eur-lex.europa.eu/eli/reg/2016/679/oj | §2, §4 |
| Diretiva 2002/58/CE, Art. 13 | https://eur-lex.europa.eu/eli/dir/2002/58/oj | §5.1 |
| Roma II (Reg. CE 864/2007), Art. 6 | https://eur-lex.europa.eu/eli/reg/2007/864/oj | §5.2 |
| LGPD (Lei 13.709/2018), Art. 3, 7, 10, 15, 16, 18, 37, 41 (texto compilado) | https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm | §2 |
| ANPD, Guia orientativo Legítimo Interesse, lançado em 02/02/2024 | https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse | §2.1 |
| Hostinger, termos §12 (risco assumido por Rogério em 2026-09-22) | Spec, premissas | Contexto: a caixa também proíbe comercial não solicitado sem opt-in |

Os textos da EUR-Lex foram citados de memória do artigo, não baixados nesta data. O validador deve conferir o texto
oficial. As passagens da DSK, do UWG e da LGPD foram lidas nos documentos oficiais em 2026-10-01.
