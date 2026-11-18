from django.urls import path

from . import views

urlpatterns = [
    path("beginner/plan/", views.plan),
    path("beginner/plan/pdf/", views.plan_pdf),
]
