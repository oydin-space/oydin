from accounts.http import api_view, json_response

from .services import build_insights


@api_view("GET")
def insights(request):
    return json_response({"items": build_insights(request.business)})
