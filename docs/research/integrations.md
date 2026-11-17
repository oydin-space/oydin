The research file could not be written to `local://research-integrations.md` because this agent has no write tool. The full content is below, so it can be saved by hand or by the main agent. Items marked **UNVERIFIED** were not confirmed from an official page.

# Oydin external integrations: research notes

## 1. 1C ClientBankExchange (bank statement import)
- **Format:** text, `1CClientBankExchange ВерсияФормата=1.02|1.03 Кодировка=Windows|DOS`.
- **Header keys:** `Отправитель`, `Получатель`, `ДатаСоздания`, `ВремяСоздания`, `ДатаНачала`, `ДатаКонца`, `РасчСчет`.
- **Account section:** `СекцияРасчСчет` … `КонецРасчСчет`, with `НачальныйОстаток`, `ВсегоПоступило`, `ВсегоСписано`, `КонечныйОстаток`.
- **Payment document:** `СекцияДокумент=<Вид>` … `КонецДокумента`. Fields: `Номер`, `Дата`, `Сумма`, `ПлательщикСчет`, `ПлательщикИНН`, `Плательщик1`, `ПолучательСчет`, `ПолучательИНН`, `Получатель1`, `НазначениеПлатежа`, `ДатаСписано`, `ДатаПоступило`.
- **File end:** `КонецФайла`. The `КонецДокумента` and `КонецФайла` names are from memory, not from the page.
- **Gotchas:** Encoding is cp1251 (Windows) or cp866 (DOS), so decode by the `Кодировка` value. Amounts use a decimal point. Sums are UZS, so store them as integers after rounding decisions.
- **Sources:** https://its.1c.ru/db/content/metod8dev/src/developers/dataexchange/bankexchange/clibnkdexchange/i8103262.htm (v1.02). https://v8.1c.ru/tekhnologii/obmen-dannymi-i-integratsiya/standarty-i-formaty/standart-obmena-s-sistemami-klient-banka/formaty-obmena/ (v1.03). https://ibank.moskb.ru/docs/Corporate_iBank2-Format_Guide.pdf (sample header). https://1s-83.com/vse-pro-1s/kakaya-kodirovka-vypiski-dlya-1s.html (encoding). Parser reference: https://crates.io/crates/odin_palace.

## 2. CommerceML 2 (product and order exchange with 1C)
- **Schema:** XSD v2.10, namespace `urn:1C.ru:commerceml_2`.
- **Source:** https://v8.1c.ru/tekhnologii/obmen-dannymi-i-integratsiya/standarty-i-formaty/standarty-commerceml/commerceml-2/
- **Status:** element details were NOT read. Fill them in from the XSD before implementation.

## 3. UZ bank statement exports (Kapitalbank, TBC Uzbekistan, Uzum Business, Hamkorbank)
- **Status:** NOT searched. **UNVERIFIED.** Assumption: most UZ banks export 1C ClientBankExchange, with CSV or XLSX as alternatives. Confirm per bank before building a parser.

## 4. Payme Business (Merchant API, JSON-RPC)
- **Methods:** CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction, GetStatement. Index: https://developer.help.paycom.uz/metody-merchant-api/
- **GetStatement:** params `from` and `to` (Timestamp ms, inclusive), selected by create time. Response: `{"result":{"transactions":[...]}}`, sorted ascending.
- **Transaction fields:** `id`, `time`, `amount` (tiyin), `account`, `create_time`, `perform_time`, `cancel_time`, `transaction`, `state`, `reason`, `receivers`.
- **Gotchas:** `amount` is in tiyin, so divide by 100 for UZS. Convert to integer UZS and keep the convention consistent.
- **Auth:** Merchant API uses an `X-Auth` header. This was NOT confirmed from the official page. Payme Payments (docs.payme.io) is a different product and uses no Authorization header. https://docs.payme.io/payments/getting-started/authentication
- **Sources:** https://developer.help.paycom.uz/metody-merchant-api/getstatement, https://developer.help.paycom.uz/protokol-subscribe-api

