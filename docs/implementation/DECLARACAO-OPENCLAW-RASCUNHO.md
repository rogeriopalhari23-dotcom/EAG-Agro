# Declaração do OpenClaw B: rascunho com fatos comprovados (2026-10-15)

**Situação:** rascunho. Não é declaração de Rogério e não entra na Spec antes de ele completar e confirmar.

**Para quê:** R21.8 e R25.2 pedem importar as supressões do executor antigo (OpenClaw) ou registrar uma exceção datada. Rogério escolheu a opção B (exceção datada) em 09/10/2026.

## 1. Fatos já comprovados (com fonte)

1. **Servidor do OpenClaw:** em 24/09/2026 e em 25/09/2026, o endereço `2.24.78.149` apresentou as três chaves de host (ED25519, RSA, ECDSA) diferentes das registradas no `known_hosts` deste computador, de conexões até maio/2026. O nome `srv1644560.hstgr.cloud` não resolvia mais no DNS. A conexão foi recusada pela verificação estrita, e nada foi lido nem executado no servidor. Fonte: `EVIDENCIAS.md` (24/09) e `OPENCLAW-RECONCILIACAO.md` (25/09).
2. **Interpretação, não confirmada:** o padrão é compatível com reinstalação ou troca da VPS. A confirmação independente só pode ser feita no hPanel da Hostinger, e não foi feita. Por isso a frase "VPS reinstalada em 24/09/2026" dos rascunhos anteriores **não é fato comprovado**: 24/09 é a data em que a mudança foi observada.
3. **Cópia local validada do código do executor (24/06/2026):**
   - no código e no modelo de configuração, modo padrão `internal_report_only`, com envio comercial, contato com leads, LinkedIn, WhatsApp, CRM e formulários desligados (`EAG_ALLOW_* = false`);
   - nenhuma base de contatos, supressões ou envios.
   - Isso descreve o código validado, não o que de fato rodou no servidor. Fonte: `OPENCLAW-RECONCILIACAO.md`.
4. **Neste computador** (verificado em 24–25/09):
   - `~/.openclaw` tem só a tela Claw3D e o quadro de tarefas dos agentes (128 tarefas), sem empresas, contatos nem supressões;
   - os perfis `EAG-OpenClaw-*` do navegador não têm dados de prospecção.
   - Nenhuma cópia da base do OpenClaw foi encontrada. Fonte: `EVIDENCIAS.md`.
5. **No Compass** (conferido em produção em 15/10, só leitura):
   - 0 importações do OpenClaw;
   - as 3 supressões existentes são 1 por link e 1 por resposta, do teste interno de 01/10, e 1 manual, da exclusão de teste de 08/10.

**Não concluído destes fatos:**
- **Ausência de registro não significa "nenhum contato" nem "nenhuma supressão".** O que rodou no servidor e o que ele enviou ou recebeu não pôde ser lido.
- Ter o código em modo de relatório não prova que nenhuma mensagem comercial saiu.

## 2. Texto da declaração (os trechos [PENDENTE] só Rogério confirma)

> "Eu, Rogério Palhari, declaro em **[PENDENTE: data]** que:
>
> 1. a base de dados do OpenClaw **[PENDENTE: não é recuperável / foi recuperada parcialmente / foi recuperada]**. Fatos registrados: o servidor `2.24.78.149` passou a apresentar chaves de host diferentes em 24/09/2026, compatível com reinstalação ou troca da VPS, não confirmada no hPanel; e não foi encontrada cópia da base neste computador;
> 2. das empresas do piloto brasileiro (Cimilho; Rei do Milho, fábrica de Inhumas; São Martinho, Usina Boa Vista), **[PENDENTE: nenhuma foi contatada pelo OpenClaw / as seguintes foram contatadas: ___ / não sei afirmar]**;
> 3. as supressões ou pedidos de não contato de que tenho conhecimento, vindos do uso do OpenClaw, são **[PENDENTE: nenhuma / lista: ___ / não sei afirmar]**, e eu as cadastrarei no Compass antes do primeiro envio.
>
> A exceção vale só para a base não recuperada e não dispensa a importação se ela for recuperada."

