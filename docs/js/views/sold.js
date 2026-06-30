/* ============================================================
   Möbelverkauf — js/views/sold.js
   Views.sold ("Verkauft"): was tatsächlich reingekommen ist —
   Gesamterlös, Vergleich zum Wunschpreis, Aufteilung nach Person
   und die Liste der verkauften Objekte.
   ============================================================ */
(function () {
  'use strict';

  var Views = window.Views = window.Views || {};

  function soldRow(it) {
    var row = App.el('button', 'list-row item-row');
    row.type = 'button';

    if (it.photo) {
      var wrap = App.el('div', 'item-thumb');
      var img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = it.photo;
      img.addEventListener('error', function () { wrap.innerHTML = ''; wrap.appendChild(App.catIcon(Catalog.category(it.category))); });
      wrap.appendChild(img);
      row.appendChild(wrap);
    } else {
      row.appendChild(App.catIcon(Catalog.category(it.category)));
    }

    var main = App.el('div', 'row-main');
    main.appendChild(App.el('div', 'row-title', it.name || 'Ohne Namen'));
    var sub = [];
    if (it.soldAt) sub.push(App.fmtDate(it.soldAt));
    if (it.buyer) sub.push('an ' + it.buyer);
    else if (it.platform) sub.push(Catalog.platformLabel(it.platform));
    main.appendChild(App.el('div', 'row-sub', sub.join(' · ') || 'verkauft'));
    row.appendChild(main);

    var trailing = App.el('div', 'row-trailing');
    var v = it.soldPrice != null ? it.soldPrice : it.askingPrice;
    trailing.appendChild(App.el('span', 'amount-pos', App.fmtEUR(v)));
    if (it.askingPrice != null && it.soldPrice != null && it.soldPrice !== it.askingPrice) {
      var diff = it.soldPrice - it.askingPrice;
      trailing.appendChild(App.el('span', 'row-diff ' + (diff >= 0 ? 'pos' : 'neg'),
        (diff >= 0 ? '+' : '−') + App.fmtEUR(Math.abs(diff))));
    }
    row.appendChild(trailing);

    row.addEventListener('click', function () { Views.items.openEditor(it); });
    return row;
  }

  function buildSummaryText(items, s) {
    var lines = [];
    lines.push('Möbelverkauf – Stand ' + App.fmtDate(new Date().toISOString()));
    lines.push('Eingenommen: ' + App.fmtEUR(s.earned) + ' (' + s.soldCount + ' verkauft)');
    if (s.expected > 0) lines.push('Noch erwartet: ' + App.fmtEUR(s.expected));
    lines.push('');
    items.filter(function (it) { return it.status === 'verkauft'; })
      .sort(function (a, b) { return (b.soldAt || '').localeCompare(a.soldAt || ''); })
      .forEach(function (it) {
        var v = it.soldPrice != null ? it.soldPrice : it.askingPrice;
        lines.push('• ' + (it.name || 'Objekt') + ': ' + App.fmtEUR(v) +
          (it.buyer ? ' (' + it.buyer + ')' : ''));
      });
    return lines.join('\n');
  }

  function render(container) {
    container.innerHTML = '';
    var view = App.el('div', 'view');

    var items = Store.getItems();
    var s = Sales.summary(items);
    var sold = items.filter(function (it) { return it.status === 'verkauft'; })
      .sort(function (a, b) { return (b.soldAt || b.updatedAt || '').localeCompare(a.soldAt || a.updatedAt || ''); });

    if (!sold.length) {
      view.appendChild(Views.items.emptyState('coins', 'Noch nichts verkauft',
        'Sobald ihr ein Objekt auf „Verkauft" setzt und den Erlös einträgt, erscheint es hier – mit Gesamtsumme.'));
      container.appendChild(view);
      return;
    }

    /* ---- Hero ---- */
    var hero = App.el('div', 'card hero-card');
    hero.appendChild(App.el('div', 'card-title', 'Gesamterlös'));
    hero.appendChild(App.el('div', 'hero-amount', App.fmtEUR(s.earned)));
    hero.appendChild(App.el('div', 'hero-sub',
      'aus ' + s.soldCount + (s.soldCount === 1 ? ' verkauften Objekt' : ' verkauften Objekten')));
    view.appendChild(hero);

    /* ---- Vergleich zum Wunschpreis ---- */
    if (s.askingOfSold > 0) {
      var cmp = App.el('div', 'card');
      cmp.appendChild(App.el('div', 'card-title', 'Im Vergleich zum Wunschpreis'));
      var r1 = App.el('div', 'kv-row');
      r1.appendChild(App.el('span', null, 'Summe Wunschpreise'));
      r1.appendChild(App.el('span', 'kv-value', App.fmtEUR(s.askingOfSold)));
      cmp.appendChild(r1);
      var r2 = App.el('div', 'kv-row');
      r2.appendChild(App.el('span', null, 'Tatsächlich erzielt'));
      r2.appendChild(App.el('span', 'kv-value', App.fmtEUR(s.earned)));
      cmp.appendChild(r2);
      var r3 = App.el('div', 'kv-row');
      r3.appendChild(App.el('span', null, 'Differenz'));
      var diffEl = App.el('span', 'kv-value ' + (s.soldVsAsking >= 0 ? 'pos' : 'neg'),
        (s.soldVsAsking >= 0 ? '+' : '−') + App.fmtEUR(Math.abs(s.soldVsAsking)));
      r3.appendChild(diffEl);
      cmp.appendChild(r3);
      cmp.appendChild(App.el('div', 'card-hint',
        s.soldVsAsking >= 0
          ? 'Ihr habt insgesamt etwas über den Wunschpreisen verkauft.'
          : 'Ihr habt insgesamt etwas unter den Wunschpreisen verkauft – ganz normal beim Verhandeln.'));
      view.appendChild(cmp);
    }

    /* ---- Aufteilung nach Person ---- */
    var per = Sales.byPerson(items);
    var members = Store.getSettings().members;
    var rows = [];
    [['p1', members[0]], ['p2', members[1]], ['beide', { name: 'Beide' }]].forEach(function (pair) {
      var key = pair[0], m = pair[1], d = per[key];
      if (!d || d.sold === 0) return;
      rows.push({ name: m ? m.name : key, earned: d.earned, sold: d.sold, color: (key === 'beide') ? 'var(--gray)' : Store.memberColor(key) });
    });
    if (rows.length) {
      var pc = App.el('div', 'card');
      pc.appendChild(App.el('div', 'card-title', 'Erlös nach Person'));
      rows.forEach(function (p) {
        var row = App.el('div', 'kv-row');
        var left = App.el('span', 'status-kv-left');
        var dot = App.el('span', 'person-dot'); dot.style.background = p.color;
        left.appendChild(dot);
        left.appendChild(App.el('span', null, p.name));
        row.appendChild(left);
        row.appendChild(App.el('span', 'kv-value', App.fmtEUR(p.earned) + ' · ' + p.sold + ' Obj.'));
        pc.appendChild(row);
      });
      view.appendChild(pc);
    }

    /* ---- Liste der verkauften Objekte ---- */
    view.appendChild(App.el('div', 'section-title', 'Verkaufte Objekte'));
    var group = App.el('div', 'list-group');
    sold.forEach(function (it) { group.appendChild(soldRow(it)); });
    view.appendChild(group);

    /* ---- Zusammenfassung kopieren ---- */
    var copyBtn = App.el('button', 'btn btn-secondary', 'Zusammenfassung kopieren');
    copyBtn.type = 'button';
    copyBtn.appendChild(App.icon('copy', 15));
    copyBtn.addEventListener('click', function () {
      var text = buildSummaryText(items, s);
      function ok() { App.toast('Zusammenfassung kopiert ✓'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(function () { App.toast('Kopieren nicht möglich'); });
      } else {
        App.toast('Kopieren nicht möglich');
      }
    });
    view.appendChild(copyBtn);

    container.appendChild(view);
  }

  Views.sold = { title: 'Verkauft', render: render };
})();