## 5. Click (Shop API and Merchant API)
- **Shop API:** Click calls your server. Prepare is `action=0` and Complete is `action=1`, both form-urlencoded. `sign_string` is MD5, built with SECRET_KEY.
- **Duplicate Complete:** return error `-4`. Source: https://github.com/Gribadan/click-payme-nextjs/blob/main/docs/click.md
- **Merchant API base:** `https://api.click.uz/v2/merchant/`. Source: https://github.com/IbrohimMirxoshimov/click-uz-integration-skill/blob/main/SKILL.md
- **Auth header:** `Auth: merchant_user_id:digest:timestamp`. Source: https://docs.click.uz/merchant-api/fiscalization
- **Digest:** the header format is verified. The digest formula is **UNVERIFIED**. A third-party wiki says `sha1(timestamp + SECRET_KEY)`. Check against https://docs.click.uz/en/merchant-api/requests, which has a Node.js example.
- **Sources:** https://docs.click.uz/merchant-api/requests, https://github.com/ansoragroup/uzfintech-skills/blob/main/skills/click/SKILL.md

## 6. Uzum Market Seller API
- **Base:** `https://api-seller.uzum.uz/api/seller-openapi/`
- **Auth:** `Authorization: API_TOKEN`. No Bearer prefix, and no `token` header. The key comes from the seller cabinet "Ключи API" section.
- **Verified endpoints:** `GET /v1/shops`, `GET /v1/product/shop/{shopId}`, `POST /v1/product/{shopId}/sendPriceData`, `GET /v1/shop/{shopId}/invoice`, `GET /v2/fbs/orders?shopIds=&page=&size=`.
- **Finance:** `GET /v1/finance/orders` (sales rows, response `orderItems`) is supported by a third-party guide. Verify the exact params against the OpenAPI before use.
- **Gotchas:** `shopIds` is required for FBS/DBS order lists, finance orders, and expenses. 401 means a missing or empty Authorization header. 403 means a bad key, no shop access, or missing shopIds or edit permission.
- **Sources:** https://api-seller.uzum.uz/api/seller-openapi/swagger/api-docs, https://github.com/MirobidUsmonov/uzum-seller-api-guide/blob/main/docs/07-moliya.md (secondary)

## 7. Moysklad JSON API 1.2
- **Auth:** Basic (base64 `login:password`) or Bearer `<access_token>`. Requesting a new token revokes the existing ones.
- **Required:** gzip-compressed requests and responses. Otherwise HTTP 415.
- **Errors:** `{"errors":[{error, parameter, code, error_message, moreInfo, line, column, dependencies, meta}]}`.
- **Rate limits:** `X-RateLimit-*`, `X-Lognex-Reset`, and `X-Lognex-Retry-After`. A concurrency 429 has code 1073.
- **Pagination:** `limit` and `offset`, max 1000 per page.
- **Entities:** `paymentin`, `paymentout`, `demand`. Field schemas were NOT read.
- **Sources:** https://dev.moysklad.ru/doc/api/remap/1.2/, https://jsr.io/@moysklad/moysklad-ts/doc/~/PaymentIn

## 8. Billz API
- **Login:** `POST https://api-admin.billz.ai/v1/auth/login` with body `{"secret_token":"<KEY>"}`. Returns `access_token` (expires_in 1296000 s, 15 days) and `refresh_token` (30 days).
- **Refresh:** `POST /v2/auth/refresh`.
- **Catalog:** `GET /v2/products?limit=&search=`, with `Authorization: Bearer`. Returns `{count, products[]}`.
- **Prices and stock:** per shop, in `shop_prices` with `retail_price` and `retail_currency` (UZS). Integer UZS.
- **Orders:** `POST /v2/order` exists, but its schema was NOT read. Sales listing is **UNVERIFIED**.
- **Source:** https://docs.billz.io/en/start/first-request.md

