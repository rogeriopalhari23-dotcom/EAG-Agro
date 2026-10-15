# Evidências da validação T11 `br_email_automatic` (piloto brasileiro por e-mail): índice (2026-10-15)

**Situação:** 4 de 5 evidências prontas (falta `transfer_mechanism`). **A validação T11 não está registrada.** O registro é ato do Administrador (`POST /api/compliance/t11`), só com autorização expressa de Rogério e com as 5 evidências completas.

**Regra dos SHA-256:** só de documento disponível e finalizado. Cada extrato é literal e congelado, tirado de um commit conhecido. O hash é do arquivo como está no Git (UTF-8, fins de linha LF). Correção não edita o extrato: gera um extrato novo, com hash novo.

| Tipo (`kind`) | Conteúdo | Responsável | Data | Alcance | Referência | SHA-256 | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `decisions` | Decisões de Rogério de 06 a 09/10/2026: uso individual, canal só e-mail, finalidade, retenção A1–D1, E1/E2-b/O7-e–O9-e/D5-a, cópia D5-a e trava T11 | Rogério Palhari (controlador), decisões; registro por Claude | 06–09/10/2026 | Tratamento no Compass, piloto brasileiro por e-mail (`br_email_automatic`) | `docs/implementation/t11-evidencias/01-decisions.md` (Spec no commit `e60b328`) | `2335da598feb61bbcd7e02378db8ba3684a837b871fc9517bd4f8f23147ad184` | **Pronta** |
| `legal_basis` | E1: legítimo interesse (LGPD art. 7º, IX) com teste de balanceamento, e o registro da aprovação | Rogério Palhari | 09/10/2026 | E-mail de identificação ao canal geral publicado de empresas no Brasil | `docs/implementation/t11-evidencias/02-legal_basis.md` | `2eb23810f89424c7123a7df7521e381a7c875db4a2bb810a272c52ab75df08f6` | **Pronta** |
| `transfer_mechanism` | Mecanismo do art. 33 para os dados na Cloudflare (Workers, D1 em ENAM, R2, Access, logs) | Rogério Palhari (consulta); Cloudflare (resposta) | Consulta informada por Rogério em 15/10/2026 | Transferência internacional dos dados do Compass | Mensagem do `PACOTE-FINAL-T11-EMAIL-BR.md` §1; resposta ainda não recebida | — | **Incompleta:** envio informado por Rogério, aguardando resposta. Mecanismo **não comprovado** (L9 pendente; D-L9 depois da resposta) |
| `incident_register` | Registro de incidentes conforme Res. CD/ANPD 15/2024, art. 10 | Rogério Palhari (controlador); estrutura criada por Claude a pedido dele | Procedimento aprovado em 15/10/2026 | Tratamento no Compass | Procedimento em `REGISTRO-INCIDENTES-PROCEDIMENTO.md`; registro fora do Git em `C:\Users\Roger\eag-compass-registros\incidentes\` | Versão 1 do registro: `4363ebd97b781b63aacbadcdc2868839ac0410b1b3335f55c36c0b8b3239791b` (linha 1 de `INDICE-SHA256.txt`) | **Concluída** no escopo do procedimento aprovado (detalhe abaixo, 15/10/2026) |
| `erasure_test` | Teste de exclusão em produção com registros fictícios (08/10/2026) e correção publicada (migração 0036, Worker 22711368) | Rogério Palhari (autorização e login); execução e registro por Claude | 08/10/2026 | Exclusão de dados pessoais no Compass (R9.1, R23.5) | `docs/implementation/t11-evidencias/05-erasure_test.md` | `7a497e3ed382b4a627be1bf3e16a587dac67fb4422d22d1c4fd43e05a25c00dc` | **Pronta** |

**Também pendente para a T11, fora das 5 evidências:** a declaração do OpenClaw B (`DECLARACAO-OPENCLAW-RASCUNHO.md`), exceção a R21.8/R25.2 que depende de fatos que só Rogério pode confirmar.

## `incident_register` por etapa (15/10/2026)

| Etapa | Situação |
| --- | --- |
| Procedimento | **Aprovado** por Rogério em 15/10/2026, opção A (`REGISTRO-INCIDENTES-PROCEDIMENTO.md`) |
| Estrutura local | **Criada** fora do Git, acesso só de `ROGERIONOTE\Roger`: `REGISTRO-INCIDENTES.md` (modelo e entrada 1) e `INDICE-SHA256.txt` |
| Entrada 1 (D1, 09/10) | **Registrada** com fatos, impacto observado e lacunas. Classificação **pendente de avaliação**, sem afirmar perda, vazamento nem ausência de impacto |
| Ferramenta da cópia | 7-Zip 26.04 instalado (pacote oficial, hash do instalador conferido pelo winget). Mecanismo testado só com dados e senha fictícios: `7zAES`, nomes ocultos sem a senha, recuperação idêntica |
| Cópia cifrada real | **Verificada (Claude, 15/10):** `C:\Users\Roger\eag-compass-registros\copia-cifrada\eagc-ri-20261015T0307Z.7z`, 2.655 bytes, criada em 2026-10-15T03:07:33Z, SHA-256 `409b7fcaf0a27786f6b8c9e0fae35f40e0f82db142c24c8607c9c2fca7eab8be` (igual ao do relatório). Formato 7z, AES-256, cabeçalho cifrado. Não decifrada por Claude |
| Cópia verificada | **Relatório lido (Claude, 15/10):** `verificacao-20261015T0307Z.txt`, com códigos criar 0, testar 0 e recuperar 0 e "CÓPIA VERIFICADA". Os SHA-256 recuperados do registro (`4363ebd9…791b`) e do índice (`04ceb868…3db5`) conferem com os originais e com os arquivos atuais. **O teste de abertura e recuperação foi executado por Rogério com a senha dele; Claude conferiu o relatório e os hashes, não a decifragem** |
| Cópia no Google Drive | **Verificada (Claude, 15/10, só leitura):** arquivo `eagc-ri-20261015T0307Z.7z`, ID privado `1qkTlcIhfNSzhyOYILcyAJmjyTn8OTszq`, 2.655 bytes, enviado em 2026-10-15T03:13:01Z. Conteúdo cifrado baixado sem decifrar: **bytes idênticos ao arquivo local** (`cmp`) e mesmo SHA-256. Permissões: só o dono (`rogeriopalhari23@gmail.com`), sem compartilhamento. Cópia temporária do download apagada |
| Local da senha | **Informado por Rogério em 15/10/2026:** gerenciador de senhas pessoal, separado do arquivo cifrado no Drive. Só o local foi registrado; a senha e o acesso ao gerenciador não foram pedidos nem vistos |

**Evidência concluída em 15/10/2026** no escopo do procedimento aprovado: procedimento, estrutura, entrada 1, cópia cifrada verificada (local e Drive idênticos, privada) e local da senha registrado. O relatório `verificacao-20261015T0307Z.txt` e as verificações acima ficam preservados. A entrada 1 continuar pendente de avaliação não impede que a evidência fique completa: o registro existe e está guardado conforme o procedimento.
