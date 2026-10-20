// Lista única de commodities para seleção (radares, prospecção, rodadas e motor), montada do catálogo. Nenhuma lista
// paralela no código: o nome vem do produto (nome comercial, grupo ou variante) e a busca aceita também as variantes,
// os nomes comerciais e a sigla. Produtos de commodities diferentes nunca se juntam (farelo de milho ≠ CGF ≠ CGM ≠ DDGS).
export function commodityList(products) {
  const active = products.filter((p) => p.active !== 0);
  const groupsOf = new Map();
  for (const p of active) (groupsOf.get(p.group_name) ?? groupsOf.set(p.group_name, new Set()).get(p.group_name)).add(p.commodity);
  const by = new Map();
  for (const p of active) (by.get(p.commodity) ?? by.set(p.commodity, []).get(p.commodity)).push(p);
  return [...by.entries()]
    .map(([code, list]) => {
      const uniqueGroup = groupsOf.get(list[0].group_name)?.size === 1;
      const label = list.length === 1 ? list[0].display_name ?? (uniqueGroup ? list[0].group_name : list[0].variant_name) : uniqueGroup ? list[0].group_name : list[0].display_name ?? list[0].variant_name;
      const aliases = [...new Set(list.flatMap((p) => [p.variant_name, p.display_name, p.group_name]).filter(Boolean))].filter((a) => a !== label);
      return {
        code,
        label,
        aliases,
        products: list.map((p) => ({ id: p.id, name: p.display_name ?? p.variant_name, identityStatus: p.identity_status })),
        identityPending: list.every((p) => p.identity_status !== "confirmed"),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
export async function commodityLabelOf(env, tenant, code) {
  const rows = (await env.DB.prepare("SELECT * FROM products WHERE tenant_id=?").bind(tenant).all()).results;
  return commodityList(rows).find((c) => c.code === code)?.label ?? code;
}