## 9. Didox
- **Access:** a partner token is required. It is issued by an account manager.
- **Base URLs:** test `testapi3.didox.uz`, prod `api-partners.didox.uz`.
- **Login:** the body and route were NOT read. A third-party guide says user login by password, cached for 6 hours. **UNVERIFIED.**
- **Sources:** https://api-docs.didox.uz/ru/home, https://api-docs.didox.uz/ru/integrators-documents, https://api-docs.didox.uz/login. Third party: https://github.com/smixs/didox-skill

## 10. Faktura.uz (api.faktura.uz)
- **Format:** RESTful, JSON or XML.
- **Paths seen:** `Api/Document/GetDocumentTypes`, `Api/Document/AssignDocumentsToLabel`.
- **Auth:** the docs have a "Receiving a token" section. The mechanism and the header are **UNVERIFIED**. The docs timed out when fetched.
- **Sources:** https://api.faktura.uz/help/en.html, https://api.faktura.uz/help/eng.html, https://api.faktura.uz/help

## 11. Google Sheets (OAuth scopes)
- **`drive.file`:** recommended, non-sensitive, per-file. Best fit for Oydin.
- **`spreadsheets`** and **`spreadsheets.readonly`:** sensitive.
- **`drive`** and **`drive.readonly`:** restricted.
- **Scope granularity:** per spreadsheet, not per sheet.
- **Source:** https://developers.google.com/workspace/sheets/api/scopes.md.txt

## 12. Telegram Login
- **Legacy widget hash check:**
  - `data-check-string` is every received field except `hash`, sorted alphabetically, joined as `key=value` with `\n`.
  - `secret = SHA256(bot_token)`.
  - Compare `hex(HMAC_SHA256(data_check_string, secret))` to `hash`.
  - Check that `auth_date` is fresh.
  - Fields: `id`, `first_name`, `last_name`, `username`, `photo_url`, `auth_date`, `hash`.
  - Source: https://core.telegram.org/widgets/login-legacy
- **New OIDC login:**
  - Discovery: `https://oauth.telegram.org/.well-known/openid-configuration`
  - Auth: `https://oauth.telegram.org/auth`
  - Token: `https://oauth.telegram.org/token`, with Basic `client_id:client_secret` and PKCE S256.
  - JWKS: `https://oauth.telegram.org/.well-known/jwks.json`
  - ID token is RS256. Verify `iss`, `aud` (bot id), and `exp`.
  - Source: https://core.telegram.org/bots/telegram-login.md

## 13. Telegram sendVoice
- **Formats:** `.OGG` (OPUS), `.MP3`, or `.M4A`. Other formats go as Audio or Document.
- **Limit:** 50 MB.
- **Params:** `chat_id`, `voice` (InputFile, file_id, or URL), `caption`, `duration`, `reply_markup`.
- **Source:** https://core.telegram.org/bots/api/methods/sendvoice

## 14. TTS via OpenRouter
- **Endpoint:** `POST https://openrouter.ai/api/v1/audio/speech` (OpenAI-compatible). Returns raw audio bytes.
- **Params:** `model` (example `openai/gpt-4o-mini-tts-2025-12-15`), `input`, `voice` (provider-dependent; example `alloy`), `instructions`, `response_format` (`mp3` or `pcm`, default `pcm`), `speed`.
- **Discovery:** `GET https://openrouter.ai/api/v1/models?output_modalities=speech`. The response header `X-Generation-Id` is the generation id.
- **Gotcha:** the default `pcm` output is not playable by Telegram. Request `mp3`, then convert to OGG/OPUS for `sendVoice`, or use MP3 directly.
- **Source:** https://openrouter.ai/docs/guides/overview/multimodal/tts.md

## Not verified (summary)
- Bank statement exports for Kapitalbank, TBC, Uzum Business, and Hamkorbank.
- CommerceML 2 element details.
- Payme `X-Auth` details.
- Click digest formula.
- Uzum finance and orders params.
- Billz sales schema.
- Moysklad `paymentin` and `demand` fields.
- Didox login and document routes.
- Faktura.uz auth and all routes.

## Files written
- None. The research is only in this reply. No repo changes were made, and no builds or tests were run.