from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env.bool("DEBUG", default=True)
# В проде секрет обязателен: без него приложение не стартует.
SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-insecure-key" if DEBUG else environ.Env.NOTSET)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "testserver"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
if DEBUG:
    CSRF_TRUSTED_ORIGINS += ["http://localhost:3010", "http://127.0.0.1:3010"]

# За обратным прокси (Caddy) с TLS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
# Telegram Mini App открывает сайт во встроенном webview: куки должны ходить в стороннем контексте.
SESSION_COOKIE_SAMESITE = "Lax" if DEBUG else "None"
CSRF_COOKIE_SAMESITE = "Lax" if DEBUG else "None"
CSRF_COOKIE_HTTPONLY = False

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "accounts",
    "finance",
    "insights",
    "ai",
    "planning",
    "imports",
    "sharing",
    "publicapi",
    "bot",
    "tools",
    "connectors",
    "onboarding",
    "billing",
    "adminx",
    "marketing",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

X_FRAME_OPTIONS = "DENY"

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL", default="postgres://oydin:oydin@127.0.0.1:5433/oydin"),
}

# Общий для всех воркеров gunicorn кэш: лимиты запросов к ИИ и OTP. В проде — таблица oydin_cache (manage.py createcachetable).
if DEBUG:
    CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.filebased.FileBasedCache", "LOCATION": "/tmp/oydin-cache"},
    }
else:
    CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "oydin_cache"},
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": f"django.contrib.auth.password_validation.{name}"}
    for name in (
        "UserAttributeSimilarityValidator",
        "MinimumLengthValidator",
        "CommonPasswordValidator",
        "NumericPasswordValidator",
    )
]
LANGUAGE_CODE = "ru"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Статика админки отдаётся whitenoise и в проде (без манифеста — работает и в dev/тестах без collectstatic).
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# Почта для входа по коду. Без EMAIL_HOST в DEBUG письма печатаются в консоль.
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Oydin <noreply@oydin.sayfi.uz>")
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend" if EMAIL_HOST else "django.core.mail.backends.console.EmailBackend"
)
EMAIL_CONFIGURED = bool(EMAIL_HOST) or DEBUG

# Google OAuth: вход включается, только когда заданы оба значения.
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET", default="")

# Суперпользователь для /admin/ (manage.py ensure_admin; без обоих значений ничего не делает).
ADMIN_EMAIL = env("ADMIN_EMAIL", default="")
ADMIN_PASSWORD = env("ADMIN_PASSWORD", default="")

# Интеграции
DEMO_LOGIN = env.bool("DEMO_LOGIN", default=DEBUG)
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
LLM_BASE_URL = env("LLM_BASE_URL", default="https://openrouter.ai/api/v1")
LLM_API_KEY = env("LLM_API_KEY", default="")
EXA_API = env("EXA_API", default="")  # веб-поиск и исследование (Exa); пусто — инструменты web_search/research выключены
LLM_MODEL = env("LLM_MODEL", default="google/gemini-3.1-flash-lite")
LLM_CLASSIFY_MODEL = env("LLM_CLASSIFY_MODEL", default="google/gemini-3.1-flash-lite")  # черновики и классификация
LLM_FALLBACK_MODEL = env("LLM_FALLBACK_MODEL", default="google/gemini-3.5-flash")
# Прямой Anthropic API — запасной провайдер, если OpenRouter отвечает 401/402/429 или ключа нет.
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default=env("ANTHROPIC_API", default=""))
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", default="claude-sonnet-5-5")
ANTHROPIC_CLASSIFY_MODEL = env("ANTHROPIC_CLASSIFY_MODEL", default="claude-haiku-5-5")
STT_MODEL = env("STT_MODEL", default="google/gemini-3.5-flash-lite")
LANGFUSE_PUBLIC_KEY = env("LANGFUSE_PUBLIC_KEY", default="")
LANGFUSE_SECRET_KEY = env("LANGFUSE_SECRET_KEY", default="")
LANGFUSE_BASE_URL = env("LANGFUSE_BASE_URL", default="https://cloud.langfuse.com")
# Ошибки уходят в self-hosted Bugsink (Sentry-совместимый); без DSN SDK не импортируется.
SENTRY_DSN = env("SENTRY_DSN", default="")
SENTRY_SCRUB_KEYS = {"auth_secret", "init_data", "password", "code", "token", "secret"}


def _scrub(value):
    if isinstance(value, dict):
        return {k: "[Filtered]" if str(k).lower() in SENTRY_SCRUB_KEYS else _scrub(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    return value


def sentry_before_send(event, hint):
    request = event.get("request")
    if isinstance(request, dict):
        for key in ("data", "query_string", "cookies"):
            if key in request:
                request[key] = _scrub(request[key])
    return event


if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        send_default_pii=False,
        before_send=sentry_before_send,
        traces_sample_rate=0.1,
        environment="development" if DEBUG else "production",
    )
AI_CHAT_PER_MINUTE = env.int("AI_CHAT_PER_MINUTE", default=12)
AI_VOICE_PER_MINUTE = env.int("AI_VOICE_PER_MINUTE", default=6)

# Оплата тарифов через Click (SHOP API); без PAYMENTS_ENABLED и ключей checkout отвечает {"available": false}.
PAYMENTS_ENABLED = env.bool("PAYMENTS_ENABLED", default=False)
CLICK_SERVICE_ID = env("CLICK_SERVICE_ID", default="")
CLICK_MERCHANT_ID = env("CLICK_MERCHANT_ID", default="")
CLICK_MERCHANT_USER_ID = env("CLICK_MERCHANT_USER_ID", default="")
CLICK_SECRET_KEY = env("CLICK_SECRET_KEY", default="")
