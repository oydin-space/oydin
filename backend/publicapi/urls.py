from django.urls import path

from finance import sync

from . import views

urlpatterns = [
    path("developer/tokens/", views.tokens),
    path("developer/tokens/<int:id>/", views.token_detail),
    path("developer/webhooks/", views.webhooks),
    path("developer/webhooks/<int:id>/", views.webhook_detail),
    path("developer/webhooks/<int:id>/ping/", views.webhook_ping),
    path("v1/business/", views.v1_business),
    path("v1/accounts/", views.v1_accounts),
    path("v1/transactions/", views.v1_transactions),
    path("v1/pulse/", views.v1_pulse),
    path("v1/forecast/", views.v1_forecast),
    path("sync/", sync.sync_view),
]
