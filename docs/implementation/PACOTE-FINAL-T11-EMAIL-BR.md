# Pacote final para concluir a T11 do e-mail automático no Brasil (2026-10-14)

**Estado em 14/10/2026, 21:31 UTC:**
- Worker `21d31f2b`; ponte `eag-mail-bridge/0.2.0` lendo (21:30:43 UTC).
- Cópia interna desligada; canais `planned`; campanhas 2 `draft` + 1 `ended`.
- 0 validações T11; as 3 fichas comerciais na versão 2, sem aprovação.
- Teste interno da cópia D5-a concluído; nenhum envio novo.

**Já decidido, não volta a ser pedido:**
- E1, E2-b, O7-e, O8-e, O9-e;
- retenção A1–D1 (com os avisos seguindo A1);
- cópia à EAG como mensagem separada depois do aceite do original;
- O2 = rogeriopalhari@hotmail.com;
- uso individual do Compass e finalidade auxiliar;
- franquia em nome da pessoa física;
- trava T11 no pré-envio e na aprovação.

## 1. Cloudflare (art. 33)

**Canal:**
- A conta está no **plano gratuito** do Workers e do D1. O erro do D1 de 09/10 citava "free tier daily row read limit".
- No plano gratuito, chamados de suporte só valem para cobrança, conta e registrador; dúvidas técnicas vão para a Comunidade e o Discord (developers.cloudflare.com/support/contacting-cloudflare-support, consulta de 14/10).
- Para privacidade, a política da Cloudflare indica `privacyquestions@cloudflare.com` e o encarregado `dpo@cloudflare.com` (cloudflare.com/privacypolicy, consulta de 14/10).
- **Canal recomendado:** e-mail para `privacyquestions@cloudflare.com`, com cópia para `dpo@cloudflare.com`, enviado **do e-mail dono da conta Cloudflare**.
- Não enviado. Ausência de resposta não comprova nada: L9 continua pendente até haver documento.

**Mensagem pronta:**

> **Subject:** Contractual transfer mechanism for Brazilian personal data (LGPD) — Workers, D1, R2 and logs
>
> Hello,
>
> I use a self-serve Cloudflare account (Account ID: 5d16c8ef26d280c96898835b4a71b7ea) to run an application on Workers, D1 (primary in ENAM), R2 and Cloudflare Access, with Workers Logs (observability) enabled. It processes personal data of individuals in Brazil, which is subject to the Brazilian LGPD (Law 13.709/2018). Under LGPD Art. 33 and ANPD Resolution CD/ANPD No. 19/2024, international transfers based on contractual clauses require the ANPD standard contractual clauses (Annex II), adopted in full and without changes, in an instrument between exporter and importer.
>
> Your DPA (version 6.4, effective April 3, 2026) covers EU, UK and Swiss transfers and the Global CBPR/PRP systems, but I could not find the ANPD clauses. Please confirm in writing:
>
> 1. Which LGPD Art. 33 transfer mechanism Cloudflare offers for this account, with the exact clause, document, version and date.
> 2. Whether Cloudflare offers an addendum with the ANPD standard contractual clauses for self-serve accounts, and how it is executed.
> 3. Which services and data that mechanism covers: Workers (including edge processing), D1, R2, Cloudflare Access logs, Workers Logs/observability, analytics and support data.
> 4. Where each of those services stores and processes data, and which sub-processors and onward transfers apply.
> 5. If I create D1 and R2 with the "eu" jurisdiction and use Regional Services, whether processing and any onward transfers, including access by Cloudflare, Inc. in the U.S., remain within the EU, and whether logs remain outside that scope.
>
> Please do not change any contract or setting on my account based on this request; I only need the information.
>
> Thank you,
> Rogério Palhari

Depois da resposta: guardar a resposta (com o SHA-256) como evidência `transfer_mechanism` e decidir a D-L9 (manter com o mecanismo indicado, recriar D1/R2 na UE ou não enviar).

## 2. Registro de incidentes

**Obrigação** (Res. CD/ANPD 15/2024, art. 10, texto conferido): o controlador mantém o registro de todo incidente de segurança, comunicado ou não, por no mínimo 5 anos a partir do registro.

