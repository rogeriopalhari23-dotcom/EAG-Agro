# Código em produção x branches (conferido em 2026-10-06)

Só leitura. Nada foi sincronizado, mesclado nem publicado.

| Referência | Commit | Situação |
| --- | --- | --- |
| **Produção** (Worker `eag-compass-production`) | versão `9913e71c-66f5-4be4-8fb4-58c7209d7a36`, publicada em 2026-10-01 20:50 UTC a partir de `ab040e3` (árvore limpa, conferida no deploy) | 100% ativa (`wrangler deployments status`) |
| `origin/v2-revisao-2` | `58a2d24` | Código idêntico ao de produção: entre `ab040e3` e `58a2d24` só mudaram documentos (`git diff ab040e3 origin/v2-revisao-2 -- src public migrations bridge wrangler.jsonc package.json` vazio) |
| `v2-revisao-2` local | `91fbd46` | 1 commit à frente do GitHub, **não enviado e não publicado**: correção do fluxo (bloqueios da ficha e próximo passo do cartão da busca), com 3 arquivos de código e 2 de teste |
| `origin/main` | `bbe69ec` (2026-09-30) | **Desatualizada:** é ancestral de `v2-revisao-2`, com 0 commits próprios e 50 atrás. Não tem as migrações 0030–0032, a ponte de e-mail, a supressão com retenção, EXCLUSAO-PURGA, a correção de respostas nem o redesign |
| `main` local | `38eea61` (2026-09-22) | 82 commits atrás de `origin/main`; ancestral de `v2-revisao-2` |
| `redesign-ui` (local e GitHub) | `61c1321` | Já contida em `v2-revisao-2` (tag `producao-7d178094` aponta para ela) |
| `v2-planejamento` (local) | `20ef963` | Já contida em `v2-revisao-2` |
| Worktrees | `eag-compass-antes` (`1c9b234`, destacada) e `eag-compass-redesign` (`61c1321`) | Cópias de comparação; nenhum trabalho fora de `v2-revisao-2` |

**Diferença `main` → `v2-revisao-2` (853 arquivos):**
- a maior parte são fontes do mapa (`public/mapa/fonts/…`) e capturas de tela do redesign em `docs/`;
- o código fica em `src/`, `public/app.js`, `bridge/`, `tests/` e nas migrações 0030–0032.

## Proposta (decisão de Rogério; não executada)

- **Sincronizar `main` com `v2-revisao-2` por avanço simples (fast-forward)**, depois de enviar `91fbd46`. Não há conflito possível: `main` não tem commit próprio.
  - Efeito: `main` passa a refletir a linha de produção, e a branch padrão do GitHub deixa de mostrar código de 30/09.
  - A produção não muda: o deploy é manual (`wrangler deploy`) e não há workflow de publicação no repositório.
- **`91fbd46`:** enviar ao GitHub e publicar numa próxima autorização, com `npm run check` e o mesmo roteiro de deploy. Não tem migração.
