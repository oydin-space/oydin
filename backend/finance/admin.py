from django.contrib import admin

from . import models

for model in (models.Account, models.Transaction, models.Obligation, models.Envelope, models.Product, models.Order):
    admin.site.register(model)
