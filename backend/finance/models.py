from django.contrib.postgres.indexes import GinIndex
from django.db import models

from accounts.models import Business


class Account(models.Model):
    class Kind(models.TextChoices):
        CASH = "cash"
        CARD = "card"
        BANK = "bank"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=Kind)
    opening_balance = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class Transaction(models.Model):
    class Direction(models.TextChoices):
        IN = "in"
        OUT = "out"
        TRANSFER = "transfer"

    class Purpose(models.TextChoices):
        BUSINESS = "business"
        PERSONAL = "personal"
        UNCLEAR = "unclear"

    class Status(models.TextChoices):
        DRAFT = "draft"
        CONFIRMED = "confirmed"

    class Source(models.TextChoices):
        MANUAL = "manual"
        VOICE = "voice"
        CHAT = "chat"
        IMPORT = "import"
        SEED = "seed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="transactions")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="transactions")
    # Куда ушёл перевод между своими счетами (не показывается в API, нужен для остатков).
    transfer_account = models.ForeignKey(
        Account, null=True, blank=True, on_delete=models.SET_NULL, related_name="incoming_transfers"
    )
    date = models.DateField()
    amount = models.BigIntegerField()
    direction = models.CharField(max_length=10, choices=Direction)
    category = models.CharField(max_length=100)
    purpose = models.CharField(max_length=10, choices=Purpose, default=Purpose.BUSINESS)
    counterparty = models.CharField(max_length=200, null=True, blank=True)
    note = models.TextField(blank=True, default="")
    status = models.CharField(max_length=10, choices=Status, default=Status.CONFIRMED)
    source = models.CharField(max_length=10, choices=Source, default=Source.MANUAL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["business", "date"]),
            GinIndex(fields=["note"], name="tx_note_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["counterparty"], name="tx_cp_trgm", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["category"], name="tx_cat_trgm", opclasses=["gin_trgm_ops"]),
        ]


class Obligation(models.Model):
    class Kind(models.TextChoices):
        SALARY = "salary"
        RENT = "rent"
        TAX = "tax"
        SUPPLIER = "supplier"
        LOAN = "loan"
        OTHER = "other"
        RECEIVABLE = "receivable"

    class Status(models.TextChoices):
        PLANNED = "planned"
        PAID = "paid"
        OVERDUE = "overdue"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="obligations")
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=12, choices=Kind)
    amount = models.BigIntegerField()
    due_date = models.DateField()
    status = models.CharField(max_length=10, choices=Status, default=Status.PLANNED)

    class Meta:
        ordering = ["due_date", "id"]


class Envelope(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="envelopes")
    title = models.CharField(max_length=200)
    target = models.BigIntegerField()
    saved = models.BigIntegerField(default=0)
    due_date = models.DateField()

    class Meta:
        ordering = ["due_date", "id"]


class Product(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=200)
    price = models.BigIntegerField()
    unit_cost = models.BigIntegerField()
    cost_is_estimate = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]


class Order(models.Model):
    class Channel(models.TextChoices):
        RETAIL = "retail"
        SHOWROOM = "showroom"
        B2B = "b2b"
        ONLINE = "online"

    class Status(models.TextChoices):
        BRIEF = "brief"
        SAMPLE = "sample"
        PRODUCTION = "production"
        QC = "qc"
        DELIVERED = "delivered"
        PAID = "paid"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="orders")
    client = models.CharField(max_length=200)
    channel = models.CharField(max_length=10, choices=Channel)
    total = models.BigIntegerField()
    prepaid = models.BigIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status, default=Status.BRIEF)
    due_date = models.DateField()

    class Meta:
        ordering = ["-due_date", "-id"]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty = models.PositiveIntegerField()
    price = models.BigIntegerField()

    class Meta:
        ordering = ["id"]
