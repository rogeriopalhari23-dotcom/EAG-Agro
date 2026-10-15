# Registro de incidentes de segurança: procedimento para aprovação de Rogério (2026-10-15)

**Situação:** proposta final, **não aprovada**. Nada aqui registra incidente nem classifica evento.

**Base:** Res. CD/ANPD nº 15/2024, art. 10. O controlador mantém o registro de **todo** incidente de segurança com dados pessoais, comunicado ou não, por no mínimo **5 anos** a partir da data do registro. O conteúdo mínimo está no § 1º.

**Alcance:** o tratamento feito no Compass, ferramenta pessoal de Rogério Palhari, pessoa física franqueada da EAG Agro. Incidente na caixa corporativa ou nos sistemas da EAG é tratado pela EAG e informado a ela; aqui fica só a referência.

## 1. Onde fica

- **Pasta:** `C:\Users\Roger\eag-compass-registros\incidentes\`, com acesso só de `ROGERIONOTE\Roger`. Nunca no Git e nunca na Cloudflare.
- **Arquivos:**
  - `REGISTRO-INCIDENTES.md`: entradas numeradas, só acréscimo;
  - `INDICE-SHA256.txt`: uma linha por versão salva do registro, com data UTC, SHA-256 e número da última entrada.
- **Cópia cifrada:** fora deste computador, no local escolhido por Rogério (pendente). Atualizada a cada versão nova do registro.
- **Hoje existe só** `RASCUNHO-REGISTRO-INCIDENTES.md`: modelo e uma avaliação em aberto. Não é o registro oficial.

## 2. Campos de cada entrada

**Obrigatórios** (art. 10, § 1º):
1. data de conhecimento do evento;
2. descrição geral das circunstâncias;
3. natureza e categoria dos dados afetados;
4. número de titulares afetados (ou "desconhecido", com o motivo);
5. avaliação do risco e dos possíveis danos aos titulares;
6. medidas de correção e mitigação;
7. forma e conteúdo da comunicação à ANPD e aos titulares, se houve;
8. motivos da ausência de comunicação, quando for o caso.

**De controle:**
- número da entrada (sequencial, nunca reutilizado);
- data do registro (UTC);
- "guardar até": data do registro + 5 anos;
- controlador: Rogério Palhari, pessoa física, para o tratamento no Compass;
- quem registrou;
- **classificação**, uma de três:
  - "em avaliação";
  - "incidente de segurança com dados pessoais";
  - "evento avaliado: não é incidente com dados pessoais", com o fundamento;
- critérios do art. 5º avaliados (risco ou dano relevante), cada um com sim, não ou desconhecido e o motivo;
- prazo de comunicação: 3 dias úteis do conhecimento de que o incidente afetou dados pessoais, quando a comunicação for devida;
- evidências: caminhos e SHA-256, sem dado pessoal em texto aberto;
- fatos comprovados e incertezas, sempre separados.

## 3. Regras de atualização

1. **Abertura:** no mesmo dia em que o evento é conhecido, com a classificação "em avaliação".
2. **Avaliação:** em até 24 h (decisão O8-e). Só Rogério classifica; o Compass e o Claude apenas reúnem fatos.
3. **Só acréscimo:** nada é apagado nem reescrito. Correção ou mudança de classificação é uma entrada nova que cita o número da anterior e diz o que muda e por quê.
4. **Sem dado pessoal em texto aberto:** só números, categorias e referências internas (IDs do Compass, caminhos de evidência).
5. **Integridade:** a cada versão salva, uma linha nova em `INDICE-SHA256.txt` e a cópia cifrada atualizada.
6. **Comunicação:** se a avaliação concluir que há risco ou dano relevante, a comunicação à ANPD e aos titulares segue o art. 6º, e forma, conteúdo e data entram na entrada.

## 4. Guarda e eliminação

- Cada entrada é guardada até a sua data "guardar até" (registro + 5 anos), mesmo que o tratamento termine antes.
- Depois dessa data, eliminação só por revisão registrada em entrada nova do próprio registro, que diz o que sai e por quê.
- Backups e cópias cifradas seguem a mesma data.

## 5. Escolhas que ainda dependem de Rogério

1. **Local da cópia cifrada:**
   - **A.** 7-Zip AES-256 no Google Drive pessoal, enviado pelo navegador;
   - **B.** pendrive com VeraCrypt;
   - **C.** cofre do gerenciador de senhas;
   - ou A + B.
2. **Onde a senha da cópia cifrada fica guardada.** Só o local, nunca a senha.

Com a aprovação deste procedimento e as duas escolhas, o rascunho vira `REGISTRO-INCIDENTES.md`, nasce o índice e a avaliação aberta (§6) é concluída por Rogério.

## 6. Evento em aberto para avaliação (não classificado)

Indisponibilidade do banco D1 em 09/10/2026. Os fatos e as incertezas estão no rascunho, fora do Git. Não foi classificado como incidente com dados pessoais confirmado nem como não incidente: a classificação é de Rogério.
