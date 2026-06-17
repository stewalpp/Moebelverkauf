from pathlib import Path
import unittest

import yaml

from wohnungssuche import feed
from wohnungssuche.filters import effective_total_rent, evaluate_listing
from wohnungssuche.models import Listing
from wohnungssuche.parser import build_listing


CRIT = {
    "min_rooms": 3,
    "min_area_sqm": 70,
    "max_total_rent_eur": 1000,
    "require_ground_floor": False,
    "allow_unknown_floor": True,
    "strict_location": True,
    "allowed_location_terms": ["barsinghausen", "gehrden"],
    "excluded_location_terms": ["seelze"],
    "excluded_terms": ["altbau"],
}


def make(**kw) -> Listing:
    base = dict(
        source_name="Immowelt Barsinghausen 3 Zimmer",
        title="Schoene 3 Zimmer Wohnung",
        url="https://www.immowelt.de/expose/" + kw.pop("uid", "x"),
        text="3 Zimmer 80 qm Barsinghausen Erdgeschoss",
        rooms=3.0,
        area_sqm=80.0,
    )
    base.update(kw)
    return Listing(**base)


class WarmRentBudgetTests(unittest.TestCase):
    def test_warm_over_cap_is_rejected(self):
        # 850 kalt + 250 NK = 1100 warm > 1000 cap -> must NOT pass
        listing = make(price_eur=850.0, kaltmiete_eur=850.0, nebenkosten_eur=250.0, uid="warm-over")
        result = evaluate_listing(listing, CRIT)
        self.assertFalse(result.accepted)
        self.assertTrue(any("zu teuer" in r for r in result.reasons))

    def test_warm_under_cap_is_accepted(self):
        listing = make(price_eur=600.0, kaltmiete_eur=600.0, nebenkosten_eur=150.0, uid="warm-under")
        result = evaluate_listing(listing, CRIT)
        self.assertTrue(result.accepted)
        self.assertTrue(any("750" in r and "warm" in r for r in result.reasons))

    def test_cold_only_borderline_flags_review(self):
        # 900 kalt, no NK known -> warm unknown but likely over -> review note
        listing = make(price_eur=900.0, kaltmiete_eur=900.0, uid="cold-borderline")
        result = evaluate_listing(listing, CRIT)
        self.assertTrue(result.accepted)
        self.assertIn("Miete und Nebenkosten pruefen", result.review_notes)

    def test_cold_only_comfortable_accepts_without_review(self):
        listing = make(price_eur=600.0, kaltmiete_eur=600.0, uid="cold-ok")
        result = evaluate_listing(listing, CRIT)
        self.assertTrue(result.accepted)
        self.assertNotIn("Miete und Nebenkosten pruefen", result.review_notes)

    def test_effective_total_rent(self):
        self.assertEqual(effective_total_rent(make(warmmiete_eur=990.0)), 990.0)
        self.assertEqual(
            effective_total_rent(make(kaltmiete_eur=700.0, nebenkosten_eur=150.0, heizkosten_eur=50.0)),
            900.0,
        )
        # only cold known -> total genuinely unknown
        self.assertIsNone(effective_total_rent(make(kaltmiete_eur=700.0)))


class PriceParseTests(unittest.TestCase):
    def test_kaution_before_rent_is_not_taken_as_price(self):
        text = "Kaution 1.500 EUR Kaltmiete 720 EUR Nebenkosten 150 EUR 80 qm 3 Zimmer Barsinghausen Erdgeschoss"
        listing = build_listing("Kleinanzeigen Barsinghausen 3 Zimmer", "3 Zimmer Wohnung", "https://www.kleinanzeigen.de/s-anzeige/a/1", text)
        self.assertEqual(listing.price_eur, 720.0)
        self.assertEqual(listing.kaltmiete_eur, 720.0)


class LocationTests(unittest.TestCase):
    def test_town_pinned_source_is_not_rejected_without_town_in_text(self):
        listing = Listing(
            source_name="Kleinanzeigen Gehrden 3 Zimmer",
            title="Helle 3 Zimmer Wohnung",
            url="https://www.kleinanzeigen.de/s-anzeige/b/2",
            text="Helle 3 Zimmer Wohnung Erdgeschoss 80 qm Kaltmiete 600 EUR",
            rooms=3.0, area_sqm=80.0, price_eur=600.0, kaltmiete_eur=600.0,
        )
        result = evaluate_listing(listing, CRIT)
        self.assertTrue(result.accepted)
        self.assertIn("Ort im Inserat pruefen", result.review_notes)

    def test_non_area_source_without_town_is_rejected(self):
        listing = Listing(
            source_name="Immowelt Region Hannover 3 Zimmer",
            title="3 Zimmer Wohnung",
            url="https://www.immowelt.de/expose/c3",
            text="3 Zimmer Wohnung Erdgeschoss 80 qm Kaltmiete 600 EUR",
            rooms=3.0, area_sqm=80.0, price_eur=600.0, kaltmiete_eur=600.0,
        )
        result = evaluate_listing(listing, CRIT)
        self.assertFalse(result.accepted)
        self.assertIn("Lage nicht im Suchgebiet erkannt", result.reasons)


class ExclusionConfigTests(unittest.TestCase):
    def test_gesuch_removed_so_nachmieter_gesucht_is_not_excluded(self):
        config = yaml.safe_load(Path("config/search.yml").read_text(encoding="utf-8"))
        criteria = config["criteria"]
        self.assertNotIn("gesuch", criteria.get("excluded_terms", []))
        listing = Listing(
            source_name="Kleinanzeigen Barsinghausen 3 Zimmer",
            title="3 Zimmer Wohnung in Barsinghausen, Nachmieter gesucht",
            url="https://www.kleinanzeigen.de/s-anzeige/d/4",
            text="Schoene 3 Zimmer Wohnung Barsinghausen Erdgeschoss 80 qm Kaltmiete 700 EUR Nebenkosten 150 EUR Nachmieter gesucht",
            rooms=3.0, area_sqm=80.0, price_eur=700.0, kaltmiete_eur=700.0, nebenkosten_eur=150.0,
        )
        result = evaluate_listing(listing, criteria)
        self.assertTrue(result.accepted, result.reasons)


class FeedDedupTests(unittest.TestCase):
    def test_same_flat_across_portals_collapses_in_feed(self):
        now = "2026-06-17T10:00:00+00:00"
        common = dict(
            price_eur=700.0, area_sqm=80.0, rooms=3.0,
            location="30890 Barsinghausen", title="Tolle 3 Zimmer Wohnung mit Balkon",
            match_status="match", first_seen=now, last_seen_in_search=now,
            availability_status="available",
        )
        state = {"seen": {
            "id_immowelt": {**common, "source": "Immowelt Barsinghausen 3 Zimmer", "url": "https://www.immowelt.de/expose/dup"},
            "id_kleinanz": {**common, "source": "Kleinanzeigen Barsinghausen 3 Zimmer", "url": "https://www.kleinanzeigen.de/s-anzeige/dup/9"},
        }}
        payload = feed.build_feed(state, CRIT, now)
        self.assertEqual(payload["counts"]["total"], 1)


if __name__ == "__main__":
    unittest.main()
