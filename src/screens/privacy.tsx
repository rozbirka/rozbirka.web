export function PrivacyScreen() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <span className="text-brand text-2xl font-semibold tracking-tight">
            rozbirka
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="text-sm font-medium uppercase tracking-wider text-brand">
          Privacy Policy · Політика конфіденційності
        </p>
        <h1 className="mt-4 text-4xl font-light tracking-tight md:text-5xl">
          Як ми поводимось з даними
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Версія від 19 вересня 2026 р.
        </p>

        <div className="prose-content mt-12 space-y-10 text-[15px] leading-relaxed text-foreground/85">
          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              1. Хто ми
            </h2>
            <p>
              Rozbirka — платформа для обліку діяльності авторозбірок: облік
              авто, складу запчастин, замовлень, кас і команди. Доступна як
              веб-застосунок та мобільний застосунок.
            </p>
            <p className="mt-3">
              Контролером даних (data controller) щодо персональних даних
              користувачів виступає власник сервісу Rozbirka. Для зв'язку —{' '}
              <a
                href="mailto:support@rozbirka.com"
                className="text-brand underline-offset-2 hover:underline"
              >
                support@rozbirka.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              2. Які дані ми збираємо
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Дані акаунту:</strong> номер телефону (для входу через
                одноразовий код), ім'я для відображення, роль у розбірці.
              </li>
              <li>
                <strong>Бізнес-дані:</strong> інформація про авто, деталі,
                партії надходжень, замовлення, клієнтів, фінансові операції,
                фото та документи — все це створюється самим користувачем у
                межах своєї розбірки.
              </li>
              <li>
                <strong>Платіжні дані:</strong> для оплати підписки ми не
                зберігаємо номери карток. Платежі обробляє{' '}
                <strong>Monobank (Mono Acquiring)</strong>. Ми зберігаємо
                ідентифікатори та статуси платежів, відомості про підписку,
                масковані реквізити картки й платіжні токени, які надає
                платіжний сервіс.
              </li>
              <li>
                <strong>Технічні дані:</strong> IP-адреса, ідентифікатори
                акаунта та сеансів, технічні журнали запитів і дій — для безпеки
                та усунення помилок.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              3. Як ми використовуємо дані
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Надавати функціональність сервісу (вхід, облік, аналітика).
              </li>
              <li>Обробляти підписку та платежі (через Monobank).</li>
              <li>
                Сповіщати про важливі зміни в обліковому записі чи сервісі.
              </li>
              <li>
                Запобігати шахрайству, зловживанням і несанкціонованому доступу.
              </li>
              <li>
                Покращувати продукт на основі знеособлених метрик використання.
              </li>
            </ul>
            <p className="mt-3">
              <strong>Ми НЕ продаємо</strong> ваші дані третім сторонам і не
              використовуємо їх для рекламного таргетингу.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              4. З ким ми ділимось даними
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Monobank</strong> — обробка платежів за підписку.
              </li>
              <li>
                NHTSA vPIC — каталог автомобілів і розшифрування VIN. Під час
                використання цих функцій сервіс отримує параметри пошуку або VIN
                автомобіля та технічні дані мережевого запиту, зокрема
                IP-адресу. Ім’я, телефон і токени входу Rozbirka в ці запити не
                додаються.
              </li>
              <li>
                <strong>Постачальники хмарної інфраструктури</strong> (Google
                Cloud, Cloudflare) — для розміщення сервісу та зберігання даних
                на захищених серверах.
              </li>
              <li>
                <strong>Twilio (SMS-провайдер)</strong> — для доставки
                одноразових кодів авторизації на номер телефону.
              </li>
              <li>
                <strong>Apple, Google та RevenueCat</strong> — якщо підписку
                раніше було оформлено через магазин застосунків, відомості про
                її статус та історію платежів можуть оброблятися для обліку вже
                оформленого доступу. Це не означає, що нові покупки доступні в
                поточному мобільному застосунку.
              </li>
              <li>
                <strong>Державні органи</strong> — лише на вимогу законодавства
                України.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              5. Скільки ми зберігаємо ваші дані
            </h2>
            <p>
              Після успішного видалення акаунта сервіс видаляє його телефон,
              ім’я, активні сеанси та членства в компаніях. Історичні посилання
              на автора бізнес-операцій замінюються нейтральним записом без
              імені й телефону. Спільні записи компанії, документи та медіа не
              видаляються разом з особистим акаунтом: вони належать до обліку
              компанії та потребують окремого розгляду.
            </p>
            <p className="mt-3">
              Технічна позначка видаленого акаунта не містить його імені або
              телефону й використовується для запобігання відновленню старого
              доступу. Видалення з робочої бази не означає негайне стирання
              резервних копій або записів у платіжних та інших постачальників.
              Питання про ці дані й застосовні вимоги до їх зберігання можна
              надіслати на контактну адресу нижче.
            </p>
            <p className="mt-3">
              Видалення особистого акаунта не скасовує підписку компанії або
              раніше оформлену підписку магазину застосунків. Керування такою
              підпискою відбувається окремо у відповідного постачальника.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              6. Ваші права
            </h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Доступ:</strong> отримати копію своїх даних.
              </li>
              <li>
                <strong>Виправлення:</strong> змінити будь-які неточні дані
                через налаштування акаунту або написавши нам.
              </li>
              <li>
                <strong>Видалення:</strong> видалити особистий акаунт у
                налаштуваннях застосунку або звернутися до підтримки. Обсяг
                видалення й винятки для спільних даних описані вище.
              </li>
              <li>
                <strong>Експорт:</strong> отримати ваші дані у машинно-читаному
                форматі (CSV / JSON).
              </li>
              <li>
                <strong>Скарга:</strong> звернутися до Уповноваженого Верховної
                Ради України з прав людини.
              </li>
            </ul>
            <p className="mt-3">
              Щоб скористатися будь-яким із цих прав — напишіть на{' '}
              <a
                href="mailto:support@rozbirka.com"
                className="text-brand underline-offset-2 hover:underline"
              >
                support@rozbirka.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              7. Безпека
            </h2>
            <p>
              Сервіс використовує HTTPS для передавання даних, одноразові коди
              для входу та перевірку прав доступу до даних компанії. Сеанси
              відкликаються під час видалення акаунта. Жодна система не дає
              абсолютної гарантії безпеки.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              8. Дані дітей
            </h2>
            <p>
              Rozbirka — інструмент для бізнесу й не призначений для осіб
              молодше 16 років. Ми свідомо не збираємо персональні дані дітей.
              Якщо ви вважаєте, що ми отримали такі дані випадково — напишіть
              нам, і ми видалимо їх.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              9. Зміни цієї політики
            </h2>
            <p>
              Поточна версія політики та дата її оновлення доступні за цією
              адресою.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-medium text-foreground">
              10. Контакти
            </h2>
            <p>
              Питання чи запити щодо ваших даних —{' '}
              <a
                href="mailto:support@rozbirka.com"
                className="text-brand underline-offset-2 hover:underline"
              >
                support@rozbirka.com
              </a>
              .
            </p>
          </section>

          <hr className="my-12 border-border/40" />

          <section className="text-sm text-muted-foreground">
            <p className="font-medium uppercase tracking-wider text-foreground">
              English summary
            </p>
            <p className="mt-3">
              Rozbirka collects only the data needed to operate the service:
              your phone number for login, your business inventory data (cars,
              parts, orders, customers, photos) — all created by you within your
              own organization, and minimal technical logs for security. We use
              Monobank to process subscription payments and don't store card
              numbers ourselves. We never sell your data or use it for
              advertising. You can request access, correction, export, or
              deletion by emailing{' '}
              <a
                href="mailto:support@rozbirka.com"
                className="text-brand underline-offset-2 hover:underline"
              >
                support@rozbirka.com
              </a>
              . Successful account deletion removes personal account identity,
              sessions and memberships; shared company records and media remain.
              Backups and provider records are handled separately. Deleting an
              account does not cancel an existing company or store subscription.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/40 py-10 text-center text-sm text-muted-foreground">
        © 2026 Rozbirka ·{' '}
        <a href="mailto:support@rozbirka.com" className="hover:text-foreground">
          support@rozbirka.com
        </a>
      </footer>
    </div>
  )
}
