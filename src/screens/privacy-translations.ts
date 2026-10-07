/*
 * English (UK) and Polish translations of the privacy policy.
 *
 * LEGAL STATUS: pending legal review. These are working translations of the
 * Ukrainian policy in `privacy.tsx`, which stays the legal source. They have
 * not been approved by a lawyer; every page shows that the Ukrainian original
 * prevails. Keep them in step with the Ukrainian text section by section and
 * re-submit them for review after any change.
 */

export const PRIVACY_MAIL = 'support@rozbirka.com'

/** A paragraph or list item: text runs, bold runs and the support address. */
export type Run = string | { strong: string } | { mail: true }
export type Block = { p: Run[] } | { ul: Run[][] }

export interface PrivacyTranslation {
  eyebrow: string
  title: string
  version: string
  /** Shown above the text: the Ukrainian original prevails. */
  notice: string
  sections: { title: string; blocks: Block[] }[]
}

const mail = { mail: true } as const

export const privacyEnglish: PrivacyTranslation = {
  eyebrow: 'Privacy Policy · Translation',
  title: 'How we handle your data',
  version: 'Version of 19 September 2026',
  notice:
    'This translation is provided for convenience. If it differs from the Ukrainian original, the Ukrainian version applies.',
  sections: [
    {
      title: '1. Who we are',
      blocks: [
        {
          p: [
            'Rozbirka is a platform for running vehicle dismantling businesses: records of cars, parts stock, orders, tills and the team. It is available as a web app and a mobile app.',
          ],
        },
        {
          p: [
            'The data controller for users’ personal data is the owner of the Rozbirka service. Contact: ',
            mail,
            '.',
          ],
        },
      ],
    },
    {
      title: '2. What data we collect',
      blocks: [
        {
          ul: [
            [
              { strong: 'Account data:' },
              ' phone number (for signing in with a one-time code), display name, role in the business.',
            ],
            [
              { strong: 'Business data:' },
              ' information about cars, parts, incoming batches, orders, customers, financial transactions, photos and documents — all created by the user within their own business.',
            ],
            [
              { strong: 'Payment data:' },
              ' we do not store card numbers for subscription payments. Payments are processed by ',
              { strong: 'Monobank (Mono Acquiring)' },
              '. We store payment identifiers and statuses, subscription details, masked card details and payment tokens provided by the payment service.',
            ],
            [
              { strong: 'Technical data:' },
              ' IP address, account and session identifiers, technical logs of requests and actions — for security and troubleshooting.',
            ],
          ],
        },
      ],
    },
    {
      title: '3. How we use data',
      blocks: [
        {
          ul: [
            [
              'To provide the service’s features (signing in, record keeping, analytics).',
            ],
            ['To process the subscription and payments (via Monobank).'],
            [
              'To notify you of important changes to your account or the service.',
            ],
            ['To prevent fraud, abuse and unauthorised access.'],
            ['To improve the product using anonymised usage metrics.'],
          ],
        },
        {
          p: [
            { strong: 'We do NOT sell' },
            ' your data to third parties or use it for advertising targeting.',
          ],
        },
      ],
    },
    {
      title: '4. Who we share data with',
      blocks: [
        {
          ul: [
            [{ strong: 'Monobank' }, ' — processing subscription payments.'],
            [
              'NHTSA vPIC — the vehicle catalogue and VIN decoding. When these features are used, that service receives the search parameters or the vehicle’s VIN and technical data of the network request, including the IP address. Your Rozbirka name, phone number and sign-in tokens are not added to these requests.',
            ],
            [
              { strong: 'Cloud infrastructure providers' },
              ' (Google Cloud, Cloudflare) — to host the service and store data on secure servers.',
            ],
            [
              { strong: 'Twilio (SMS provider)' },
              ' — to deliver one-time sign-in codes to your phone number.',
            ],
            [
              { strong: 'Apple, Google and RevenueCat' },
              ' — if a subscription was previously purchased through an app store, its status and payment history may be processed to account for access already purchased. This does not mean that new purchases are available in the current mobile app.',
            ],
            [
              { strong: 'Public authorities' },
              ' — only where required by the law of Ukraine.',
            ],
          ],
        },
      ],
    },
    {
      title: '5. How long we keep your data',
      blocks: [
        {
          p: [
            'After an account is successfully deleted, the service deletes its phone number, name, active sessions and company memberships. Historical references to the author of business operations are replaced with a neutral record without a name or phone number. Shared company records, documents and media are not deleted together with the personal account: they belong to the company’s records and need to be considered separately.',
          ],
        },
        {
          p: [
            'The technical marker of a deleted account contains neither its name nor its phone number and is used to prevent the old access from being restored. Deletion from the working database does not mean immediate erasure of backups or of records held by payment and other providers. Questions about such data and the requirements that apply to keeping it can be sent to the contact address below.',
          ],
        },
        {
          p: [
            'Deleting a personal account does not cancel the company’s subscription or a subscription previously purchased through an app store. Such a subscription is managed separately with the relevant provider.',
          ],
        },
      ],
    },
    {
      title: '6. Your rights',
      blocks: [
        {
          ul: [
            [{ strong: 'Access:' }, ' obtain a copy of your data.'],
            [
              { strong: 'Rectification:' },
              ' correct any inaccurate data in your account settings or by writing to us.',
            ],
            [
              { strong: 'Erasure:' },
              ' delete your personal account in the app settings or contact support. The scope of deletion and the exceptions for shared data are described above.',
            ],
            [
              { strong: 'Export:' },
              ' receive your data in a machine-readable format (CSV / JSON).',
            ],
            [
              { strong: 'Complaint:' },
              ' contact the Ukrainian Parliament Commissioner for Human Rights.',
            ],
          ],
        },
        {
          p: ['To exercise any of these rights, write to ', mail, '.'],
        },
      ],
    },
    {
      title: '7. Security',
      blocks: [
        {
          p: [
            'The service uses HTTPS to transfer data, one-time codes for signing in and checks of access rights to company data. Sessions are revoked when an account is deleted. No system can guarantee absolute security.',
          ],
        },
      ],
    },
    {
      title: '8. Children’s data',
      blocks: [
        {
          p: [
            'Rozbirka is a business tool and is not intended for anyone under 16. We do not knowingly collect children’s personal data. If you believe we have received such data by accident, write to us and we will delete it.',
          ],
        },
      ],
    },
    {
      title: '9. Changes to this policy',
      blocks: [
        {
          p: [
            'The current version of the policy and the date it was last updated are available at this address.',
          ],
        },
      ],
    },
    {
      title: '10. Contact',
      blocks: [{ p: ['Questions or requests about your data — ', mail, '.'] }],
    },
  ],
}

