from django.urls import path

from . import views

urlpatterns = [
    path("imports/", views.imports),
    path("imports/<int:id>/", views.import_detail),
    path("imports/<int:id>/commit/", views.import_commit),
    path("exports/transactions/", views.export_transactions),
]
