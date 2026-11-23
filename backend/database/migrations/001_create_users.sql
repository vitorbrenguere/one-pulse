-- 001: tabela users (spec 00-architecture §3.2, v1.1.0)
-- USR-INV-01 (manager_id <> id) é validada no service: o MySQL não permite CHECK
-- sobre coluna AUTO_INCREMENT nem sobre coluna com FK ON DELETE SET NULL (nota 3.5).

CREATE TABLE users (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('COLABORADOR', 'GESTOR') NOT NULL DEFAULT 'COLABORADOR',
  manager_id    INT UNSIGNED  NULL,
  job_title     VARCHAR(120)  NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_manager_id (manager_id),
  CONSTRAINT fk_users_manager
    FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
