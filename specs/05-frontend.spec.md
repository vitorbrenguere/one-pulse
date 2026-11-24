# 05 — Front-End (MVP)

| Campo | Valor |
|---|---|
| Status | ✅ Aprovada (v1.0.0) · v1.0.1 aguardando validação |
| Versão | 1.0.1 (§6.6: textos e estrutura acessível fixados pelos testes; §10: helper `goals-store.ts`) |
| Data | 2026-11-24 |
| Depende de | [`00-architecture.spec.md`](00-architecture.spec.md) v1.3.0 · [`01-auth.spec.md`](01-auth.spec.md) · [`02-users.spec.md`](02-users.spec.md) · [`03-pd-goals.spec.md`](03-pd-goals.spec.md) · [`04-evaluations.spec.md`](04-evaluations.spec.md) |
| Branch | `feat/phase-5-frontend` |

---

## 1. Objetivo

Entregar a interface web do OnePulse consumindo a API já concluída (fases 1–4), sem alterar o back-end. O MVP cobre: sessão (login, cadastro, logout), dashboard por papel, perfil, metas de PDI e avaliações de desempenho, com estados de carregamento, vazio e erro tratados de forma consistente.

**Princípio:** o back-end é a fonte da verdade para regras e autorização. O front-end **espelha** as regras apenas para guiar a UX (esconder ações impossíveis, validar campos óbvios), mas sempre trata a resposta da API como definitiva.

**Fora do escopo desta fase:**
- qualquer mudança no back-end (se a UI precisar de algo novo, vira emenda em spec própria);
- modo escuro, internacionalização (a UI é só pt-BR), PWA/offline;
- testes E2E em navegador real (Playwright/Cypress): a cobertura é Vitest + Testing Library;
- paginação, busca textual e gráficos/relatórios;
- notificações em tempo real;
- o colaborador ver o nome do próprio gestor (spec 02 Q-02: a API não permite).

---

## 2. Stack e Configuração

| Item | Escolha |
|---|---|
| Build | Vite + React 19 + TypeScript (`strict: true`) |
| Estilo | Tailwind CSS v4 (plugin `@tailwindcss/vite`) |
| Estado de servidor | TanStack Query v5 (**único** lugar com dados da API) |
| Roteamento | React Router v7 em modo biblioteca (`react-router-dom`) |
| Ícones | Lucide React |
| Testes | Vitest + jsdom + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` |
| Mock HTTP nos testes | MSW v2 (`msw/node`): intercepta o `fetch` real (veja Q-02) |
| Qualidade | ESLint (typescript-eslint + react-hooks) e `tsc --noEmit` |

### 2.1 Conexão com a API em desenvolvimento

- O Vite faz **proxy** de `/api` → `http://localhost:3333` (veja Q-03). Para o navegador, front e API ficam na mesma origem (`localhost:5173`), então o cookie `onepulse_token` (`SameSite=Lax`, `httpOnly`) é enviado sem depender de CORS.
- A base da API é `import.meta.env.VITE_API_URL ?? '/api/v1'`. Há `frontend/.env.example`; o `.env` não é versionado.
- O `CORS_ORIGIN=http://localhost:5173` do back-end continua válido (necessário se o proxy não for usado).

### 2.2 Comandos (dentro de `frontend/`)

```bash
npm run dev          # http://localhost:5173 (requer a API em :3333)
npm test             # vitest run
npm run test:watch
npm run lint
npm run typecheck    # tsc --noEmit
npm run build
```

---

## 3. Arquitetura

### 3.1 Pastas

```
frontend/src/
├── main.tsx                     # QueryClientProvider + BrowserRouter + AuthProvider
├── App.tsx                      # <AppRoutes />
├── routes/
│   ├── AppRoutes.tsx            # tabela de rotas (§5)
│   ├── RequireAuth.tsx          # guard: sessão
│   ├── RequireRole.tsx          # guard: papel
│   └── PublicOnly.tsx           # guard: /login e /register
├── services/
│   ├── http.ts                  # apiRequest + ApiError (§3.2)
│   └── query-keys.ts            # fábrica de query keys (§3.4)
├── lib/
│   ├── query-client.ts          # createQueryClient() + tratamento global de 401
│   ├── dates.ts                 # formatDate, todayUtc, isOverdue, currentCycle, cycleOptions
│   ├── labels.ts                # enums → rótulos pt-BR
│   └── form-errors.ts           # details[] → { [field]: message }
├── types/api.ts                 # UserDTO, GoalDTO, EvaluationDTO, enums, ApiErrorBody
├── components/ui/               # Button, Field, Input, Textarea, Select, Card, Badge,
│                                # ProgressBar, LoadingState, EmptyState, ErrorBanner,
│                                # Dialog, ConfirmDialog, ScoreInput
├── components/layout/AppShell.tsx
└── features/
    ├── auth/      (api.ts, AuthProvider.tsx, useAuth.ts, hooks/, pages/LoginPage, RegisterPage)
    ├── profile/   (api.ts, hooks/useUpdateProfile, components/ProfileCard)
    ├── team/      (api.ts, hooks/useTeam, useTeamMember, pages/TeamMemberPage)
    ├── dashboard/ (pages/DashboardPage, components/CollaboratorDashboard, ManagerDashboard)
    ├── pdi/       (api.ts, hooks/, components/GoalList, GoalCard, GoalFormDialog,
    │               GoalProgressForm, ManagerFeedbackForm, pages/GoalsPage)
    └── evaluations/ (api.ts, hooks/, view-state.ts, components/EvaluationCard,
                      SelfEvaluationForm, ManagerEvaluationForm, OpenEvaluationDialog,
                      pages/EvaluationsPage)
```

Camadas (dependência numa só direção): `pages → components → hooks → features/*/api.ts → services/http.ts`. Componentes **não** chamam `fetch`; hooks não conhecem JSX.

