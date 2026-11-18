from django.urls import path

from . import views

urlpatterns = [
    path("ai/chat/", views.chat_view),
    path("ai/voice/", views.voice_view),
    path("ai/feedback/", views.feedback_view),
    path("ai/tools/generate/", views.tools_generate_view),
    path("business/profile/", views.business_profile_view),
    path("ai/memory/", views.memory_list_view),
    path("ai/memory/<int:fact_id>/", views.memory_delete_view),
]
