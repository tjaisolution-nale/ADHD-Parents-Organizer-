# Uruchomienie Etapu 0 „Dom”

Ten przewodnik prowadzi przez konfigurację krok po kroku. Zajmuje około godziny. 🟦 to osoba, której konto Google obsługuje bota; 🟩 to druga osoba.

## Krok 0: spike (10 minut)

Ten krok sprawdza, czy węzeł Code w Twoim n8n potrafi to, czego potrzebuje bot: wysyłać zapytania HTTP (także bez przerywania na błędach HTTP), czytać zmienne środowiska, pamiętać stan między uruchomieniami, czekać, pobierać pliki binarne i kodować je w base64.

1. Sprawdź wersję n8n: `docker exec <nazwa-kontenera> n8n --version`.
2. Jeśli w Twoim kontenerze nie ma jeszcze `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, dodaj tę zmienną i zrestartuj kontener (bez niej odczyt `$env` będzie zablokowany).
3. W n8n: **Workflows → Import from File** i wybierz `n8n/workflows/spike.json`.
4. Otwórz workflow „Dom – spike” i **włącz go** (przełącznik Active). Odczekaj około 40 sekund i **wyłącz**.
5. Otwórz **Executions** tego workflow: powinny być 3–4 uruchomienia. Wyślij Claude wynik węzła „Sprawdź możliwości” z ostatniego z nich.

Oczekiwany wynik: `count` rośnie z uruchomienia na uruchomienie (1, 2, 3…), a `http`, `fullResponse`, `env`, `staticData`, `timer`, `binary`, `urlSearchParams` i `base64` mają wartość `true`. Pole `runners` mówi, czy włączone są task runnery n8n. Pole `errors` mówi, co poszło nie tak. Po sprawdzeniu usuń workflow „Dom – spike”.

## Krok 1: kalendarze

1. W Kalendarzu Google 🟦 utwórz dwa kalendarze: **Dom** i **Dom-TEST** (Ustawienia → Dodaj kalendarz → Utwórz nowy).
2. Udostępnij oba kalendarze 🟩 z uprawnieniem **Wprowadzanie zmian w wydarzeniach**.
3. U **obu** osób ustaw domyślne powiadomienia dla kalendarza „Dom” (Ustawienia → Dom → Powiadomienia o wydarzeniach): 10 minut przed wydarzeniem oraz dla wydarzeń całodniowych o 9:00 w dniu wydarzenia. Bot korzysta z tych ustawień, bo przypomnienia ustawione w samym wydarzeniu działają tylko u jego twórcy.
4. 🟩 udostępnia swój główny kalendarz 🟦: „Zobacz wszystkie szczegóły wydarzenia” albo „Zobacz tylko informacje o dostępności”. Dzięki temu bot i Claude widzą kolizje.
5. 🟩 ustawia w Gmailu filtr przekazywania rachunków na adres 🟦 (Ustawienia → Filtry, słowa: invoice, bill, statement, direct debit, payment due, faktura, rachunek → Przekaż dalej).
6. ID kalendarza znajdziesz w Ustawieniach kalendarza → **Integruj kalendarz** → „Identyfikator kalendarza” (kończy się na `@group.calendar.google.com`).

## Krok 2: Telegram

1. Napisz do [@BotFather](https://t.me/BotFather): `/newbot`, nazwa np. „Dom”, i zachowaj token.
2. W BotFather: `/setprivacy` → wybierz bota → **Disable**. Bez tego bot nie widzi zwykłych wiadomości w grupie.
3. Utwórz grupę „Dom” z 🟦, 🟩 i botem.
4. Napisz coś w grupie, a potem otwórz w przeglądarce `https://api.telegram.org/bot<TOKEN>/getUpdates`. Odczytaj `chat.id` grupy (liczba ujemna) oraz `from.id` obu osób.
5. 🟦 pisze prywatnie do bota `/start`. Bez tego bot nie może wysyłać prywatnych powiadomień o błędach.