### 3.2 Cliente HTTP (`services/http.ts`)

```ts
apiRequest<T>(path: string, options?: { method?: 'GET'|'POST'|'PATCH'|'DELETE'; body?: unknown }): Promise<T>

class ApiError extends Error {
  status: number;            // 0 quando não houve resposta (rede)
  code: string;              // do envelope, ou NETWORK_ERROR / UNEXPECTED_RESPONSE
  details: Array<{ field: string; message: string }>;  // [] quando ausente
}
```

- Sempre `credentials: 'include'`; com corpo, `Content-Type: application/json` e `JSON.stringify(body)`.
- `2xx` com JSON → devolve o corpo tipado; `204` → `undefined`.
- Não-`2xx` com envelope `{ error: { code, message, details? } }` → lança `ApiError` com esses valores.
- Não-`2xx` sem envelope válido → `ApiError(status, 'UNEXPECTED_RESPONSE', 'Erro inesperado. Tente novamente.')`.
- Falha de rede (`fetch` rejeita) → `ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor.')`.
- Mensagem para `500 INTERNAL_ERROR`: a do envelope (o back-end já a deixa genérica).

### 3.3 Sessão (`AuthProvider`)

- A sessão é a query `['auth', 'me']` (`GET /auth/me`) — **não** há cópia em `useState`/contexto. O contexto expõe apenas o resultado da query e as ações (`login`, `logout`).
- `401` em `/auth/me` não é erro: significa "deslogado" (`user = null`). `retry: false` para essa query.
- `login` → `POST /auth/login` → `setQueryData(['auth','me'], { user })`.
- `logout` → `POST /auth/logout` → `queryClient.clear()` → `/login`. O cache é limpo **mesmo se o logout falhar** (a rota é idempotente; o pior caso é o cookie expirar sozinho).
- **401 global:** qualquer outra query/mutation que receba `ApiError` com `status 401` (sessão expirou no meio do uso) limpa o cache e marca `['auth','me']` como deslogado; o guard redireciona para `/login` com o aviso "Sua sessão expirou. Entre novamente." Implementado nos `QueryCache`/`MutationCache` `onError` do `createQueryClient()`.
- Retry padrão: `0` para mutations; para queries, até 1 retentativa **somente** em `NETWORK_ERROR`/`5xx` (nunca em 4xx).

### 3.4 Query keys e invalidação

| Key | Endpoint | Invalidada por |
|---|---|---|
| `['auth','me']` | `GET /auth/me` | login (set), logout (clear), `PATCH /users/me` (set) |
| `['users','team']` | `GET /users/team` | — |
| `['users', id]` | `GET /users/:id` | — |
| `['goals', { userId? }]` | `GET /pd-goals[?userId]` | criar/editar/excluir meta (prefixo `['goals']`) |
| `['evaluations', { userId?, cycle? }]` | `GET /evaluations[...]` | abrir/editar avaliação (prefixo `['evaluations']`) |

Depois de um PATCH bem-sucedido, o item retornado também é aplicado com `setQueryData` nas listas abertas, para a tela refletir o **estado calculado pelo servidor** (ex.: `progress: 100` → `CONCLUIDA`) sem esperar o refetch.

---

## 4. Design System

### 4.1 Identidade visual

- **Estilo:** limpo, minimalista, muito espaço em branco, hierarquia por tipografia e peso, não por cor.
- **Paleta neutra** (Tailwind `zinc`): fundo `zinc-50`, superfícies `white` com borda `zinc-200`, texto `zinc-900` (principal) e `zinc-600` (secundário). Ação primária: botão `zinc-900` com texto branco.
- **Cores semânticas**, usadas só em badges, barras e banners:

| Uso | Cor |
|---|---|
| `NAO_INICIADA` | `zinc` (neutro) |
| `EM_ANDAMENTO` | `blue` |
| `CONCLUIDA` (meta e avaliação) | `emerald` |
| `CANCELADA` | `zinc` com texto riscado no título |
| Atrasada / erro | `red` |
| Aguardando outra parte | `amber` |

- **Contraste:** texto e componentes interativos atendem WCAG AA (≥ 4,5:1 para texto normal). Status nunca é comunicado **só** por cor: sempre há rótulo textual.
- **Tipografia:** pilha de fonte do sistema (`ui-sans-serif, system-ui, …`), sem dependência externa. Escala: `text-2xl` títulos de página, `text-lg` títulos de card, `text-sm` metadados.
- **Foco visível:** `focus-visible:ring-2 ring-zinc-900 ring-offset-2` em todo elemento interativo.
- **Ícones:** Lucide, sempre com `aria-hidden` quando decorativos ou com rótulo acessível quando são o único conteúdo do botão.

### 4.2 Responsividade (mobile-first)

- `< md` (768px): navegação em menu recolhível (botão com `aria-expanded`); listas em cartões empilhados; diálogos em tela cheia.
- `≥ md`: navegação horizontal no cabeçalho; grids de 2–3 colunas no dashboard.
- Largura máxima do conteúdo: `max-w-6xl` centralizado.

### 4.3 Componentes de estado (padrão em toda tela)

| Componente | Comportamento |
|---|---|
| `LoadingState` | `role="status"` com texto acessível "Carregando…" (spinner + texto visualmente oculto). |
| `EmptyState` | Ícone, título, descrição e ação opcional (ex.: "Criar meta"). |
| `ErrorBanner` | `role="alert"`; mostra `ApiError.message`; botão "Tentar novamente" quando recebe `onRetry`. |
| Erro por campo (`Field`) | Mensagem abaixo do input, ligada por `aria-describedby`, com `aria-invalid="true"` no input. |

**Mapeamento do envelope de erro em formulários** (`lib/form-errors.ts`):
- `VALIDATION_ERROR`: cada `details[]` cujo `field` existe no formulário vira erro do campo; os demais (ex.: `field: "body"`) vão para o `ErrorBanner` do formulário.
- Qualquer outro `code` (`403`, `404`, `409`, `500`, rede): `ErrorBanner` com a `message` da API.

