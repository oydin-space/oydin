from django.http import HttpResponse

from accounts.access import FINANCE_READERS, require_role
from accounts.http import ApiError, api_view, json_response, parse_json

from . import pdf, reference
from . import services as svc


@api_view("GET", "PUT")
@require_role(*FINANCE_READERS)
def plan(request):
    obj = svc.get_plan(request.business)
    if request.method == "PUT":
        if request.business.is_demo or request.user.username == "demo":
            raise ApiError(403, "demo_tenant")
        obj = svc.apply(obj, parse_json(request))
    return json_response({
        **svc.serialize(obj),
        "registration": reference.registration(request.GET.get("lang") or request.headers.get("Accept-Language")),
    })


@api_view("GET")
@require_role(*FINANCE_READERS)
def plan_pdf(request):
    lang = reference.lang_of(request.GET.get("lang") or request.headers.get("Accept-Language"))
    obj = svc.get_plan(request.business)
    data = pdf.render(request.business.name, svc.serialize(obj), reference.registration(lang), lang)
    response = HttpResponse(data, content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="oydin-start-plan.pdf"'
    return response
