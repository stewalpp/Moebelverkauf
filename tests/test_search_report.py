import unittest

from wohnungssuche.filters import MatchResult
from wohnungssuche.models import Listing
from wohnungssuche.search import format_listing, should_fail_run


class SearchReportTests(unittest.TestCase):
    def test_listing_contains_clickable_rating_fields(self):
        listing = Listing(
            source_name="test",
            title="Wohnung zur Miete 3 Zimmer, 80 qm, EG",
            url="https://example.test/listing",
            text="3 Zimmer 80 qm 900 EUR EG Barsinghausen",
            rooms=3,
            area_sqm=80,
            price_eur=900,
            floor="eg",
        )
        result = MatchResult(
            accepted=True,
            reasons=["3 Zimmer", "80 qm", "900 EUR"],
            review_notes=[],
        )

        markdown = "\n".join(format_listing(1, listing, result, review_candidate=False))

        self.assertIn("<summary>Bewertung anklicken</summary>", markdown)
        self.assertIn("Bitte pro Person genau ein Feld markieren.", markdown)
        self.assertIn("\U0001F535 stewalpp (Blau)", markdown)
        self.assertIn("\U0001F7E2 gishaa-create (Gruen)", markdown)
        self.assertIn("- [ ] Gut", markdown)
        self.assertIn("- [ ] Vielleicht", markdown)
        self.assertIn("- [ ] Schlecht", markdown)
        self.assertEqual(markdown.count("- [ ] "), 6)
        self.assertNotIn("- [ ] 10", markdown)

    def test_partial_source_errors_do_not_fail_run(self):
        self.assertFalse(should_fail_run(["Immowelt: 403"], successful_sources=1))
        self.assertTrue(should_fail_run(["Immowelt: 403"], successful_sources=0))


if __name__ == "__main__":
    unittest.main()