### 4.4 Rótulos (pt-BR)

| Enum | Rótulo |
|---|---|
| `COLABORADOR` / `GESTOR` | Colaborador / Gestor |
| `NAO_INICIADA` / `EM_ANDAMENTO` / `CONCLUIDA` / `CANCELADA` | Não iniciada / Em andamento / Concluída / Cancelada |
| `TECNICA` / `COMPORTAMENTAL` / `CARREIRA` | Técnica / Comportamental / Carreira |
| Avaliação `ABERTA` / `CONCLUIDA` | Em andamento / Concluída |
| Ciclo `2026-S2` | 2º semestre de 2026 |

### 4.5 Datas

- `targetDate` (`AAAA-MM-DD`) é **data pura**: formatada por manipulação de string (`31/03/2027`), **nunca** via `new Date('2027-03-31')`, que é meia-noite UTC e viraria 30/03 no fuso de Brasília.
- Timestamps ISO (`createdAt`, `*SubmittedAt`, `managerFeedbackAt`) são exibidos no fuso local com `Intl.DateTimeFormat('pt-BR')` (ADR-06: conversão só na apresentação).
- `todayUtc()` (`AAAA-MM-DD`) é o `min` do seletor de prazo (spec 03 §2.6).
- **Atrasada:** `targetDate < todayUtc()` **e** status não terminal.
- `currentCycle(now)`: jan–jun → `AAAA-S1`; jul–dez → `AAAA-S2` (UTC). `cycleOptions(now)`: ciclo anterior, atual e próximo, com o atual pré-selecionado.

---

## 5. Rotas e Guards

| Rota | Acesso | Conteúdo |
|---|---|---|
| `/login` | `PublicOnly` | Formulário de login |
| `/register` | `PublicOnly` | Formulário de cadastro |
| `/` | — | Redireciona para `/dashboard` |
| `/dashboard` | `RequireAuth` | Dashboard por papel (§6.2) |
| `/goals` | `RequireAuth` | Minhas metas de PDI (§6.4) |
| `/evaluations` | `RequireAuth` | Avaliações (§6.5) |
| `/team/:userId` | `RequireAuth` + `RequireRole('GESTOR')` | Acompanhamento de um liderado: perfil, metas e avaliações (§6.3) |
| `*` | — | Página "Página não encontrada" com link para o dashboard |

- **`RequireAuth`:** enquanto `/auth/me` carrega → `LoadingState` de página inteira (nenhum conteúdo protegido aparece). Deslogado → `<Navigate to="/login" state={{ from }} replace>`.
- **`PublicOnly`:** logado → `<Navigate to="/dashboard" replace>`.
- **`RequireRole('GESTOR')`:** COLABORADOR → `<Navigate to="/dashboard" replace>`. É conveniência de UX; a proteção real é o `403`/`404` da API.
- Após o login, o usuário volta para `from` (se for uma rota protegida) ou para `/dashboard`.
- **Layout (`AppShell`)** nas rotas protegidas: logo "OnePulse", links Dashboard · Metas · Avaliações (link ativo com `aria-current="page"`), nome + badge de papel do usuário e botão "Sair".

---

## 6. Telas e Fluxos

### 6.1 Login e Cadastro

**Login:** e-mail, senha, botão "Entrar", link "Criar conta". Validação no cliente: campos obrigatórios e formato básico de e-mail. `INVALID_CREDENTIALS` → `ErrorBanner` com a mensagem da API ("E-mail ou senha inválidos."), e o campo de senha é limpo.

**Cadastro:** nome, e-mail, senha (com dica da política: "8 a 72 caracteres, com ao menos uma letra e um número"), botão "Criar conta", link "Já tenho conta". Validação no cliente espelha a spec 01 §3.1 (nome 2–120, e-mail, política de senha), com as **mesmas mensagens** da API. Sucesso → login automático com as mesmas credenciais → `/dashboard` (veja Q-01). `409 EMAIL_ALREADY_IN_USE` → erro no campo e-mail.

Em ambos: botão desabilitado com texto de progresso ("Entrando…", "Criando conta…") durante a requisição, impedindo envio duplo.

### 6.2 Dashboard

**Comum aos dois papéis — Meu perfil (`ProfileCard`):** mostra nome, e-mail, cargo e papel. "Editar" abre formulário inline com nome e cargo. O `PATCH /users/me` envia **só os campos alterados**; cargo apagado vira `jobTitle: null` (spec 02 D-07). Sem alterações, "Salvar" fica desabilitado. Sucesso atualiza `['auth','me']` (o nome no cabeçalho muda na hora).

**Comum — Minhas metas (resumo):** contagem por status e até 5 metas **ativas** (`NAO_INICIADA`, `EM_ANDAMENTO`), na ordem da API (prazo mais próximo primeiro), com barra de progresso e badge "Atrasada". Link "Ver todas" → `/goals`. Sem metas → `EmptyState` com ação "Criar primeira meta" (→ `/goals?new=1`, que abre o diálogo de criação).

**COLABORADOR — Minhas avaliações (resumo):** cada avaliação com ciclo e o estado visual da §6.5.1. Sem avaliações → "Nenhuma avaliação aberta. O ciclo é aberto pelo seu gestor."

**GESTOR — Minha equipe:** `GET /users/team` em cartões (nome, cargo, e-mail) com link para `/team/:userId`. Cada liderado mostra o badge "Avaliação pendente" quando existe avaliação `ABERTA` dele em que a parte do gestor ainda não foi enviada (cruzando com `GET /evaluations`, uma única chamada). Equipe vazia → "Você ainda não tem liderados diretos." O dashboard do gestor **não** carrega as metas de cada liderado (evita N requisições; veja Q-05).

### 6.3 Acompanhamento do liderado (`/team/:userId`, só GESTOR)

