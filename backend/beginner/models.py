from django.db import models


class BeginnerPlan(models.Model):
    """Черновик плана начинающего: бюджет запуска, точка безубыточности, чек-лист. Один на бизнес."""

    business = models.OneToOneField("accounts.Business", on_delete=models.CASCADE, related_name="beginner_plan")
    budget_items = models.JSONField(default=list)
    breakeven = models.JSONField(default=dict)
    checklist = models.JSONField(default=list)
    regime = models.CharField(max_length=12, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)
