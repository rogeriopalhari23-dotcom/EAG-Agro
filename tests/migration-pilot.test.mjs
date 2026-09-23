import test from "node:test";
import assert from "node:assert/strict";
import { D1Test, migrations } from "./helpers/db.mjs";

function apply(db, sql) {
  db.raw.exec("BEGIN");
  try {
    db.raw.exec(sql);
    db.raw.exec("COMMIT");
  } catch (e) {
    db.raw.exec("ROLLBACK");
    throw e;
  }
}
const index = migrations.findIndex((sql) => sql.includes("P2-T1: esquema do piloto nacional"));
function upTo(db, last) {
  for (const sql of migrations.slice(0, last)) apply(db, sql);
}
function full() {
  const db = new D1Test();
  upTo(db, migrations.length);
  return db;
}
const q = (db, sql, ...a) => db.raw.prepare(sql).get(...a);
function seed(db) {
  db.raw.exec(`
    INSERT INTO companies(id,tenant_id,legal_name,country_code,source_label,created_by) VALUES ('co','eag-internal','Doces Vale Verde Ltda.','BR','teste','system-admin');
    INSERT INTO contacts(id,tenant_id,company_id,full_name_encrypted,source_label,created_by) VALUES ('ct','eag-internal','co','x','teste','system-admin');
    INSERT INTO campaigns(id,tenant_id,product_id,market,name,origin_city,origin_uf,radius_km,created_by) VALUES ('cp','eag-internal','product-06','national','Açúcar','Sertãozinho','SP',5,'system-admin');
    INSERT INTO fichas(id,tenant_id,company_id,campaign_id,created_by) VALUES ('fi','eag-internal','co','cp','system-admin');
    INSERT INTO ficha_versions(id,ficha_id,version_no,snapshot_enc,snapshot_sha256,pv_report_json,review_ok,skill_sha256,templates_version,generator_version,created_by) VALUES ('fv','fi',1,'enc','h','{}',1,'s','t','g','system-admin');
    INSERT INTO ficha_messages(id,version_id,contact_id,channel,step_no,kind,day_offset,body_enc,message_sha256) VALUES ('fm','fv','ct','email',1,'auto_email',0,'enc','m1');
    INSERT INTO ficha_approvals(id,version_id,contact_id,channel,messages_sha256,approved_by,approved_at) VALUES ('fa','fv','ct','email','agg','system-admin','2026-09-23T00:00:00Z');
    INSERT INTO send_outbox(id,tenant_id,ficha_id,message_row_id,approval_id,company_id,commodity,contact_id,channel,step_no,planned_date,message_sha256) VALUES ('ob','eag-internal','fi','fm','fa','co','sugar','ct','email',1,'2026-09-24','m1');
  `);
}

test("P2-T1: 0007 aplica sobre banco preenchido e preserva dados anteriores", () => {
  assert.ok(index > 0, "migração do piloto não encontrada");
  const db = new D1Test();
  try {
    upTo(db, index);
    db.raw.exec(`
      INSERT INTO companies(id,tenant_id,legal_name,country_code,registration_id,registration_id_type,source_label,created_by) VALUES ('old','eag-internal','Antiga','BR','11.222.333/0001-81','CNPJ','doc','system-admin');
      INSERT INTO contacts(id,tenant_id,company_id,email_encrypted,source_label,created_by) VALUES ('oldc','eag-internal','old','cipher','doc','system-admin');
      INSERT INTO campaigns(id,tenant_id,product_id,market,name,origin_city,origin_uf,radius_km,created_by) VALUES ('oldcp','eag-internal','product-03','national','Milho','Franca','SP',5,'system-admin');
    `);
    for (const sql of migrations.slice(index)) apply(db, sql);
    assert.equal(q(db, "SELECT registration_id FROM companies WHERE id='old'").registration_id, "11.222.333/0001-81");
    assert.equal(q(db, "SELECT cnpj_root FROM companies WHERE id='old'").cnpj_root, null);
    const c = q(db, "SELECT email_encrypted,email_validation,prospect_role FROM contacts WHERE id='oldc'");
    assert.equal(c.email_encrypted, "cipher");
    assert.equal(c.email_validation, null);
    assert.equal(c.prospect_role, null);
    assert.equal(q(db, "SELECT name FROM campaigns WHERE id='oldcp'").name, "Milho");
  } finally {
    db.raw.close();
  }
});

