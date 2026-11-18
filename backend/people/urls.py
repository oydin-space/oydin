from django.urls import path

from . import views

urlpatterns = [
    path("people/", views.people),
    path("people/locations/", views.locations),
    path("people/locations/<int:id>/", views.location_detail),
    path("people/summary/", views.summary),
    path("people/<int:id>/", views.person_detail),
]
