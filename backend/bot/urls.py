from django.urls import path

from . import views

urlpatterns = [
    path("telegram/webhook/", views.webhook),
    path("telegram/link/", views.link),
    path("notifications/settings/", views.notification_settings),
]
