/* ============================================================
   Möbelverkauf — js/views/dashboard.js
   Views.dashboard ("Übersicht"): die wichtigsten Zahlen auf einen
   Blick — eingenommen, erwartet, Fortschritt, Aufteilung nach Status,
   Person und Kategorie.
   ============================================================ */
(function () {
  'use strict';

  var Views = window.Views = window.Views || {};

  function openItems(scope) {
    if (Views.items && Views.items.setScope) Views.items.setScope(scope);
    App.switchTab('items');
  }

  function statTile(value, label, tone, scope) {
    var t = App.el('div', 'stat' + (scope ? ' tappable' : ''));
    t.appendChild(App.el('div', 'stat-value' + (tone ? ' ' + tone : ''), value));
    t.appendChild(App.el('div', 'stat-label', label));
    if (scope) {
      t.setAttribute('role', 'button');
      t.addEventListener('click', function () { openItems(scope); });
    }
    return t;
  }

  function render(container) {
    container.innerHTML = '';
    var view = App.el('div', 'view');

    var items = Store.getItems();

    if (!items.length) {
      view.appendChild(Views.items.emptyState('box', 'Willkommen beim Möbelverkauf',
        'Hier seht ihr später, was rein- und rauskommt. Legt mit „+" das erste Objekt an, das ihr verkaufen wollt.'));
      var add = App.el('button', 'btn btn-primary');
      add.type = 'button';
      add.textContent = 'Erstes Objekt hinzufügen';
      add.style.maxWidth = '320px';
      add.style.margin = '4px auto 0';
      add.addEventListener('click', function () { Views.items.openEditor(null); });
      view.appendChild(add);
      container.appendChild(view);
      return;
    }

    var s = Sales.summary(items);

    /* ---- Hero: eingenommen ---- */
    var hero = App.el('div', 'card hero-card');
    hero.appendChild(App.el('div', 'card-title', 'Bisher eingenommen'));
    hero.appendChild(App.el('div', 'hero-amount', App.fmtEUR(s.earned)));
    var heroSub = s.soldCount + (s.soldCount === 1 ? ' verkauftes Objekt' : ' verkaufte Objekte');
    if (s.expected > 0) heroSub += ' · noch ' + App.fmtEUR(s.expected) + ' erwartet';
    hero.appendChild(App.el('div', 'hero-sub', heroSub));

    // Fortschritt: eingenommen vom Gesamtpotenzial
    if (s.potential > 0) {
      var prog = App.el('div', 'progress');
      var fill = App.el('div', 'progress-fill');
      fill.style.width = Math.max(2, Math.round(s.earned / s.potential * 100)) + '%';
      prog.appendChild(fill);
      hero.appendChild(prog);
      var legend = App.el('div', 'hero-progress-legend');
      legend.appendChild(App.el('span', null, App.fmtEUR(s.earned) + ' von ~' + App.fmtEUR(s.potential)));
      legend.appendChild(App.el('span', null, Math.round(s.earned / s.potential * 100) + ' %'));
      hero.appendChild(legend);
    }
    view.appendChild(hero);

    /* ---- Kennzahlen ---- */
    var grid = App.el('div', 'stat-grid');
    grid.appendChild(statTile(String(s.openCount), 'Zu verkaufen', null, 'offen'));
    grid.appendChild(statTile(String(s.reservedCount), 'Reserviert', s.reservedCount ? 'saving' : null, 'reserviert'));
    grid.appendChild(statTile(String(s.soldCount), 'Verkauft', s.soldCount ? 'pos' : null, 'verkauft'));
    grid.appendChild(statTile(String(s.total), 'Gesamt', null, 'alle'));
    view.appendChild(grid);

    /* ---- Erwartete Einnahmen ---- */
    if (s.expected > 0) {
      var expCard = App.el('div', 'card');
      expCard.appendChild(App.el('div', 'card-title', 'Noch erwartet'));
      var er = App.el('div', 'kv-row');
      er.appendChild(App.el('span', null, 'Offen (Wunschpreise)'));
      er.appendChild(App.el('span', 'kv-value', App.fmtEUR(s.openValue)));
      expCard.appendChild(er);
      if (s.reservedValue > 0) {
        var rr = App.el('div', 'kv-row');
        rr.appendChild(App.el('span', null, 'Reserviert'));
        rr.appendChild(App.el('span', 'kv-value', App.fmtEUR(s.reservedValue)));
        expCard.appendChild(rr);
      }
      if (s.withoutPrice > 0) {
        expCard.appendChild(App.el('div', 'card-hint',
          s.withoutPrice + (s.withoutPrice === 1 ? ' offenes Objekt hat' : ' offene Objekte haben') + ' noch keinen Wunschpreis.'));
      }
      view.appendChild(expCard);
    }

    /* ---- Status-Aufteilung ---- */
    var statusCard = App.el('div', 'card');
    statusCard.appendChild(App.el('div', 'card-title', 'Status'));
    var anyStatus = false;
    Catalog.statuses.forEach(function (st) {
      var count = s.counts[st.key] || 0;
      if (!count) return;
      anyStatus = true;
      var row = App.el('div', 'kv-row');
      var left = App.el('span', 'status-kv-left');
      var dot = App.el('span', 'status-dot ' + st.cls);
      left.appendChild(dot);
      left.appendChild(App.el('span', null, st.label));
      row.appendChild(left);
      row.appendChild(App.el('span', 'kv-value', String(count)));
      statusCard.appendChild(row);
    });
    if (anyStatus) view.appendChild(statusCard);

    /* ---- Aufteilung nach Person ---- */
    var per = Sales.byPerson(items);
    var members = Store.getSettings().members;
    var personRows = [];
    [['p1', members[0]], ['p2', members[1]], ['beide', { name: 'Beide' }]].forEach(function (pair) {
      var key = pair[0], m = pair[1];
      var d = per[key];
      if (!d || d.total === 0) return;
      personRows.push({ key: key, name: m ? m.name : key, data: d, color: (key === 'beide') ? 'var(--gray)' : Store.memberColor(key) });
    });
    if (personRows.length) {
      var pc = App.el('div', 'card');
      pc.appendChild(App.el('div', 'card-title', 'Wer kümmert sich'));
      personRows.forEach(function (p) {
        var row = App.el('div', 'kv-row');
        var left = App.el('span', 'status-kv-left');
        var dot = App.el('span', 'person-dot'); dot.style.background = p.color;
        left.appendChild(dot);
        left.appendChild(App.el('span', null, p.name));
        row.appendChild(left);
        var val = p.data.sold ? (App.fmtEUR(p.data.earned) + ' · ' + p.data.total + ' Obj.') : (p.data.total + ' Obj.');
        row.appendChild(App.el('span', 'kv-value', val));
        pc.appendChild(row);
      });
      view.appendChild(pc);
    }

    /* ---- Nach Kategorie ---- */
    var cats = Sales.byCategory(items);
    if (cats.length) {
      var cc = App.el('div', 'card');
      cc.appendChild(App.el('div', 'card-title', 'Nach Kategorie'));
      cats.sort(function (a, b) { return b.count - a.count; });
      cats.forEach(function (cat) {
        var row = App.el('div', 'kv-row');
        var left = App.el('span', 'status-kv-left');
        left.appendChild(App.el('span', 'cat-emoji', cat.emoji));
        left.appendChild(App.el('span', null, cat.label));
        row.appendChild(left);
        var label = cat.count + (cat.count === 1 ? ' Obj.' : ' Obj.');
        if (cat.earned > 0) label = App.fmtEUR(cat.earned) + ' · ' + label;
        row.appendChild(App.el('span', 'kv-value', label));
        cc.appendChild(row);
      });
      view.appendChild(cc);
    }

    container.appendChild(view);
  }

  Views.dashboard = { title: 'Übersicht', render: render };
})();
