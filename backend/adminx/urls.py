from django.urls import path

from . import views

urlpatterns = [
    path("admin/metrics/", views.metrics, name="adminx_metrics"),
    path("admin/business-data/<int:business_id>/", views.business_data, name="adminx_business_data"),
]
