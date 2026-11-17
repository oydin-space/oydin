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
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

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

# Общий для всех воркеров gunicorn кэш: лимиты запросов к ИИ.
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.filebased.FileBasedCache", "LOCATION": "/tmp/oydin-cache"},
}

AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = "ru"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Интеграции
DEMO_LOGIN = env.bool("DEMO_LOGIN", default=DEBUG)
TELEGRAM_BOT_TOKEN = env("TELEGRAM_BOT_TOKEN", default="")
LLM_BASE_URL = env("LLM_BASE_URL", default="https://openrouter.ai/api/v1")
LLM_API_KEY = env("LLM_API_KEY", default="")
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
AI_CHAT_PER_MINUTE = env.int("AI_CHAT_PER_MINUTE", default=12)
AI_VOICE_PER_MINUTE = env.int("AI_VOICE_PER_MINUTE", default=6)
