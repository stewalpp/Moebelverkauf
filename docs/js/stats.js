/* ============================================================
   Möbelverkauf — js/stats.js
   window.Sales: reine Rechen-Helfer für die Übersicht & Bilanz.
   Keine DOM-Berührung, nur Zahlen aus der Objektliste.
   ============================================================ */
(function () {
  'use strict';

  function n(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }

  // Erlös eines Objekts: tatsächlicher Verkaufspreis, sonst 0.
  function earnedOf(it) {
    return (it.status === 'verkauft') ? n(it.soldPrice) : 0;
  }

  // Erwarteter (noch ausstehender) Erlös: Wunschpreis bei offen/reserviert.
  function expectedOf(it) {
    var s = window.Catalog && Catalog.status(it.status);
    return (s && s.expects) ? n(it.askingPrice) : 0;
  }

  function summary(items) {
    var out = {
      total: items.length,
      counts: { offen: 0, reserviert: 0, verkauft: 0, verschenkt: 0, entsorgt: 0, behalten: 0 },
      earned: 0,            // Σ tatsächlicher Erlös (verkauft)
      expected: 0,          // Σ Wunschpreis (offen + reserviert)
      reservedValue: 0,     // Σ Wunschpreis (nur reserviert)
      openValue: 0,         // Σ Wunschpreis (nur offen)
      askingOfSold: 0,      // Σ Wunschpreis der verkauften (für Vergleich)
      soldCount: 0,
      openCount: 0,
      reservedCount: 0,
      doneCount: 0,
      withoutPrice: 0       // offene Objekte ohne Wunschpreis
    };

    items.forEach(function (it) {
      if (out.counts[it.status] !== undefined) out.counts[it.status]++;
      var st = window.Catalog && Catalog.status(it.status);

      out.earned += earnedOf(it);
      out.expected += expectedOf(it);

      if (it.status === 'offen') {
        out.openCount++;
        out.openValue += n(it.askingPrice);
        if (it.askingPrice == null) out.withoutPrice++;
      } else if (it.status === 'reserviert') {
        out.reservedCount++;
        out.reservedValue += n(it.askingPrice);
      } else if (it.status === 'verkauft') {
        out.soldCount++;
        out.askingOfSold += n(it.askingPrice);
      }
      if (st && st.done) out.doneCount++;
    });

    // Gesamtpotenzial = bereits eingenommen + noch erwartet
    out.potential = out.earned + out.expected;
    // Differenz verkauft ggü. Wunschpreis (nur Objekte, die einen Wunschpreis hatten)
    out.soldVsAsking = out.earned - out.askingOfSold;
    return out;
  }

  // Aufschlüsselung nach Person (wer kümmert sich): Erlös + Anzahl verkauft.
  function byPerson(items) {
    var map = {
      p1: { earned: 0, sold: 0, total: 0 },
      p2: { earned: 0, sold: 0, total: 0 },
      beide: { earned: 0, sold: 0, total: 0 },
      none: { earned: 0, sold: 0, total: 0 }
    };
    items.forEach(function (it) {
      var key = (it.owner === 'p1' || it.owner === 'p2' || it.owner === 'beide') ? it.owner : 'none';
      map[key].total++;
      if (it.status === 'verkauft') {
        map[key].sold++;
        map[key].earned += n(it.soldPrice);
      }
    });
    return map;
  }

  // Aufschlüsselung nach Kategorie: Anzahl, Erlös, erwarteter Wert.
  function byCategory(items) {
    var cats = (window.Catalog && Catalog.categories) || [];
    var rows = cats.map(function (c) {
      return { key: c.key, label: c.label, emoji: c.emoji, color: c.color, count: 0, earned: 0, expected: 0 };
    });
    var index = {};
    rows.forEach(function (r) { index[r.key] = r; });
    items.forEach(function (it) {
      var r = index[it.category] || index.sonstiges;
      if (!r) return;
      r.count++;
      r.earned += earnedOf(it);
      r.expected += expectedOf(it);
    });
    return rows.filter(function (r) { return r.count > 0; });
  }

  window.Sales = {
    summary: summary,
    byPerson: byPerson,
    byCategory: byCategory,
    earnedOf: earnedOf,
    expectedOf: expectedOf
  };
})();
