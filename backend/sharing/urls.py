from django.urls import path

from . import views

urlpatterns = [
    path("share-links/", views.share_links),
    path("share-links/<int:id>/", views.share_link_detail),
    path("shared/<str:token>/", views.shared_report),
    path("shared/<str:token>/report.pdf", views.shared_pdf),
    path("consents/partner/", views.consents),
    path("consents/partner/<int:partner_id>/", views.consent_revoke),
    path("partner/me/", views.partner_me),
    path("partner/leads/", views.partner_leads),
    path("partner/leads/<str:id>/", views.partner_lead_detail),
    path("impact/", views.impact),
]
