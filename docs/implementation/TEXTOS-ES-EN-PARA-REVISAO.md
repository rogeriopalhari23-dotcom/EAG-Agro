# Textos em espanhol e inglês para revisão de Rogério (2026-10-14)

**Situação:** rascunho para revisão. Nada foi implementado, publicado ou aprovado. Base: Spec R28.20 e R28.21, `IDIOMA-POR-PAIS.md`.

**Base dos textos:** tradução fiel dos textos de Rogério já em produção (identificação `id-pt-1.4.0`: E-mail 1 com "Bom dia"/"Boa tarde", E-mail 2, transparência E2-b e descadastro).

**O que não é traduzido:**
- nomes próprios: Rogerio Palhari, EAG Agro e o nome da empresa;
- assinatura oficial ("Broker | EAG AGRO", contatos, aviso de confidencialidade, que já está em inglês);
- endereço físico.

**Marcadores:** `{{empresa}}`/`{{company}}`, `{{nome}}`/`{{name}}` e `{{link}}` aparecem aqui só para a revisão. Na ficha, o sistema troca cada um pelo valor real antes da aprovação, e o revisor recusa marcador que sobrar.

**Commodity do exemplo:** milho, em espanhol "maíz" e em inglês "corn". As outras commodities usam o termo de mercado de cada idioma, a confirmar quando houver campanha.

## 1. Espanhol (América Latina, exceto Brasil)

Tratamento formal ("usted"), espanhol neutro, sem regionalismos.

**Assunto (os dois e-mails, sem "Re:"):** `Responsable de la compra de maíz`

### E-mail 1 (dia 0)

Antes das 12:00 no horário do destinatário:

```text
Buenos días, ¿cómo está?

Mi nombre es Rogerio Palhari y trabajo en la originación de commodities agrícolas. Soy franquiciado de EAG Agro y estoy buscando el contacto de la persona responsable de la compra de maíz en {{empresa}}.

¿Podría indicarme quién se encarga de esta área y cuál sería el mejor canal para conversar?

Gracias por su atención.
```

A partir das 12:00: o mesmo texto com a primeira linha `Buenas tardes, ¿cómo está?`.

Destinatário pessoa com nome confirmado (nunca no canal geral):
- `Buenos días, {{nome}}, ¿cómo está?`
- `Buenas tardes, {{nome}}, ¿cómo está?`

### E-mail 2 (dia 4)

Sem saudação por horário, como em português.

```text
Hola:

Retomo brevemente mi mensaje anterior. ¿Podría indicarme con quién debo hablar sobre la compra de maíz?

Si la empresa no compra maíz, una breve confirmación ya me ayuda.

Gracias.
```

### Rodapé (todos os e-mails, depois da assinatura)

```text
—
[endereço físico da EAG, sem tradução]
Encontré esta dirección en el sitio web de la empresa. Solicitudes sobre datos personales: rogeriopalhari@hotmail.com.
Para no recibir más mensajes, responda "baja" o use este enlace: {{link}}
```

A frase "Encontré esta dirección…" só entra quando a fonte registrada do canal é o site da empresa. Em outra fonte, fica só "Solicitudes sobre datos personales: …", como no português (PV4).

### Página de descadastro (link do rodapé)

- **Pergunta:** "¿No desea recibir más mensajes de EAG Agro?"
- **Botão:** "Confirmar baja"
- **Confirmação:** "Listo. No recibirá más mensajes."
- **Link inválido:** "Enlace inválido o vencido."
- **Muitas tentativas:** "Demasiados intentos. Inténtelo de nuevo en un minuto."

## 2. Inglês (fora da América Latina, incluindo Portugal, os países lusófonos fora da América Latina e a Alemanha)

**Assunto (os dois e-mails, sem "Re:"):** `Person responsible for corn purchasing`

Substitui o `Corn supplier` do modelo `id-en-1.0.0`, nunca revisado, para dizer o mesmo que o assunto em português.

### E-mail 1 (dia 0)

Antes das 12:00 no horário do destinatário:

```text
Good morning, I hope you are well.

My name is Rogerio Palhari and I work in the origination of agricultural commodities. I am a franchisee of EAG Agro and I am looking for the contact of the person responsible for purchasing corn at {{company}}.

Could you let me know who handles this area and what would be the best channel to talk?

Thank you for your attention.
```

A partir das 12:00: o mesmo texto com a primeira linha `Good afternoon, I hope you are well.`.

Destinatário pessoa com nome confirmado:
- `Good morning {{name}}, I hope you are well.`
- `Good afternoon {{name}}, I hope you are well.`

### E-mail 2 (dia 4)

```text
Hello,

Following up briefly on my previous message. Could you let me know who I should speak with about corn purchasing?

If your company does not buy corn, a short confirmation already helps.

Thank you.
```

### Rodapé

```text
—
[endereço físico da EAG, sem tradução]
I found this address on the company's website. Requests regarding personal data: rogeriopalhari@hotmail.com.
To stop receiving these messages, reply "unsubscribe" or use this link: {{link}}
```

