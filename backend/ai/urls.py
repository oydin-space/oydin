from django.urls import path

from . import views

urlpatterns = [
    path("ai/chat/", views.chat_view),
    path("ai/voice/", views.voice_view),
    path("ai/feedback/", views.feedback_view),
]
