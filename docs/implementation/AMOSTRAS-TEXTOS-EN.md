# Amostras lado a lado — tradução para o inglês (P3-T9)

Gerado por `scripts/amostras-en.mjs`. Skill `/prospeccao-vendas` SHA-256 `33bd093f…`; modelos `pv-1.0.0` (português) e `pv-en-1.0.0` (inglês).

**Portão humano (Plano 3 T9):** a tradução só vale depois que Rogério aprovar este documento. Até lá toda ficha em inglês sai com PV12 reprovado e não pode ser aprovada. Para liberar, depois da aprovação por escrito, o admin grava o parâmetro `templates_en_approved` no escopo `pv-en-1.0.0` com `{"enabled":true,"evidenceRef":"docs/implementation/AMOSTRAS-TEXTOS-EN.md#aprovacao"}`.

Decisões a conferir:
- A-EN1: a prova social declarada (texto em português) **não** entra no e-mail em inglês, para não misturar idiomas. Se Rogério quiser prova social no internacional, precisa de uma declaração em inglês.
- "usina" traduzido por "mill" na pergunta do Level 2 ("directly from the mill or through a trading company?").
- Saudação "Olá, <nome>, tudo bem?" → "Hi <nome>, I hope you're well."; break "Um abraço," → "Best regards,".
- Nomes das commodities em inglês: termos de mercado (soybean, soybean meal, cottonseed meal, corn gluten feed, used cooking oil…); CSO sem nome em inglês (identidade pendente) — a ficha não é gerada.

Lacuna registrada em toda ficha internacional: _Lacuna 🔴 (R28.15): a skill /prospeccao-vendas não tem método específico para exportação — o curso diz que o processo é o mesmo, em inglês. Feiras, câmaras de comércio e bases de importadores não são cobertos._

## Sem declarações de volume

### Decisor — passo 1, dia 0, e-mail

**Português** — assunto: `Fornecedor café`

```text
Olá, Anna, tudo bem?
Encontrei seu contato pelo LinkedIn e tomei a liberdade de te enviar uma mensagem rápida.
Sou da EAG Agro; atuamos na comercialização de commodities.
Meu objetivo neste primeiro contato é apenas iniciar uma conversa, para entender se faz sentido apresentar a EAG Agro como possível fornecedor para a sua empresa.
Você teria cerca de 20 minutos ainda esta semana para eu explicar rapidamente como trabalhamos?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Coffee supplier`

```text
Hi Anna, I hope you're well.
I found your contact on LinkedIn and took the liberty of sending you a quick message.
I'm with EAG Agro; we trade commodities.
My goal with this first contact is simply to start a conversation, to understand whether it makes sense to present EAG Agro as a possible supplier to your company.
Would you have about 20 minutes this week for me to quickly explain how we work?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 2, dia 4, e-mail

**Português** — assunto: `Re: Fornecedor café`

```text
Fala, Anna, tudo bem?
Você chegou a ver o e-mail que te enviei dias atrás? Não tive retorno seu. A melhor forma de falar com você é por aqui mesmo?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Re: Coffee supplier`

```text
Hi Anna, how are you?
Did you get a chance to see the email I sent you a few days ago? I haven't heard back from you. Is this the best way to reach you?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 3, dia 10, e-mail

**Português** — assunto: `Fornecedor café`

```text
Olá, Anna, tudo bem?
Volto a escrever porque sei que a rotina de compras é corrida. Conversamos com indústrias que utilizam café para entender como organizam o fornecimento.
Se fizer sentido, você teria 20 minutos para uma conversa rápida nos próximos dias?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Coffee supplier`

