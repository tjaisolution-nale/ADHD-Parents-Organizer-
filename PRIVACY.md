# Polityka prywatności — „Dom bot”

„Dom bot” to prywatny asystent jednego gospodarstwa domowego: dwóch osób, które same go uruchamiają na własnym komputerze. Nie jest usługą publiczną i nie przyjmuje innych użytkowników.

## Jakie dane

- Wiadomości (tekst i nagrania głosowe) wysyłane w prywatnej grupie Telegram „Dom”.
- Wydarzenia w kalendarzach Google „Dom” i „Dom-TEST” oraz informacja o zajętości w głównym kalendarzu drugiej osoby (za jej zgodą).

## Do czego

Wyłącznie do tworzenia i aktualizowania wydarzeń w kalendarzu domowym oraz do przypomnień i podsumowań dla tych dwóch osób.

## Gdzie są przetwarzane

- Na komputerze właściciela (n8n w Dockerze).
- Google Calendar API — odczyt i zapis wydarzeń.
- Gemini API — rozpoznanie terminu i treści wiadomości. Dla użytkowników w Wielkiej Brytanii Google stosuje zasady płatnego planu także w darmowym: treści nie służą do ulepszania usług Google.
- Telegram Bot API — odbiór wiadomości i odpowiedzi.

Dane nie są sprzedawane ani przekazywane innym podmiotom. Nie ma reklam ani analityki. Użycie danych z Google API jest zgodne z [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), w tym z wymaganiami Limited Use.

## Przechowywanie

Wydarzenia zostają w kalendarzach Google użytkowników. Bot przechowuje lokalnie tylko stan roboczy: oczekujące pytania (najdłużej 24 godziny), punkty i liczniki.

## Odebranie dostępu

Dostęp bota do kalendarza można w każdej chwili odebrać na stronie [myaccount.google.com/permissions](https://myaccount.google.com/permissions), a bota usunąć z grupy Telegram.

## Kontakt

Przez zgłoszenie (Issue) w tym repozytorium.

---

**English summary.** "Dom bot" is a private household assistant run by its two users on their own computer; it is not a public service. It reads messages in their private Telegram group and reads and writes events in their own Google calendars, solely to manage their household calendar. Data is processed only by the owner's computer, Google Calendar API, Gemini API (for UK users Google applies its paid-service data terms, so content is not used to improve Google products) and Telegram Bot API; it is never sold or shared, and there are no ads or analytics. Use of data from Google APIs complies with the Google API Services User Data Policy, including the Limited Use requirements. Access can be revoked at any time at myaccount.google.com/permissions.
