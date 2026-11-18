from django.urls import path

from . import views

urlpatterns = [
    path("decisions/afford/", views.afford),
    path("planning/afford/", views.afford),
    path("planning/split/", views.owner_split),
    path("cash-close/", views.cash_close),
    path("cash-close/expected/", views.cash_close_expected),
    path("cash-close/<int:id>/", views.cash_close_detail),
    path("reports/period/", views.period_report),
    path("tax/reserve/", views.tax_reserve),
    path("tax/reminders/", views.tax_reminders),
    path("tax/reminders/<int:id>/", views.tax_reminder_detail),
    path("goals/", views.goals),
    path("goals/<int:id>/", views.goal_detail),
    path("benchmarks/", views.benchmarks),
    path("seasonality/", views.seasonality),
    path("debtors/", views.debtors),
    path("debtors/reminders/", views.debtor_reminders),
    path("debtors/reminders/<int:id>/", views.debtor_reminder_detail),
    path("commitments/", views.commitments),
    path("commitments/<int:id>/", views.commitment_detail),
    path("commitments/<int:id>/confirm/", views.commitment_confirm),
]
