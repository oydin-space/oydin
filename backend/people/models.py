from django.db import models


class Location(models.Model):
    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="locations")
    name = models.CharField(max_length=100)
    address = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["id"]


class Person(models.Model):
    class Kind(models.TextChoices):
        STAFF = "staff"
        CONTRACTOR = "contractor"
        BUYER = "buyer"
        PARTNER = "partner"

    class PayType(models.TextChoices):
        MONTHLY = "monthly"
        HOURLY = "hourly"
        PER_TASK = "per_task"
        PERCENT = "percent"
        NONE = "none"

    class Currency(models.TextChoices):
        UZS = "UZS"
        USD = "USD"
        RUB = "RUB"
        EUR = "EUR"

    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="people")
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.STAFF)
    pay_type = models.CharField(max_length=10, choices=PayType.choices, default=PayType.NONE)
    pay_amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.UZS)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.SET_NULL, related_name="people")
    role_title = models.CharField(max_length=100, blank=True, default="")
    started_on = models.DateField(null=True, blank=True)
    ended_on = models.DateField(null=True, blank=True)
    note = models.CharField(max_length=1000, blank=True, default="")

    class Meta:
        ordering = ["id"]