## Krok 3: Google Cloud (dostęp bota do kalendarza)

1. Na [console.cloud.google.com](https://console.cloud.google.com) utwórz projekt, np. „Dom bot”.
2. **APIs & Services → Library**: włącz **Google Calendar API**.
3. **OAuth consent screen**: typ **External**, wypełnij nazwę i e-mail, dodaj zakresy `calendar.events` i `calendar.readonly`, a potem **Publish app**, tak by stan był **In production**. W stanie „Testing” dostęp wygasa co 7 dni.
4. **Credentials → Create credentials → OAuth client ID**, typ **Desktop app**. Wpisz ID klienta i sekret do `n8n/.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. W terminalu, w katalogu repozytorium: `node scripts/google-auth.mjs`. Otwórz wyświetlony adres, zaloguj się kontem 🟦 i zaakceptuj ostrzeżenie o niezweryfikowanej aplikacji (to Twoja własna aplikacja, ostrzeżenie pojawi się tylko raz). Skopiuj wypisaną linię `GOOGLE_REFRESH_TOKEN=...` do `n8n/.env`.

## Krok 4: Gemini

1. W [Google AI Studio](https://aistudio.google.com) utwórz klucz API w projekcie z włączonymi płatnościami (płatny tier). W darmowym tierze treści mogą być używane do ulepszania usług Google.
2. W Google Cloud ustaw alert budżetowy, np. 5 £ miesięcznie (Billing → Budgets & alerts).
3. W `GEMINI_MODEL` wpisz aktualny model z rodziny Flash, który obsługuje audio i structured output (lista modeli w AI Studio).
4. Opcjonalnie sprawdź rozumienie wiadomości: `npm run eval:parse` (około 30 wywołań, wynik co najmniej 90% i zero błędnie zapisanych dat).

## Krok 5: plik n8n/.env

Skopiuj `n8n/.env.example` do `n8n/.env` i uzupełnij wszystkie pola. Na start zostaw `DOM_MODE=test`, czyli bot pisze do „Dom-TEST”.

## Krok 6: instalacja

- Z kontenerem z tego repozytorium: `scripts/setup.sh`.
- Z Twoim istniejącym kontenerem n8n: upewnij się, że kontener dostaje zmienne z `n8n/.env` (np. `env_file`) i ma `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, potem `N8N_CONTAINER=<nazwa-kontenera> scripts/setup.sh`.

Następnie w n8n włącz workflow „Dom – bot” (przełącznik Active). Workflow błędów „Dom – błędy” jest już przypięty w ustawieniach; sprawdź to w **Settings → Error workflow**.

## Aktualizacja bota

Po zmianach w repozytorium: `git pull`, potem `scripts/setup.sh` (albo z `N8N_CONTAINER=…`). Import nadpisuje te same workflow (stałe ID), ale je wyłącza, więc włącz „Dom – bot” ponownie. Import czyści też pamięć bota: przyciski pod starszymi wiadomościami odpowiedzą „Ten przycisk już wygasł”, a cele tygodnia policzą się od nowa z kalendarza.

## Krok 7: Wispr Flow

Na telefonie ustaw Wispr Flow jako klawiaturę do dyktowania i dyktuj prosto do pola wiadomości w grupie „Dom”. Głosówki Telegrama też działają, ale dyktowanie daje od razu tekst do poprawienia.

## Krok 8: z testów na produkcję

Po tygodniu testów (lista w `docs/testy-akceptacyjne.md`): w `n8n/.env` ustaw `DOM_MODE=prod` i upewnij się, że `DOM_CALENDAR_ID` jest wypełnione (bez niego bot nie wystartuje i raz na godzinę napisze o tym do 🟦), zrestartuj kontener n8n i poproś Claude o przełączenie Routines na kalendarz „Dom” i oba adresy e-mail.
