# Политика токена приложения: только encrypt/decrypt ключом oydin-creds (Transit). Ни чтения ключа, ни экспорта, ни других путей.
path "transit/encrypt/oydin-creds" {
  capabilities = ["update"]
}

path "transit/decrypt/oydin-creds" {
  capabilities = ["update"]
}

# Продление и проверка собственного токена (политика default не выдаётся: токен создаётся с -no-default-policy).
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}
