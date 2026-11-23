# 01 — Autenticação (Auth)

| Campo | Valor |
|---|---|
| Status | ✅ Aprovada (v1.0.0) |
| Versão | 1.0.1 (correção: exemplo de senha com 7 caracteres no AUTH-05) |
| Data | 2026-11-22 |
| Depende de | [`00-architecture.spec.md`](00-architecture.spec.md) (tabela `users`, RBAC-01..04, ADR-03) |
| Branch | `feat/phase-1-auth` |

---

## 1. Objetivo

Permitir que uma pessoa **crie uma conta** (sempre como `COLABORADOR`), **entre** no sistema recebendo uma sessão segura via cookie `httpOnly`, **saia** e **consulte quem está logado**. Esta fase também entrega o **middleware de autenticação**, base de todas as rotas protegidas das próximas fases.

**Fora do escopo desta fase:** refresh token, "esqueci minha senha", verificação de e-mail, rate limiting de login e revogação de sessão no servidor (veja a seção 8).

---

## 2. Regras Gerais

### 2.1 Sessão (JWT em cookie)

| Item | Valor |
|---|---|
| Nome do cookie | `onepulse_token` |
| Atributos | `HttpOnly; SameSite=Lax; Path=/`, mais `Secure` quando `NODE_ENV=production` |
| Duração | 8 horas (`Max-Age=28800`), igual à expiração do JWT |
| Algoritmo | HS256, segredo em `JWT_SECRET` |
| Payload | `{ sub: "<userId>", role: "COLABORADOR" \| "GESTOR", iat, exp }` |
| Origem do token | **Somente** o cookie. O header `Authorization` é ignorado. |

> O payload carrega só identificadores: nada de e-mail, nome ou dados sensíveis. O JWT é **assinado, não criptografado**, e qualquer pessoa pode decodificá-lo em base64.

### 2.2 Senhas

- Hash com **bcrypt**; custo definido em `BCRYPT_ROUNDS` (padrão `12`, e `4` no ambiente de teste por velocidade).
- **Máximo de 72 caracteres:** o bcrypt ignora silenciosamente o que passa de 72 bytes. Sem esse limite, `"senha…(72 chars)A"` e `"senha…(72 chars)B"` seriam a mesma senha.
- A senha em texto puro nunca é logada nem persistida.

### 2.3 Representação pública do usuário (`UserDTO`)

Toda resposta que retorna um usuário usa **exatamente** este formato:

```json
{
  "id": 1,
  "name": "Ana Souza",
  "email": "ana@onepulse.dev",
  "role": "COLABORADOR",
  "managerId": null,
  "jobTitle": null,
  "createdAt": "2026-11-22T12:00:00.000Z"
}
```

`password_hash` / `passwordHash` / `isActive` **nunca** aparecem em nenhuma resposta.

### 2.4 Envelope de erro (padrão do `CLAUDE.md`)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos.", "details": [ { "field": "email", "message": "E-mail inválido." } ] } }
```

`details` existe apenas em `VALIDATION_ERROR`.

### 2.5 Catálogo de códigos de erro

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | O corpo viola o schema Zod (inclui campos desconhecidos). |
| 400 | `INVALID_JSON` | O corpo não é JSON válido. |
| 401 | `INVALID_CREDENTIALS` | Login com e-mail inexistente, senha errada ou usuário inativo. Mensagem única: *"E-mail ou senha inválidos."* |
| 401 | `UNAUTHENTICATED` | Rota protegida sem sessão válida (cookie ausente, inválido ou expirado, ou usuário inexistente/inativo). |
| 409 | `EMAIL_ALREADY_IN_USE` | Cadastro com e-mail já existente. |
| 500 | `INTERNAL_ERROR` | Erro inesperado. Nunca expõe stack trace. |

---

## 3. Schemas de Validação (Zod)

Todos os schemas usam **`.strict()`**: campos não previstos geram `400`. Isso bloqueia *mass assignment*, como alguém enviar `"role": "GESTOR"` no cadastro.

### 3.1 `registerSchema`

| Campo | Regras | Mensagem de erro |
|---|---|---|
| `name` | string · `trim()` · 2 a 120 caracteres | "Nome deve ter entre 2 e 120 caracteres." |
| `email` | string · `trim()` · `toLowerCase()` · formato de e-mail · máx. 255 | "E-mail inválido." |
| `password` | string · 8 a 72 caracteres · pelo menos 1 letra e 1 número · **sem** `trim()` | "Senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número." |

### 3.2 `loginSchema`

| Campo | Regras | Observação |
|---|---|---|
| `email` | string · `trim()` · `toLowerCase()` · formato de e-mail | |
| `password` | string · mínimo 1 caractere · máx. 72 | A política de força **não** é aplicada no login. Ela vale só para criar senhas, e no login apenas daria pistas sobre a regra. |

### 3.3 Variáveis de ambiente (`envSchema`, validado no boot: *fail fast*)

| Variável | Regra |
|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | número, padrão `3333` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | obrigatórias |
| `JWT_SECRET` | obrigatória, **mínimo de 32 caracteres** |
| `JWT_EXPIRES_IN_SECONDS` | número, padrão `28800` |
| `BCRYPT_ROUNDS` | inteiro entre 4 e 15, padrão `12` |
| `CORS_ORIGIN` | URL do front-end (ex.: `http://localhost:5173`) |

