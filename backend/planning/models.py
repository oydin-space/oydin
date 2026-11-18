from django.conf import settings
from django.db import models

from accounts.models import Business
from finance.models import Account, Currency, Obligation


class CashClose(models.Model):
    """Ежедневная сверка: сколько должно быть по записям и сколько пересчитано руками."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="cash_closes")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="cash_closes")
    date = models.DateField()
    currency = models.CharField(max_length=3, choices=Currency)
    expected = models.BigIntegerField()
    counted = models.BigIntegerField()
    difference = models.BigIntegerField()
    note = models.CharField(max_length=500, blank=True, default="")
    idempotency_key = models.CharField(max_length=80, null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["account", "date"], name="cash_close_account_day"),
            models.UniqueConstraint(
                fields=["business", "idempotency_key"], condition=models.Q(idempotency_key__isnull=False),
                name="cash_close_idem_key",
            ),
        ]


class TaxReserve(models.Model):
    """Необязательный план резерва денег под налоги. Процент вводит пользователь; расчёта налога здесь нет."""

    class Method(models.TextChoices):
        FIXED = "fixed"
        PERCENT = "percent"

    class Period(models.TextChoices):
        MONTH = "month"
        QUARTER = "quarter"

    business = models.OneToOneField(Business, on_delete=models.CASCADE, related_name="tax_reserve")
    enabled = models.BooleanField(default=False)
    method = models.CharField(max_length=8, choices=Method, default=Method.PERCENT)
    fixed_amount = models.BigIntegerField(null=True, blank=True)
    percent = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    period = models.CharField(max_length=8, choices=Period, default=Period.MONTH)
    base_categories = models.JSONField(default=list, blank=True)
    confirmed_amount = models.BigIntegerField(null=True, blank=True)


class TaxReminder(models.Model):
    class Kind(models.TextChoices):
        PAYMENT = "payment"
        REPORT = "report"

    class Status(models.TextChoices):
        PLANNED = "planned"
        DONE = "done"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="tax_reminders")
    title = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=Kind)
    due_date = models.DateField()
    amount = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status, default=Status.PLANNED)
    provenance = models.CharField(max_length=20, default="user_setting")
    notify_telegram = models.BooleanField(default=False)
    confirmed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    confirmed_at = models.DateTimeField()
    obligation = models.ForeignKey(Obligation, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["due_date", "id"]


class Goal(models.Model):
    class Kind(models.TextChoices):
        SAFETY_CUSHION = "safety_cushion"
        SAVINGS = "savings"
        REVENUE = "revenue"
        EXPENSE_CAP = "expense_cap"
        NO_PERSONAL_LEAKS = "no_personal_leaks"

    class Status(models.TextChoices):
        ACTIVE = "active"
        ACHIEVED = "achieved"
        ARCHIVED = "archived"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="goals")
    kind = models.CharField(max_length=20, choices=Kind)
    title = models.CharField(max_length=120)
    target = models.BigIntegerField()
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status, default=Status.ACTIVE)

    class Meta:
        ordering = ["id"]


class Commitment(models.Model):
    """Повторяющийся платёж/поступление. Операция создаётся черновиком только после подтверждения человеком."""

    class Frequency(models.TextChoices):
        WEEKLY = "weekly"
        MONTHLY = "monthly"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="commitments")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="+")
    title = models.CharField(max_length=120)
    direction = models.CharField(max_length=3, choices=[("in", "in"), ("out", "out")], default="out")
    category = models.CharField(max_length=100)
    amount = models.BigIntegerField()
    frequency = models.CharField(max_length=8, choices=Frequency)
    next_date = models.DateField()
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["next_date", "id"]


class DebtorReminder(models.Model):
    """Черновик текста напоминания должнику; отправлять можно только после одобрения владельца."""

    class Status(models.TextChoices):
        DRAFT = "draft"
        APPROVED = "approved"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="debtor_reminders")
    counterparty = models.CharField(max_length=200)
    amount = models.BigIntegerField()
    text = models.TextField()
    status = models.CharField(max_length=10, choices=Status, default=Status.DRAFT)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class OwnerSplit(models.Model):
    """Как владелец делит свободные деньги: доля «развитию» и «себе». Остальное — «держит бизнес на плаву», его считает сервис."""

    business = models.OneToOneField(Business, on_delete=models.CASCADE, related_name="owner_split")
    development_pct = models.PositiveSmallIntegerField(default=50)
    owner_pct = models.PositiveSmallIntegerField(default=50)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(development_pct__lte=100, owner_pct__lte=100)
                                   & models.Q(development_pct__gte=0, owner_pct__gte=0), name="owner_split_range"),
            models.CheckConstraint(condition=models.Q(development_pct=100 - models.F("owner_pct")), name="owner_split_sum_100"),
        ]