Três blocos, carregados em paralelo: perfil (`GET /users/:id`), metas (`GET /pd-goals?userId=`) e avaliações (`GET /evaluations?userId=`).

- `404` em qualquer um → página "Colaborador não encontrado" com link para o dashboard (mesmo comportamento para id inexistente ou fora da equipe — RBAC-03).
- `:userId` mal formado (não casa `^[1-9]\d{0,9}$`) → mesma página, **sem** chamar a API.
- **Metas:** mesma lista da §6.4 em modo **gestor**: sem controles de conteúdo, progresso, status ou exclusão; cada meta tem o formulário de parecer (§6.4.4). Botão "Nova meta para <nome>" cria com `userId`.
- **Avaliações:** lista com estado visual; botão "Abrir avaliação" já com o liderado pré-selecionado (§6.5.3).

### 6.4 Metas de PDI (`/goals`)

#### 6.4.1 Listagem e filtros
- `GET /pd-goals` (próprias metas). Cada `GoalCard`: título, categoria, badge de status, barra de progresso com `%`, prazo formatado, badge "Atrasada", descrição (se houver) e parecer do gestor (se houver).
- **Filtro por status** (Todas · Não iniciada · Em andamento · Concluída · Cancelada) aplicado **no cliente** — a API não aceita filtro (`?status` → 400, spec 03 GOAL-14). O filtro fica na URL (`/goals?status=EM_ANDAMENTO`) para ser compartilhável e sobreviver ao refresh; valor desconhecido na URL = "Todas".
- Sem metas → `EmptyState` com "Criar meta". Filtro sem resultados → "Nenhuma meta com este status." (mensagem diferente, sem a ação de criar).

#### 6.4.2 Criar / editar conteúdo (`GoalFormDialog`)
- Campos: título (3–150), descrição (opcional, até 2000; vazio → `null`), categoria (select), prazo (`<input type="date" min={todayUtc()}>`).
- Criar: `POST /pd-goals` (com `userId` quando o gestor cria para o liderado). Editar (só dono, só meta não terminal): `PATCH` com os campos alterados.
- Sucesso → fecha o diálogo, lista atualizada. `400` → erros por campo (inclui "Prazo não pode estar no passado.").

#### 6.4.3 Progresso e status (só dono, só meta não terminal) — `GoalProgressForm`
- Controle de progresso (`input type="range"` + número, 0–100) e select de status com **apenas transições válidas** (spec 03 §2.4): de `NAO_INICIADA` → todos; de `EM_ANDAMENTO` → `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA` (nunca `NAO_INICIADA`).
- O payload nunca combina `status` e `progress` de forma contraditória (spec 03 §2.5): ao escolher `CONCLUIDA`/`CANCELADA` o envio tem só `status`; ao mexer só no progresso, só `progress`.
- Dicas: "Ao chegar a 100%, a meta será concluída." · "Concluir ou cancelar é definitivo." — `CONCLUIDA` e `CANCELADA` pedem confirmação (`ConfirmDialog`).
- A tela mostra o estado **devolvido pela API** (ex.: `{ progress: 30 }` em `NAO_INICIADA` aparece como "Em andamento").
- Meta terminal: somente leitura (nenhum controle de edição, progresso, status ou exclusão).

#### 6.4.4 Parecer do gestor — `ManagerFeedbackForm`
- **Gestor (na `/team/:userId`):** textarea (1–2000) com "Salvar parecer"; se já existe parecer, "Editar" e "Remover" (envia `managerFeedback: null`, com confirmação). Disponível inclusive em metas terminais (spec 03 D-05).
- **Dono:** vê o parecer somente leitura, com a data (`managerFeedbackAt`). Nenhum formulário de parecer.

#### 6.4.5 Exclusão
- Botão "Excluir" **só** para o dono e **só** em `NAO_INICIADA`; pede confirmação. `204` → some da lista.
- `409 GOAL_NOT_DELETABLE` (corrida) → `ErrorBanner` com a mensagem da API e a lista é recarregada.

#### 6.4.6 Conflitos
- `409 GOAL_LOCKED` / `INVALID_STATUS_TRANSITION` / `403` → `ErrorBanner` com a mensagem da API e refetch da lista (a tela estava desatualizada).

### 6.5 Avaliações de Desempenho (`/evaluations`)

#### 6.5.1 Estado visual (`getEvaluationViewState`, função pura)

O papel do viewer é derivado no cliente: `evaluation.userId === me.id` → avaliado; `evaluation.managerId === me.id` → avaliador.

| Papel | `status` | Self enviada | Gestor enviou | Rótulo | Tom | Ação disponível |
|---|---|---|---|---|---|---|
| Avaliado | `ABERTA` | não | não | Autoavaliação pendente | amber | Preencher autoavaliação |
| Avaliado | `ABERTA` | não | sim | Autoavaliação pendente · gestor já enviou | amber | Preencher autoavaliação |
| Avaliado | `ABERTA` | sim | não | Aguardando gestor | amber | — |
| Avaliador | `ABERTA` | — | não | Sua avaliação pendente | amber | Avaliar |
| Avaliador | `ABERTA` | não | sim | Aguardando autoavaliação | amber | — |
| Ambos | `CONCLUIDA` | sim | sim | Concluída · notas reveladas | emerald | Ver resultado |

> Os campos ocultos pela API chegam como `null` (spec 04 §2.5). A UI **nunca** exibe esse `null` como "0", "—" ou campo vazio editável: decide a mensagem pelo `status`/`*SubmittedAt` ("Será revelada quando a avaliação for concluída." / "A autoavaliação ainda não foi enviada.").