```text
Hi Anna, I hope you're well.
I'm writing again because I know purchasing routines are busy. We talk with manufacturers that use coffee to understand how they organize their supply.
If it makes sense, would you have 20 minutes for a quick conversation in the coming days?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 4, dia 14, e-mail

**Português** — assunto: `Fornecedor café`

```text
Acho que agora não é o melhor momento, Anna.
Tentei entrar em contato com você algumas vezes nas últimas semanas, mas não tive retorno, nem positivo nem negativo. Imagino que você esteja com outras prioridades no momento ou envolvido em projetos mais urgentes, então não quero insistir além do necessário.
A ideia do meu contato era conversarmos sobre fornecimento de café para indústrias e entender se faria sentido apresentar como a EAG Agro trabalha com fornecimento estruturado, regular e previsível.
Vou encerrar por aqui para não tomar mais seu tempo. Se em algum momento esse tema fizer sentido, é só responder este e-mail.
Um abraço,

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Coffee supplier`

```text
I guess now isn't the best time, Anna.
I've tried to reach you a few times over the last few weeks, but haven't heard back, either positive or negative. I imagine you have other priorities at the moment or are involved in more urgent projects, so I don't want to insist more than necessary.
The idea of my contact was to talk about supplying coffee to manufacturers and understand whether it would make sense to present how EAG Agro works with structured, regular and predictable supply.
I'll close here so as not to take up more of your time. If this topic makes sense at some point, just reply to this email.
Best regards,

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 5, dia 2, LinkedIn

**Português**

```text
Fala, Anna, tudo bem? Te mandei um e-mail, chegou a ver?
```

**English**

```text
Hi Anna, how are you? I sent you an email, did you get a chance to see it?
```

### Decisor — passo 6, dia 3, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)
```

### Decisor — passo 7, dia 7, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)
```

### Decisor — passo 8, dia 8, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)

Se não atender: mensagem pelo LinkedIn.
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)

If they don't answer: message on LinkedIn.
```

### Decisor — passo 9, dia 11, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)
```

### Influenciador — passo 3, dia 10, e-mail

**Português** — assunto: `Fornecedor café`

```text
Olá, Jonas, tudo bem?
Sou da EAG Agro; atuamos na comercialização de commodities e tenho tentado falar com a área de compras de vocês sobre fornecimento de café.
Você poderia me ajudar com 20 minutos de conversa, ou me indicar a pessoa mais adequada para tratar desse tema?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-influenciador>
```

**English** — assunto: `Coffee supplier`

```text
Hi Jonas, I hope you're well.
I'm with EAG Agro; we trade commodities, and I've been trying to reach your purchasing team about supplying coffee.
Could you help me with a 20-minute conversation, or point me to the most appropriate person to discuss this topic?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-influenciador>
```

## Com volume disponível declarado (A-K6)

### Decisor — passo 1, dia 0, e-mail

**Português** — assunto: `Fornecedor café`

```text
Olá, Anna, tudo bem?
Encontrei seu contato pelo LinkedIn e tomei a liberdade de te enviar uma mensagem rápida.
Sou da EAG Agro; atuamos na comercialização de commodities e hoje estamos com um volume relevante de café disponível. Atendemos indústrias de alimentos no Sudeste.
Meu objetivo neste primeiro contato é apenas iniciar uma conversa, para entender se faz sentido apresentar a EAG Agro como possível fornecedor para a sua empresa.
Você teria cerca de 20 minutos ainda esta semana para eu explicar rapidamente como trabalhamos?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Coffee supplier`

```text
Hi Anna, I hope you're well.
I found your contact on LinkedIn and took the liberty of sending you a quick message.
I'm with EAG Agro; we trade commodities and we currently have a relevant volume of coffee available.
My goal with this first contact is simply to start a conversation, to understand whether it makes sense to present EAG Agro as a possible supplier to your company.
Would you have about 20 minutes this week for me to quickly explain how we work?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 2, dia 4, e-mail

**Português** — assunto: `Re: Fornecedor café`

```text
Fala, Anna, tudo bem?
Você chegou a ver o e-mail que te enviei dias atrás? Não tive retorno seu. A melhor forma de falar com você é por aqui mesmo?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Re: Coffee supplier`

```text
Hi Anna, how are you?
Did you get a chance to see the email I sent you a few days ago? I haven't heard back from you. Is this the best way to reach you?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 3, dia 10, e-mail

