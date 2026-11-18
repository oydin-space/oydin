from django.urls import path

from . import views

urlpatterns = [
    path("billing/plans/", views.plans),
    path("billing/subscription/", views.subscription),
    path("billing/checkout/", views.checkout),
    path("billing/click/prepare/", views.prepare),
    path("billing/click/complete/", views.complete),
]