**Se a resposta a 2 ou 3 for "não sei afirmar":** a exceção não fica completa. Rogério decide se consulta o hPanel ou um backup da Hostinger antes, ou se registra a incerteza na própria exceção. Não presumo nenhuma das duas.

## 3. Depois de completada

- Entra na Spec como exceção datada a R21.8/R25.2.
- As supressões informadas são cadastradas no Compass antes do primeiro envio.

## 4. Resposta recebida de Rogério (data informada: 14/10/2026, horário de Cuiabá)

- **Data da declaração:** 14/10/2026, horário de Cuiabá (UTC−4). **Registrada.**
- **Itens 1, 2 e 3:** recebidos com as opções ainda entre colchetes, sem nenhuma escolhida:
  - acesso ao painel ou a backups: [sim / não / não sei];
  - situação da base: [integral / parcial / recuperação não tentada / não recuperável / desconhecida];
  - contatos anteriores: [listar / nenhuma / não sei afirmar];
  - pedidos de descadastro ou de não contato: [listar / nenhum conhecido / não sei afirmar].
- **Registro:** os três itens continuam **sem resposta**. Nada foi registrado como "nenhuma", "nenhum" ou "não recuperável", e a ausência de escolha não é tratada como ausência de contatos ou de supressões.
- **Situação da declaração:** **incompleta.** A exceção a R21.8/R25.2 não entra na Spec, e as supressões do OpenClaw continuam como pendência antes de qualquer envio.

## 5. Respostas de Rogério (14/10/2026, horário de Cuiabá)

1. **Acesso ao painel da VPS ou a backups:** não sei. **Situação da base:** desconhecida.
2. **Contatos anteriores com Cimilho, Rei do Milho (Inhumas) ou São Martinho (Usina Boa Vista):** não sei afirmar.
3. **Pedidos anteriores de descadastro ou de não contato:** não sei afirmar.

O desconhecimento **não** é tratado como ausência de contatos ou de supressões.

**Conferência local feita depois (Claude, 15/10, só leitura):** `~/.openclaw/claw3d/task-manager/tasks.json` tem 128 tarefas, de 10/05 a 28/06/2026, sem canal preenchido. Nenhuma ocorrência de Cimilho, Rei do Milho ou São Martinho, nem de descadastro, "unsubscribe" ou "não contatar". Isso cobre só esse arquivo e **não** prova ausência de contato: o que rodou na VPS não foi lido.

**Conclusão:** as respostas **não atendem** à declaração da opção B, que pressupõe saber se a base é recuperável e quais contatos e supressões existem. A exceção a R21.8/R25.2 continua sem registro, e as supressões do OpenClaw continuam como pendência antes de qualquer envio.

**Verificações concretas que resolveriam:**
- **(a) Caixa de e-mail que o OpenClaw usava.** O executor enviava por SMTP próprio, com relatório padrão para `rogeriopalhari@eagagro.com`. Uma busca só de leitura nas pastas Enviados e Entrada dessa caixa, até 24/09/2026, pelos domínios `cimilho.com.br`, `reidomilho.com.br` e `saomartinho.com.br` e por respostas de descadastro, respondem os itens 2 e 3 **para essa caixa**. Exige autorização de Rogério; a ponte já tem acesso de leitura a ela.
- **(b) Painel da Hostinger.** Ver se a VPS `2.24.78.149` (`srv1644560`) aparece em alguma conta Hostinger de Rogério e se há backup ou snapshot anterior a 24/09/2026. Isso responde o item 1. Se aparecer, conferir a impressão `SHA256:zA4NvA5n8KMmxOVbyKdsgYdRn1I4LQjFREnM6y/1JX8` no terminal do navegador antes de qualquer leitura. Só Rogério pode entrar no painel.
- Se (b) mostrar que a VPS não está em conta de Rogério, a situação da base fica desconhecida de forma definitiva para ele. Registrar a exceção mesmo assim, com essa incerteza declarada, seria decisão de Rogério, não presumida.
