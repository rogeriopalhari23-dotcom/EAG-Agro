# Textos em espanhol e inglês para revisão de Rogério (revisão 2, 2026-10-14)

**Situação:** rascunho para revisão, **não aprovado**. Nada foi implementado, publicado ou gerado como ficha. Base: Spec R28.20 e R28.21, `IDIOMA-POR-PAIS.md`.

**Revisão 2:** redação própria de cada idioma, sem tradução literal do português. Mantém a intenção e os fatos dos textos de Rogério (`id-pt-1.4.0`):
- quem escreve: Rogerio Palhari, franqueado da EAG Agro;
- objetivo do E-mail 1: identificar quem compra milho e o canal adequado;
- E-mail 2: retomada curta, com a saída "não compramos milho".

**O que nenhum texto afirma:** disponibilidade, preço, volume, qualidade, certificação, aceitação de GMO ou condição comercial.

**O que não é traduzido:**
- nomes próprios: Rogerio Palhari, EAG Agro e o nome da empresa;
- assinatura oficial;
- endereço físico.

**Marcadores:** `{{empresa}}`/`{{company}}`, `{{nome}}`/`{{name}}` e `{{link}}` aparecem aqui só para a revisão. Na ficha, o sistema troca cada um pelo valor real antes da aprovação.

## 1. Espanhol (América Latina, exceto Brasil)

Tratamento "usted", espanhol neutro de negócios.

**Assunto (os dois e-mails, sem "Re:"):** `Contacto de compras de maíz`

### E-mail 1 (dia 0)

Antes das 12:00 no horário do destinatário:

```text
Buenos días:

Mi nombre es Rogerio Palhari. Soy franquiciado de EAG Agro y trabajo en la originación de commodities agrícolas en Brasil.

Estoy buscando a la persona responsable de las compras de maíz en {{empresa}}, para presentarme y conocer cómo se abastecen de este insumo.

¿Podría indicarme quién está a cargo de esa área y cuál es la mejor vía de contacto?

Muchas gracias.
```

A partir das 12:00: o mesmo texto com a primeira linha `Buenas tardes:`.

Destinatário pessoa com nome confirmado (nunca no canal geral):
- `Buenos días, {{nome}}:`
- `Buenas tardes, {{nome}}:`

### E-mail 2 (dia 4)

```text
Hola:

Le escribí hace unos días buscando a la persona responsable de las compras de maíz en {{empresa}}.

Si puede compartirme su nombre y correo electrónico, me comunico directamente con esa persona. Si la empresa no compra maíz, una breve respuesta indicándolo también me ayuda.

Gracias.
```

### Rodapé (todos os e-mails, depois da assinatura)

```text
—
[endereço físico da EAG, sem tradução]
Encontré esta dirección en el sitio web de su empresa. Para solicitudes sobre datos personales: rogeriopalhari@hotmail.com.
Para dejar de recibir estos mensajes, responda "baja" o use este enlace: {{link}}
```

A frase "Encontré esta dirección…" só entra quando a fonte registrada do canal é o site da empresa. Em outra fonte, fica só "Para solicitudes sobre datos personales: …" (PV4).

### Página de descadastro

- **Pergunta:** "¿No desea recibir más mensajes de EAG Agro?"
- **Botão:** "Confirmar baja"
- **Confirmação:** "Listo. No recibirá más mensajes."
- **Link inválido:** "Enlace inválido o vencido."
- **Muitas tentativas:** "Demasiados intentos. Inténtelo de nuevo en un minuto."

## 2. Inglês (fora da América Latina, incluindo Portugal, os países lusófonos fora da América Latina e a Alemanha)

**Assunto (os dois e-mails, sem "Re:"):** `Corn purchasing contact`

### E-mail 1 (dia 0)

Antes das 12:00 no horário do destinatário:

```text
Good morning,

My name is Rogerio Palhari. I am an EAG Agro franchisee working in agricultural commodity origination in Brazil.

I am trying to reach the person responsible for corn procurement at {{company}}, to introduce myself and learn how your team sources corn.

Could you let me know who handles corn purchasing and the best way to contact them?

Thank you,
```

A partir das 12:00: o mesmo texto com a primeira linha `Good afternoon,`.

Destinatário pessoa com nome confirmado:
- `Good morning {{name}},`
- `Good afternoon {{name}},`

### E-mail 2 (dia 4)

```text
Hello,

I wrote a few days ago looking for the person who handles corn purchasing at {{company}}.

If you can share their name and email address, I will contact them directly. If your company does not buy corn, a short reply saying so is also helpful.

Thank you,
```

### Rodapé

```text
—
[endereço físico da EAG, sem tradução]
I found this address on your company's website. For requests about personal data: rogeriopalhari@hotmail.com.
To stop receiving these messages, reply "unsubscribe" or use this link: {{link}}
```

A linha de descadastro é a mesma já usada nos modelos em inglês. A origem do endereço segue a mesma regra do português.

**Página de descadastro:** já tem inglês e não muda.

## 3. Escolhas de termo que mudam o sentido comercial

1. **"originación de commodities agrícolas en Brasil" e "agricultural commodity origination in Brazil":**
   - mantido "originação": no mercado de grãos, o termo descreve quem capta o produto na origem, junto a produtores, para compradores;
   - não promete fornecimento;
   - "trading" não foi usado, porque sugere compra e venda por conta própria.
   - "en Brasil"/"in Brazil" situa a origem para o comprador estrangeiro. O fato já estava no texto alemão escrito por Rogério ("in Brasilien tätig"). Confirmar se quer mantê-lo.
2. **"compras de maíz" e "corn procurement / corn purchasing":** nomeiam a função de compras, não um cargo. "Procurement" é o termo de suprimentos no E-mail 1; "purchasing" é a forma mais comum no pedido e no E-mail 2. Evita supor que existe um "comprador de milho" com esse título.
3. **Motivo do contato ("para presentarme y conocer cómo se abastecen de este insumo" / "to introduce myself and learn how your team sources corn"):**
   - não existe no português;
   - dá a quem lê o e-mail geral um motivo para encaminhar, sem oferecer produto;
   - "insumo" e "sources" tratam o milho como matéria-prima do comprador, sem afirmar que ele compra.
   - Se preferir sem motivo, a frase termina em "{{empresa}}"/"{{company}}".
4. **E-mail 2 pede nome e e-mail e diz "me comunico directamente"/"I will contact them directly":** em português o pedido é "com quem devo falar". A versão nova reduz o trabalho de quem recebe e deixa claro o próximo passo, que já é o que acontece. A saída "não compra milho" ficou igual.
5. **Assuntos curtos ("Contacto de compras de maíz", "Corn purchasing contact"):** dizem o objetivo do contato (identificar o contato de compras) em vez de "responsável pela compra".
   - Hoje o revisor só tem regra de assunto para português e alemão. A regra para espanhol e inglês entra na implementação.

**Sem mudança de sentido** (só adaptação ao idioma):
- saudação com dois-pontos em espanhol ("Buenos días:") e vírgula em inglês;
- "Muchas gracias."/"Thank you,";
- "Para dejar de recibir estos mensajes" e "For requests about personal data". A transparência continua dizendo só a origem do endereço e o canal do titular, sem afirmação jurídica nova.

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
