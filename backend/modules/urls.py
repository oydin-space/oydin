from django.urls import path

from . import views

urlpatterns = [
    path("modules/", views.modules),
    path("modules/preset/", views.preset),
    path("widgets/", views.widgets),
    path("widgets/usage/", views.usage),
    path("widgets/proposals/", views.proposals),
    path("widgets/proposals/<int:id>/approve/", views.proposal_approve),
    path("widgets/proposals/<int:id>/reject/", views.proposal_reject),
    path("widgets/<str:key>/versions/", views.versions),
    path("widgets/<str:key>/rollback/", views.rollback),
]
