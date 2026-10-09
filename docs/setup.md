# Uruchomienie Etapu 0 „Dom”

## Krok 0: spike (10 minut)

Ten krok sprawdza, czy węzeł Code w Twoim n8n potrafi to, czego potrzebuje bot: wysyłać zapytania HTTP, czytać zmienne środowiska, pamiętać stan między uruchomieniami, czekać i pobierać pliki binarne.

1. Sprawdź wersję n8n: `docker exec <nazwa-kontenera> n8n --version`.
2. Jeśli w Twoim kontenerze nie ma jeszcze `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, dodaj tę zmienną i zrestartuj kontener (bez niej odczyt `$env` będzie zablokowany).
3. W n8n: **Workflows → Import from File** i wybierz `n8n/workflows/spike.json`.
4. Otwórz workflow „Dom – spike” i kliknij **Test workflow**.
5. Otwórz wynik węzła „Sprawdź możliwości” i wyślij go Claude.

Oczekiwany wynik: `http`, `env`, `staticData`, `timer` i `binary` mają wartość `true`.

**Wynik decyduje o Zadaniu 12 planu; Zadania 2–11 od niego nie zależą.** Jeśli któraś wartość to `false`, budowa zatrzymuje się przed Zadaniem 12 i ta część wraca do planowania. Pole `errors` mówi, co poszło nie tak.

Po sprawdzeniu możesz usunąć workflow „Dom – spike”.