**Procedimento final proposto:**
1. **Local principal:** `C:\Users\Roger\eag-compass-registros\incidentes\`. A pasta-mãe já existe com acesso só de `ROGERIONOTE\Roger`. Nunca no Git, nunca na Cloudflare.
2. **Arquivos:**
   - `REGISTRO-INCIDENTES.md`, só acréscimo; correção é uma entrada nova que cita a anterior;
   - `INDICE-SHA256.txt`, com uma linha por versão do registro (data e SHA-256).
3. **Conteúdo:** sem dado pessoal em texto aberto. Só números, categorias e referências internas (IDs do Compass, caminhos de evidência).
4. **Campos obrigatórios** (art. 10, § 1º):
   1. data de conhecimento;
   2. descrição geral das circunstâncias;
   3. natureza e categoria dos dados afetados;
   4. número de titulares afetados;
   5. avaliação do risco e possíveis danos;
   6. medidas de correção e mitigação;
   7. forma e conteúdo da comunicação, se houve;
   8. motivos da ausência de comunicação, quando for o caso.
5. **Campos de controle:**
   - número;
   - data do registro;
   - "guardar até" (registro + 5 anos);
   - controlador (Rogério Palhari, pessoa física, para o tratamento no Compass);
   - quem registrou;
   - critérios do art. 5º avaliados;
   - prazo de comunicação calculado (3 dias úteis);
   - evidências.
6. **Prazo interno:** abrir a entrada no mesmo dia do conhecimento e avaliar em até 24 h (O8-e). Incidente na caixa corporativa fornecida pela EAG é tratado pela EAG e informado a ela.
7. **Eliminação:** nada antes de "guardar até"; depois, só por revisão registrada.
8. **Primeiro candidato a registro:** a indisponibilidade de 09/10 (limite de leituras do D1, cerca de 17:06–00:00 UTC). Não houve perda nem exposição; registrar como incidente de disponibilidade ou como evento avaliado e não confirmado é parte da sua avaliação.

**Cópia cifrada** (neste computador não há 7-Zip, VeraCrypt nem Google Drive para desktop; o Windows 10 Home não tem BitLocker nem EFS):
- **A.** Instalar o 7-Zip (gratuito) e guardar um `.7z` com AES-256 e senha forte numa pasta do seu Google Drive pessoal, enviado pelo navegador. Senha guardada fora do Drive.
- **B.** Pendrive com contêiner VeraCrypt, guardado com você. Sem nuvem; depende de lembrar de atualizar.
- **C.** Anexo num cofre de gerenciador de senhas que você já use, se tiver um.

**O que falta você escolher:**
1. Aprovar o procedimento acima.
2. Escolher A, B ou C (ou A + B).
3. Dizer onde fica a senha da cópia cifrada.

Com isso eu crio a pasta, o arquivo modelo vazio e o índice; você faz a cópia cifrada.

## 3. OpenClaw B: declaração para preencher

Os trechos **[entre colchetes]** são os fatos ainda não confirmados. Só você pode preenchê-los.

> "Eu, Rogério Palhari, declaro em **[data]** que a base do OpenClaw **[não é recuperável / foi recuperada parcialmente]**. Consta registrado que a VPS foi reinstalada em 24/09/2026 e que não há cópia dos dados neste computador. Das empresas do piloto brasileiro (Cimilho; Rei do Milho — Inhumas; São Martinho — Usina Boa Vista), **[nenhuma foi contatada pelo OpenClaw / as seguintes foram contatadas: ___]**. As supressões de que tenho conhecimento são **[nenhuma / lista: ___]**, e eu as cadastrarei no Compass antes do primeiro envio. A exceção vale só para a base perdida e não dispensa a importação se ela for recuperada."

Depois de preenchida, entra na Spec como exceção datada a R21.8/R25.2.

## 4. As três fichas (versão 2, aguardando sua revisão)

**Caminho no painel:** Abordagem → Fichas → "Revisar e aprovar" na linha da empresa (o botão só abre a ficha; aprovar é outro passo, hoje bloqueado pela trava T11, pela campanha em rascunho e pelo canal `planned`).

| Empresa | Ficha | Destinatário (canal geral publicado) |
|---|---|---|
| Cimilho | `92203532-1ef4-4ec9-8d0a-9dd4fc51e09e` | e-mail geral do site |
| São Martinho — Usina Boa Vista | `3bba38e2-b2b8-491b-b34a-8e4c647d028b` | e-mail geral da unidade na página oficial |
| Rei do Milho — Inhumas | `5217599f-cce1-41d1-94fa-4ec4c6be2834` | e-mail de compras do site |

As três têm o **mesmo texto**. Muda só o link de descadastro de cada destinatário, que aparece abaixo como marcador por funcionar como chave de ação. Modelo `id-pt-1.2.0`; revisor sem violações; passos no dia 0 e no dia 4.

**Passo 1 (dia 0)** — Assunto: **Responsável pela compra de milho**

```
Olá,