#### 6.5.2 Telas por papel
- **COLABORADOR:** lista das próprias avaliações (`GET /evaluations`, ordem da API: ciclo mais recente primeiro).
- **GESTOR:** duas seções — "Avaliações da equipe" (`GET /evaluations`, nomes resolvidos via `['users','team']`) e "Minhas avaliações" (`GET /evaluations?userId=<me>`, como avaliado). Na seção própria, o avaliador aparece como "Seu gestor" (a API não expõe o perfil do gestor).
- Vazios: colaborador → "Nenhuma avaliação aberta. O ciclo é aberto pelo seu gestor."; equipe → "Nenhuma avaliação aberta para a equipe." com ação "Abrir avaliação".

#### 6.5.3 Abrir avaliação (GESTOR) — `OpenEvaluationDialog`
- Select de liderado (da `['users','team']`) e select de ciclo (`cycleOptions`, atual pré-selecionado). `POST /evaluations`.
- `409 EVALUATION_ALREADY_EXISTS` → `ErrorBanner` com a mensagem da API. Sucesso → fecha e a avaliação aparece na lista.
- Equipe vazia → botão "Abrir avaliação" desabilitado com explicação.

#### 6.5.4 Preencher a própria parte
- **Autoavaliação (avaliado):** `ScoreInput` (nota 1–5, `radiogroup` com `fieldset`/`legend` "Nota") e comentários (opcional, até 2000; vazio → `null`).
- **Avaliação do gestor (avaliador):** `ScoreInput` + feedback (obrigatório para enviar, até 2000).
- Botões: "Salvar rascunho" (`PATCH` sem `submit`) e "Enviar" (`PATCH` com os campos + `submit: true`, após `ConfirmDialog`: "Depois de enviada, sua parte não poderá ser alterada.").
- Validação do cliente para "Enviar": sem nota → "Informe a nota antes de enviar."; gestor sem feedback → "Informe o feedback antes de enviar." (mesmas mensagens da spec 04 EVR-03). "Salvar rascunho" não exige nada.
- Parte enviada → somente leitura, com a data de envio.
- O avaliador vê a autoavaliação **somente** se `selfSubmittedAt` estiver preenchido; antes disso, "A autoavaliação ainda não foi enviada."
- O avaliado, com `ABERTA`, vê no lugar da parte do gestor: "Enviada em <data>. Será revelada quando a avaliação for concluída." ou "O gestor ainda não enviou."
- `CONCLUIDA` → as duas partes lado a lado (empilhadas no mobile), somente leitura.
- `409 EVALUATION_LOCKED` / `403` → `ErrorBanner` com a mensagem da API e refetch.

### 6.6 Textos e estrutura acessível fixados pelos testes (v1.0.1)

Os testes consultam a tela como o usuário (papel + nome acessível), então estes textos fazem parte do contrato da UI:

| Tipo | Textos |
|---|---|
| Título `h1` | `Entrar` (login) · `Criar conta` (cadastro) · `Dashboard` · `Metas de PDI` · `Avaliações de desempenho` · nome do liderado (`/team/:userId`) · `Página não encontrada` · `Colaborador não encontrado` |
| Regiões (`<section aria-labelledby>`) | `Meu perfil` · `Minhas metas` · `Minhas avaliações` · `Minha equipe` · `Avaliações da equipe` · em `/team/:userId`: `Metas` e `Avaliações` |
| Labels | `Nome` · `E-mail` · `Senha` · `Cargo` · `Título` · `Descrição` · `Categoria` · `Prazo` · `Progresso (%)` · `Status` · `Filtrar por status` · `Parecer do gestor` · `Colaborador` · `Ciclo` · `Nota` (legend do `radiogroup`, opções `1`–`5`) · `Comentários` · `Feedback` |
| Botões | `Entrar`/`Entrando…` · `Criar conta`/`Criando conta…` · `Sair` · `Menu` · `Editar perfil` · `Salvar` · `Nova meta` · `Criar meta` (ação do estado vazio) · `Nova meta para <nome>` · `Editar` · `Excluir` · `Salvar progresso` · `Salvar parecer` · `Remover parecer` · `Confirmar` · `Tentar novamente` · `Abrir avaliação` · `Preencher autoavaliação` · `Avaliar` · `Salvar rascunho` · `Enviar` |
| Links | `Criar conta` · `Já tenho conta` · `Dashboard` · `Metas` · `Avaliações` · `Ver todas` · `Criar primeira meta` · `Voltar ao dashboard` |
| Mensagens | `Você ainda não tem metas de PDI.` · `Nenhuma meta com este status.` · `Cargo não informado` · `Atrasada` · `Avaliação pendente` · `Seu gestor` · `Nota do gestor` · notas exibidas como `N de 5` |

- Cada meta e cada avaliação é um `<article>` cujo nome acessível é o título (meta) ou o ciclo (`2º semestre de 2026`); na equipe, `<nome> · <ciclo>`.
- O resumo de metas do dashboard usa `<dl>` (status em `<dt>`, contagem em `<dd>`) e a lista `aria-label="Metas ativas"`; o progresso é um `progressbar` com `aria-valuenow`.
- Na avaliação, o botão de ação (`Preencher autoavaliação`/`Avaliar`) expande o formulário dentro do próprio card; o card continua expandido após o envio (é onde a revelação aparece, UI-57).
- Uma única `<nav>`: o botão `Menu` (com `aria-expanded`) só muda a visibilidade dela no mobile.

---

## 7. Critérios de Aceite

> Convenção: `it('[UI-07] ...')`. **C** = teste de componente/página (Testing Library + MSW, renderizado com `QueryClient` novo por teste e `MemoryRouter`); **U** = unitário de função pura.
> Notação: **C1** = colaborador logado; **G** = gestor logado com liderados **L1** e **L2**. "API responde X" = handler MSW do teste.

