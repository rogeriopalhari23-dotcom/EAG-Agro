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
- As referências legais são leitura de trabalho, com o artigo citado. Os números das resoluções da ANPD e os prazos devem ser conferidos no texto oficial antes da aprovação.

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
| O7 | Prazos para atender pedidos | Resposta simplificada imediata; resposta completa em até 15 dias; exclusão executada pela rotina existente (ver L4) |
| O8 | Incidente de segurança | Rogério avalia em até 24 h. Se houver risco relevante, comunica à ANPD e aos titulares no prazo legal (ver L6) |
| O9 | Triagem de sanções | Manter, como controle interno; refazer antes das ligações se elas ocorrerem depois de 24/10/2026 |

### 2.2 Obrigações legais aplicáveis

| # | Obrigação | Base (conferir) | Como o Compass atende hoje | Lacuna |
|---|---|---|---|---|
| L1 | A LGPD se aplica. Nome, cargo, perfil e telefone de pessoa são dados pessoais; a exceção para uso particular não econômico não cabe, porque a finalidade é comercial. Dados só da empresa (CNPJ, endereço) não são dados pessoais | Art. 3, Art. 4 I, Art. 5 I | Tratado como dado pessoal: cifrado, com acesso restrito | — |
| L2 | Base legal, finalidade e necessidade. Com legítimo interesse: finalidade legítima, situação concreta, só os dados necessários e transparência | Art. 6, Art. 7 IX, Art. 10 §§1–2 | Minimização praticada: nenhum e-mail ou telefone pessoal coletado ou deduzido | Teste de balanceamento não documentado (O3) |
| L3 | Informar quem pergunta e respeitar a oposição | Art. 9, Art. 10 §2, Art. 18 §2 | Supressão por telefone existe (`POST /api/suppression`, canal `phone`) | ~~A supressão de telefone não suspende a ligação de nível 0~~: corrigido e não publicado (`PUBLICACAO-SUPRESSAO-TELEFONE.md`). Texto de transparência não aprovado (O4) |
| L4 | Atender direitos do titular (acesso, correção, eliminação, oposição) nos prazos | Art. 18, Art. 19 (acesso: imediato simplificado ou 15 dias) | Exclusão implementada e testada só com dados fictícios | Canal do titular não definido (O2) |
| L5 | Segurança adequada | Art. 46 | Access, cifragem de dados pessoais, auditoria sem dados pessoais legíveis | — |
| L6 | Comunicar incidente relevante à ANPD e aos titulares | Art. 48; Res. CD/ANPD 15/2024 (prazo de 3 dias úteis) | Sem procedimento escrito | O8 |
| L7 | Registro das operações de tratamento | Art. 37; Res. CD/ANPD 2/2022 (agente de pequeno porte: registro simplificado; encarregado dispensado, mas canal de comunicação obrigatório; prazos em dobro; não vale para tratamento de alto risco) | Não existe | Registro simplificado (§4) |
| L8 | Eliminar quando a finalidade acabar | Art. 15–16 | Rotina de exclusão existe | Prazos (O6) |
| L9 | Transferência internacional: dados guardados na Cloudflare, fora do Brasil | Art. 33; Res. CD/ANPD 19/2024 (cláusulas-padrão) | Não verificado | Conferir se o contrato de tratamento de dados da Cloudflare (DPA) traz as cláusulas da ANPD ou outro mecanismo do Art. 33 |

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
4. **Conferir o mecanismo de transferência internacional da Cloudflare (L9).** É verificação documental; não depende de parecer.
5. **Fazer o teste ponta a ponta da exclusão em produção** com registro fictício interno (S2).
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