Meu nome é Rogério Palhari, da EAG Agro, no Brasil. Atuamos na intermediação de commodities agrícolas, incluindo milho brasileiro.

Quem é responsável pela compra de milho na empresa? Poderia encaminhar esta mensagem à pessoa responsável ou indicar um contato profissional adequado?

Obrigado pela atenção.

Rogerio Palhari
Broker | EAG AGRO
+55 66 99226-9615
rogeriopalhari@eagagro.com
www.eagagro.com

The content of this email is confidential and intended solely for the recipient specified in this message. Sharing any part of this message with third parties without the sender’s written consent is strictly prohibited. If you have received this message by mistake, please reply and proceed with its deletion so that we can ensure such an error does not occur in the future.

—
Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil
Encontrei este endereço no site da empresa. Pedidos sobre dados pessoais: rogeriopalhari@hotmail.com.
Para não receber mais mensagens, responda "sair" ou use este link: [link de descadastro próprio deste destinatário]
```

**Passo 2 (dia 4)** — Assunto: **Responsável pela compra de milho**

```
Olá,

Retomo brevemente minha mensagem anterior. Poderia indicar com quem devo falar sobre a compra de milho?

Se a empresa não compra milho, uma breve confirmação já ajuda.

Obrigado.

[mesma assinatura, aviso de confidencialidade e rodapé do passo 1]
```

## 5. Pendências restantes (lista única)

**Decisões suas:**
1. Procedimento de incidentes e local da cópia cifrada (§2).
2. Declaração do OpenClaw (§3).
3. Revisão das 3 fichas, para aceitar o texto ou pedir mudança. A aprovação é depois da T11 validada.
4. D-L9, depois da resposta da Cloudflare.
5. Registrar a validação T11 `br_email_automatic` (Administrador), quando houver as 5 evidências.
6. Na hora do primeiro envio real:
   - autorizar a validação dos 3 endereços pela Snov (3 créditos);
   - configurar a cópia para vendas@;
   - ativar a campanha de milho;
   - liberar o canal (R26.3);
   - aprovar cada ficha.
7. **Opcional, não necessária para a T11:** declarar ou não o enquadramento de pequeno porte.

**Comprovações externas:**
1. Resposta escrita da Cloudflare sobre o mecanismo do art. 33 (§1).

**Ações técnicas:**
1. **Horário da cópia:** diferenciar o instante do aceite SMTP do original (informado pela ponte) do instante em que o Compass registrou o aceite. A linha "enviado em …" da cópia hoje usa o registro no Compass. No teste de 14/10, o SMTP aceitou o original às 21:13:19 UTC e a cópia mostrou 21:14, horário do registro, que não deve ser apresentado como horário do envio. Pendente, não implementado.
2. Criar a pasta, o modelo e o índice do registro de incidentes, depois da sua escolha.
3. Montar as 5 evidências com SHA-256 para o registro T11:
   - `decisions`: decisões de 08–09/10;
   - `legal_basis`: E1;
   - `transfer_mechanism`: resposta da Cloudflare;
   - `incident_register`: registro criado;
   - `erasure_test`: teste de 08/10.
4. Reimportar as listas de sanções se o primeiro envio for depois de 24/10/2026 (validade de 720 h).
5. Investigar o consumo de leituras da fila da lista mensal internacional (`trade_list_jobs`, cerca de 1.240 linhas por consulta, repetindo em 14/10): risco de custo, não de envio.
6. Registrar no CRM da EAG as 3 empresas antes do primeiro contato (obrigação contratual, feita por você no sistema da EAG, fora do Compass).

## 6. Atualização de 2026-10-15 (retomada só das três pendências da T11)

**Estado:**
- Worker `abdabdc2`.
- As 3 fichas brasileiras na **versão 4** (`id-pt-1.4.0`, Bom dia/Boa tarde), sem aprovação.
- 0 validações T11; canais `planned`; campanhas inativas; cópia desligada; nenhum envio novo.
- Decisões já aprovadas (lista do topo) não são reabertas.

| Pendência | Conferido em 15/10 | Situação |
| --- | --- | --- |
| Cloudflare (art. 33, L9, evidência `transfer_mechanism`) | Gmail de `rogeriopalhari23@gmail.com` (só leitura): nenhuma mensagem enviada a `privacyquestions@`/`dpo@cloudflare.com` e nenhuma resposta; só e-mails de marketing da Cloudflare chegam a esse endereço, o que indica que ele é o dono da conta. A mensagem do §1 continua válida | **Não enviada.** Aguarda o envio por Rogério, depois a resposta |
| Registro de incidentes (evidência `incident_register`) | `C:\Users\Roger\eag-compass-registros\` existe só com `contrato\`; não há pasta `incidentes\` | **Aguarda as escolhas de Rogério** (§2). Nada criado |
| Declaração do OpenClaw B (exceção a R21.8/R25.2) | Nenhuma declaração registrada desde 09/10 | **Aguarda os fatos de Rogério** (§3) |

**Respostas que faltam de Rogério:**
1. **Cloudflare:** enviar a mensagem do §1 do e-mail dono da conta. Rogério envia direto, ou autoriza um rascunho no Gmail dele para revisar e enviar ele mesmo. Rascunho não é envio.
2. **Incidentes:**
   - aprovar o procedimento do §2;
   - escolher a cópia cifrada A, B, C ou A + B;
   - dizer onde fica a senha (só o local, nunca a senha);
   - dizer como classificar a indisponibilidade de 09/10: incidente de disponibilidade ou evento avaliado e não confirmado.
3. **OpenClaw:** completar a declaração do §3:
   - data;
   - se a base é recuperável;
   - quais empresas do piloto foram contatadas pelo OpenClaw (ou nenhuma);
   - supressões conhecidas (ou nenhuma).

**Depois das respostas (sem nova decisão):**
- criar a pasta, o modelo e o índice de incidentes;
- registrar a declaração na Spec;
- guardar a resposta da Cloudflare com SHA-256;
- montar as 5 evidências.

O registro da validação T11 continua sendo ato do Administrador, com autorização expressa. A D-L9 só é decidida depois da resposta da Cloudflare.

## 7. Atualização de 2026-10-15 (tarde)

- **Cloudflare:** **envio informado por Rogério em 15/10/2026, aguardando resposta.** O mecanismo do art. 33 **não** é considerado comprovado (L9 pendente; D-L9 depois da resposta).
- **Incidentes:**
  - procedimento final para aprovação em `REGISTRO-INCIDENTES-PROCEDIMENTO.md`;
  - rascunho do modelo fora do Git (`C:\Users\Roger\eag-compass-registros\incidentes\RASCUNHO-REGISTRO-INCIDENTES.md`, acesso só de `ROGERIONOTE\Roger`), com a indisponibilidade de 09/10 em avaliação, fatos e incertezas separados, sem classificação.
- **OpenClaw:** rascunho da declaração com os fatos comprovados e os pendentes em `DECLARACAO-OPENCLAW-RASCUNHO.md`.
  - Correção: "reinstalada em 24/09" não é fato comprovado; 24/09 é a data em que a troca de chaves foi observada.
- **Evidências:** índice em `t11-evidencias/INDICE.md`.
  - Prontas, com SHA-256: `decisions`, `legal_basis` e `erasure_test`.
  - Incompletas: `transfer_mechanism` e `incident_register`.
  - Validação T11 **não registrada**.
- **Horário da cópia:** corrigido no commit `e60b328` (migração 0043, ponte 0.2.1), não publicado.
