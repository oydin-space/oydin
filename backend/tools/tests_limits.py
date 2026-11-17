from django.core.cache import cache
from django.test import TestCase

from accounts.models import Membership
from finance.tests import jpost, make_user

from .models import SavedTool
from .tests import SPEC
from .views import MAX_TOOLS


class ToolsLimitTests(TestCase):
    def test_cap_per_business(self):
        cache.clear()
        owner, business, _ = make_user("limit_owner")
        Membership.objects.update_or_create(user=owner, business=business, defaults={"role": "owner"})
        self.client.force_login(owner)
        for i in range(MAX_TOOLS):
            SavedTool.objects.create(business=business, created_by=owner, title=f"t{i}", kind="custom", spec=SPEC, values={})
        r = jpost(self.client, "/api/tools/", {"title": "x", "kind": "custom", "spec": SPEC})
        self.assertEqual((r.status_code, r.json()), (409, {"error": "tools_limit"}))
