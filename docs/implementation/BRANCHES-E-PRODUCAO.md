# Código em produção x branches

## Situação em 2026-10-06 14:00 UTC (depois da publicação autorizada)

| Referência | Commit | Situação |
| --- | --- | --- |
| **Produção** (Worker `eag-compass-production`) | versão `4a515430-0249-43bb-9663-1f3982dd7cb8`, publicada às 13:58:59 UTC por `npm run deploy`, a partir de `2abf8fe` (código = `91fbd46`) | 100% ativa |
| `v2-revisao-2` (local e GitHub) | `2abf8fe` | Igual à produção |
| `main` (local e GitHub) | `2abf8fe` | Sincronizada por avanço simples (`bbe69ec..2abf8fe` no GitHub; `38eea61..2abf8fe` local), sem force push. Não havia commit exclusivo da `main` |
| `redesign-ui`, `v2-planejamento`, worktrees `eag-compass-antes` e `eag-compass-redesign` | — | Já contidas em `v2-revisao-2`; nada a preservar fora dela |

**Workflows conferidos antes de atualizar a `main`:**
- `ci.yml` roda em push para `main`, `v2-planejamento` e `v2-revisao-2`, e faz só `npm ci` e `npm run check`, sem segredos e sem deploy.
- `mdic-mensal.yml` só roda pelo agendamento (dias 10–12, 12h UTC) ou manualmente. Push não dispara, e ele só publica os dados do MDIC (nenhuma ação comercial).
- Depois dos pushes rodou só "Validate EAG Compass" nas duas branches.
- **O deploy continua manual** (`npm run deploy`).

## Registro anterior (2026-10-06, antes da publicação)

- Produção `9913e71c` (de `ab040e3`) tinha o mesmo código de `origin/v2-revisao-2` (`58a2d24`).
- `origin/main` estava em `bbe69ec` (2026-09-30): ancestral de `v2-revisao-2`, 50 commits atrás.
- A `main` local estava em `38eea61` (2026-09-22).