**Português** — assunto: `Fornecedor café`

```text
Olá, Anna, tudo bem?
Volto a escrever porque sei que a rotina de compras é corrida. Conversamos com indústrias que utilizam café para entender como organizam o fornecimento.
Se fizer sentido, você teria 20 minutos para uma conversa rápida nos próximos dias?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Coffee supplier`

```text
Hi Anna, I hope you're well.
I'm writing again because I know purchasing routines are busy. We talk with manufacturers that use coffee to understand how they organize their supply.
If it makes sense, would you have 20 minutes for a quick conversation in the coming days?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 4, dia 14, e-mail

**Português** — assunto: `Fornecedor café`

```text
Acho que agora não é o melhor momento, Anna.
Tentei entrar em contato com você algumas vezes nas últimas semanas, mas não tive retorno, nem positivo nem negativo. Imagino que você esteja com outras prioridades no momento ou envolvido em projetos mais urgentes, então não quero insistir além do necessário.
A ideia do meu contato era conversarmos sobre fornecimento de café para indústrias e entender se faria sentido apresentar como a EAG Agro trabalha com fornecimento estruturado, regular e previsível.
Vou encerrar por aqui para não tomar mais seu tempo. Se em algum momento esse tema fizer sentido, é só responder este e-mail.
Um abraço,

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-decisor>
```

**English** — assunto: `Coffee supplier`

```text
I guess now isn't the best time, Anna.
I've tried to reach you a few times over the last few weeks, but haven't heard back, either positive or negative. I imagine you have other priorities at the moment or are involved in more urgent projects, so I don't want to insist more than necessary.
The idea of my contact was to talk about supplying coffee to manufacturers and understand whether it would make sense to present how EAG Agro works with structured, regular and predictable supply.
I'll close here so as not to take up more of your time. If this topic makes sense at some point, just reply to this email.
Best regards,

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-decisor>
```

### Decisor — passo 5, dia 2, LinkedIn

**Português**

```text
Fala, Anna, tudo bem? Te mandei um e-mail, chegou a ver?
```

**English**

```text
Hi Anna, how are you? I sent you an email, did you get a chance to see it?
```

### Decisor — passo 6, dia 3, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café e atualmente estou com um bom volume disponível para negociação. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee and I currently have a good volume available for negotiation. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)
```

### Decisor — passo 7, dia 7, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café e atualmente estou com um bom volume disponível para negociação. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee and I currently have a good volume available for negotiation. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)
```

### Decisor — passo 8, dia 8, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café e atualmente estou com um bom volume disponível para negociação. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)

Se não atender: mensagem pelo LinkedIn.
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee and I currently have a good volume available for negotiation. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)

If they don't answer: message on LinkedIn.
```

### Decisor — passo 9, dia 11, ligação

**Português**

```text
Recepção: pedir para falar com Anna ("Anna está na mesa?"). Se perguntarem o assunto: "Estou em contato com Anna por e-mail. Fala que é o Rogério Palhari, da EAG Agro."

Se atender (Level 2):
Olá, Anna, tudo bem? … Peguei seu contato no LinkedIn e queria conversar com você 5 minutos, o assunto é bem rápido. Te peguei num bom horário?
Me chamo Rogério Palhari, sou da EAG Agro. Vi que a sua empresa atua na compra de café e atualmente estou com um bom volume disponível para negociação. Queria entender rapidamente se faz sentido conversarmos.
Só para saber se temos alguma sinergia entre os negócios: se eu realmente posso te ajudar, queria fazer três perguntas rápidas.
— Hoje vocês compram café direto da usina ou via trading?
— Normalmente trabalham com compras spot ou contratos mensais?
— Em termos de volume, qual o consumo mensal médio de vocês?
Fechamento: Podemos marcar um bate-papo por vídeo, quarta ou quinta-feira? É rápido, 20 a 30 minutos. (Confirmar o e-mail ao vivo e enviar o convite na hora.)
```

