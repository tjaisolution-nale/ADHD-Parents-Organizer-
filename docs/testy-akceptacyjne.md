# Testy akceptacyjne Etapu 0

Wszystko na kalendarzu „Dom-TEST” (`DOM_MODE=test`). Zaznaczaj po kolei; każdy błąd zgłoś Claude z opisem i godziną.

## Dodawanie

- [ ] Tekst „jutro 18 dentysta” → wydarzenie „🟦 Dentysta” jutro 18:00 i potwierdzenie z przyciskami ✅ / ⏰ +15 min / Jutro / ↩️ Cofnij.
- [ ] To samo od 🟩 → tytuł zaczyna się od 🟩.
- [ ] „w sobotę 10 sprzątanie razem” → tytuł zaczyna się od 🟨.
- [ ] Głosówka „pojutrze o 14 odebrać paczkę” → wydarzenie. Jeśli Gemini zwraca błąd formatu (OGG/Opus), zgłoś to; zapasowo będzie konwersja `ffmpeg`, a do tego czasu dyktowanie przez Wispr Flow.
- [ ] „kupić mleko” (bez dnia) → pytanie z przyciskami Dziś / Jutro / Weekend / Przyszły tydzień → po wyborze pytanie o porę → wydarzenie.
- [ ] „w piątek dentysta”, gdy Gemini poda zły dzień → pytanie „🤔 Data nie zgadza się z dniem tygodnia. Kiedy?”, nigdy cichy zapis.
- [ ] Kolizja: dodaj „jutro 18 basen”, potem „jutro 18 dentysta” → „⚠️ koliduje z 🟦 Basen” i przyciski „Wstaw o 18:30” / „Zostaw”.

## Przyciski i komendy

- [ ] ⏰ +15 min przesuwa wydarzenie; Jutro przenosi na następny dzień o tej samej godzinie.
- [ ] ↩️ Cofnij usuwa świeże wydarzenie bota; na starszym niż 24 h odpowiada „Tego już nie da się cofnąć”.
- [ ] `/zalegle` przenosi Twoje i wspólne zaległości na jutro.
- [ ] Przypomnienie z kalendarza przychodzi na oba telefony 10 minut przed wydarzeniem.

## Grywalizacja

- [ ] ✅ → animacja 🎰, po 2 sekundach wynik i paski 🟦 / 🟩 / 🎯.
- [ ] Drugie kliknięcie ✅ (także przez drugą osobę) → „Już zrobione ✅”, punkty bez zmian.
- [ ] Dwa ✅ jednej osoby w ciągu 20 minut → „🔥 Combo x2!”.
- [ ] ✅ obu osób w ciągu godziny → „🙌 Piątka! +2 dla 🟦 i 🟩”.
- [ ] `/test777`, potem ✅ → „777! JACKPOT +10”.

## Odporność

- [ ] Restart kontenera n8n, potem ✅ pod potwierdzeniem sprzed restartu → działa (pamięć bota przetrwała).
- [ ] Dwie wiadomości w ciągu 5 sekund, potem ✅ pod oboma potwierdzeniami → oba działają, żaden przycisk nie „wygasł”.
- [ ] Obie osoby klikają ✅ pod tą samą sprawą 🟨 niemal jednocześnie → jedna animacja 🎰, druga osoba dostaje „Już zrobione ✅”.
- [ ] Aktualizacja według `docs/setup.md` („Aktualizacja bota”) → w n8n nadal jest jeden „Dom – bot”, nie dwa.
- [ ] „Jutro” pod sprawą zaległą z zeszłego tygodnia → przenosi na jutro, nie na dzień po starym terminie.
- [ ] „🟩 odebrać paczkę jutro 15” wysłane przez 🟦 → tytuł zaczyna się od 🟩.

- [ ] Mac uśpiony (zatrzymaj kontener), wyślij wiadomość, uruchom kontener → wiadomość obsłużona; jeśli termin już minął, bot pyta o nowy dzień.
- [ ] Zły klucz Gemini w `.env` (restart kontenera) → „📥 Zapisane do posortowania…” i wydarzenie 📥 na dziś. Przywróć klucz.
- [ ] Wiadomość od osoby spoza listy albo naklejka → brak reakcji.

## Routines (pierwszy tydzień)

- [ ] Brief poranny przychodzi e-mailem do 🟦 i ma: 3 najważniejsze rzeczy, 💸 na 7 dni, zaległości.
- [ ] Rachunek z Gmaila pojawia się jako „🟨 💸 …” 3 dni przed terminem, bez duplikatów następnego dnia.
- [ ] Podsumowanie niedzielne (uruchomione ręcznie) pokazuje punkty obu osób i nie wskazuje zwycięzcy.