### 7.1 Cliente HTTP e utilitários

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-01** | `apiRequest` com e sem corpo | Chama a URL `<base><path>` com `credentials: 'include'`; com corpo, envia `Content-Type: application/json` e o JSON serializado. | U |
| **UI-02** | API responde `200` com JSON; `204` sem corpo | Devolve o corpo; devolve `undefined`. | U |
| **UI-03** | API responde `400` com envelope `VALIDATION_ERROR` + `details`; `409` com envelope sem `details` | Lança `ApiError` com `status`, `code`, `message` e `details` (ou `[]`). | U |
| **UI-04** | API responde `502` com HTML; `fetch` rejeita (rede) | `ApiError` `UNEXPECTED_RESPONSE` com mensagem genérica; `ApiError(0, 'NETWORK_ERROR')`. | U |
| **UI-05** | `formatDate('2027-03-31')` com `TZ=America/Sao_Paulo`; `todayUtc` com relógio fixo às 23h de Brasília; `isOverdue` (passado/hoje/futuro × terminal/não terminal) | `31/03/2027`; a data UTC (dia seguinte); atrasada só se passado **e** não terminal. | U (`it.each`) |
| **UI-06** | `currentCycle` em 30/06 e 01/07 (UTC); `cycleOptions` em `2026-S1` | `2026-S1` / `2026-S2`; `[2025-S2, 2026-S1, 2026-S2]` com o atual marcado. | U |
| **UI-07** | `labels` para todos os valores de enum; `formErrors(details, campos)` | Rótulos exatos da §4.4; campos conhecidos mapeados, `body`/desconhecidos separados para o banner. | U (`it.each`) |

### 7.2 Sessão e rotas

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-08** | Acesso a `/dashboard` enquanto `/auth/me` não responde | `LoadingState` (`role="status"`) e nenhum conteúdo protegido renderizado. | C |
| **UI-09** | `/auth/me` responde `401`; acesso a `/goals` | Redireciona para `/login`; após login bem-sucedido, volta para `/goals`. | C |
| **UI-10** | Usuário logado acessa `/login` e `/register` | Redireciona para `/dashboard`. | C (`it.each`) |
| **UI-11** | Acesso a `/` logado; acesso a `/rota-inexistente` | `/dashboard`; página "Página não encontrada" com link para o dashboard. | C |
| **UI-12** | C1 acessa `/team/2` | Redireciona para `/dashboard`, sem chamar `/users/2`. | C |
| **UI-13** | Logado em `/goals`, a query de metas recebe `401` (sessão expirou) | Cache limpo; redireciona para `/login` exibindo "Sua sessão expirou. Entre novamente." | C |
| **UI-14** | Clique em "Sair" (API `204`); e com a API falhando | `POST /auth/logout` chamado; nos dois casos o usuário vai para `/login` e uma rota protegida acessada em seguida não mostra dados antigos. | C |
| **UI-15** | `AppShell` com C1 e com G em `/goals` | Mostra nome e badge do papel; link "Metas" com `aria-current="page"`; no mobile, o menu abre/fecha via botão com `aria-expanded`. | C |

### 7.3 Login e cadastro

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-16** | Login com credenciais válidas | `POST /auth/login` com `{ email, password }`; navega para `/dashboard` mostrando o nome do usuário. | C |
| **UI-17** | API responde `401 INVALID_CREDENTIALS` | `role="alert"` com "E-mail ou senha inválidos."; senha limpa; e-mail preservado. | C |
| **UI-18** | Envio com campos vazios / e-mail mal formado (login e cadastro) | Mensagens por campo (`aria-invalid`, `aria-describedby`) e **nenhuma** requisição. | C (`it.each`) |
| **UI-19** | API responde `400 VALIDATION_ERROR` com `details` para `email` e `password` | Cada mensagem aparece no campo correspondente. | C |
| **UI-20** | Requisição de login/cadastro pendente | Botão desabilitado com "Entrando…"/"Criando conta…"; um segundo clique não gera outra requisição. | C |
| **UI-21** | Cadastro com senha fora da política (`abc1234`, `abcdefgh`, `12345678`) | Mensagem da spec 01 §3.1 no campo senha; nenhuma requisição. | C (`it.each`) |
| **UI-22** | Cadastro válido (API `201`) e login automático (`200`) | `POST /auth/register` e depois `POST /auth/login` com as mesmas credenciais; navega para `/dashboard`. Se o login automático falhar, vai para `/login` com "Conta criada. Entre para continuar." | C |
| **UI-23** | Cadastro com API `409 EMAIL_ALREADY_IN_USE` | Mensagem da API no campo e-mail. | C |
| **UI-24** | Links "Criar conta" / "Já tenho conta" | Navegam entre `/login` e `/register`. | C |

### 7.4 Dashboard e perfil

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-25** | C1 com metas em vários status (uma atrasada) | Contagem por status; até 5 metas ativas com barra de progresso; badge "Atrasada" na vencida; seção "Minha equipe" **ausente** e `/users/team` **não** é chamado. | C |
| **UI-26** | C1 sem metas e sem avaliações | `EmptyState` com "Criar primeira meta" (→ `/goals?new=1`) e a mensagem "O ciclo é aberto pelo seu gestor." | C |
| **UI-27** | C1 com avaliações em estados diferentes | Cada uma com o rótulo da §6.5.1. | C |
| **UI-28** | G com L1 (avaliação `ABERTA` com a parte do gestor pendente) e L2 (sem pendência) | Cartões de L1 e L2 com link para `/team/:id`; badge "Avaliação pendente" só em L1. | C |
| **UI-29** | G sem liderados; `/users/team` responde `500` | "Você ainda não tem liderados diretos."; `ErrorBanner` com "Tentar novamente" que refaz a requisição e mostra a equipe. | C |
| **UI-30** | Editar perfil: altera só o cargo; depois apaga o cargo | `PATCH /users/me` com `{ jobTitle: "..." }`; depois `{ jobTitle: null }`; o card reflete a resposta. | C |
| **UI-31** | Editar perfil alterando o nome | Corpo `{ name }`; o nome no cabeçalho muda sem recarregar a página. | C |
| **UI-32** | Formulário de perfil sem alterações; API responde `400` com `details` de `name` | "Salvar" desabilitado; erro exibido no campo nome. | C |

