from datetime import date

from django.http import HttpResponse

from accounts.access import ACCOUNTANT, OWNER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json
from finance.models import Account

from . import export, parsers, services
from .models import ImportJob

MANAGERS = (OWNER, ACCOUNTANT)


def get_job(request, id):
    job = ImportJob.objects.filter(pk=id, business=request.business).first()
    if job is None:
        raise ApiError(404, "not_found")
    return job


def business_account(request, value):
    account = Account.objects.filter(pk=value if isinstance(value, int) and not isinstance(value, bool) else None,
                                     business=request.business).first()
    if account is None:
        raise ApiError(400, "invalid_account")
    return account


def query_date(request, name):
    raw = request.GET.get(name)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ApiError(400, "invalid_date") from None


def import_list(request):
    jobs = ImportJob.objects.filter(business=request.business)[:50]
    return json_response({"items": [services.serialize(j, rows=[]) for j in jobs]})


def import_create(request):
    upload = request.FILES.get("file")
    if upload is None:
        raise ApiError(400, "invalid_file")
    if upload.size > parsers.MAX_BYTES:
        raise ApiError(413, "file_too_large")
    kind = request.POST.get("kind") or None
    if kind is not None and kind not in parsers.PARSERS:
        raise ApiError(400, "invalid_kind")
    account = None
    if request.POST.get("account_id"):
        raw = request.POST["account_id"]
        account = business_account(request, int(raw) if raw.isdigit() else None)
    job = services.create_job(request.business, request.user, upload.name, upload.read(), kind, account)
    return json_response(services.serialize(job), status=201)


@api_view("GET", "POST")
@require_role(*MANAGERS)
def imports(request):
    return import_list(request) if request.method == "GET" else import_create(request)


@api_view("GET", "PATCH")
@require_role(*MANAGERS)
def import_detail(request, id):
    job = get_job(request, id)
    if request.method == "PATCH":
        if job.status != ImportJob.Status.PREVIEW:
            raise ApiError(409, "already_committed")
        body = parse_json(request)
        if "mapping" in body:
            services.update_mapping(job, body["mapping"])
        if "account_id" in body:
            job.account = business_account(request, body["account_id"])
        job.save()
    return json_response(services.serialize(job))


@api_view("POST")
@require_role(*MANAGERS)
def import_commit(request, id):
    job = get_job(request, id)
    if job.status != ImportJob.Status.PREVIEW:
        raise ApiError(409, "already_committed")
    body = parse_json(request, required=False)
    skip = body.get("skip_duplicates", True)
    exclude = body.get("exclude_rows", [])
    if not isinstance(skip, bool) or not isinstance(exclude, list) or not all(
        isinstance(n, int) and not isinstance(n, bool) for n in exclude
    ):
        raise ApiError(400, "invalid_request")
    rows = services.commit(job, request.user, skip_duplicates=skip, exclude_rows=exclude)
    return json_response(services.serialize(job, rows=rows))


@api_view("GET")
@require_role(*MANAGERS)
def export_transactions(request):
    fmt = request.GET.get("format")
    if fmt not in export.RENDERERS:
        raise ApiError(400, "invalid_format")
    start, end = (query_date(request, "from"), query_date(request, "to"))
    render, content_type = export.RENDERERS[fmt]
    response = HttpResponse(render(export.queryset(request.business, start, end)), content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="transactions.{export.EXTENSIONS[fmt]}"'
    return response
