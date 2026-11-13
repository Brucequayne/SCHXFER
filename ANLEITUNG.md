# Portfolio – Anleitung

## Einmalig einrichten
1. Alle Dateien aus dem ZIP ins Repo hochladen. Der Ordner `.github` muss mit hinein, denn er sorgt fürs automatische Veröffentlichen.
2. **Settings → Pages → Build and deployment → Source: „GitHub Actions“** auswählen.
3. Unter dem Reiter **Actions** siehst du, ob das Veröffentlichen geklappt hat (grüner Haken).

## Fotos hinzufügen
```
Fotografie/
  01_Island/              ← Projektordner, Zahl vorne bestimmt die Reihenfolge
    00001.Title.jpg       ← Titelbild: „title“ irgendwo im Dateinamen
    00002.jpg             ← weitere Fotos, sortiert nach Dateiname
    00003.jpg
    info.txt              ← optional: 1. Zeile = Titel, darunter Beschreibung
  02_Berlin_Nacht/
    ...
```
- Angezeigter Projektname = Ordnername ohne Nummer, `_` wird zum Leerzeichen („02_Berlin_Nacht“ → „Berlin Nacht“).
- Erlaubt: `.jpg`, `.png`, `.webp`.
- Nach jedem Hochladen baut GitHub die Fotoliste neu, und nach etwa einer Minute ist alles online.
- Im Actions-Protokoll (Schritt „Fotoliste erzeugen“) stehen Warnungen, z. B. wenn ein Bild zu groß ist oder ein Titelbild fehlt.

## Empfohlene Bildgröße
- Lange Kante **2000 px**, JPEG-Qualität ca. **75–80 %**, Farbraum **sRGB**
- Ziel: **250–500 KB** pro Bild, Obergrenze **ca. 800 KB**

## Name der Seite ändern
In `js/config.js` → `siteTitle`.
