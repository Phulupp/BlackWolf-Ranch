# Hornhausen-Hof

Internes Verwaltungsprogramm für den privaten **Hornhausen-Hof** (RedM Roleplay, Jahr 1899).
Waren, Preise, Bestellungen, ein Handelsrechner, das Telegramm-Verzeichnis, Verkäufe, das
Hofbuch und die Benutzerverwaltung des Hofes laufen alle in Echtzeit über **Firebase**
(Authentication + Firestore) – Änderungen sind sofort bei allen angemeldeten Mitarbeitern sichtbar.

Das gesamte Design ist bewusst rustikal gehalten: dunkles Holz, altes Pergament, Western-Typografie
und ein durchgängiges Grafik-Set (Hintergründe, Pergament-Texturen, Zierrahmen, Trenner, Siegel)
statt moderner Dashboard-Optik – im Stil einer hochwertigen internen Hofverwaltung von 1899.

## ✨ Funktionen

- **Firebase Authentication** – Login per E-Mail/Passwort oder Google, inkl. Registrierung und
  „Passwort vergessen". Neue Accounts starten automatisch im Status „wartet auf Freigabe" und
  müssen von einem Verwalter freigeschaltet werden.
- **Rangsystem** (unabhängig von den Verwalterrechten): `Hofherr`, `Hofmeister`, `Stallmeister`,
  `Hofarbeiter`, `Knecht`, `Tagelöhner`. Neue Accounts erhalten automatisch den Rang „Tagelöhner".
- **Verwalterrechte** lassen sich unabhängig vom Rang pro Account vergeben (`isAdmin`), inkl.
  Schutzmechanismus für „unantastbare" Accounts, die nicht versehentlich degradiert oder gesperrt
  werden können.
- **Übersicht (Dashboard)** – Begrüßung mit Foto-Kopfbereich, Kennzahlen (offene Bestellungen,
  Tagesumsatz, Gesamtgewinn), Schnellzugriff und die letzten Bestellungen/Verkäufe/
  Kontakte auf einen Blick.
- **Waren & Preise** – Produktliste mit Verkaufs- und Einkaufspreis; Anlegen/
  Bearbeiten/Löschen nur für Verwalter, Ansicht für alle freigegebenen Nutzer.
- **Bestellungen** – Eine Bestellung kann mehrere Produkte enthalten (Produkt auswählen, Menge
  eingeben, hinzufügen – beliebig oft, editierbar/entfernbar), mit automatischer Zusammenfassung
  (Anzahl Produkte, Gesamtmenge) und Status `Offen` / `In Bearbeitung` / `Abgeschlossen`.
- **Handelsrechner** – berechnet Angebote und führt eine Historie der letzten Angebote; ein
  Angebot lässt sich direkt als neue Bestellung übernehmen.
- **Kontakte** – Telegramm-Verzeichnis mit `BW-`-Nummern und Rollen (Bürger, Hofmeister, Sheriff,
  Rancher, Schmied, Händler, …), verwaltbare Rollenliste.
- **Verkäufe** – Verkaufslog mit automatischer Tagesstatistik.
- **Hofbuch** – die Chronik des Hofes: jeder freigegebene Mitarbeiter kann Einträge (Überschrift +
  Text) verfassen, die chronologisch in einem aufgeschlagenen Buch dargestellt werden.
- **Statistiken** – Auswertungen zu Top-Waren, Top-Kunden und Gesamtgewinn.
- **Verwaltung (Admin)** – Benutzerliste freigeben/ablehnen/sperren/entsperren, Rang & Verwalter-
  rechte setzen, Notizen, Umbenennen, Passwort-Reset auslösen, Accounts direkt anlegen, sowie ein
  unveränderliches Aktivitäts-Log aller Verwalter-Aktionen.
- **„Wer ist online"** – Live-Anzeige der gerade aktiven Mitarbeiter.
- **Update-Banner** – informiert alle Nutzer automatisch, wenn eine neue Version bereitsteht.

## 🖥️ Design

- Dunkles Holz, gealtertes Pergament, warme Brauntöne und Goldakzente statt modernem UI –
  konsequent auf jeder einzelnen Seite der Anwendung, nicht nur auf dem Login-Bildschirm.
- Der Login-/Registrierungsbildschirm nutzt einen Hof-Hintergrund, ein hängendes Holzschild-Logo
  und ein Pergament-Foto als Anmelde-Karte; dieselbe Hintergrund-Textur zieht sich als
  Dashboard-Hintergrund durch die gesamte App.
