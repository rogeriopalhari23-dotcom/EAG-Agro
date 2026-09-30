// Endereço físico dos e-mails (R19.13), sempre no rodapé separado da assinatura. Só vale depois de validado por Rogério:
// EAG_POSTAL_ADDRESS_CONFIRMED guarda o texto exato que ele confirmou. Se EAG_POSTAL_ADDRESS mudar sem nova confirmação,
// o revisor e a aprovação voltam a bloquear.
export const postalAddressConfirmed = (env) => !!env.EAG_POSTAL_ADDRESS && env.EAG_POSTAL_ADDRESS_CONFIRMED === env.EAG_POSTAL_ADDRESS;

export const ADDRESS_PENDING =
  "Endereço físico sem confirmação de Rogério (ou diferente do texto confirmado): aprovação bloqueada até a validação (R19.13).";
