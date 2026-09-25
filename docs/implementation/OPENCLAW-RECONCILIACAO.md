# OpenClaw → Compass: inventário e plano de reconciliação (P2-T15)

Estado em 2026-09-25. Nada foi conectado na VPS nem importado.

## Identidade da VPS (2.24.78.149)

| Tipo | Registrada no `known_hosts` (conexões até maio/2026) | Apresentada hoje (`ssh-keyscan`, sem login) |
| --- | --- | --- |
| ED25519 | `SHA256:zKBnNsJ9dMyUwsoerjDzagrS08yqS2w+v/pnIcND7XU` | `SHA256:zA4NvA5n8KMmxOVbyKdsgYdRn1I4LQjFREnM6y/1JX8` |
| RSA | `SHA256:5qi0kFmUBbHyK/V0/880/1LPKhQt2aDGKb2GW2SuNCU` | `SHA256:3DvVvHwJzT+wuQ49Xcox7Ln6e1aUk5l3Y/I3zF8QSW4` |
| ECDSA | `SHA256:8QoJ5g2buYWLJG3EPmAJLESbYpZ4b9/7JUebYpPMjBU` | `SHA256:GLjK16SFTORR25SEpyUverASdjenWKzFNF2pRXz2t7U` |

As três chaves mudaram ao mesmo tempo e o nome `srv1644560.hstgr.cloud` saiu do DNS: padrão de **reinstalação ou troca da VPS**. A confirmação independente é só pelo hPanel (terminal do navegador da VPS): `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` precisa mostrar `SHA256:zA4NvA5n8KMmxOVbyKdsgYdRn1I4LQjFREnM6y/1JX8`. Sem essa confirmação, nenhuma conexão.

## Inventário do executor antigo (cópia local validada de 2026-06-24)

Fonte: `Desktop/EAG Agro/eag_openclaw_claw3d_validated_refactor_20260624_v2_regras_porte` (lidos só estrutura, nomes de chave e valores padrão do modelo de configuração).

- Componentes na VPS: `autopilot/eag_autopilot_controller.py` (rodadas de agentes: coordenação, prospecção, validação, relatório final), `eag_mailer.py` (SMTP próprio: `SMTP_HOST/PORT/USER/PASS/FROM/TLS`), `eag_report_pdf.py`, `eag_next_round.sh`, `eag_autopilot_console.sh`; instalação por `install_vps_autopilot_validated.ps1` / `patch_vps_autopilot_validated.sh`; na máquina local, o lançador `EAG_OpenClaw_Launcher.ps1` e os perfis de navegador `AppData/Local/EAG-OpenClaw-*`.
- Modo padrão: `EAG_AUTOPILOT_MODE=internal_report_only`; `EAG_ALLOW_COMMERCIAL_SEND`, `EAG_ALLOW_LEAD_CONTACT`, `EAG_ALLOW_LINKEDIN_ACTION`, `EAG_ALLOW_WHATSAPP_ACTION`, `EAG_ALLOW_CRM_ACTION`, `EAG_ALLOW_EXTERNAL_FORM_ACTION` = `false`. E-mail só de relatório para `EAG_REPORT_EMAIL` (padrão `rogeriopalhari@eagagro.com`); o controlador registra "Nenhum lead foi acionado".
- Dados: relatórios e `metadata.json` por rodada; não há base de contatos, supressões ou envios no código validado. `~/.openclaw` local só tem a tela Claw3D e o quadro de tarefas dos agentes.

## Plano de reconciliação (depois da confirmação da identidade)

1. Conectar só leitura e listar: versão instalada, `config.env` (só **nomes** e as chaves `EAG_ALLOW_*`/`EAG_AUTOPILOT_MODE` — nunca `SMTP_PASS`), agendamentos (`crontab -l`, `systemctl list-timers`, `pm2 ls`) e pastas de relatório.
2. Se algum `EAG_ALLOW_*` estiver `true` ou houver agendamento de envio: registrar e pedir a Rogério a decisão de desligar antes de o Compass enviar (errata item 11 — corte comprovado do executor antigo).
3. Se houver lista de contatos/descadastros: importar primeiro as supressões (`POST /api/openclaw/imports` → `/suppressions` → `/close-suppressions`), depois empresas e contatos, no formato de `docs/OPERACAO.md`; conflitos vão para o relatório, nunca fusão automática.
4. Se a VPS foi reinstalada sem backup: registrar "sem dados a migrar"; a tarefa fecha com o corte comprovado (nenhum executor antigo ativo) e sem importação.
