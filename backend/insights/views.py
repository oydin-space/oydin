from accounts.access import FINANCE_READERS, require_role
from accounts.http import api_view, json_response
from finance.texts import resolve_lang

from .services import build_insights


@api_view("GET")
@require_role(*FINANCE_READERS)
def insights(request):
    return json_response({"items": build_insights(request.business, lang=resolve_lang(request))})