### 7.5 Acompanhamento do liderado

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-33** | G abre `/team/<L1>` | Mostra perfil, metas e avaliações de L1 (`GET /users/:id`, `/pd-goals?userId=`, `/evaluations?userId=`). | C |
| **UI-34** | API responde `404` para o usuário; `:userId` = `abc` | "Colaborador não encontrado" com link para o dashboard; no segundo caso, nenhuma requisição. | C (`it.each`) |

### 7.6 Metas de PDI

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-35** | C1 em `/goals` com metas | Cada meta mostra título, categoria e status em pt-BR, `%` de progresso, prazo `dd/mm/aaaa` e parecer do gestor (com data) quando houver. | C |
| **UI-36** | Seleciona o filtro "Em andamento"; abre `/goals?status=CONCLUIDA`; abre `/goals?status=XYZ` | Só as metas do status (sem nova requisição) e a URL atualizada; filtro aplicado a partir da URL; "Todas". | C |
| **UI-37** | Sem metas; filtro sem resultado | `EmptyState` com "Criar meta"; "Nenhuma meta com este status." sem ação de criar. | C |
| **UI-38** | Cria meta válida | `POST /pd-goals` com `{ title, category, targetDate }` (`description` vazia → `null` / omitida); diálogo fecha; a meta aparece na lista. O input de prazo tem `min` = hoje UTC. | C |
| **UI-39** | API responde `400` com `details` de `title` e `targetDate` | Erros nos campos; diálogo continua aberto com os valores preservados. | C |
| **UI-40** | G cria meta em `/team/<L1>` | Corpo inclui `userId: L1`. | C |
| **UI-41** | Dono altera o progresso para 30 em meta `NAO_INICIADA` | `PATCH` com `{ progress: 30 }`; o card passa a "Em andamento" e 30% (estado devolvido pela API). | C |
| **UI-42** | Select de status em meta `EM_ANDAMENTO` | Não oferece "Não iniciada". Escolher "Concluída" pede confirmação e envia `{ status: "CONCLUIDA" }` (sem `progress`). | C |
| **UI-43** | Meta `CONCLUIDA` ou `CANCELADA` do dono | Sem controles de edição, progresso, status ou exclusão. | C (`it.each`) |
| **UI-44** | Dono edita título de meta não terminal | `PATCH` só com os campos alterados; card atualizado. | C |
| **UI-45** | "Excluir" | Visível só em `NAO_INICIADA`. Confirmação → `DELETE` → meta some. Com API `409 GOAL_NOT_DELETABLE` → `role="alert"` com a mensagem da API e a lista é recarregada. | C |
| **UI-46** | G vê metas de L1 em `/team/<L1>` | Sem controles de conteúdo, progresso, status ou exclusão; formulário de parecer presente, inclusive em meta `CONCLUIDA`. | C |
| **UI-47** | G salva, edita e remove o parecer | `PATCH { managerFeedback: "..." }`; depois `{ managerFeedback: null }` após confirmação; parecer vazio/só espaços → erro no campo, sem requisição. | C |
| **UI-48** | Dono vê meta com parecer | Parecer somente leitura com data; nenhum formulário de parecer. | C |
| **UI-49** | PATCH responde `409 GOAL_LOCKED` | `role="alert"` com a mensagem da API e refetch da lista. | C |

### 7.7 Avaliações

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-50** | `getEvaluationViewState` com a matriz completa da §6.5.1 | Rótulo, tom e ação exatos de cada linha. | U (`it.each`) |
| **UI-51** | C1 em `/evaluations` com avaliações; sem avaliações | Lista com ciclo ("2º semestre de 2026") e estado visual; vazio: "Nenhuma avaliação aberta. O ciclo é aberto pelo seu gestor." Sem botão "Abrir avaliação". | C |
| **UI-52** | G em `/evaluations` | Seções "Avaliações da equipe" (com nomes dos liderados) e "Minhas avaliações"; botão "Abrir avaliação". | C |
| **UI-53** | G abre avaliação para L1 no ciclo atual | `POST /evaluations` com `{ userId: L1, cycle: currentCycle }`; a avaliação aparece na lista. Com `409 EVALUATION_ALREADY_EXISTS` → mensagem da API no diálogo. | C |
| **UI-54** | C1 salva rascunho da autoavaliação (nota 4, comentário) | `PATCH { selfScore: 4, selfComments: "..." }` sem `submit`; continua editável. | C |
| **UI-55** | C1 clica "Enviar" sem nota; depois com nota e confirma | Sem nota: "Informe a nota antes de enviar." e nenhuma requisição. Com nota: `PATCH` com `submit: true`; a parte fica somente leitura e o estado vira "Aguardando gestor". | C |
| **UI-56** | Avaliação `ABERTA` com o gestor já enviado (campos do gestor `null`), vista por C1 | Mostra "Será revelada quando a avaliação for concluída."; **não** renderiza nota/feedback do gestor (nem "0" nem vazio). | C |
| **UI-57** | C1 envia a autoavaliação e a API devolve `CONCLUIDA` com as notas do gestor | A tela passa a "Concluída · notas reveladas" e exibe as duas partes, somente leitura. | C |
| **UI-58** | G vê avaliação de L1 com a autoavaliação em rascunho (campos `null`) | "A autoavaliação ainda não foi enviada."; formulário do gestor com nota e feedback. | C |
| **UI-59** | G clica "Enviar" sem feedback | "Informe o feedback antes de enviar." e nenhuma requisição. Com nota e feedback: `PATCH` com `submit: true`. | C |
| **UI-60** | G em "Minhas avaliações" (G avaliado) | Formulário de **autoavaliação** (não o de gestor) e o avaliador rotulado "Seu gestor". | C |
| **UI-61** | PATCH responde `409 EVALUATION_LOCKED` | `role="alert"` com a mensagem da API e refetch. | C |

