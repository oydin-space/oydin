from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf/", views.csrf),
    path("auth/demo/", views.demo),
    path("auth/telegram/", views.telegram),
    path("auth/logout/", views.logout_view),
    path("me/", views.me),
    path("business/", views.business),
]