Se faltar alguma variável ou uma delas for inválida, a aplicação **não sobe** e a mensagem de erro indica qual variável corrigir.

---

## 4. Contrato da API

Prefixo base: `/api/v1`. Todas as requisições e respostas usam `application/json`.

### 4.1 `POST /api/v1/auth/register`: público

**Request**
```json
{ "name": "Ana Souza", "email": "Ana@OnePulse.dev ", "password": "segura123" }
```
**Response `201 Created`**: `{ "user": UserDTO }`. **Não** define cookie: o cadastro não autentica.

### 4.2 `POST /api/v1/auth/login`: público

**Request**
```json
{ "email": "ana@onepulse.dev", "password": "segura123" }
```
**Response `200 OK`**: `{ "user": UserDTO }` mais o header:
```
Set-Cookie: onepulse_token=<jwt>; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax
```

### 4.3 `POST /api/v1/auth/logout`: público e idempotente

Sem corpo. **Response `204 No Content`**, com:
```
Set-Cookie: onepulse_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax
```

### 4.4 `GET /api/v1/auth/me`: protegido

**Response `200 OK`**: `{ "user": UserDTO }`, com dados lidos **do banco** a cada requisição, não do JWT. Se o nome ou o papel mudarem, a resposta já reflete a mudança.

---

## 5. Critérios de Aceite

> Cada ID vira pelo menos um teste: `it('[AUTH-07] ...')`. **I** = teste de integração (Supertest + MySQL de teste); **U** = teste unitário (service com repository fake).

### 5.1 Cadastro: `POST /auth/register`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **AUTH-01** | Dado um payload válido, quando cadastro | `201`, corpo `{ user }` no formato `UserDTO` com `role = "COLABORADOR"` e `managerId = null`; **sem** header `Set-Cookie`. | I |
| **AUTH-02** | Dado um cadastro bem-sucedido | No banco, `password_hash` é diferente da senha enviada, começa com `$2` (bcrypt) e `bcrypt.compare(senha, hash)` retorna `true`. | I |
| **AUTH-03** | Dado o e-mail `"  Ana@OnePulse.DEV "` | Ele é persistido e retornado como `"ana@onepulse.dev"`. | I |
| **AUTH-04** | Dado que `ana@onepulse.dev` já existe, quando cadastro `ANA@onepulse.dev` | `409 EMAIL_ALREADY_IN_USE`; nenhum novo registro criado. | I |
| **AUTH-05** | Dado um payload inválido (casos abaixo) | `400 VALIDATION_ERROR` com `details[]` apontando o(s) `field`(s) inválido(s); nenhum registro criado. | I + U (schema) |
| **AUTH-06** | Dado um payload válido com campo extra (`role: "GESTOR"`, `managerId`, `isActive`…) | `400 VALIDATION_ERROR`; nenhum registro criado. | I |

**Casos do AUTH-05** (teste parametrizado com `it.each`):

| Campo | Valor | Motivo |
|---|---|---|
| `name` | ausente · `""` · `" a "` · 121 caracteres | obrigatório, mínimo de 2 após trim, máximo de 120 |
| `email` | ausente · `"ana"` · `"ana@"` · 256 caracteres | formato e tamanho |
| `password` | ausente · `"abc1234"` (7) · `"abcdefgh"` (sem número) · `"12345678"` (sem letra) · 73 caracteres | política de senha e limite do bcrypt |
| corpo | `{}` · `[]` · `"texto"` | não é objeto ou está vazio |

### 5.2 Login: `POST /auth/login`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **AUTH-07** | Dado um usuário ativo com credenciais corretas | `200`, `{ user: UserDTO }` e `Set-Cookie` de `onepulse_token` com `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`. | I |
| **AUTH-08** | Dado um login bem-sucedido | O JWT **não** aparece no corpo da resposta; ao decodificá-lo, `sub` é o id do usuário, `role` é o papel e `exp - iat = 28800`. | I |
| **AUTH-09** | Dado `NODE_ENV=production` | O cookie inclui `Secure`; em `development`/`test`, não inclui. | U |
| **AUTH-10** | Dado um e-mail existente com senha errada | `401 INVALID_CREDENTIALS`, mensagem genérica e nenhum `Set-Cookie`. | I |
| **AUTH-11** | Dado um e-mail inexistente | Resposta **idêntica** à do AUTH-10 (mesmo status, `code` e `message`). | I |
| **AUTH-12** | Dado um usuário com `is_active = false` e senha correta | Resposta **idêntica** à do AUTH-10. | I |
| **AUTH-13** | Dado o e-mail `" ANA@onepulse.dev"` com a senha correta | `200` (o e-mail é normalizado antes da busca). | I |
| **AUTH-14** | Dado um payload inválido (sem e-mail, sem senha, e-mail mal formado, campo extra) | `400 VALIDATION_ERROR`. | I |
| **AUTH-15** | Dado um e-mail inexistente | O service executa `bcrypt.compare` contra um hash fictício, para que o tempo de resposta não revele se o e-mail existe (*timing attack*). | U |

