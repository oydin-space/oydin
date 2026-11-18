from django.urls import path

from . import views

urlpatterns = [path("rollup/", views.rollup)]
