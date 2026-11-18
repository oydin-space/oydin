from accounts.http import api_view, json_response

from . import services as svc


@api_view("GET", business=False)
def rollup(request):
    return json_response(svc.rollup(request.user))
