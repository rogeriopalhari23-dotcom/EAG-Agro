import { calculateCompleteness } from "./scoring.js";
import { fail, str, oneOf, number, date } from "./http.js";
export const requiredFields = [
  "product",
  "specification",
  "packaging",
  "volume_per_operation",
  "destination_country",
  "delivery_location",
  "incoterm",
  "required_date",
  "modality",
  "operations_per_year",
  "payment_method",
  "payment_term",
  "payment_guarantee",
  "final_buyer",
  "decision_maker",
  "compliance_restrictions",
];
export const optionalFields = [
  "price",
  "annual_potential_direct",
  "logistics_confirmed",
  "company_registry_status",
  "buyer_profile",
  "delivery_condition",
  "buying_channel",
  "precise_location",
  "inside_radius",
];
const keys = new Set([...requiredFields, ...optionalFields]);
const nonempty = (v) =>
  v !== null &&
  v !== undefined &&
  (!(typeof v === "string") || v.trim().length > 0);
export function validateFields(fields, actor, at) {
  if (!Array.isArray(fields) || fields.length > keys.size)
    fail(422, "invalid_fields", "Lista de campos inválida.");
  const seen = new Set();
  return fields.map((f) => {
    if (!f || typeof f !== "object" || !keys.has(f.key) || seen.has(f.key))
      fail(422, "invalid_field", "Campo desconhecido ou repetido.");
    seen.add(f.key);
    const status = oneOf(
      f.status,
      ["confirmed", "not_confirmed", "not_applicable"],
      "status",
    );
    if (
      status === "not_applicable" &&
      [
        "product",
        "volume_per_operation",
        "destination_country",
        "delivery_location",
        "modality",
        "operations_per_year",
        "decision_maker",
        "buyer_profile",
        "company_registry_status",
        "logistics_confirmed",
        "precise_location",
        "inside_radius",
      ].includes(f.key)
    )
      fail(
        422,
        "not_applicable_forbidden",
        "Este campo precisa permanecer no denominador.",
      );
    const reason =
      status === "not_applicable" ? str(f.reason, "motivo", 500) : null;
    const source =
      status === "confirmed"
        ? str(f.sourceReference, "fonte do campo", 1000)
        : null;
    const value =
      status === "not_applicable" || f.value === "" ? null : (f.value ?? null);
    if (status === "confirmed" || value !== null) {
      if (!nonempty(value))
        fail(
          422,
          "confirmation_without_value",
          "Confirmação exige valor e fonte.",
        );
      if (["volume_per_operation", "annual_potential_direct"].includes(f.key)) {
        if (!value || typeof value !== "object" || Array.isArray(value))
          fail(422, "volume_unit_required", "Informe {amount, unit}.");
        number(value.amount, f.key, 0, 1e12);
        oneOf(value.unit, ["MT", "KG", "L", "M3", "SAC60KG"], "unidade");
      } else if (f.key === "operations_per_year") {
        number(value, f.key, 0, 366);
        if (!Number.isInteger(value))
          fail(422, "invalid_field", "Operações anuais devem ser inteiras.");
      } else if (
        [
          "final_buyer",
          "logistics_confirmed",
          "precise_location",
          "inside_radius",
        ].includes(f.key)
      ) {
        if (typeof value !== "boolean")
          fail(422, "invalid_boolean", "Informe true ou false.");
      } else if (f.key === "company_registry_status")
        oneOf(
          value,
          ["verified_active", "partially_verified", "inactive"],
          f.key,
        );
      else if (f.key === "buyer_profile")
        oneOf(
          value,
          [
            "confirmed_final_consumer",
            "possible_final_consumer",
            "trader_distributor",
            "unconfirmed",
          ],
          f.key,
        );
      else if (f.key === "required_date") date(value, f.key, { future: true });
      else if (f.key === "destination_country") {
        if (!/^[A-Z]{2}$/.test(value))
          fail(422, "invalid_country", "Use código de país com 2 letras.");
      } else str(value, f.key, 2000);
    }
    return {
      key: f.key,
      status,
      value,
      reason,
      sourceReference: source,
      confirmedBy: status === "confirmed" ? actor.id : null,
      confirmedAt: status === "confirmed" ? at : null,
    };
  });
}
export function completeness(rows, demand) {
  const byKey = Object.fromEntries(rows.map((r) => [r.field_key, r]));
  return calculateCompleteness(
    requiredFields
      .filter((k) => k !== "final_buyer" || demand.final_buyer_required)
      .map((key) => ({
        key,
        required: true,
        status: byKey[key]?.field_status || "not_confirmed",
      })),
  );
}
export function confirmedValues(rows) {
  return Object.fromEntries(
    rows
      .filter(
        (r) =>
          r.field_status === "confirmed" &&
          r.source_reference &&
          r.value_json !== null,
      )
      .map((r) => [r.field_key, JSON.parse(r.value_json)]),
  );
}
export const amountMT = (value) =>
  value?.unit === "MT"
    ? value.amount
    : value?.unit === "KG"
      ? value.amount / 1000
      : value?.unit === "SAC60KG"
        ? value.amount * 0.06
        : null;
