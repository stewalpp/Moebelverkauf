/* ============================================================
   Möbelverkauf — js/views/items.js
   Views.items ("Objekte"): die Hauptliste aller Verkaufsobjekte mit
   Suche, Status-Filtern, Sortierung sowie dem Bearbeiten-/Anlegen-
   Formular (Bottom-Sheet) inkl. Foto-Erfassung.
   ============================================================ */
(function () {
  'use strict';

  var Views = window.Views = window.Views || {};

  var SCOPES = [
    { key: 'alle', label: 'Alle', match: function () { return true; } },
    { key: 'offen', label: 'Zu verkaufen', match: function (it) { return it.status === 'offen'; } },
    { key: 'reserviert', label: 'Reserviert', match: function (it) { return it.status === 'reserviert'; } },
    { key: 'verkauft', label: 'Verkauft', match: function (it) { return it.status === 'verkauft'; } },
    { key: 'erledigt', label: 'Erledigt', match: function (it) { return it.status === 'verschenkt' || it.status === 'entsorgt' || it.status === 'behalten'; } }
  ];

  var SORTS = [
    ['neu', 'Neueste zuerst'],
    ['name', 'Name (A–Z)'],
    ['preis', 'Preis (höchster)'],
    ['status', 'Nach Status']
  ];

  var STATUS_ORDER = { offen: 0, reserviert: 1, verkauft: 2, verschenkt: 3, entsorgt: 4, behalten: 5 };

  var filterState = { query: '', scope: 'alle', sort: 'neu' };

  // -------- helpers

  function priceValue(it) {
    if (it.status === 'verkauft') return it.soldPrice != null ? it.soldPrice : it.askingPrice;
    return it.askingPrice;
  }

  function applyFilter(items) {
    var scope = SCOPES.find(function (s) { return s.key === filterState.scope; }) || SCOPES[0];
    var q = filterState.query.trim().toLowerCase();
    var out = items.filter(function (it) {
      if (!scope.match(it)) return false;
      if (q) {
        var hay = (it.name + ' ' + Catalog.categoryLabel(it.category) + ' ' + it.buyer + ' ' + it.note).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var sort = filterState.sort;
    out.sort(function (a, b) {
      if (sort === 'name') return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
      if (sort === 'preis') return (priceValue(b) || 0) - (priceValue(a) || 0);
      if (sort === 'status') {
        var d = (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
        return d !== 0 ? d : (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      // 'neu' (Standard): neueste zuerst
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return out;
  }

  function statusPill(status) {
    var s = Catalog.status(status);
    var pill = App.el('span', 'status-pill ' + s.cls, s.short);
    return pill;
  }

  function priceEl(it) {
    if (it.status === 'verkauft') {
      var v = it.soldPrice != null ? it.soldPrice : it.askingPrice;
      var el = App.el('span', 'amount-pos', App.fmtEUR(v));
      return el;
    }
    if (it.status === 'offen' || it.status === 'reserviert') {
      if (it.askingPrice == null) return App.el('span', 'item-price-muted', 'Preis offen');
      return App.el('span', 'item-price', App.fmtEUR(it.askingPrice));
    }
    return App.el('span', 'item-price-muted', '—');
  }

  function thumb(it) {
    if (it.photo) {
      var wrap = App.el('div', 'item-thumb');
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = it.photo;
      img.addEventListener('error', function () {
        wrap.innerHTML = '';
        wrap.appendChild(App.catIcon(Catalog.category(it.category)));
      });
      wrap.appendChild(img);
      return wrap;
    }
    return App.catIcon(Catalog.category(it.category));
  }

  function subText(it) {
    var parts = [Catalog.categoryLabel(it.category)];
    var owner = Store.ownerLabel(it.owner);
    if (owner) parts.push(owner);
    if (it.status === 'verkauft' && it.buyer) parts.push('an ' + it.buyer);
    else if (it.platform) parts.push(Catalog.platformLabel(it.platform));
    return parts.join(' · ');
  }

  function itemRow(it) {
    var cell = App.el('div', 'swipe-cell');
    var row = App.el('button', 'list-row item-row');
    row.type = 'button';

    row.appendChild(thumb(it));

    var main = App.el('div', 'row-main');
    main.appendChild(App.el('div', 'row-title', it.name || 'Ohne Namen'));
    main.appendChild(App.el('div', 'row-sub', subText(it)));
    row.appendChild(main);

    var trailing = App.el('div', 'row-trailing');
    trailing.appendChild(priceEl(it));
    trailing.appendChild(statusPill(it.status));
    row.appendChild(trailing);

    row.addEventListener('click', function () { openEditor(it); });
    cell.appendChild(row);
    return cell;
  }

  // -------- Foto: einlesen & komprimieren (als data-URL, gratis in Firestore)

  function compressPhoto(file, cb) {
    var reader = new FileReader();
    reader.onerror = function () { cb(null); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { cb(null); };
      img.onload = function () {
        var max = 1024;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var cw = Math.max(1, Math.round(img.width * scale));
        var ch = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
        var q = 0.72;
        var data;
        try { data = canvas.toDataURL('image/jpeg', q); } catch (e) { cb(null); return; }
        while (data.length > 400000 && q > 0.4) { q -= 0.12; data = canvas.toDataURL('image/jpeg', q); }
        cb(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // -------- Editor (anlegen & bearbeiten)

  function openEditor(existing) {
    var isEdit = !!existing;
    var draft = existing
      ? Object.assign({}, existing)
      : { name: '', category: 'moebel', askingPrice: null, soldPrice: null, status: 'offen', buyer: '', platform: '', owner: '', note: '', photo: '' };

    var c = App.el('div', 'editor');

    /* ---- Foto ---- */
    var photoGroup = App.el('div', 'form-group');
    var photoWrap = App.el('div', 'photo-edit');
    function renderPhoto() {
      photoWrap.innerHTML = '';
      if (draft.photo) {
        var img = document.createElement('img');
        img.className = 'photo-edit-img';
        img.src = draft.photo; img.alt = '';
        photoWrap.appendChild(img);
        var rm = App.el('button', 'photo-edit-remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Foto entfernen');
        rm.appendChild(App.icon('x', 16));
        rm.addEventListener('click', function () { draft.photo = ''; renderPhoto(); });
        photoWrap.appendChild(rm);
      } else {
        var ph = App.el('div', 'photo-edit-placeholder');
        ph.appendChild(App.icon('camera', 26));
        ph.appendChild(App.el('span', null, 'Foto hinzufügen'));
        photoWrap.appendChild(ph);
      }
    }
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.setAttribute('capture', 'environment');
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      App.toast('Foto wird verarbeitet …');
      compressPhoto(f, function (data) {
        fileInput.value = '';
        if (!data) { App.toast('Foto konnte nicht geladen werden'); return; }
        draft.photo = data;
        renderPhoto();
      });
    });
    photoWrap.addEventListener('click', function () { fileInput.click(); });
    renderPhoto();
    photoGroup.appendChild(photoWrap);
    photoGroup.appendChild(fileInput);
    c.appendChild(photoGroup);

    /* ---- Name ---- */
    var nameGroup = App.el('div', 'form-group');
    nameGroup.appendChild(App.el('label', 'form-label', 'Was wird verkauft?'));
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.className = 'input';
    nameInput.placeholder = 'z. B. Esstisch Eiche, Sofa, Waschmaschine …';
    nameInput.value = draft.name;
    nameInput.setAttribute('autocapitalize', 'sentences');
    nameInput.addEventListener('input', function () { draft.name = nameInput.value; });
    nameGroup.appendChild(nameInput);
    c.appendChild(nameGroup);

    /* ---- Kategorie ---- */
    var catGroup = App.el('div', 'form-group');
    catGroup.appendChild(App.el('label', 'form-label', 'Kategorie'));
    var catGrid = App.el('div', 'cat-grid');
    var catButtons = [];
    Catalog.categories.forEach(function (cat) {
      var chip = App.el('button', 'cat-chip' + (draft.category === cat.key ? ' active' : ''));
      chip.type = 'button';
      chip.dataset.key = cat.key;
      chip.appendChild(App.el('span', null, cat.emoji));
      chip.appendChild(App.el('span', null, cat.label));
      chip.addEventListener('click', function () {
        draft.category = cat.key;
        catButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.key === cat.key); });
      });
      catButtons.push(chip);
      catGrid.appendChild(chip);
    });
    catGroup.appendChild(catGrid);
    c.appendChild(catGroup);

    /* ---- Status ---- */
    var statusGroup = App.el('div', 'form-group');
    statusGroup.appendChild(App.el('label', 'form-label', 'Status'));
    var statusRow = App.el('div', 'chip-row chip-row-wrap');
    var statusButtons = [];
    var soldGroup; // forward ref to toggle visibility
    Catalog.statuses.forEach(function (s) {
      var chip = App.el('button', 'chip status-chip-opt ' + s.cls + (draft.status === s.key ? ' active' : ''), s.label);
      chip.type = 'button';
      chip.dataset.key = s.key;
      chip.addEventListener('click', function () {
        draft.status = s.key;
        statusButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.key === s.key); });
        if (soldGroup) soldGroup.classList.toggle('is-hidden', s.key !== 'verkauft');
        // bei "verkauft" und leerem Erlös den Wunschpreis vorschlagen
        if (s.key === 'verkauft' && (draft.soldPrice == null) && draft.askingPrice != null) {
          draft.soldPrice = draft.askingPrice;
          soldInput.value = String(draft.askingPrice).replace('.', ',');
        }
      });
      statusButtons.push(chip);
      statusRow.appendChild(chip);
    });
    statusGroup.appendChild(statusRow);
    c.appendChild(statusGroup);

    /* ---- Preise ---- */
    var priceRow = App.el('div', 'form-row');

    var askGroup = App.el('div', 'form-group');
    askGroup.appendChild(App.el('label', 'form-label', 'Wunschpreis (€)'));
    var askInput = document.createElement('input');
    askInput.type = 'text'; askInput.inputMode = 'decimal'; askInput.className = 'input';
    askInput.placeholder = 'z. B. 120';
    askInput.value = draft.askingPrice != null ? String(draft.askingPrice).replace('.', ',') : '';
    askInput.addEventListener('input', function () { draft.askingPrice = App.parseNum(askInput.value); });
    askGroup.appendChild(askInput);
    priceRow.appendChild(askGroup);

    soldGroup = App.el('div', 'form-group' + (draft.status === 'verkauft' ? '' : ' is-hidden'));
    soldGroup.appendChild(App.el('label', 'form-label', 'Tatsächlich erzielt (€)'));
    var soldInput = document.createElement('input');
    soldInput.type = 'text'; soldInput.inputMode = 'decimal'; soldInput.className = 'input';
    soldInput.placeholder = 'z. B. 100';
    soldInput.value = draft.soldPrice != null ? String(draft.soldPrice).replace('.', ',') : '';
    soldInput.addEventListener('input', function () { draft.soldPrice = App.parseNum(soldInput.value); });
    soldGroup.appendChild(soldInput);
    priceRow.appendChild(soldGroup);

    c.appendChild(priceRow);

    /* ---- Wer kümmert sich ---- */
    var members = Store.getSettings().members;
    var ownerGroup = App.el('div', 'form-group');
    ownerGroup.appendChild(App.el('label', 'form-label', 'Wer kümmert sich?'));
    var ownerRow = App.el('div', 'chip-row');
    var ownerButtons = [];
    var ownerOpts = [
      { key: 'p1', label: members[0] ? members[0].name : 'Person 1' },
      { key: 'p2', label: members[1] ? members[1].name : 'Person 2' },
      { key: 'beide', label: 'Beide' }
    ];
    ownerOpts.forEach(function (o) {
      var chip = App.el('button', 'chip' + (draft.owner === o.key ? ' active' : ''), o.label);
      chip.type = 'button';
      chip.dataset.key = o.key;
      chip.addEventListener('click', function () {
        // erneutes Tippen hebt die Auswahl auf
        draft.owner = (draft.owner === o.key) ? '' : o.key;
        ownerButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.key === draft.owner); });
      });
      ownerButtons.push(chip);
      ownerRow.appendChild(chip);
    });
    ownerGroup.appendChild(ownerRow);
    c.appendChild(ownerGroup);

    /* ---- Plattform ---- */
    var platGroup = App.el('div', 'form-group');
    platGroup.appendChild(App.el('label', 'form-label', 'Wo inseriert / verkauft'));
    var platSel = document.createElement('select');
    platSel.className = 'input';
    Catalog.platforms.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.key; opt.textContent = p.label;
      if (draft.platform === p.key) opt.selected = true;
      platSel.appendChild(opt);
    });
    platSel.addEventListener('change', function () { draft.platform = platSel.value; });
    platGroup.appendChild(platSel);
    c.appendChild(platGroup);

    /* ---- Käufer ---- */
    var buyerGroup = App.el('div', 'form-group');
    buyerGroup.appendChild(App.el('label', 'form-label', 'Käufer (optional)'));
    var buyerInput = document.createElement('input');
    buyerInput.type = 'text'; buyerInput.className = 'input';
    buyerInput.placeholder = 'Name oder Notiz zum Käufer';
    buyerInput.value = draft.buyer;
    buyerInput.addEventListener('input', function () { draft.buyer = buyerInput.value; });
    buyerGroup.appendChild(buyerInput);
    c.appendChild(buyerGroup);

    /* ---- Notiz ---- */
    var noteGroup = App.el('div', 'form-group');
    noteGroup.appendChild(App.el('label', 'form-label', 'Notiz (optional)'));
    var noteInput = document.createElement('textarea');
    noteInput.className = 'input';
    noteInput.placeholder = 'z. B. „kleiner Kratzer", „inkl. Schrauben", „abholbereit" …';
    noteInput.style.minHeight = '72px';
    noteInput.style.fontFamily = 'inherit';
    noteInput.style.fontSize = '15px';
    noteInput.value = draft.note;
    noteInput.addEventListener('input', function () { draft.note = noteInput.value; });
    noteGroup.appendChild(noteInput);
    c.appendChild(noteGroup);

    /* ---- Speichern ---- */
    var save = App.el('button', 'btn btn-primary', isEdit ? 'Änderungen speichern' : 'Objekt hinzufügen');
    save.type = 'button';
    save.style.marginTop = '6px';
    save.addEventListener('click', function () {
      if (!draft.name.trim()) {
        App.toast('Bitte einen Namen eingeben');
        nameInput.focus();
        return;
      }
      var data = {
        name: draft.name.trim(),
        category: draft.category,
        askingPrice: draft.askingPrice,
        soldPrice: draft.soldPrice,
        status: draft.status,
        buyer: draft.buyer.trim(),
        platform: draft.platform,
        owner: draft.owner,
        note: draft.note.trim(),
        photo: draft.photo
      };
      if (isEdit) {
        Store.updateItem(existing.id, data);
        App.toast('Gespeichert ✓');
      } else {
        Store.addItem(data);
        App.toast('Hinzugefügt ✓');
      }
      App.closeSheet();
    });
    c.appendChild(save);

    /* ---- Löschen (nur im Bearbeiten-Modus) ---- */
    if (isEdit) {
      var del = App.el('button', 'btn btn-destructive', 'Objekt löschen');
      del.type = 'button';
      del.style.marginTop = '10px';
      del.addEventListener('click', function () {
        App.confirm({
          title: 'Objekt löschen?',
          message: '„' + (existing.name || 'Dieses Objekt') + '" wird endgültig entfernt.',
          confirmText: 'Löschen',
          cancelText: 'Abbrechen',
          destructive: true
        }).then(function (ok) {
          if (!ok) return;
          Store.deleteItem(existing.id);
          App.closeSheet();
          App.toast('Gelöscht');
        });
      });
      c.appendChild(del);
    }

    App.showSheet({ title: isEdit ? 'Objekt bearbeiten' : 'Neues Objekt', content: c });
    if (!isEdit) setTimeout(function () { try { nameInput.focus(); } catch (e) {} }, 250);
  }

  // -------- the view

  var activeRenderList = null;

  function render(container) {
    container.innerHTML = '';
    var view = App.el('div', 'view');

    // Suchleiste
    var search = App.el('div', 'searchbar');
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Suchen (Name, Kategorie, Käufer …)';
    input.value = filterState.query;
    input.addEventListener('input', function () { filterState.query = input.value; renderList(); });
    search.appendChild(input);
    view.appendChild(search);

    // Status-Chips
    var chips = App.el('div', 'chip-row');
    SCOPES.forEach(function (s) {
      var chip = App.el('button', 'chip' + (filterState.scope === s.key ? ' active' : ''), s.label);
      chip.type = 'button';
      chip.addEventListener('click', function () { filterState.scope = s.key; render(container); });
      chips.appendChild(chip);
    });
    view.appendChild(chips);

    // Sortier-Zeile
    var sortRow = App.el('div', 'sort-row');
    var info = App.el('span', 'sort-info', '');
    sortRow.appendChild(info);
    var sortSel = document.createElement('select');
    sortSel.className = 'sort-select';
    SORTS.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0]; opt.textContent = o[1];
      if (filterState.sort === o[0]) opt.selected = true;
      sortSel.appendChild(opt);
    });
    sortSel.addEventListener('change', function () { filterState.sort = sortSel.value; renderList(); });
    sortRow.appendChild(sortSel);
    view.appendChild(sortRow);

    var listWrap = App.el('div', 'item-list');
    view.appendChild(listWrap);
    container.appendChild(view);

    function renderList() {
      listWrap.innerHTML = '';
      var all = Store.getItems();
      var filtered = applyFilter(all);
      info.textContent = filtered.length + (filtered.length === 1 ? ' Objekt' : ' Objekte');

      if (!all.length) {
        listWrap.appendChild(emptyState('box', 'Noch nichts erfasst',
          'Tippe unten auf „+" und trage das erste Möbelstück oder Gerät ein, das ihr verkaufen wollt.'));
        var add = App.el('button', 'btn btn-primary');
        add.type = 'button';
        add.textContent = 'Erstes Objekt hinzufügen';
        add.style.maxWidth = '320px';
        add.style.margin = '4px auto 0';
        add.addEventListener('click', function () { openEditor(null); });
        listWrap.appendChild(add);
        return;
      }
      if (!filtered.length) {
        listWrap.appendChild(emptyState('filter', 'Nichts gefunden',
          'Für diesen Filter gibt es gerade keine Objekte. Wechsle auf „Alle" oder ändere die Suche.'));
        return;
      }

      var group = App.el('div', 'list-group');
      filtered.forEach(function (it) { group.appendChild(itemRow(it)); });
      listWrap.appendChild(group);
    }

    activeRenderList = renderList;
    renderList();
  }

  function update() {
    if (typeof activeRenderList !== 'function') return false;
    var listWrap = document.querySelector('#view-root .item-list');
    if (!listWrap || !document.body.contains(listWrap)) return false;
    activeRenderList();
    return true;
  }

  function emptyState(icon, title, text) {
    var e = App.el('div', 'empty-state');
    e.appendChild(App.icon(icon, 44));
    e.appendChild(App.el('div', 'empty-title', title));
    e.appendChild(App.el('div', null, text));
    return e;
  }

  // Vom Dashboard aufgerufen: Filter setzen, bevor auf den Objekte-Tab gewechselt wird.
  function setScope(scope) {
    filterState.scope = SCOPES.some(function (s) { return s.key === scope; }) ? scope : 'alle';
    filterState.query = '';
  }

  Views.items = {
    title: 'Objekte',
    render: render,
    update: update,
    openEditor: openEditor,
    setScope: setScope,
    emptyState: emptyState
  };
})();
