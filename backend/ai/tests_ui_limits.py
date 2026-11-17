from django.test import SimpleTestCase

from . import ui


class NumberLimitTests(SimpleTestCase):
    def test_huge_integer_is_invalid(self):
        with self.assertRaises(ui.Invalid):
            ui.parse('root = Stack([t])\nt = TextBlock("x")\nn = ' + "9" * 5000)

    def test_long_float_is_invalid(self):
        with self.assertRaises(ui.Invalid):
            ui.parse('root = Stack([t])\nt = StatCard("a", ' + "1" * 30 + ".5)")

    def test_validate_does_not_raise(self):
        self.assertIsNone(ui.validate_tool('root = Stack([t])\nt = TextBlock("' + "x" + '")\nn = ' + "9" * 5000))
