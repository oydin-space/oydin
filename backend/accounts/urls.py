from django.urls import path

from . import consent, views

urlpatterns = [
    path("auth/csrf/", views.csrf),
    path("auth/providers/", views.providers),
    path("auth/demo/", views.demo),
    path("auth/telegram/", views.telegram),
    path("auth/email/request/", views.email_request),
    path("auth/email/verify/", views.email_verify),
    path("auth/google/start/", views.google_start),
    path("auth/google/callback/", views.google_callback),
    path("auth/logout/", views.logout_view),
    path("auth/me/", views.me),
    path("me/", views.me),
    path("consents/", consent.consents),
    path("business/", views.business),
    path("businesses/", views.businesses),
    path("businesses/<int:business_id>/", views.business_detail),
    path("businesses/<int:business_id>/switch/", views.business_switch),
    path("businesses/<int:business_id>/members/", views.members),
    path("businesses/<int:business_id>/members/<int:member_id>/", views.member_detail),
]