test("P2-T1: canais começam planejados e 'enabled' exige evidência", () => {
  const db = full();
  try {
    const rows = db.raw.prepare("SELECT channel,state FROM channels ORDER BY channel").all();
    assert.deepEqual(rows.map((r) => r.state), ["planned", "planned", "planned"]);
    assert.throws(() => db.raw.exec("UPDATE channels SET state='enabled' WHERE channel='email'"), /CHECK/);
  } finally {
    db.raw.close();
  }
});

test("P2-T1: versão e mensagens da ficha são imutáveis", () => {
  const db = full();
  try {
    seed(db);
    assert.throws(() => db.raw.exec("UPDATE ficha_versions SET snapshot_enc='outro' WHERE id='fv'"), /ficha_version_immutable/);
    db.raw.exec("UPDATE ficha_versions SET superseded_at='2026-09-24' WHERE id='fv'");
    assert.throws(() => db.raw.exec("UPDATE ficha_messages SET body_enc='outro' WHERE id='fm'"), /ficha_message_immutable/);
    assert.throws(() => db.raw.exec("DELETE FROM ficha_messages WHERE id='fm'"), /ficha_message_immutable/);
  } finally {
    db.raw.close();
  }
});

test("P2-T1: indeterminado só sai com resolução registrada; aceito é final", () => {
  const db = full();
  try {
    seed(db);
    db.raw.exec("UPDATE send_outbox SET status='indeterminate' WHERE id='ob'");
    assert.throws(() => db.raw.exec("UPDATE send_outbox SET status='pending' WHERE id='ob'"), /requires_resolution/);
    assert.throws(() => db.raw.exec("UPDATE send_outbox SET status='temp_failed' WHERE id='ob'"), /requires_resolution/);
    db.raw.exec("UPDATE send_outbox SET status='accepted',resolved_by='system-admin',resolved_reason='Confirmado na caixa de enviados' WHERE id='ob'");
    assert.throws(() => db.raw.exec("UPDATE send_outbox SET status='pending' WHERE id='ob'"), /outbox_accepted_final/);
  } finally {
    db.raw.close();
  }
});

test("P2-T1: uma linha de outbox por ficha, destinatário, canal e passo; Message-ID único", () => {
  const db = full();
  try {
    seed(db);
    assert.throws(
      () =>
        db.raw.exec(
          "INSERT INTO send_outbox(id,tenant_id,ficha_id,message_row_id,approval_id,company_id,commodity,contact_id,channel,step_no,planned_date,message_sha256) VALUES ('ob2','eag-internal','fi','fm','fa','co','sugar','ct','email',1,'2026-09-24','m1')",
        ),
      /UNIQUE/,
    );
    db.raw.exec("UPDATE send_outbox SET message_id='<ob@eagagro.com>' WHERE id='ob'");
    db.raw.exec(
      "INSERT INTO send_outbox(id,tenant_id,ficha_id,message_row_id,approval_id,company_id,commodity,contact_id,channel,step_no,planned_date,message_sha256) VALUES ('ob3','eag-internal','fi','fm','fa','co','sugar','ct','email',2,'2026-09-26','m2')",
    );
    assert.throws(() => db.raw.exec("UPDATE send_outbox SET message_id='<ob@eagagro.com>' WHERE id='ob3'"), /UNIQUE/);
  } finally {
    db.raw.close();
  }
});

test("P2-T1: perfil confirmado exige evidência; unidade não cruza tenant; mensagem IMAP gravada uma vez", () => {
  const db = full();
  try {
    seed(db);
    assert.throws(
      () =>
        db.raw.exec(
          "INSERT INTO buyer_profiles(id,tenant_id,company_id,product_id,profile_class,basis,icp_status,updated_by) VALUES ('bp','eag-internal','co','product-06','final_consumer_confirmed','x','in_icp','system-admin')",
        ),
      /CHECK/,
    );
    db.raw.exec("INSERT INTO tenants(id,name) VALUES ('outro','Outro')");
    assert.throws(
      () =>
        db.raw.exec(
          "INSERT INTO company_units(id,tenant_id,company_id,cnpj,source_label,consulted_at) VALUES ('u','outro','co','11222333000181','x','2026-09-23')",
        ),
      /tenant_reference_mismatch/,
    );
    const ins = "INSERT INTO inbound_messages(id,tenant_id,mailbox,uidvalidity,imap_uid,classification,correlation,r2_key,received_at) VALUES (?,'eag-internal','INBOX',7,42,'human','none','k','2026-09-23')";
    db.raw.prepare(ins).run("m1");
    assert.throws(() => db.raw.prepare(ins).run("m2"), /UNIQUE/);
  } finally {
    db.raw.close();
  }
});
