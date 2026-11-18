from django.urls import path

from . import views

urlpatterns = [
    path("onboarding/state/", views.state),
    path("onboarding/answer/", views.answer),
    path("onboarding/lookup/", views.lookup),
    path("onboarding/message/", views.message),
    path("onboarding/context/", views.context),
]
