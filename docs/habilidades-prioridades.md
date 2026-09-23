# Habilidades prioritárias aplicadas ao EAG Compass

Revisão de 23/09/2026. Base atual: ZIP atribuído a `20ef963`, SHA-256 `f73211849191734fe34747c9f602580781466aeb8b1c537d2408cde97615ac49`; correções da primeira revisão reaproveitadas. Corrige a avaliação anterior baseada no esqueleto TypeScript do repositório: o pacote real usa JavaScript nativo, Worker e HTML/DOM.

| Prioridade | Aplicação concreta nesta revisão | Forma de incorporação |
| --- | --- | --- |
| P0 — Segurança e revisão por evidência | JWT, RBAC, tenant, transações, concorrência, testes negativos, dados ausentes bloqueando decisões críticas | `src/auth.js`, `http.js`, `store.js`, migrações e testes |
| P0 — Regras comerciais verificáveis | Fórmulas v2, fontes nos campos confirmados, demanda versionada, perfil comprador contextual e gate sem usar score histórico cego | `scoring.js`, `demand.js`, `scores.js` |
| P1 — Performance e custo | Lotes D1, fim do N+1 de campos, paginação, cache de chaves criptográficas/JWKS, assets separados, cron/KV/R2/filas ociosos removidos da configuração | Implementação e relatório de custos |
| P1 — Design e escrita | Talhão, foco visível, formulários com rótulos, estados reais, erro acionável, ausência de promessas de envio | `public/` e `AGENTS.md` |
| P1 — Composição | Separação por domínio, DOM por funções reutilizáveis e componentes simples de formulário | Implementação nativa; sem dependência React |
| P2 — Conteúdo institucional | `posts-linkedin-agro`, quando houver pedido de marketing | Habilidade já disponível no ambiente, fora do runtime e da prospecção automatizada |

`writing-guidelines` e `web-design-guidelines` não foram consideradas instaladas: as tentativas anteriores de salvamento falharam. Os critérios de escrita/design acima vêm da Spec e do design aprovado, não de uma alegada importação dessas habilidades.

`vercel-composition-patterns`, `vercel-react-best-practices` e `vercel-react-view-transitions` são específicas de React: não ativadas nesta arquitetura. CLI, deploy e otimização da Vercel e React Native ficam fora do projeto. Nenhum pacote Vercel foi adicionado.

As orientações ficam incorporadas em `AGENTS.md` e neste documento. Não são dependências pagas, não geram chamadas em produção e não equivalem à instalação de uma habilidade na conta ChatGPT.

A habilidade comercial `/prospeccao-vendas` não está no ZIP. Seu texto original, correspondente ao hash registrado em T12, continua necessário para implementar o revisor e as sequências. Não reconstruir esse conteúdo por suposição.

Economia de contexto para agentes: `CLAUDE.md`, fila `sequence.json` e comando `npm run next`. O comando entrega somente a tarefa e os arquivos necessários; não usa IA. Recálculos idênticos não multiplicam gravações de score.
