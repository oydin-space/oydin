from django.http import HttpResponse

from accounts.http import ApiError, api_view, json_response

from .models import Testimonial


@api_view("GET", auth=False)
def testimonials(request):
    lang = request.GET.get("lang", "ru")
    items = []
    for t in Testimonial.objects.filter(published=True).defer("photo", "logo"):
        base = f"/api/public/testimonials/{t.id}"
        items.append(
            {
                "id": t.id,
                "name": t.name,
                "position": t.position,
                "company": t.company,
                "text": t.text_for(lang),
                "photo": f"{base}/photo/" if t.photo_type else None,
                "logo": f"{base}/logo/" if t.logo_type else None,
            }
        )
    return json_response({"items": items})


def _image(request, id, kind):
    t = Testimonial.objects.filter(pk=id, published=True).first()
    data = getattr(t, kind, None) if t else None
    if not data:
        raise ApiError(404, "not_found")
    resp = HttpResponse(bytes(data), content_type=getattr(t, f"{kind}_type"))
    resp["X-Content-Type-Options"] = "nosniff"
    resp["Cache-Control"] = "public, max-age=3600"
    return resp


@api_view("GET", auth=False)
def photo(request, id):
    return _image(request, id, "photo")


@api_view("GET", auth=False)
def logo(request, id):
    return _image(request, id, "logo")