**English**

```text
Reception: ask to speak with Anna ("Is Anna at their desk?"). If they ask what it's about: "I'm in touch with Anna by email. Tell them it's Rogério Palhari, from EAG Agro."

If they answer (Level 2):
Hi, Anna, how are you? … I got your contact on LinkedIn and I'd like to talk with you for 5 minutes, it's a very quick matter. Did I catch you at a good time?
My name is Rogério Palhari, I'm with EAG Agro. I saw that your company buys coffee and I currently have a good volume available for negotiation. I'd like to quickly understand whether it makes sense for us to talk.
Just to see whether there is any synergy between our businesses: if I can really help you, I'd like to ask three quick questions.
— Today, do you buy coffee directly from the mill or through a trading company?
— Do you usually work with spot purchases or monthly contracts?
— In terms of volume, what is your average monthly consumption?
Close: Can we schedule a video call, Wednesday or Thursday? It's quick, 20 to 30 minutes. (Confirm the email live and send the invitation right away.)
```

### Influenciador — passo 3, dia 10, e-mail

**Português** — assunto: `Fornecedor café`

```text
Olá, Jonas, tudo bem?
Sou da EAG Agro; atuamos na comercialização de commodities e tenho tentado falar com a área de compras de vocês sobre fornecimento de café.
Você poderia me ajudar com 20 minutos de conversa, ou me indicar a pessoa mais adequada para tratar desse tema?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
Para não receber mais mensagens, responda "sair" ou use este link: https://compass.exemplo/u/<token-influenciador>
```

**English** — assunto: `Coffee supplier`

```text
Hi Jonas, I hope you're well.
I'm with EAG Agro; we trade commodities, and I've been trying to reach your purchasing team about supplying coffee.
Could you help me with a 20-minute conversation, or point me to the most appropriate person to discuss this topic?

Rogério Palhari — EAG Agro
[endereço físico da EAG — EAG_POSTAL_ADDRESS]
To stop receiving these messages, reply "unsubscribe" or use this link: https://compass.exemplo/u/<token-influenciador>
```

## Level 0 (sem e-mail do decisor)

**Português**

```text
Recepção: Oi, é a Juliana, como posso ajudar?
Você: Oi, Juliana, tudo bem? Veja se você consegue me ajudar: estou procurando o responsável pela área de compras de vocês. Encontro ele neste número ou seria outro?
Se não passar o telefone: Sem problemas, entendo perfeitamente — é normal, aqui trabalhamos assim também. Vamos fazer assim: me passa o e-mail? Se ele tiver interesse, me retorna por lá mesmo, pode ser?
Se o e-mail for genérico (compras@): Obrigado pelo e-mail! Só me fala uma coisa: para quem eu endereço lá no setor de compras?
Nunca: "Boa tarde, eu sou o … e trabalho na… Poderia falar com o setor de compras?"
```

**English**

```text
Reception: Hi, this is Juliana, how can I help?
You: Hi Juliana, how are you? Let's see if you can help me: I'm looking for the person responsible for purchasing. Can I reach them at this number or would it be another one?
If they won't put you through: No problem, I completely understand — it's normal, we work the same way here. Let's do this: could you give me the email? If they're interested, they can reply there, all right?
If the email is generic (purchasing@): Thanks for the email! Just tell me one thing: who should I address it to in the purchasing department?
Never: "Good afternoon, I'm … and I work at … Could I speak with the purchasing department?"
```

## Aprovação

- [ ] Rogério aprova a tradução (data, canal e texto da aprovação):
- [ ] Correções pedidas:
