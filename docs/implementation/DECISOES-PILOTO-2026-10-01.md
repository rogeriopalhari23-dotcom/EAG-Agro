# Piloto comercial — estado, T1 e decisões pendentes (2026-10-01)

Documentos de apoio:
- `T11-POLITICA-PROPOSTA.md`: política de ciclo de vida e regras de primeiro contato.
- `PRONTIDAO-FICHAS-DEU.md`: Amori e BLACK & YUM, com os textos completos.

Nada foi enviado, aprovado, ativado ou contratado, e nenhum crédito da Snov foi consumido.

## 1. Estado confirmado em produção (consultas só leitura, 2026-10-01 ~18:20 UTC)

| Item | Valor |
| --- | --- |
| Worker | `b6d4b19d-a56b-402e-b78f-e7394a395ecd` (código de `b3935f9`; HEAD `751b663` só acrescenta documentos) |
| Transporte | Ponte no PC Windows de Rogério (tarefa "EAG Compass - ponte de e-mail"). Uma VPS fica como melhoria futura (`PONTE-VPS.md`). |
| Redesign | Aprovado e publicado (tag `producao-7d178094`, incorporado nas versões seguintes) |
| Canais | `email`, `whatsapp` e `linkedin` = `planned` |
| Campanhas | Alemanha/café `defa3ad8…` = `draft`; teste interno `5069cc54…` = `ended`; nenhuma ativa |
| Fichas | 24grad, Amori e BLACK & YUM `in_approval` (v2); 6 fichas de teste `discarded` |
| Fila | 5 `accepted` (internas) + 19 `cancelled`; nada pendente |
| Supressões | 2 (`opt_out`, `channel_all`, `until_t11_policy`): `+ponte-link` (3b) e a Hotmail (3a), preservadas |
| Snov | Amori e BLACK & YUM `valid` até 2026-10-31; 24grad `catchall` (não validada) |
| Parâmetros | `email_validation_max_age_days` = 30; `sanctions_max_age_hours` = 720; janelas nacional e internacional 09–17 seg–sex; **`international_enabled` ausente** |
| Sanções | OFAC, CEIS e CNEP importadas em 2026-09-24 (vencem em 2026-10-24); **nenhuma triagem das empresas alemãs** |
| Porte | Pequena e média só desempatam; porte e grupo nunca descartam sozinhos (decisão de 2026-09-30) |

## 2. T1 contra os critérios da Spec

**R26.3:** "E-mail só DEVE passar a `habilitado` após T1 comprovado com endereços internos, pela ponte de e-mail".

| Critério | Evidência (EVIDENCIAS.md) | Resultado |
| --- | --- | --- |
| Envio | Cenário 1: SMTP 250, `accepted`, entregue em `+ponte-a` | comprovado |
| Estados | Cenários 1, 4 e 5: `accepted`, `recovered accepted`, `temp_failed` → `accepted`, sem duplicidade | comprovado |
| Recebimento | Cenário 2: resposta gravada `human`/`thread` | comprovado |
| Correlação de resposta | Cenário 2: ligada à empresa e ao envio; passos 2–4 `cancelled` `reply_human`; tarefa aberta | comprovado |
| Leitura antes do envio (R19.14, AT76) | Cenário 6: leitura falha → `reply_reader_unavailable`; volta após leitura boa | comprovado |
| Autenticação do domínio | Cenário 1: SPF, DKIM e DMARC `pass` (DMARC do domínio da EAG em `p=none`, fora do controle de Rogério) | comprovado |
| Descadastro (R21.10) | 3b: one-click `List-Unsubscribe-Post` → supressão só do alias. 3a: "sair" pela Hotmail → só ela suprimida | comprovado |
| R26.6: supressão, pausas, deduplicação, R17 | Supressão (3a/3b), pausa por resposta (2), sem duplicidade (4), revisor PV em todas as fichas, destinatário externo recusado (8), segurança da ponte (7) | comprovado; a pausa manual (R22) só tem teste automatizado |
| Lacuna menor | A cópia em "Enviados" não foi conferida no cenário 1 | não bloqueia R26.3 |

**Conclusão:**
- **O teste técnico do T1 está concluído.**
- **Falta a liberação operacional:** passar o canal para `habilitado` com data, responsável e teste (R26.1). É decisão de Rogério.
- **Falta a liberação comercial:** ativar a campanha e aprovar cada ficha. É outra decisão de Rogério, que depende dos bloqueios abaixo.

## 3. Itens abertos

| # | Item aberto | Evidência existente | Ação necessária | Responsável | Bloqueia |
| --- | --- | --- | --- | --- | --- |
| 1 | Liberação do canal e-mail (R26.1/R26.3) | §2: técnico concluído | Registrar `habilitado` com a evidência | Rogério | Toda aprovação de e-mail |
| 2 | T11: e-mail para empresas na Alemanha | UWG §7(2) Nr. 2; BGH I ZR 218/07; DSK 2022 (T11 §5) | Parecer de advogado com prática em UWG | Rogério escolhe e consulta o advogado | Amori, BLACK & YUM e 24grad por e-mail |
| 3 | T11: controlador e uso da marca e da caixa EAG | Assinatura e rodapé da EAG; política de privacidade da EAG não encontrada no site (404) | Perguntas do T11 §3 | Jurídico ou encarregado da EAG | Qualquer envio comercial, inclusive nacional |
| 4 | T11: retenção da supressão e do histórico | Implementação `until_t11_policy`; DSK §5.1; LGPD Art. 15–16 | Validar o T11 §2 | Validador da EAG, depois Rogério | Validação de T11 |
| 5 | Exclusão completa (R9.1/R23.5) | `deletePersonalData` não purga textos de fichas nem mensagens recebidas | Implementar a purga | Implementação, depois de decidido | Atender pedido de exclusão por inteiro |
| 6 | Informação do GDPR Art. 14 | Ausente nos textos | Definir se é exigida e qual o texto | Advogado (item 2) | Versão nova das fichas, se exigida |
| 7 | Triagem de sanções das empresas | Nenhuma `screening_run` | Rodar a triagem antes da aprovação; reimportar as listas até 24/10 | Rogério (Admin), ação interna | Envio (pré-envio `compliance_unavailable`) |
| 8 | Liberação internacional (P3-T12) | `international_enabled` ausente; falta a primeira rotina mensal completa da Comtrade | Registrar a liberação | Rogério | Aprovação de ficha internacional |
| 9 | Supressões do OpenClaw (R21.8/R25.2) | VPS reinstalada, sem dados acessíveis (P2-T15) | Recuperar e importar, ou registrar exceção na Spec | Rogério | Primeiro envio do piloto |
| 10 | 24grad | `catchall`; decisor provisório pelo Impressum, sem e-mail | Nenhum e-mail ou ligação sem decisão; telefone B2B também exige interesse presumível (T11 §5.2) | Rogério | Ficha da 24grad |
| 11 | Piloto nacional | Chave da Casa dos Dados ausente; commodity, cidade/UF e raio não definidos (Spec §6.0.1) | Decidir o escopo e a chave | Rogério | Etapa 1 nacional |
| 12 | Perfis e domínio (P1-T12) | Só o admin; `eagcompass.com` pendente | E-mails dos perfis; troca de DNS no hPanel do domínio pessoal | Rogério | Nada no piloto com um usuário |

## 4. Propostas para as decisões de Rogério

1. **Canal de e-mail:**
   - **Proposta:** registrar o e-mail como `habilitado`, com a evidência do §2, **só quando houver ficha liberável**. Até lá, fica `planned`.
   - **Efeito:** a aprovação deixa de recusar por `channel_not_ready`; nada sai sem ficha aprovada e campanha ativa.
   - **Razão:** o técnico está provado, mas habilitar agora não destrava nenhuma ficha (itens 2, 7 e 8) e só aumenta a superfície de erro.
2. **Alemanha por e-mail:**
   - **Proposta:** não aprovar Amori, BLACK & YUM nem 24grad por e-mail até o parecer sobre o UWG. As fichas ficam `in_approval`, sem descarte, com a nota "aguarda parecer UWG §7".
   - **Efeito:** o piloto alemão por e-mail para.
   - **Razão:** o §7(2) Nr. 2 exige consentimento prévio também entre empresas, e o BGH considera ilícito até um único e-mail. Endereço publicado, `valid` da Snov e link de saída não são consentimento.
3. **Caminho para a Alemanha enquanto isso:**
   - **Proposta:** carta de identificação do comprador (o mesmo texto do passo 1, em papel), com pedido de consentimento para contato por e-mail e o aviso do Art. 14. É preciso confirmar com o advogado antes.
   - **Efeito:** abre contato sem e-mail não solicitado. É lento e tem custo de postagem.
   - **Razão:** é o canal que o UWG não condiciona a consentimento prévio.
4. **Validadores:**
   - **Proposta:** levar o T11 §3 ao jurídico ou encarregado da EAG (controlador, marca, caixa, política) e o T11 §5 a um advogado de UWG/DSGVO.
   - **Efeito:** a T11 pode ser concluída.
   - **Razão:** a mensagem fala em nome da EAG, e Rogério não administra a infraestrutura nem a política dela.
   - **Consulta paga:** só com o OK de Rogério.
5. **Retenção (T11 §2):**
   - **Proposta:** hash sem prazo fixo enquanto houver prospecção no canal, com revisão anual; histórico de remoções pelo mesmo tempo, mais o prazo de prova que o validador indicar; remoção só nos três casos do §2.3.
   - **Efeito:** fixa o critério hoje marcado `until_t11_policy`.
   - **Razão:** a orientação da DSK §5.1 e a LGPD Art. 10 e 37. Nenhum número foi inventado.
6. **Exclusão completa:**
   - **Proposta:** autorizar a implementação da purga de textos congelados e mensagens recebidas no pedido de exclusão, mantendo o hash.
   - **Efeito:** cumpre a R9.1/R23.5.
   - **Razão:** a lacuna foi encontrada nesta revisão.
7. **Sanções:**
   - **Proposta:** rodar a triagem das três empresas alemãs, que é interna e sem custo, só quando houver data de envio. Reimportar as listas antes de 24/10, se houver envio previsto depois disso.
   - **Efeito:** remove o `compliance_unavailable`.
   - **Razão:** a triagem tem validade de 30 dias e não adianta fazer cedo.
8. **OpenClaw:**
   - **Proposta:** registrar na Spec uma exceção datada à R21.8/R25.2: "sem base recuperável do OpenClaw (VPS reinstalada, 2026-09-24); supressões conhecidas por Rogério cadastradas manualmente antes do primeiro envio".
   - **Efeito:** destrava o primeiro envio sem fingir importação.
   - **Razão:** sem acesso à VPS, a importação é impossível; a alternativa honesta é uma exceção explícita.
9. **Piloto comercial:**
   - **Proposta:** iniciar pelo nacional, com commodity, cidade/UF e raio escolhidos por Rogério, assim que a chave da Casa dos Dados existir (contratação só com OK) e o item 3 estiver respondido. A Alemanha segue pelo item 3.
   - **Efeito:** primeira campanha real num mercado sem a exigência alemã de consentimento para e-mail entre empresas. Continuam a LGPD e o risco da Hostinger §12 já assumido.
   - **Razão:** é o caminho com menos bloqueios jurídicos abertos.
