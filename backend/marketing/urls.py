from django.urls import path

from . import views

urlpatterns = [
    path("public/testimonials/", views.testimonials),
    path("public/testimonials/<int:id>/photo/", views.photo, name="testimonial_photo"),
    path("public/testimonials/<int:id>/logo/", views.logo, name="testimonial_logo"),
]
