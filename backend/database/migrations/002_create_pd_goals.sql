-- 002: tabela pd_goals (spec 00-architecture §3.3 v1.2.0 · spec 03-pd-goals §5.1)
-- Invariantes PDI-INV-01..04 e a máquina de estados ficam no service (spec 03 §2.4/§2.5).
-- O CHECK de progress é permitido: a coluna não é AUTO_INCREMENT nem participa de FK (nota 3.5).

CREATE TABLE pd_goals (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED     NOT NULL,
  created_by          INT UNSIGNED     NOT NULL,
  title               VARCHAR(150)     NOT NULL,
  description         TEXT             NULL,
  category            ENUM('TECNICA', 'COMPORTAMENTAL', 'CARREIRA') NOT NULL,
  status              ENUM('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'NAO_INICIADA',
  progress            TINYINT UNSIGNED NOT NULL DEFAULT 0,
  target_date         DATE             NOT NULL,
  completed_at        DATETIME         NULL,
  manager_feedback    TEXT             NULL,
  manager_feedback_at DATETIME         NULL,
  created_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_pd_goals_user_status (user_id, status),
  KEY idx_pd_goals_user_target_date (user_id, target_date),
  KEY idx_pd_goals_created_by (created_by),
  CONSTRAINT chk_pd_goals_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT fk_pd_goals_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_pd_goals_created_by
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
