# Idioma por país do destinatário: inventário e ajustes (2026-10-14)

Decisão de Rogério em 2026-10-14, registrada na Spec: R28.20, R28.21, nota em R16.1, R28.15 e PV12, e pendências L1–L5 em §6.0.1.

**A regra**
- O idioma vem do país do destinatário:
  - Brasil: português;
  - demais países da América Latina: espanhol;
  - fora da América Latina: inglês.
- Nunca é deduzido do nome da pessoa ou do domínio do e-mail.
- Vale para a sequência inteira: assunto, apresentação, acompanhamentos, transparência e descadastro.
- Nomes próprios, marcas e endereços ficam como estão.
- A saudação por horário acompanha o idioma.

**O que esta decisão não autoriza:** publicar, aplicar a 0041, aprovar fichas ou enviar mensagens. Nada aqui foi aplicado ao código: só a Spec e comentários nos modelos.

## 1. O que existe hoje

| Ponto | Hoje | Conforme a regra? |
| --- | --- | --- |
| Idioma da campanha | Nacional: `pt-BR`. Internacional: `countries.default_language` do país (só `en` ou `pt-BR`, por restrição do banco) | Não. Não há espanhol; Portugal e os países lusófonos da África e da Ásia estão em português |
| Idioma da ficha | O da campanha; a ficha de identificação aceita escolha manual (`pt-BR`, `en`, `de`) | Não. A escolha deveria ser automática, pelo país |
| Português (Brasil) | Identificação `id-pt-1.4.0` (Bom dia/Boa tarde, transparência E2-b, descadastro "sair") e reunião `pv-1.1.0` | Sim, depois da publicação da 0041 e do código |
| Espanhol | Não existe: nenhum modelo, nenhuma regra do revisor, nenhum nome de commodity, nenhuma palavra de descadastro | Não |
| Inglês | Identificação `id-en-1.0.0` (não revisada), abre com "Hi, I hope you're well."; reunião `pv-en-1.0.0`, aguardando aprovação de Rogério; rodapé com "unsubscribe" | Em parte: falta a saudação por horário e a linha de transparência |
| Alemão | Identificação `id-de-1.1.0` (textos de Rogério). Em produção, **3 fichas da Alemanha em alemão, `in_approval`**, 0 aprovações | Não. A regra manda inglês para a Alemanha (pendência L3) |
| Saudação por horário | Só português, com "Boa tarde" virando "Bom dia" (`morningVariant`) | Falta generalizar por idioma |
| Linha de transparência | Só português (E2-b, LGPD) | Faltam espanhol e inglês, e a base legal de cada país (T11 por país) |
| Descadastro na resposta | Reconhece "sair", "unsubscribe", "abmelden" e semelhantes | Faltam palavras em espanhol ("baja", "darme de baja", "cancelar suscripción") |
| Página de descadastro (`/u/*`) | Bilíngue, português e inglês | Falta espanhol |
| Assinatura oficial | Igual em todos os idiomas ("Broker \| EAG AGRO", aviso de confidencialidade em inglês) | Pode ficar como está (marca e texto oficial); fica só o registro |
| Cópia interna | Reproduz o texto que saiu, inclusive a saudação (`greeting_variant`) | Sim |
| Fichas do piloto (Cimilho, São Martinho, Rei do Milho) | Português, v3 em produção, v4 preparada (Bom dia/Boa tarde) | Sim: continuam em português |

## 2. Ajustes necessários

1. **Regra central de idioma:**
   - uma função determinística, país ISO para idioma, com a lista fechada da América Latina (L1);
   - sem dedução por nome ou domínio;
   - deixa de usar `countries.default_language`, que não aceita `es`;
   - não precisa de migração, desde que o idioma passe a ser calculado e não lido da coluna.
2. **Idioma da ficha:**
   - calculado do país da empresa cadastrada (L4) na criação e em cada nova versão;
   - a escolha manual sai (hoje aceita `de`);
   - sem modelo aprovado no idioma, a ficha não é gerada (sem troca para outro idioma).
   - A campanha mostra o idioma resultante em vez de escolhê-lo.
3. **Espanhol, que só pode ser gerado depois dos textos aprovados por Rogério (L5):**
   - modelos de identificação (E-mail 1 e 2) e de reunião (4 e-mails, LinkedIn, roteiros);
   - nomes das commodities;
   - assunto, transparência, rodapé de descadastro e "Buenos días"/"Buenas tardes";
   - regras do revisor em espanhol: PV7 (preço, volume…), PV10 (desculpas), assunto e palavra de saída.
4. **Inglês:**
   - E-mail 1 com "Good morning"/"Good afternoon" no lugar de "Hi, I hope you're well." (texto para aprovação);
   - linha de transparência em inglês, cujo conteúdo depende da base legal de cada país (T11 por país; a Alemanha segue com o advogado de UWG/DSGVO).
5. **Saudação por horário generalizada:**
   - variante pelo idioma: pt "Boa tarde" → "Bom dia"; es "Buenas tardes" → "Buenos días"; en "Good afternoon" → "Good morning";
   - mesmas colunas da 0041 e mesmo controle de hash e aprovação; não precisa de migração nova.
6. **Descadastro:**
   - palavras em espanhol no reconhecimento de respostas (`src/inbound.js`);
   - página `/u/*` em português, espanhol e inglês.
7. **Testes:** um por regra, cobrindo:
   - país para idioma, incluindo os casos de dúvida da L1;
   - nome ou domínio que nunca muda o idioma;
   - ficha sem modelo recusada;
   - saudação nos três idiomas às 11:59 e às 12:00;
   - cópia igual ao enviado;
   - "baja" suprimindo o envio;
   - fichas brasileiras sem mudança.
8. **Produção, depois de autorizado:**
   - aplicar a 0041 e publicar;
   - as fichas brasileiras recebem a versão 4 em português;
   - as 3 fichas da Alemanha em alemão aguardam a decisão L3 (nova versão em inglês ou descarte).

## 3. Decisões de Rogério (Spec §6.0.1)

- **L1:** lista fechada da América Latina (Haiti, Belize, Guiana, Suriname, Guiana Francesa, Porto Rico, Caribe).
  - Até decidir: espanhol só nos países de língua oficial espanhola; os casos de dúvida ficam sem ficha.
- **L2 (decidida em 14/10):** Portugal e os países lusófonos fora da América Latina usam inglês.
- **L3 (decidida em 14/10):** a Alemanha usa inglês. As 3 fichas alemãs ficam como estão até nova instrução.
- **L4:** o país do destinatário é o da empresa cadastrada? O contato não tem país próprio.
- **L5:** textos em espanhol e saudações em inglês para aprovação, preparados em `TEXTOS-ES-EN-PARA-REVISAO.md` (14/10).

Propostas para L1 e L4 (não decididas): `TEXTOS-ES-EN-PARA-REVISAO.md` §5.
