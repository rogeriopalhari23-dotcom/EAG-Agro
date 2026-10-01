# Prontidão das fichas Amori e BLACK & YUM — revisão sem envio (2026-10-01)

Revisão feita sobre os dados de produção, só com leitura: `GET /api/fichas/:id` pelo Access e consultas `SELECT` no D1.
Não houve envio, aprovação nem consumo da Snov. Nada mudou no conteúdo desde a versão 2 de 2026-09-30 17:52 UTC, e por
isso **nenhuma versão nova foi gerada**. As duas fichas continuam `in_approval`; a campanha
`defa3ad8-70af-4034-96f8-7ea423735b5f` (Alemanha, café verde) continua `draft`; o canal `email` continua `planned`.

## Conferência por item

| Item | Amori | BLACK & YUM | Situação |
| --- | --- | --- | --- |
| Conteúdo congelado | v2, 2 passos (dia 0 e dia 4), revisor PV `ok` (SIG, PV2, PV3, PV4, PV7, PV9, PV10, PV12, R19.13, R19.2-12) | igual | ok |
| Assinatura | `sig-eag-1.0.0`, uma vez | igual | ok. Observações abaixo. |
| Descadastro | Resposta „abmelden“ (reconhecida pelo classificador, junto com „abbestellen“ e „austragen“) e link one-click; cabeçalho `List-Unsubscribe` comprovado no cenário 3b | igual | ok |
| Endereço físico | Rodapé com "Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil", igual ao confirmado (`EAG_POSTAL_ADDRESS_CONFIRMED`) | igual | ok |
| Validação do endereço | Snov `valid`, vence 2026-10-31 18:33 UTC | `valid`, vence 2026-10-31 18:33 UTC | ok até 31/10. O pré-envio confere a validade **em cada passo**: o passo 2 (dia 4) também tem de sair antes do vencimento. |
| Perfil comprador | Canal geral da empresa (papel `other`), `buyer_type` `unconfirmed`, finalidade `identify_buyer` | igual | Coerente: o e-mail só pede o comprador responsável. |
| Porte | `pending_size`; a ficha registra que esclarecer o porte é objetivo do primeiro contato | igual | Coerente com a regra (porte só desempata). O texto não pergunta o porte; ele entra na conversa aberta pela resposta. |
| Janela do destinatário | Fuso `Europe/Berlin`; janela internacional 09–17, seg–sex | igual | ok. Em horário de Cuiabá: 03–11h até 25/10 (horário de verão europeu) e 04–12h depois. O PC da ponte precisa estar ligado e lendo a caixa nesse horário. |
| Leitura das respostas | Portão R19.14 ativo (nada sai sem leitura boa nos últimos 10 min); ponte em execução contínua | igual | ok tecnicamente |
| Triagem de sanções | **Nunca feita** para a empresa | **Nunca feita** | **Bloqueio B1.** O pré-envio segura com `compliance_unavailable`. As listas vencem em 2026-10-24. |
| Liberação internacional | Parâmetro `international_enabled:international` **ausente** | igual | **Bloqueio B2.** A aprovação recusa com `international_not_enabled` (P3-T12). |
| Campanha | `draft` (versão 1; validação comercial do café aprovada em 2026-09-30) | igual | **Bloqueio B3:** só a ativação por Rogério. |
| Canal | `planned` | igual | **Bloqueio B4:** liberação do canal (R26.3), decisão de Rogério. |
| Supressões do OpenClaw (R21.8/R25.2) | Não importadas (P2-T15 parcial: VPS reinstalada) | igual | **Bloqueio B5:** a Spec manda importar antes do primeiro envio do piloto, ou registrar uma exceção. |
| Compliance da Alemanha (T11) | E-mail publicitário sem consentimento prévio (UWG §7(2) Nr. 2) | igual | **Bloqueio B6, jurídico:** ver `T11-POLITICA-PROPOSTA.md` §5. Endereço publicado, `valid` e link de saída não são consentimento. |
| Informação do GDPR Art. 14 | Ausente | Ausente | Depende do validador (T11 §4). Se for exigida, a ficha precisa de versão nova. |

### Observações sem bloqueio (decisão de Rogério se quiser mudar)
1. A assinatura usa "Rogerio" sem acento, e o corpo usa "Rogério". Ambos vêm do padrão oficial (`sig-eag-1.0.0` e
   `SENDER_PERSON_NAME`).