export const privacyPolish: PrivacyTranslation = {
  eyebrow: 'Polityka prywatności · Tłumaczenie',
  title: 'Jak postępujemy z danymi',
  version: 'Wersja z 19 września 2026 r.',
  notice:
    'To tłumaczenie udostępniamy dla wygody. Jeśli różni się od ukraińskiego oryginału, obowiązuje wersja ukraińska.',
  sections: [
    {
      title: '1. Kim jesteśmy',
      blocks: [
        {
          p: [
            'Rozbirka to platforma do prowadzenia ewidencji w firmach demontujących pojazdy: ewidencja aut, magazynu części, zamówień, kas i zespołu. Jest dostępna jako aplikacja internetowa i aplikacja mobilna.',
          ],
        },
        {
          p: [
            'Administratorem danych osobowych użytkowników jest właściciel serwisu Rozbirka. Kontakt: ',
            mail,
            '.',
          ],
        },
      ],
    },
    {
      title: '2. Jakie dane zbieramy',
      blocks: [
        {
          ul: [
            [
              { strong: 'Dane konta:' },
              ' numer telefonu (do logowania kodem jednorazowym), wyświetlana nazwa, rola w firmie.',
            ],
            [
              { strong: 'Dane firmy:' },
              ' informacje o autach, częściach, partiach dostaw, zamówieniach, klientach, operacjach finansowych, zdjęciach i dokumentach — wszystko to tworzy sam użytkownik w ramach swojej firmy.',
            ],
            [
              { strong: 'Dane płatnicze:' },
              ' przy płatnościach za subskrypcję nie przechowujemy numerów kart. Płatności obsługuje ',
              { strong: 'Monobank (Mono Acquiring)' },
              '. Przechowujemy identyfikatory i statusy płatności, informacje o subskrypcji, zamaskowane dane karty oraz tokeny płatnicze przekazywane przez serwis płatniczy.',
            ],
            [
              { strong: 'Dane techniczne:' },
              ' adres IP, identyfikatory konta i sesji, techniczne logi żądań i działań — dla bezpieczeństwa i usuwania błędów.',
            ],
          ],
        },
      ],
    },
    {
      title: '3. Jak wykorzystujemy dane',
      blocks: [
        {
          ul: [
            [
              'Aby zapewnić działanie serwisu (logowanie, ewidencja, analityka).',
            ],
            ['Aby obsługiwać subskrypcję i płatności (przez Monobank).'],
            ['Aby informować o ważnych zmianach w koncie lub serwisie.'],
            [
              'Aby zapobiegać oszustwom, nadużyciom i nieuprawnionemu dostępowi.',
            ],
            [
              'Aby ulepszać produkt na podstawie zanonimizowanych wskaźników użytkowania.',
            ],
          ],
        },
        {
          p: [
            { strong: 'NIE sprzedajemy' },
            ' Twoich danych stronom trzecim i nie wykorzystujemy ich do targetowania reklam.',
          ],
        },
      ],
    },
    {
      title: '4. Komu udostępniamy dane',
      blocks: [
        {
          ul: [
            [{ strong: 'Monobank' }, ' — obsługa płatności za subskrypcję.'],
            [
              'NHTSA vPIC — katalog pojazdów i dekodowanie numeru VIN. Podczas korzystania z tych funkcji ten serwis otrzymuje parametry wyszukiwania lub numer VIN pojazdu oraz dane techniczne żądania sieciowego, w tym adres IP. Imię, numer telefonu ani tokeny logowania Rozbirka nie są dołączane do tych żądań.',
            ],
            [
              { strong: 'Dostawcy infrastruktury chmurowej' },
              ' (Google Cloud, Cloudflare) — do hostowania serwisu i przechowywania danych na zabezpieczonych serwerach.',
            ],
            [
              { strong: 'Twilio (dostawca SMS)' },
              ' — do dostarczania jednorazowych kodów logowania na numer telefonu.',
            ],
            [
              { strong: 'Apple, Google i RevenueCat' },
              ' — jeśli subskrypcja została wcześniej wykupiona w sklepie z aplikacjami, informacje o jej statusie i historii płatności mogą być przetwarzane w celu rozliczenia już wykupionego dostępu. Nie oznacza to, że nowe zakupy są dostępne w obecnej aplikacji mobilnej.',
            ],
            [
              { strong: 'Organy państwowe' },
              ' — wyłącznie wtedy, gdy wymaga tego prawo Ukrainy.',
            ],
          ],
        },
      ],
    },
    {
      title: '5. Jak długo przechowujemy dane',
      blocks: [
        {
          p: [
            'Po skutecznym usunięciu konta serwis usuwa jego numer telefonu, imię, aktywne sesje i członkostwa w firmach. Historyczne odniesienia do autora operacji biznesowych są zastępowane neutralnym wpisem bez imienia i numeru telefonu. Wspólne rekordy firmy, dokumenty i multimedia nie są usuwane razem z kontem osobistym: należą do ewidencji firmy i wymagają odrębnego rozpatrzenia.',
          ],
        },
        {
          p: [
            'Techniczne oznaczenie usuniętego konta nie zawiera jego imienia ani numeru telefonu i służy do zapobiegania przywróceniu dawnego dostępu. Usunięcie z bazy roboczej nie oznacza natychmiastowego usunięcia kopii zapasowych ani zapisów u dostawców płatności i innych dostawców. Pytania o te dane i mające zastosowanie wymogi dotyczące ich przechowywania można wysłać na adres kontaktowy podany niżej.',
          ],
        },
        {
          p: [
            'Usunięcie konta osobistego nie anuluje subskrypcji firmy ani subskrypcji wykupionej wcześniej w sklepie z aplikacjami. Taką subskrypcją zarządza się osobno u właściwego dostawcy.',
          ],
        },
      ],
    },
    {
      title: '6. Twoje prawa',
      blocks: [
        {
          ul: [
            [{ strong: 'Dostęp:' }, ' otrzymanie kopii swoich danych.'],
            [
              { strong: 'Sprostowanie:' },
              ' poprawienie nieprawidłowych danych w ustawieniach konta lub przez kontakt z nami.',
            ],
            [
              { strong: 'Usunięcie:' },
              ' usunięcie konta osobistego w ustawieniach aplikacji lub przez kontakt z pomocą techniczną. Zakres usunięcia i wyjątki dotyczące danych wspólnych opisano wyżej.',
            ],
            [
              { strong: 'Eksport:' },
              ' otrzymanie swoich danych w formacie nadającym się do odczytu maszynowego (CSV / JSON).',
            ],
            [
              { strong: 'Skarga:' },
              ' zwrócenie się do Pełnomocnika Rady Najwyższej Ukrainy ds. Praw Człowieka.',
            ],
          ],
        },
        {
          p: [
            'Aby skorzystać z któregokolwiek z tych praw, napisz na ',
            mail,
            '.',
          ],
        },
      ],
    },
    {
      title: '7. Bezpieczeństwo',
      blocks: [
        {
          p: [
            'Serwis używa HTTPS do przesyłania danych, kodów jednorazowych do logowania oraz sprawdzania uprawnień dostępu do danych firmy. Sesje są unieważniane przy usuwaniu konta. Żaden system nie daje absolutnej gwarancji bezpieczeństwa.',
          ],
        },
      ],
    },
    {
      title: '8. Dane dzieci',
      blocks: [
        {
          p: [
            'Rozbirka to narzędzie dla firm i nie jest przeznaczona dla osób poniżej 16. roku życia. Świadomie nie zbieramy danych osobowych dzieci. Jeśli uważasz, że otrzymaliśmy takie dane przypadkowo, napisz do nas, a je usuniemy.',
          ],
        },
      ],
    },
    {
      title: '9. Zmiany polityki',
      blocks: [
        {
          p: [
            'Aktualna wersja polityki i data jej aktualizacji są dostępne pod tym adresem.',
          ],
        },
      ],
    },
    {
      title: '10. Kontakt',
      blocks: [
        { p: ['Pytania lub wnioski dotyczące Twoich danych — ', mail, '.'] },
      ],
    },
  ],
}
