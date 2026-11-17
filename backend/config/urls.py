from django.contrib import admin
from django.db import connection
from django.urls import include, path

from accounts.http import api_view, json_response
from ai.llm import is_configured


@api_view("GET", auth=False)
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db = True
    except Exception:
        db = False
    return json_response({"ok": db, "db": db, "ai": is_configured()})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/", include("accounts.urls")),
    path("api/", include("finance.urls")),
    path("api/", include("insights.urls")),
    path("api/", include("ai.urls")),
    path("api/", include("planning.urls")),
    path("api/", include("imports.urls")),
    path("api/", include("sharing.urls")),
    path("api/", include("publicapi.urls")),
]