A linha de descadastro é a mesma já usada nos modelos em inglês. A origem do endereço segue a mesma regra do português.

**A página de descadastro já tem inglês:** "Don't want to receive messages from EAG Agro?", "Unsubscribe", "Done. You will not receive further messages."

## 3. Pontos para a revisão

1. **"originación" e "origination":** traduzem "originação", que é jargão do mercado. Se preferir algo mais claro para o leitor de fora, sugestões:
   - espanhol: "comercialización de commodities agrícolas";
   - inglês: "agricultural commodity trading".
2. **"franquiciado de EAG Agro" e "franchisee of EAG Agro":** sem artigo, porque é nome próprio de empresa. Em português ficou "da EAG Agro".
3. **Transparência:** é a tradução da linha E2-b, aprovada para o Brasil (LGPD). Se ela basta em cada país (GDPR art. 14 na União Europeia e em Portugal, leis de cada país da América Latina) depende da T11 do país (`<país>_email_automatic`). A tradução não libera nenhum país.
4. **"baja":** a ponte e o Compass ainda não reconhecem "baja" como pedido de saída. Isso tem de ser implementado antes de qualquer envio em espanhol (ajuste 6 de `IDIOMA-POR-PAIS.md`).
5. **E-mail 2 sem saudação por horário:** começa com "Hola:" e "Hello,", como o português começa com "Olá,". O R28.21 vale para o E-mail 1.

## 4. Textos de reunião ainda não aprovados (separados)

Não fazem parte desta revisão de identificação:
- **Inglês, modelo de reunião `pv-en-1.0.0`:** tradução dos 4 e-mails, LinkedIn e roteiros, em `AMOSTRAS-TEXTOS-EN.md`, aguardando aprovação de Rogério desde o P3-T9. Ainda abre com "Hi <nome>, I hope you're well.", sem saudação por horário (ajustar se o R28.21 for estendido aos e-mails de reunião).
- **Espanhol, modelo de reunião:** não existe. Só será preparado se Rogério pedir.
- **Alemão, identificação `id-de-1.1.0`:** 3 fichas em produção, `in_approval`, mantidas sem alteração por instrução de Rogério (14/10). Pela regra, a Alemanha passa a usar inglês.

## 5. Propostas para L1 e L4 (só propostas, não decisões de Rogério)

### L1: casos geográficos da América Latina

**Proposta:** espanhol só onde o espanhol é língua oficial; os demais territórios da região ficam em inglês.

| País ou território | Proposta | Motivo |
| --- | --- | --- |
| Argentina (AR), Bolívia (BO), Chile (CL), Colômbia (CO), Costa Rica (CR), Cuba (CU), El Salvador (SV), Equador (EC), Guatemala (GT), Honduras (HN), México (MX), Nicarágua (NI), Panamá (PA), Paraguai (PY), Peru (PE), República Dominicana (DO), Uruguai (UY), Venezuela (VE) | Espanhol | Espanhol é língua oficial |
| Porto Rico (PR) | Espanhol | Espanhol oficial ao lado do inglês, e é o idioma corrente dos negócios locais |
| Haiti (HT) | Inglês | Francês e crioulo; o espanhol não é falado como língua de negócios |
| Belize (BZ), Guiana (GY) | Inglês | Inglês é a língua oficial |
| Suriname (SR) | Inglês | Neerlandês oficial; inglês é a língua corrente de comércio |
| Guiana Francesa (GF), Guadalupe (GP), Martinica (MQ) e demais territórios franceses | Inglês | Francês oficial; o espanhol não serve |
| Caribe de língua inglesa ou neerlandesa (Jamaica, Trinidad e Tobago, Bahamas, Barbados, Aruba, Curaçao etc.) | Inglês | Inglês ou neerlandês; fora do recorte hispânico |

**Consequência da regra, só registrada (não é caso de L1):** Espanha e Guiné Equatorial têm espanhol oficial, mas ficam fora da América Latina e recebem inglês pela regra como escrita. Se Rogério quiser espanhol para elas, será uma exceção explícita.

### L4: origem do país do destinatário

**Proposta:**
1. Por padrão, o país é o da **empresa cadastrada** (`companies.country_code`, ISO, obrigatório no cadastro e vindo da fonte do cadastro: CNPJ, registro comercial ou cadastro oficial do país).
2. Exceção só com prova documental: um campo opcional de **país do contato**, preenchido apenas quando o endereço publicado do contato estiver em outro país (exemplo: escritório de compras no exterior), com a fonte registrada.
3. **Nunca** servem para definir o país:
   - nome da pessoa;
   - domínio ou terminação do e-mail (.com, .es, .pt);
   - prefixo do telefone;
   - fuso horário.

   O fuso continua servindo só para a janela e para a saudação.
4. A versão da ficha guarda o país usado e a origem dele (empresa ou contato, com fonte). Assim a escolha do idioma fica auditável.
5. Sem país da empresa, a ficha não é gerada.
