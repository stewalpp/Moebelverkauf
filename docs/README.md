# Möbelverkauf – PWA

Dieser Ordner ist die installierbare App und wird über **GitHub Pages**
ausgeliefert (Branch `main`, Ordner `/docs`).

Es ist eine reine statische Web-App (HTML/CSS/JS, keine Build-Tools). Die Daten
liegen in Firestore (anonyme Anmeldung) und werden zwischen beiden Handys in
Echtzeit synchronisiert. Foto, Wunschpreis und tatsächlicher Erlös pro Objekt;
Übersicht und Bilanz.

Vollständige Beschreibung, Aufbau und Hinweise: siehe
[`../README.md`](../README.md).

## Schnellstart lokal

```bash
python -m http.server 8080   # in diesem Ordner ausführen
# http://localhost:8080 öffnen
```