### 5.3 Logout: `POST /auth/logout`

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **AUTH-16** | Dado um usuário logado | `204`, corpo vazio e `Set-Cookie: onepulse_token=;` com `Max-Age=0` (ou `Expires` no passado), mantendo `HttpOnly`, `SameSite=Lax` e `Path=/`. | I |
| **AUTH-17** | Dada uma requisição sem cookie | `204` (idempotente: sair duas vezes não é erro). | I |

### 5.4 Usuário logado: `GET /auth/me` (e o middleware de autenticação)

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **AUTH-18** | Dado um cookie válido | `200`, `{ user: UserDTO }` do usuário dono do token. | I |
| **AUTH-19** | Dado que o nome do usuário mudou no banco depois do login | `/me` retorna o nome **novo**. | I |
| **AUTH-20** | Dada uma requisição sem cookie | `401 UNAUTHENTICATED`. | I |
| **AUTH-21** | Dado um token adulterado (assinatura inválida, outro segredo, string aleatória, `alg: none`) | `401 UNAUTHENTICATED`. | I (`it.each`) |
| **AUTH-22** | Dado um token expirado | `401 UNAUTHENTICATED`. | I |
| **AUTH-23** | Dado um token válido de um usuário excluído **ou** desativado depois do login | `401 UNAUTHENTICATED`. | I |
| **AUTH-24** | Dado um JWT válido enviado só em `Authorization: Bearer <jwt>` | `401 UNAUTHENTICATED` (somente o cookie é aceito). | I |

### 5.5 Transversais

| ID | Dado / Quando | Então | Tipo |
|---|---|---|---|
| **AUTH-25** | Dado um corpo com JSON mal formado em qualquer rota de auth | `400 INVALID_JSON`. | I |
| **AUTH-26** | Em **todas** as respostas de sucesso de auth | Nenhuma chave `password`, `passwordHash`, `password_hash` ou `isActive` em nenhum nível do JSON. | I |
| **AUTH-27** | Dado um erro inesperado (ex.: banco fora do ar) | `500 INTERNAL_ERROR`, sem stack trace nem mensagem interna no corpo. | I |
| **AUTH-28** | Dado um `.env` com `JWT_SECRET` ausente ou com menos de 32 caracteres | O carregamento da config falha com erro que cita `JWT_SECRET`. | U |

---

## 6. Requisitos Não Funcionais

- **CORS:** `origin = CORS_ORIGIN`, `credentials: true`. Sem isso, o navegador não envia o cookie a partir do front-end em outra porta.
- **Banco de teste isolado:** os testes de integração usam `onepulse_test`, que é limpo entre os testes. Eles **nunca** tocam em `onepulse_db`.
- **Logs:** nunca registrar o corpo de `/auth/*` (contém senha).

---

## 7. Decisões desta Spec

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D-01 | O cadastro **não** faz login automático | Retornar o cookie no `register` | Responsabilidades separadas e um teste a menos de combinação. O front-end chama o login em seguida. |
| D-02 | `.strict()` em vez de `.strip()` nos schemas | Ignorar campos extras em silêncio | Uma falha explícita mostra a tentativa de mass assignment e facilita o debug no cliente. |
| D-03 | A mesma resposta para e-mail inexistente, senha errada e usuário inativo | Mensagens específicas | Evita a enumeração de contas pelo login. |
| D-04 | O `409` no cadastro revela que o e-mail existe | Responder `201` falso e enviar e-mail | Trade-off aceito no MVP: sem infraestrutura de e-mail, a UX clara vale mais. A mitigação futura é rate limiting. |
| D-05 | `/me` consulta o banco a cada requisição | Confiar só no payload do JWT | O papel ou a desativação refletem na hora, ao custo de 1 query (indexada por PK). |

---

## 8. Limitações Conhecidas (débito técnico consciente)

- **Sem revogação server-side:** um JWT roubado vale até expirar. Isso é mitigado pelo `httpOnly`, pela expiração de 8h e pela checagem de `is_active` (AUTH-23). Evolução: *token version* em `users` ou refresh token rotativo.
- **Sem rate limiting** no login e no cadastro. Evolução: `express-rate-limit` em uma fase futura.

---

## 9. Plano de Testes (prévia para a etapa RED)

```
backend/
├── src/modules/auth/
│   ├── auth.schemas.test.ts        # AUTH-05 (casos), AUTH-14 — unitário
│   ├── auth.service.test.ts        # AUTH-15 — unitário com repository fake
│   └── auth.cookie.test.ts         # AUTH-09 — opções do cookie por ambiente
├── src/config/env.test.ts          # AUTH-28
└── tests/integration/auth/
    ├── register.test.ts            # AUTH-01..06
    ├── login.test.ts               # AUTH-07, 08, 10..14
    ├── logout.test.ts              # AUTH-16, 17
    ├── me.test.ts                  # AUTH-18..24
    └── cross-cutting.test.ts       # AUTH-25..27
```
