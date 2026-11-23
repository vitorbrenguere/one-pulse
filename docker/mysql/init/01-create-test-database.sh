#!/bin/sh
# Executado pelo entrypoint do MySQL APENAS na primeira inicialização (volume vazio).
# Cria o banco isolado de testes de integração e concede acesso ao usuário da aplicação.
set -eu

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE DATABASE IF NOT EXISTS onepulse_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON onepulse_test.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
EOSQL

echo "[init] onepulse_test criado e liberado para '${MYSQL_USER}'."
