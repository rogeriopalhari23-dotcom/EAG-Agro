# Evidência `legal_basis`: E1, legítimo interesse com teste de balanceamento

> Extrato literal e congelado para a validação T11 `br_email_automatic`. Fonte: `docs/implementation/PRONTIDAO-PILOTO-BR-EMAIL.md` §6 (texto) e registros da aprovação, no commit `e60b328`. Não editar: correção = novo extrato.

## Texto aprovado

### E1. Base legal do e-mail de identificação (Brasil)

> Adoto o legítimo interesse (LGPD art. 7º, IX) para enviar, ao canal geral publicado por uma empresa, um e-mail que só pergunta quem é o responsável pela compra de milho.
>
> **Teste de balanceamento:**
> 1. **Finalidade:** prospecção comercial entre empresas para fornecimento de milho a consumidores industriais, dentro da minha atividade de franqueado.
> 2. **Necessidade:** uso só o endereço geral publicado pela própria empresa no site oficial, com fonte e data. Não uso endereço pessoal, deduzido ou comprado. Nome de pessoa só entra se a empresa indicar.
> 3. **Expectativa:** o endereço foi publicado pela empresa para contato institucional. A mensagem é curta, sem anexo, sem preço e sem oferta.
> 4. **Salvaguardas:**
>    - no máximo 2 mensagens, com 4 dias de intervalo;
>    - saída por resposta "sair" ou em um clique, processada antes do próximo envio;
>    - supressão mantida para não recontatar (A1);
>    - nada sai sem minha aprovação, empresa a empresa;
>    - endereço validado antes do envio.
> 5. **Direitos:** pedidos pelo e-mail rogeriopalhari@hotmail.com, ou respondendo à própria mensagem.
>
> **Conclusão:** com o caráter institucional do canal e as salvaguardas, o interesse legítimo não se sobrepõe aos direitos dos titulares. Revisável se houver orientação contrária.

## Registro da aprovação (09/10/2026)

- **Decisões de Rogério (09/10):** E1, E2-b, OpenClaw B (opção; declaração pendente), O7-e, O8-e, O9-e e D5-a. Ver `PRONTIDAO-PILOTO-BR-EMAIL.md` §9.
| 2026-10-09 | Decisões do piloto brasileiro por e-mail? | Rogério Palhari aprovou **E1** (legítimo interesse, teste de balanceamento), **E2-b** (linha de transparência com o canal do titular rogeriopalhari@hotmail.com), **O7-e, O8-e, O9-e** e **D5-a** (cópia interna separada de cada passo aceito ao endereço fixo do contrato; parâmetro só do Administrador). **OpenClaw B** aprovada como opção, mas a exceção **não está registrada**: falta a declaração de Rogério (texto em `implementation/PRONTIDAO-PILOTO-BR-EMAIL.md` §9). Alcance: só `br_email_automatic`. Implementação em §10, não publicada. **Não** aprova fichas, não ativa campanha, não libera canal e **não** valida a T11; incidentes e Cloudflare seguem pendentes. | R19, R21, R25, R26, T11 |
