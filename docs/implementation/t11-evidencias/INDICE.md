# Evidências da validação T11 `br_email_automatic` (piloto brasileiro por e-mail): índice (2026-10-15)

**Situação:** 3 de 5 evidências prontas. **A validação T11 não está registrada.** O registro é ato do Administrador (`POST /api/compliance/t11`), só com autorização expressa de Rogério e com as 5 evidências completas.

**Regra dos SHA-256:** só de documento disponível e finalizado. Cada extrato é literal e congelado, tirado de um commit conhecido. O hash é do arquivo como está no Git (UTF-8, fins de linha LF). Correção não edita o extrato: gera um extrato novo, com hash novo.

| Tipo (`kind`) | Conteúdo | Responsável | Data | Alcance | Referência | SHA-256 | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `decisions` | Decisões de Rogério de 06 a 09/10/2026: uso individual, canal só e-mail, finalidade, retenção A1–D1, E1/E2-b/O7-e–O9-e/D5-a, cópia D5-a e trava T11 | Rogério Palhari (controlador), decisões; registro por Claude | 06–09/10/2026 | Tratamento no Compass, piloto brasileiro por e-mail (`br_email_automatic`) | `docs/implementation/t11-evidencias/01-decisions.md` (Spec no commit `e60b328`) | `2335da598feb61bbcd7e02378db8ba3684a837b871fc9517bd4f8f23147ad184` | **Pronta** |
| `legal_basis` | E1: legítimo interesse (LGPD art. 7º, IX) com teste de balanceamento, e o registro da aprovação | Rogério Palhari | 09/10/2026 | E-mail de identificação ao canal geral publicado de empresas no Brasil | `docs/implementation/t11-evidencias/02-legal_basis.md` | `2eb23810f89424c7123a7df7521e381a7c875db4a2bb810a272c52ab75df08f6` | **Pronta** |
| `transfer_mechanism` | Mecanismo do art. 33 para os dados na Cloudflare (Workers, D1 em ENAM, R2, Access, logs) | Rogério Palhari (consulta); Cloudflare (resposta) | Consulta informada por Rogério em 15/10/2026 | Transferência internacional dos dados do Compass | Mensagem do `PACOTE-FINAL-T11-EMAIL-BR.md` §1; resposta ainda não recebida | — | **Incompleta:** envio informado por Rogério, aguardando resposta. Mecanismo **não comprovado** (L9 pendente; D-L9 depois da resposta) |
| `incident_register` | Registro de incidentes conforme Res. CD/ANPD 15/2024, art. 10 | Rogério Palhari (controlador); estrutura criada por Claude a pedido dele | Procedimento aprovado em 15/10/2026 | Tratamento no Compass | Procedimento em `REGISTRO-INCIDENTES-PROCEDIMENTO.md`; registro fora do Git em `C:\Users\Roger\eag-compass-registros\incidentes\` | Versão 1 do registro: `4363ebd97b781b63aacbadcdc2868839ac0410b1b3335f55c36c0b8b3239791b` (linha 1 de `INDICE-SHA256.txt`) | **Incompleta** (detalhe abaixo) |
| `erasure_test` | Teste de exclusão em produção com registros fictícios (08/10/2026) e correção publicada (migração 0036, Worker 22711368) | Rogério Palhari (autorização e login); execução e registro por Claude | 08/10/2026 | Exclusão de dados pessoais no Compass (R9.1, R23.5) | `docs/implementation/t11-evidencias/05-erasure_test.md` | `7a497e3ed382b4a627be1bf3e16a587dac67fb4422d22d1c4fd43e05a25c00dc` | **Pronta** |

**Também pendente para a T11, fora das 5 evidências:** a declaração do OpenClaw B (`DECLARACAO-OPENCLAW-RASCUNHO.md`), exceção a R21.8/R25.2 que depende de fatos que só Rogério pode confirmar.

## `incident_register` por etapa (15/10/2026)

| Etapa | Situação |
| --- | --- |
| Procedimento | **Aprovado** por Rogério em 15/10/2026, opção A (`REGISTRO-INCIDENTES-PROCEDIMENTO.md`) |
| Estrutura local | **Criada** fora do Git, acesso só de `ROGERIONOTE\Roger`: `REGISTRO-INCIDENTES.md` (modelo e entrada 1) e `INDICE-SHA256.txt` |
| Entrada 1 (D1, 09/10) | **Registrada** com fatos, impacto observado e lacunas. Classificação **pendente de avaliação**, sem afirmar perda, vazamento nem ausência de impacto |
| Ferramenta da cópia | 7-Zip 26.04 instalado (pacote oficial, hash do instalador conferido pelo winget). Mecanismo testado só com dados e senha fictícios: `7zAES`, nomes ocultos sem a senha, recuperação idêntica |
| Cópia cifrada real | **Informada por Rogério em 15/10** (script rodado e cópia verificada). **Não verificada por Claude:** a pasta `C:\Users\Roger\eag-compass-registros\copia-cifrada\` não existe, e nenhum `eagc-ri-*.7z` nem `verificacao-*.txt` foi encontrado em `C:\Users\Roger` (busca recursiva, 15/10) |
| Cópia verificada | **Não confirmada:** o relatório de verificação não foi localizado neste computador |
| Cópia no Google Drive | **Informada por Rogério em 15/10. Não localizada** no Drive de `rogeriopalhari23@gmail.com` (conector, só leitura, 15/10): nenhum `.7z`, nenhum título com `eagc` e nenhum arquivo próprio criado desde 15/10. Comparação de integridade não feita |
| Local da senha | **Pendente de Rogério:** informar só o local |

A evidência fica completa quando as quatro pendências estiverem cumpridas. A entrada 1 continuar pendente de avaliação não impede que a evidência fique completa: o registro existe e está guardado conforme o procedimento.
