from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/pulse/", views.pulse),
    path("accounts/", views.accounts),
    path("transactions/", views.transactions),
    path("transactions/<int:id>/", views.transaction_detail),
    path("obligations/", views.obligations),
    path("envelopes/", views.envelopes),
    path("forecast/", views.forecast),
    path("products/", views.products),
    path("orders/", views.orders),
    path("analytics/summary/", views.analytics_summary),
    path("rates/", views.exchange_rates),
]
