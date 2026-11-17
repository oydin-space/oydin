from django.contrib import admin

from . import models

for model in (models.CashClose, models.TaxReserve, models.TaxReminder, models.Goal, models.Commitment,
              models.DebtorReminder):
    admin.site.register(model)