### 7.8 Transversais

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **UI-62** | Qualquer lista (metas, equipe, avaliações) enquanto carrega; com `500`; com rede indisponível | `LoadingState`; `ErrorBanner` com a mensagem da API e "Tentar novamente"; "Não foi possível conectar ao servidor." | C (`it.each`) |
| **UI-63** | Todo formulário das telas acima | Todo campo é encontrável por `getByLabelText`; diálogos têm `role="dialog"` com nome acessível, recebem o foco ao abrir, fecham com `Esc` e devolvem o foco ao botão de origem. | C |

---

## 8. Decisões desta Spec

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D-01 | Sessão = query `['auth','me']` | Usuário em `useState`/contexto | Regra do CLAUDE.md (estado de servidor só no TanStack Query); evita duas fontes da verdade dessincronizadas. |
| D-02 | Proxy do Vite em dev | Chamar `localhost:3333` direto via CORS | Mesma origem: o cookie `SameSite=Lax` funciona sem configuração extra, e o código do front é igual em dev e produção (atrás de reverse proxy). |
| D-03 | MSW para mockar a API nos testes | `vi.mock` dos módulos `api.ts` | Testa o caminho real (`fetch` → `http.ts` → hooks → tela), incluindo `credentials`, envelope de erro e 204; os handlers documentam o contrato. Mais próximo da regra "sem mocks que escondam o comportamento real". |
| D-04 | Validação no cliente só para guiar a UX, com as mesmas mensagens da API | Sem validação no cliente; ou replicar todos os schemas Zod | Feedback imediato nos erros óbvios sem criar uma segunda fonte da verdade; a API continua decidindo (os `details[]` sempre são exibidos). |
| D-05 | Filtro de status no cliente, com estado na URL | Pedir `?status` no back-end | A API atual rejeita `?status` e as listas são pequenas no MVP; a URL mantém o filtro no refresh. |
| D-06 | Página dedicada `/team/:userId` (só GESTOR) | `?userId=` em `/goals` e `/evaluations` | Separa "minhas coisas" de "coisas do liderado", com permissões de UI diferentes, e concentra o contexto do 1:1 numa tela. |
| D-07 | Dashboard do gestor sem metas dos liderados | Carregar `GET /pd-goals?userId=` para cada liderado | Evita N requisições (não há endpoint agregado, spec 03 §1); as metas ficam em `/team/:userId`. |
| D-08 | Mostrar o estado devolvido pela API após cada mutation | Atualização otimista | As regras derivadas (PRG-02/03, conclusão da avaliação, revelação) são do servidor; prever no cliente duplicaria a lógica. |
| D-09 | `targetDate` formatado por string | `new Date(targetDate)` | Evita o bug clássico de fuso (meia-noite UTC = dia anterior no Brasil). |
| D-10 | Fonte do sistema, sem modo escuro | Webfont (Inter) e tema escuro | Zero dependência e escopo enxuto no MVP; os tokens do Tailwind permitem evoluir depois. |

---

## 9. Decisões de Produto (resolvidas em 2026-11-24)

- **Q-01: Cadastro.** Login automático logo após o cadastro (UI-22); se o login automático falhar, `/login` com "Conta criada. Entre para continuar."
- **Q-02: Mock HTTP nos testes.** MSW (D-03), cobrindo o caminho completo até o `fetch`.
- **Q-03: Conexão em dev.** Proxy do Vite `/api` → `http://localhost:3333` (D-02), mantendo a mesma origem para o cookie.
- **Q-04: Rota do liderado.** Rota dedicada `/team/:userId`, só para GESTOR (D-06).
- **Q-05: Dashboard do gestor.** Equipe + badge "Avaliação pendente", sem resumo de metas por liderado (D-07, evita N+1 requisições).
- **Q-06: Ciclos ao abrir avaliação.** Semestre anterior, atual (selecionado por padrão) e próximo (`cycleOptions`, §4.5).

---

## 10. Plano de Testes (prévia para a etapa RED)

```
frontend/
├── vite.config.ts                         # proxy /api + config do Vitest (jsdom, setupFiles)
├── src/test/
│   ├── setup.ts                           # jest-dom, MSW server (listen/resetHandlers/close)
│   ├── server.ts                          # setupServer() + handlers padrão
│   ├── factories.ts                       # makeUser, makeGoal, makeEvaluation; usuários G, L1, L2, C1
│   ├── goals-store.ts                     # API de metas em memória (GET/POST/PATCH/DELETE)
│   └── render.tsx                         # renderApp({ route, me }), currentPath, freezeDate, cenários
├── src/services/http.test.ts              # UI-01..04
├── src/lib/dates.test.ts                  # UI-05, UI-06
├── src/lib/labels.test.ts                 # UI-07
├── src/lib/form-errors.test.ts            # UI-07
├── src/routes/routes.test.tsx             # UI-08..13
├── src/components/layout/AppShell.test.tsx           # UI-14, UI-15
├── src/features/auth/pages/LoginPage.test.tsx        # UI-16..20, UI-24
├── src/features/auth/pages/RegisterPage.test.tsx     # UI-18, UI-21..24
├── src/features/dashboard/pages/DashboardPage.test.tsx  # UI-25..29
├── src/features/profile/components/ProfileCard.test.tsx # UI-30..32
├── src/features/team/pages/TeamMemberPage.test.tsx   # UI-33, UI-34, UI-40, UI-46, UI-47
├── src/features/pdi/pages/GoalsPage.test.tsx         # UI-35..39, UI-41..45, UI-48, UI-49
├── src/features/evaluations/view-state.test.ts       # UI-50
├── src/features/evaluations/pages/EvaluationsPage.test.tsx  # UI-51..61
└── src/test/cross-cutting.test.tsx        # UI-62, UI-63
```
