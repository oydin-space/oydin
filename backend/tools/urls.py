from django.urls import path

from . import views

urlpatterns = [
    path("tools/", views.tools),
    path("tools/templates/", views.templates),
    path("tools/<int:id>/", views.tool_detail),
]
