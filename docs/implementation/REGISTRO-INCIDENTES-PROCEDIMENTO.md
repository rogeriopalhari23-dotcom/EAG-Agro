# Registro de incidentes de segurança: procedimento (aprovado por Rogério Palhari em 2026-10-15)

**Situação:** **aprovado por Rogério em 15/10/2026**, com a opção **A**: cópia cifrada no Google Drive pessoal, 7-Zip AES-256 com nomes cifrados. Este documento não contém registros: o registro fica fora do Git.

**Base:** Res. CD/ANPD nº 15/2024, art. 10. O controlador mantém o registro de **todo** incidente de segurança com dados pessoais, comunicado ou não, por no mínimo **5 anos** a partir da data do registro. O conteúdo mínimo está no § 1º.

**Alcance:** o tratamento feito no Compass, ferramenta pessoal de Rogério Palhari, pessoa física franqueada da EAG Agro. Incidente na caixa corporativa ou nos sistemas da EAG é tratado pela EAG e informado a ela; aqui fica só a referência.

## 1. Onde fica

- **Pasta:** `C:\Users\Roger\eag-compass-registros\incidentes\`, com acesso só de `ROGERIONOTE\Roger`. Nunca no Git e nunca na Cloudflare.
- **Arquivos:**
  - `REGISTRO-INCIDENTES.md`: entradas numeradas, só acréscimo;
  - `INDICE-SHA256.txt`: uma linha por versão salva do registro, com data UTC, SHA-256 e número da última entrada.
- **Cópia cifrada:** no Google Drive pessoal de Rogério (opção A), atualizada a cada versão nova do registro. O arquivo local fica em `C:\Users\Roger\eag-compass-registros\copia-cifrada\` até o envio.

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
  - "pendente de avaliação";
  - "incidente de segurança com dados pessoais";
  - "evento avaliado: não é incidente com dados pessoais", com o fundamento;
- critérios do art. 5º avaliados (risco ou dano relevante), cada um com sim, não ou desconhecido e o motivo;
- prazo de comunicação: 3 dias úteis do conhecimento de que o incidente afetou dados pessoais, quando a comunicação for devida;
- evidências: caminhos e SHA-256, sem dado pessoal em texto aberto;
- fatos comprovados e incertezas, sempre separados.

## 3. Regras de atualização

1. **Abertura:** no mesmo dia em que o evento é conhecido, com a classificação "pendente de avaliação".
2. **Avaliação:** iniciada em até 24 h (decisão O8-e).
   - A classificação exige fundamento técnico registrado na própria entrada: fatos, impacto observado e lacunas resolvidas ou declaradas.
   - Rogério decide com base nesse fundamento, não por escolha sem evidência.
   - Enquanto o fundamento não basta, a classificação continua "pendente de avaliação".
   - O Compass e o Claude reúnem fatos e não classificam.
3. **Só acréscimo:** nada é apagado nem reescrito. Correção ou mudança de classificação é uma entrada nova que cita o número da anterior e diz o que muda e por quê.
4. **Sem dado pessoal em texto aberto:** só números, categorias e referências internas (IDs do Compass, caminhos de evidência).
5. **Integridade:** a cada versão salva, uma linha nova em `INDICE-SHA256.txt` e a cópia cifrada atualizada.
6. **Comunicação:** se a avaliação concluir que há risco ou dano relevante, a comunicação à ANPD e aos titulares segue o art. 6º, e forma, conteúdo e data entram na entrada.

## 4. Guarda e eliminação

- Cada entrada é guardada até a sua data "guardar até" (registro + 5 anos), mesmo que o tratamento termine antes.
- Depois dessa data, eliminação só por revisão registrada em entrada nova do próprio registro, que diz o que sai e por quê.
- Backups e cópias cifradas seguem a mesma data.

## 5. Escolhas (situação em 15/10)

1. **Local da cópia cifrada:** **A, escolhida.** 7-Zip, formato 7z, AES-256, cabeçalho cifrado (`-mhe=on`, nomes dos arquivos cifrados), enviado por Rogério ao Google Drive dele pelo navegador.
   - A senha é digitada por Rogério no próprio 7-Zip e nunca aparece em chat, comando, log ou documento.
   - Script: `C:\Users\Roger\eag-compass-registros\gerar-copia-cifrada.ps1`, fora do Git. Ele cria a cópia, testa a abertura, recupera numa pasta temporária, compara os SHA-256 com os originais e grava só o resultado.
2. **Onde a senha fica guardada:** **pendente.** Só o local, nunca a senha.

**Estrutura criada em 15/10** (fora do Git, acesso só de `ROGERIONOTE\Roger`): `REGISTRO-INCIDENTES.md` (modelo e entrada 1) e `INDICE-SHA256.txt` (primeira linha). O rascunho anterior foi substituído.

## 6. Evento em aberto para avaliação (não classificado)

Entrada 1 do registro: indisponibilidade do banco D1 em 09/10/2026, com fatos comprovados, impacto observado e lacunas.

**Classificação: pendente de avaliação** até haver fundamento técnico suficiente. O registro não afirma perda, vazamento nem ausência de impacto sem comprovação.