- Dasselbe Schild-Logo (in klein) taucht auch im Sidebar-Kopf, als Browser-Tab-Icon (Favicon) und
  in der Update-Benachrichtigung auf; der Übersicht-Kopfbereich zeigt das große Hof-Foto als
  Banner mit Zierrahmen.
- Alle Karten, Panels und Dialoge nutzen dieselbe Pergament-Textur (jeweils eine eigene Variante
  für Standardseiten, Dialoge und das Hofbuch); Buttons, Trennlinien, Wachssiegel und Zierrahmen
  stammen ebenfalls aus demselben Grafik-Set, damit die Designsprache auf allen Seiten identisch
  bleibt.
- Schriften: „Rye" (Wortmarke/Schild), „Playfair Display" (Überschriften), „Vollkorn" (Fließtext).

## 📁 Projektstruktur

```
Hornhausen-Hof/
│
├── index.html              # Struktur: Login/Registrierung, Sidebar, alle Ansichten, Modale
├── css/
│   └── style.css           # Gesamtes Design (Holz/Pergament-Theme, Design-Tokens)
├── js/
│   ├── firebase-config.js  # Firebase-Projektdaten (Compat-SDK)
│   ├── auth.js              # Login/Registrierung/Benutzerverwaltung (Firebase Modular-SDK)
│   └── app.js                # Restliche App-Logik: Firestore-Sync, Rendering, Modale
├── assets/                  # Grafik-Set: Hintergründe, Logo, Pergament-Texturen, Holz- und
│                             # Papier-Texturen, Buttons, Zierelemente (Rahmen, Trenner, Siegel,
│                             # Hof-Illustration)
│   ├── background/          # login-background, dashboard-background
│   ├── logo/                # hornhausen-sign (groß), hornhausen-sign-small (Sidebar/Favicon)
│   ├── parchment/            # parchment-login, parchment-page, parchment-modal, parchment-book
│   ├── textures/             # sidebar-background, wood-panel, paper-texture
│   ├── buttons/               # button-dark, button-hover
│   └── decorations/            # farm-outline, divider-western, rope-divider, wax-seal, wood-frame
├── firestore.rules          # Sicherheitsregeln (Firestore) – Archivkopie, siehe unten
└── version.json             # Versionsnummer für das automatische Update-Banner
```

## 🔥 Firestore-Collections

| Collection    | Zweck                                                          |
|---------------|-----------------------------------------------------------------|
| `users`       | Ein Dokument pro Account (Status, Rang, Verwalterrechte, …)     |
| `usernames`   | Reservierte Benutzernamen (Verfügbarkeitsprüfung)               |
| `adminLog`    | Unveränderliches Log aller Verwalter-Aktionen                   |
| `presence`    | „Wer ist online"-Heartbeat                                      |
| `kontakte`    | Telegramm-Verzeichnis                                            |
| `produkte`    | Waren & Preise                                                    |
| `bestellungen`| Bestellungen (Produkte als Array je Bestellung)                 |
| `angebote`    | Historie der Handelsrechner-Angebote                             |
| `verkaeufe`   | Verkaufslog                                                       |
| `kataloge`    | Verwaltete Listen (z. B. Rollen der Kontakte-Seite)              |
| `hofbuch`     | Chronik-Einträge des Hofbuchs (Titel, Text, Autor, Zeitpunkt)    |

Die aktuellen, gültigen Regeln werden ausschließlich über die Firebase-Konsole
(Firestore Database → Regeln) gepflegt – `firestore.rules` in diesem Repo ist nur eine
Archiv-/Versionskopie zur Nachverfolgung.

## ⚙️ Einrichtung

1. In `js/firebase-config.js` die eigenen Firebase-Projektdaten eintragen (Web-App aus der
   Firebase-Konsole).
2. In der Firebase-Konsole **Authentication** (E-Mail/Passwort + Google) sowie **Firestore
   Database** aktivieren und die Regeln aus `firestore.rules` übernehmen.
3. `index.html` lokal öffnen oder über GitHub Pages (siehe `.github/workflows/pages.yml`)
   bereitstellen.

## 🚀 Deployment

Der `main`-Branch wird automatisch per GitHub Actions (`.github/workflows/pages.yml`) auf
GitHub Pages veröffentlicht.

## 🔒 Hinweis

Dies ist ein internes Verwaltungstool für ein privates RedM-Roleplay-Projekt. Zugriff ist nur für
freigegebene Hof-Mitarbeiter vorgesehen.
