-- 003: tabela evaluations (spec 00-architecture §3.4 v1.3.0 · spec 04-evaluations §5.1)
-- Um registro por (user_id, cycle) com duas partes: autoavaliação (self_*) e gestor (manager_*).
-- EVAL-INV-02..04 e as regras de envio/visibilidade ficam no service (spec 04 §2.4/§2.5).
-- Os CHECKs de nota são permitidos: as colunas não são AUTO_INCREMENT nem participam de FK (nota 3.5).

CREATE TABLE evaluations (
  id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id              INT UNSIGNED     NOT NULL,
  manager_id           INT UNSIGNED     NOT NULL,
  cycle                CHAR(7)          NOT NULL,
  status               ENUM('ABERTA', 'CONCLUIDA') NOT NULL DEFAULT 'ABERTA',
  self_score           TINYINT UNSIGNED NULL,
  self_comments        TEXT             NULL,
  self_submitted_at    DATETIME         NULL,
  manager_score        TINYINT UNSIGNED NULL,
  manager_feedback     TEXT             NULL,
  manager_submitted_at DATETIME         NULL,
  created_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_evaluations_user_cycle (user_id, cycle),
  KEY idx_evaluations_manager_cycle (manager_id, cycle),
  CONSTRAINT chk_evaluations_self_score CHECK (self_score BETWEEN 1 AND 5),
  CONSTRAINT chk_evaluations_manager_score CHECK (manager_score BETWEEN 1 AND 5),
  CONSTRAINT fk_evaluations_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_evaluations_manager
    FOREIGN KEY (manager_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
