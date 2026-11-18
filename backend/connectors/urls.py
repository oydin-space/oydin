from django.urls import path

from . import views

urlpatterns = [
    path("connectors/", views.connectors),
    path("connectors/<int:id>/", views.connector_detail),
    path("connectors/<int:id>/test/", views.connector_test),
]
