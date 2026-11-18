from django.http import HttpResponse

from accounts.access import FINANCE_READERS, require_role
from accounts.http import ApiError, api_view, json_response, parse_json

from . import services as svc
from .models import Location, Person


def _write_guard(request):
    if request.method != "GET" and (request.business.is_demo or request.user.username == "demo"):
        raise ApiError(403, "demo_tenant")


def _person(request, id):
    person = Person.objects.filter(pk=id, business=request.business).first()
    if person is None:
        raise ApiError(404, "Человек не найден")
    return person


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def people(request):
    if request.method == "POST":
        _write_guard(request)
        fields = svc.person_fields(request.business, parse_json(request), partial=False)
        svc.check_dates(fields.get("started_on"), fields.get("ended_on"))
        return json_response(svc.serialize_person(Person.objects.create(business=request.business, **fields)), status=201)
    items = Person.objects.filter(business=request.business)
    return json_response({"people": [svc.serialize_person(p) for p in items]})


@api_view("PATCH", "DELETE")
@require_role(*FINANCE_READERS)
def person_detail(request, id):
    _write_guard(request)
    person = _person(request, id)
    if request.method == "DELETE":
        person.delete()
        return HttpResponse(status=204)
    fields = svc.person_fields(request.business, parse_json(request), partial=True)
    svc.check_dates(fields.get("started_on", person.started_on), fields.get("ended_on", person.ended_on))
    for key, value in fields.items():
        setattr(person, key, value)
    person.save()
    return json_response(svc.serialize_person(person))


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def locations(request):
    if request.method == "POST":
        _write_guard(request)
        fields = svc.location_fields(parse_json(request), partial=False)
        return json_response(svc.serialize_location(Location.objects.create(business=request.business, **fields)), status=201)
    return json_response({"locations": [svc.serialize_location(x) for x in Location.objects.filter(business=request.business)]})


@api_view("PATCH", "DELETE")
@require_role(*FINANCE_READERS)
def location_detail(request, id):
    _write_guard(request)
    loc = Location.objects.filter(pk=id, business=request.business).first()
    if loc is None:
        raise ApiError(404, "Точка не найдена")
    if request.method == "DELETE":
        loc.delete()
        return HttpResponse(status=204)
    for key, value in svc.location_fields(parse_json(request), partial=True).items():
        setattr(loc, key, value)
    loc.save()
    return json_response(svc.serialize_location(loc))


@api_view("GET")
@require_role(*FINANCE_READERS)
def summary(request):
    return json_response(svc.summary(request.business))
