# Vault для секретов коннекторов Oydin: файловое хранилище в томе vault_data, только внутренняя сеть, без TLS (трафик не покидает сеть vault).
ui            = false
disable_mlock = false # контейнеру выдан IPC_LOCK
api_addr      = "http://vault:8200"

# Периодический токен приложения (720h) продлевается renew-self; потолок аренды остаётся по умолчанию (768h).
default_lease_ttl = "768h"
max_lease_ttl     = "768h"

storage "file" {
  path = "/vault/file"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}