2. O aviso de confidencialidade da assinatura está em inglês num e-mail em alemão. Faz parte da assinatura oficial.
3. O link de descadastro aponta para `eag-compass-production.rogeriopalhari23.workers.dev`: funciona, mas mostra uma
   conta pessoal. Melhora quando o domínio `eagcompass.com` estiver ligado (P1-T12).
4. Mudar qualquer um desses itens gera versão nova e exige nova aprovação. Por isso não alterei nada.

## Bloqueios concretos, por ficha (iguais nas duas)
- **B1:** a triagem de sanções da empresa precisa ser feita no mesmo mês do envio. É ação interna, sem custo.
- **B2:** a liberação internacional (P3-T12) precisa ser registrada por Rogério.
- **B3:** a campanha precisa ser ativada.
- **B4:** o canal de e-mail precisa ser liberado.
- **B5:** é preciso importar as supressões do OpenClaw ou registrar uma exceção.
- **B6:** a validação jurídica do e-mail para a Alemanha. **Esse bloqueio prevalece sobre os outros:** mesmo com B1–B5
  resolvidos, a recomendação é não aprovar estas fichas por e-mail sem o parecer.

## Textos finais congelados (os que seriam aprovados)

Tradução de apoio (não enviada):
- **Passo 1:** "Bom dia, meu nome é Rogério Palhari, trabalho na EAG Agro no Brasil. Intermediamos commodities agrícolas,
  entre elas café verde brasileiro. Quem é o responsável pela compra de café verde na sua empresa? Poderia encaminhar
  minha mensagem à pessoa responsável ou me indicar um endereço de contato profissional adequado? Obrigado pelo apoio."
- **Passo 2:** "Retomo brevemente minha mensagem anterior. Poderia me dizer a quem devo me dirigir sobre a compra de café
  verde? Se sua empresa não compra café verde, basta um breve aviso. Obrigado."
- **Rodapé:** "Se não quiser receber outras mensagens, responda 'abmelden' ou use este link."

### Amori Coffee (Mainz) — ficha `14f46b96-8073-4532-92c3-083351acaa9a`, versão 2

Hash de aprovação do destinatário (`messagesSha256`): `30d4d10f9464676784dcc8e8bb33e8a0a1e718a4b1a6f4707f4b28c375a68403`.

**Passo 1 — dia 0 — SHA-256 `d60987c8e05f45bce2ac044b49b0b66a17c657e68e6dd24656d3e60e90a3615f`**

Assunto: Zuständige Person für den Rohkaffee-Einkauf

```text
Guten Tag,

mein Name ist Rogério Palhari, ich bin bei EAG Agro in Brasilien tätig. Wir vermitteln Agrarrohstoffe, darunter brasilianischen Rohkaffee.

Wer ist in Ihrem Unternehmen für den Einkauf von Rohkaffee zuständig? Könnten Sie meine Nachricht bitte an die zuständige Person weiterleiten oder mir eine geeignete geschäftliche Kontaktadresse nennen?

Vielen Dank für Ihre Unterstützung.

Rogerio Palhari
Broker | EAG AGRO
+55 66 99226-9615
rogeriopalhari@eagagro.com
www.eagagro.com

The content of this email is confidential and intended solely for the recipient specified in this message. Sharing any part of this message with third parties without the sender’s written consent is strictly prohibited. If you have received this message by mistake, please reply and proceed with its deletion so that we can ensure such an error does not occur in the future.

—
Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil
Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: https://eag-compass-production.rogeriopalhari23.workers.dev/u/MjRkMWYzNGUtNzVmMy00MmJiLTgyZjgtODg1OWJiMDFkZDY5LmE5M2MwNTM4LWExY2EtNDJjNC05ZWExLTM5NTMzOGQzM2QyNQ.2I4fA3K3v0jcoiuogLB8x7iPJDVz4GABtTzC0pzJcUU
```

**Passo 2 — dia 4 — SHA-256 `4ebf2d193287d199f5e46fb357a667e5faced9b21ce23c9dbc245ee638fbac29`**

Assunto: Zuständige Person für den Rohkaffee-Einkauf

