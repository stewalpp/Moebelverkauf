# Möbelverkauf

Eine kleine, private Smartphone-App (PWA) für unseren Umzug: Wir tragen ein,
**was verkauft werden soll**, zu welchem **Wunschpreis**, und was am Ende
**tatsächlich dabei rumgekommen ist**. Beide Handys sehen denselben Stand –
in Echtzeit synchronisiert.

Diese App ist aus der früheren „Wohnungssuche" entstanden: Firebase-Projekt,
PWA-Setup und das iOS-Design wurden übernommen, der Inhalt komplett auf
„Verkaufen" umgebaut. Der frühere Wohnungs-Scraper (Python + GitHub Actions)
wurde entfernt – diese App braucht keinen Server, nur Firebase.

## Funktionen

- **Objekte erfassen:** Name, Kategorie (Möbel, Küche, Elektronik …), Foto,
  Wunschpreis, Notiz, „wer kümmert sich".
- **Status-Ablauf:** Zu verkaufen → reserviert → verkauft → verschenkt /
  entsorgt / behalten.
- **Tatsächlicher Erlös:** Beim Verkauf den erzielten Preis eintragen.
- **Übersicht:** bisher eingenommen, noch erwartet, Fortschritt, Aufteilung
  nach Status, Person und Kategorie.
- **Bilanz „Verkauft":** Gesamterlös, Vergleich zum Wunschpreis, Erlös pro
  Person und die Liste aller Verkäufe; Zusammenfassung zum Kopieren.
- **Foto vom Handy:** wird im Browser komprimiert und gratis in Firestore
  gespeichert (kein zusätzliches Setup, kein Storage-Bucket nötig).
- **Gemeinsam in Echtzeit:** beide Geräte teilen sich automatisch denselben
  Stand. Sync kann pro Gerät abgeschaltet werden.
- **Offline-fähig:** Daten bleiben lokal verfügbar, Änderungen syncen, sobald
  wieder Verbindung besteht.

## Aufbau

Reine statische PWA im Ordner [`docs/`](docs/) – HTML, CSS und klassisches
JavaScript, keine Build-Tools, keine externen Abhängigkeiten außer dem
Firebase-Web-SDK (lazy vom CDN geladen).

```
docs/
  index.html            App-Shell (Header, Tab-Leiste, Roots)
  manifest.json         PWA-Manifest
  sw.js                 Service Worker (App-Shell-Cache)
  css/style.css         iOS-Design-System
  js/
    config.js           Firebase-Config + household-Schlüssel
    core.js             Helfer: Format, Icons, Sheet, Toast, Confirm, Theme
    catalog.js          Stammdaten: Kategorien, Status, Plattformen
    stats.js            Rechen-Helfer für Übersicht & Bilanz
    store.js            Offline-first Speicher + Firestore-Sync (Objekte)
    views/
      dashboard.js      „Übersicht"
      items.js          „Objekte" (Liste + Anlegen/Bearbeiten)
      sold.js           „Verkauft" (Bilanz)
      settings.js       „Mehr" (Sync, Namen, Darstellung, Export)
    app.js              Boot: Tabs, „+"-Button, Onboarding, SW
```

### Datenablage (Firestore)

Gleiches Firebase-Projekt **und** derselbe Haushalt wie früher – das ist
Absicht: Die bestehenden Firestore-Regeln geben nur den Pfad
`households/stewalpp-gishaa/**` frei. Die Verkaufsobjekte liegen aber in einer
eigenen Unter-Sammlung `items`, getrennt von den alten Wohnungs-Bewertungen
unter `ratings`:

```
households/stewalpp-gishaa/items/{itemId}    # ein Verkaufsobjekt (NEU)
households/stewalpp-gishaa/meta/settings      # Namen (geteilt)
households/stewalpp-gishaa/ratings/…          # alte Wohnungsdaten (unberührt)
```

**Soft-Delete:** Die Regeln erlauben Anlegen/Ändern/Lesen, aber kein echtes
Löschen. Beim Löschen setzt die App das Objekt deshalb auf `deleted: true`
(ein Update) und blendet es überall aus. So braucht es keine Änderung an den
Firestore-Regeln. Wer gelöschte Objekte später wirklich aus der Datenbank
entfernen will, kann optional eine Lösch-Regel ergänzen – nötig ist das nicht.

## Installieren

Repository → **Settings → Pages** → *Deploy from a branch* → Branch `main`,
Ordner `/docs`. Danach erreichbar unter
`https://stewalpp.github.io/Moebelverkauf/` (auf dem iPhone in Safari öffnen →
Teilen → „Zum Home-Bildschirm").

## Lokal testen

Einfach einen kleinen Static-Server im `docs/`-Ordner starten, z. B.:

```bash
cd docs
python -m http.server 8080
# dann http://localhost:8080 öffnen
```

(Service Worker und Firebase brauchen `http(s)://`, per `file://` läuft die App
auch, aber ohne Service-Worker-Cache.)

## Sicherheit / Datenschutz

Die Firebase-Web-Config in `docs/js/config.js` ist kein Geheimnis – jeder
Web-Client bekommt sie. Der Zugriff ist über die Firestore-Regel
(`allow read, write: if request.auth != null;`) plus anonyme Anmeldung
abgesichert. Für diese private Zwei-Personen-App sind die Daten (eure
Verkaufsliste) unkritisch.