```text
Guten Tag,

ich komme kurz auf meine vorherige Nachricht zurück. Könnten Sie mir bitte mitteilen, an wen ich mich bezüglich des Einkaufs von Rohkaffee wenden kann?

Falls Ihr Unternehmen keinen Rohkaffee einkauft, genügt ein kurzer Hinweis.

Vielen Dank.

Rogerio Palhari
Broker | EAG AGRO
+55 66 99226-9615
rogeriopalhari@eagagro.com
www.eagagro.com

The content of this email is confidential and intended solely for the recipient specified in this message. Sharing any part of this message with third parties without the sender’s written consent is strictly prohibited. If you have received this message by mistake, please reply and proceed with its deletion so that we can ensure such an error does not occur in the future.

—
Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil
Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: https://eag-compass-production.rogeriopalhari23.workers.dev/u/MjRkMWYzNGUtNzVmMy00MmJiLTgyZjgtODg1OWJiMDFkZDY5LmE5M2MwNTM4LWExY2EtNDJjNC05ZWExLTM5NTMzOGQzM2QyNQ.2I4fA3K3v0jcoiuogLB8x7iPJDVz4GABtTzC0pzJcUU
```

### BLACK & YUM GenussRösterei – Telgter KaffeeBar (Telgte) — ficha `b299df74-fe35-42d2-bdc4-52c31129b2f1`, versão 2

Hash de aprovação do destinatário (`messagesSha256`): `99dbc8ba227769803bc9eb4b483325ff5adb5dc58f5076d81ee0323cab3d5239`.

**Passo 1 — dia 0 — SHA-256 `70084d6bb262113a8e87692d65ee19127bbe543315c351a1919f153d2da68f0b`**

Assunto: Zuständige Person für den Rohkaffee-Einkauf

```text
Guten Tag,

mein Name ist Rogério Palhari, ich bin bei EAG Agro in Brasilien tätig. Wir vermitteln Agrarrohstoffe, darunter brasilianischen Rohkaffee.

Wer ist in Ihrem Unternehmen für den Einkauf von Rohkaffee zuständig? Könnten Sie meine Nachricht bitte an die zuständige Person weiterleiten oder mir eine geeignete geschäftliche Kontaktadresse nennen?

Vielen Dank für Ihre Unterstützung.

Rogerio Palhari
Broker | EAG AGRO
+55 66 99226-9615
rogeriopalhari@eagagro.com
www.eagagro.com

The content of this email is confidential and intended solely for the recipient specified in this message. Sharing any part of this message with third parties without the sender’s written consent is strictly prohibited. If you have received this message by mistake, please reply and proceed with its deletion so that we can ensure such an error does not occur in the future.

—
Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil
Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: https://eag-compass-production.rogeriopalhari23.workers.dev/u/ZjYwNmIyM2QtYzljNi00YmQxLWFjNzItNTI1OTM2NDQ3MTQzLmYxOWVkNTVmLTQyZGQtNGExYS05YWVkLWFkZTE5MjU3YjM4Yw.KrFA7b4tZAjGUXdbvleqLkOnSlAJxLt1a3soTSUpdzI
```

**Passo 2 — dia 4 — SHA-256 `a6ad78d66c704c4914be5e0e0cea59c947a7f3e441e508d68ba3645673ddfb0b`**

Assunto: Zuständige Person für den Rohkaffee-Einkauf

```text
Guten Tag,

ich komme kurz auf meine vorherige Nachricht zurück. Könnten Sie mir bitte mitteilen, an wen ich mich bezüglich des Einkaufs von Rohkaffee wenden kann?

Falls Ihr Unternehmen keinen Rohkaffee einkauft, genügt ein kurzer Hinweis.

Vielen Dank.

Rogerio Palhari
Broker | EAG AGRO
+55 66 99226-9615
rogeriopalhari@eagagro.com
www.eagagro.com

The content of this email is confidential and intended solely for the recipient specified in this message. Sharing any part of this message with third parties without the sender’s written consent is strictly prohibited. If you have received this message by mistake, please reply and proceed with its deletion so that we can ensure such an error does not occur in the future.

—
Al. Rio Negro, 503 — Alphaville Industrial, Barueri/SP, Brasil
Wenn Sie keine weiteren Nachrichten erhalten möchten, antworten Sie mit „abmelden“ oder nutzen Sie diesen Link: https://eag-compass-production.rogeriopalhari23.workers.dev/u/ZjYwNmIyM2QtYzljNi00YmQxLWFjNzItNTI1OTM2NDQ3MTQzLmYxOWVkNTVmLTQyZGQtNGExYS05YWVkLWFkZTE5MjU3YjM4Yw.KrFA7b4tZAjGUXdbvleqLkOnSlAJxLt1a3soTSUpdzI
```

