import { defineMessages, translate, type Locale } from '@/i18n'

export const teamMessages = defineMessages({
  uk: {
    crumb: 'Налаштування · Команда',
    title: 'Команда',
    lead: 'Хто має доступ до складу, продажів і грошей.',
    accessEyebrow: 'Налаштування доступу',
    noViewPermission:
      'Недостатньо прав для перегляду команди. Попросіть власника розбірки відкрити вам розділ «Команда».',
    accessLost:
      'Право керувати командою було змінено. Оновіть права або попросіть власника розбірки повернути доступ.',
    loadFailed:
      'Не вдалося завантажити дані команди. Перевірте зв’язок і оновіть сторінку.',
    accessRefreshFailed:
      'Дію виконано, але не вдалося оновити права. Натисніть «Оновити права», щоб продовжити роботу.',
    actionFailed: 'Не вдалося виконати дію. Спробуйте ще раз.',
    roleUpdated: 'Роль учасника оновлено.',
    roleUpdateFailed:
      'Не вдалося змінити роль учасника. Перевірте зв’язок і спробуйте ще раз.',
    permissionsUpdated: 'Права учасника оновлено.',
    permissionsSaveFailed:
      'Не вдалося зберегти права. Перевірте зв’язок і спробуйте ще раз.',
    invitationCreated: 'Запрошення створено.',
    invitationCreateFailed:
      'Не вдалося створити запрошення. Перевірте зв’язок і спробуйте ще раз.',
    permissionsLoadFailed:
      'Не вдалося завантажити права учасника. Перевірте зв’язок і спробуйте ще раз.',

    groupCars: 'Автомобілі',
    groupParts: 'Запчастини',
    groupOrders: 'Замовлення',
    groupCustomers: 'Клієнти',
    groupFinance: 'Фінанси',
    groupIntakes: 'Приймання',
    groupInventory: 'Інвентаризація',
    groupStickers: 'Стікери',
    groupReports: 'Звіти',
    groupTeam: 'Команда',
    groupBilling: 'Підписка',

    segmentAll: 'Усі',
    segmentActive: 'Активні',
    segmentOff: 'Вимкнені',

    roleOwner: 'Власник',
    roleManager: 'Менеджер',
    roleMaster: 'Майстер',

    invitationUsed: 'Використано',
    invitationRevoked: 'Відкликано',
    invitationExpired: 'Прострочено',
    invitationActive: 'Активне',

    noLastSeen:
      'Останній вхід учасника не зберігається — відома лише дата приєднання.',
    noEmail:
      'Пошти в учасника немає — кабінет знає імʼя й телефон, а телефон тут не вказано.',
    noEmailInvite:
      'Листів кабінет не надсилає й пошти не питає: запрошення — це код, який ви передаєте людині самі. Місце в тарифі рахується за учасниками, а не за виданими кодами.',

    searchMembers: 'Пошук учасників',
    searchPlaceholder: 'Імʼя або телефон',
    invite: 'Запросити',
    refreshAccess: 'Оновити права',
    loading: 'Завантажуємо команду…',
    kpiMembers: 'Учасників',
    activeCount: {
      one: '{count} активний',
      few: '{count} активні',
      many: '{count} активних',
      other: '{count} активного',
    },
    offCount: {
      one: '{count} вимкнений',
      few: '{count} вимкнені',
      many: '{count} вимкнених',
      other: '{count} вимкненого',
    },
    kpiSeats: 'Місць у тарифі',
    seatsUnknown: 'тариф не повідомляє ліміт місць',
    planFallback: 'Тариф',
    seatsUnlimited: '{plan} · без обмеження',
    seatsFree: '{plan} · вільно {count}',
    kpiInvitations: 'Запрошень діє',
    invitationsNone: 'усі коди використані або відкликані',
    invitationsHint: 'код вводять під час реєстрації',
    memberState: 'Стан учасника',
    shownMembers: {
      one: 'Показано {shown} з {count} учасника',
      few: 'Показано {shown} з {count} учасників',
      many: 'Показано {shown} з {count} учасників',
      other: 'Показано {shown} з {count} учасника',
    },
    members: 'Учасники',
    noMembersForFilter: 'Учасників за цим фільтром немає.',
    membersCaption: 'Учасники команди',
    columnUser: 'Користувач',
    columnRole: 'Роль',
    columnActivity: 'Активність',
    columnStatus: 'Статус',
    itsYou: 'це ви',
    noContact: 'пошти й телефону не вказано',
    roleFor: 'Роль для {name}',
    inTeamSince: 'у команді з',
    memberActive: 'Активний',
    memberOff: 'Вимкнений',
    permissions: 'Права',
    deactivate: 'Вимкнути',
    activate: 'Активувати',
    deactivateTitle: 'Вимкнути учасника',
    activateTitle: 'Активувати учасника',
    deactivateDescription:
      '{name} втратить доступ до кабінету. Ви зможете активувати цей обліковий запис пізніше.',
    activateDescription:
      '{name} знову отримає доступ до кабінету з роллю «{role}».',
    deactivateFailed:
      'Не вдалося вимкнути учасника. Перевірте зв’язок і спробуйте ще раз.',
    activateFailed:
      'Не вдалося активувати учасника. Перевірте зв’язок і спробуйте ще раз.',
    deactivated: 'Учасника вимкнено.',
    activated: 'Учасника активовано.',
    deleteTitle: 'Видалити учасника',
    deleteDescription:
      '{name} втратить доступ назавжди. Щоб повернути людину в команду, доведеться створити нове запрошення.',
    deleteFailed:
      'Не вдалося видалити учасника. Перевірте зв’язок і спробуйте ще раз.',
    deleted: 'Учасника видалено.',
    memberActions: 'Дії з учасником {name}',
    lastSeenNote:
      'Останній вхід не зберігається — у колонці «Активність» лише дата приєднання.',
    seatsNoteUnknown: 'Скільки місць дає тариф, зараз невідомо.',
    seatsNoteUnlimited: 'Зайнято {used} — тариф не обмежує кількість людей.',
    seatsNote: 'Зайнято {used} з {max} місць тарифу.',
    raiseLimit: 'Збільшити ліміт',
    invitations: 'Запрошення',
    invitationsLead: 'Передайте активний код людині для реєстрації.',
    noActive: 'жодного активного',
    activeInvitations: {
      one: '{count} діє',
      few: '{count} діють',
      many: '{count} діють',
      other: '{count} діє',
    },
    validUntil: '{role} · діє до',
    revoke: 'Відкликати',
    revokeTitle: 'Відкликати запрошення',
    revokeDescription:
      'Код {code} перестане працювати. Створіть нове запрошення, якщо доступ ще потрібен.',
    revokeFailed:
      'Не вдалося відкликати запрошення. Перевірте зв’язок і спробуйте ще раз.',
    revoked: 'Запрошення відкликано.',
    invitationActions: 'Дії із запрошенням {code}',
    noActiveInvitations: 'Активних запрошень немає.',
    hideHistory: 'Сховати історію',
    invitationHistory: 'Історія запрошень ({count})',
    newInvitationDescription:
      'Оберіть роль. Після створення передайте код людині — він знадобиться їй під час реєстрації.',
    createInvitation: 'Створити запрошення',
    newInvitation: 'Нове запрошення',
    invitationRoleHint: 'Новий учасник отримає права цієї ролі.',
    invitationRole: 'Роль для запрошення',
    permissionsDescription:
      'Індивідуальні права для {name}. Вони замінюють права ролі «{role}».',
    permissionsEyebrow: 'Команда · Права',
    savePermissions: 'Зберегти права',
    permissionsTitle: 'Права: {name}',
    userPermissions: 'Права користувача',
    rolePermissions: 'Права ролі',
    selectedCount: '{legend} — обрано {selected} з {total}',
    confirm: 'Підтвердити',
  },
  'en-GB': {
    crumb: 'Settings · Team',
    title: 'Team',
    lead: 'Who has access to stock, sales and money.',
    accessEyebrow: 'Access settings',
    noViewPermission:
      'You don’t have permission to view the team. Ask the business owner to open the Team section for you.',
    accessLost:
      'Your permission to manage the team has changed. Refresh your permissions or ask the business owner to restore access.',
    loadFailed:
      'Couldn’t load the team. Check your connection and refresh the page.',
    accessRefreshFailed:
      'Done, but your permissions couldn’t be refreshed. Click “Refresh permissions” to carry on.',
    actionFailed: 'Couldn’t complete the action. Please try again.',
    roleUpdated: 'Member’s role updated.',
    roleUpdateFailed:
      'Couldn’t change the member’s role. Check your connection and try again.',
    permissionsUpdated: 'Member’s permissions updated.',
    permissionsSaveFailed:
      'Couldn’t save the permissions. Check your connection and try again.',
    invitationCreated: 'Invitation created.',
    invitationCreateFailed:
      'Couldn’t create the invitation. Check your connection and try again.',
    permissionsLoadFailed:
      'Couldn’t load the member’s permissions. Check your connection and try again.',

    groupCars: 'Cars',
    groupParts: 'Parts',
    groupOrders: 'Orders',
    groupCustomers: 'Customers',
    groupFinance: 'Finance',
    groupIntakes: 'Intake',
    groupInventory: 'Stocktake',
    groupStickers: 'Stickers',
    groupReports: 'Reports',
    groupTeam: 'Team',
    groupBilling: 'Subscription',

    segmentAll: 'All',
    segmentActive: 'Active',
    segmentOff: 'Deactivated',

    roleOwner: 'Owner',
    roleManager: 'Manager',
    roleMaster: 'Mechanic',

    invitationUsed: 'Used',
    invitationRevoked: 'Revoked',
    invitationExpired: 'Expired',
    invitationActive: 'Active',

    noLastSeen:
      'A member’s last sign-in isn’t stored — only the date they joined.',
    noEmail:
      'Members have no email — the account knows their name and phone, and no phone is given here.',
    noEmailInvite:
      'The account doesn’t send emails or ask for addresses: an invitation is a code you pass on yourself. Plan seats count members, not issued codes.',

    searchMembers: 'Search members',
    searchPlaceholder: 'Name or phone',
    invite: 'Invite',
    refreshAccess: 'Refresh permissions',
    loading: 'Loading the team…',
    kpiMembers: 'Members',
    activeCount: { one: '{count} active', other: '{count} active' },
    offCount: { one: '{count} deactivated', other: '{count} deactivated' },
    kpiSeats: 'Plan seats',
    seatsUnknown: 'the plan doesn’t report a seat limit',
    planFallback: 'Plan',
    seatsUnlimited: '{plan} · unlimited',
    seatsFree: '{plan} · {count} free',
    kpiInvitations: 'Active invitations',
    invitationsNone: 'all codes used or revoked',
    invitationsHint: 'the code is entered at sign-up',
    memberState: 'Member status',
    shownMembers: {
      one: 'Showing {shown} of {count} member',
      other: 'Showing {shown} of {count} members',
    },
    members: 'Members',
    noMembersForFilter: 'No members match this filter.',
    membersCaption: 'Team members',
    columnUser: 'User',
    columnRole: 'Role',
    columnActivity: 'Activity',
    columnStatus: 'Status',
    itsYou: 'you',
    noContact: 'no email or phone given',
    roleFor: 'Role for {name}',
    inTeamSince: 'in the team since',
    memberActive: 'Active',
    memberOff: 'Deactivated',
    permissions: 'Permissions',
    deactivate: 'Deactivate',
    activate: 'Activate',
    deactivateTitle: 'Deactivate member',
    activateTitle: 'Activate member',
    deactivateDescription:
      '{name} will lose access to the account. You can activate them again later.',
    activateDescription:
      '{name} will get access to the account again with the “{role}” role.',
    deactivateFailed:
      'Couldn’t deactivate the member. Check your connection and try again.',
    activateFailed:
      'Couldn’t activate the member. Check your connection and try again.',
    deactivated: 'Member deactivated.',
    activated: 'Member activated.',
    deleteTitle: 'Remove member',
    deleteDescription:
      '{name} will lose access for good. To bring them back, you’ll need to create a new invitation.',
    deleteFailed:
      'Couldn’t remove the member. Check your connection and try again.',
    deleted: 'Member removed.',
    memberActions: 'Actions for {name}',
    lastSeenNote:
      'Last sign-in isn’t stored — the Activity column only shows the join date.',
    seatsNoteUnknown: 'It’s not known how many seats the plan gives.',
    seatsNoteUnlimited:
      '{used} taken — the plan doesn’t limit the number of people.',
    seatsNote: '{used} of {max} plan seats taken.',
    raiseLimit: 'Raise the limit',
    invitations: 'Invitations',
    invitationsLead: 'Give an active code to the person so they can sign up.',
    noActive: 'none active',
    activeInvitations: { one: '{count} active', other: '{count} active' },
    validUntil: '{role} · valid until',
    revoke: 'Revoke',
    revokeTitle: 'Revoke invitation',
    revokeDescription:
      'Code {code} will stop working. Create a new invitation if access is still needed.',
    revokeFailed:
      'Couldn’t revoke the invitation. Check your connection and try again.',
    revoked: 'Invitation revoked.',
    invitationActions: 'Actions for invitation {code}',
    noActiveInvitations: 'No active invitations.',
    hideHistory: 'Hide history',
    invitationHistory: 'Invitation history ({count})',
    newInvitationDescription:
      'Choose a role. Once it’s created, give the code to the person — they’ll need it to sign up.',
    createInvitation: 'Create invitation',
    newInvitation: 'New invitation',
    invitationRoleHint: 'The new member gets this role’s permissions.',
    invitationRole: 'Role for the invitation',
    permissionsDescription:
      'Individual permissions for {name}. They replace the permissions of the “{role}” role.',
    permissionsEyebrow: 'Team · Permissions',
    savePermissions: 'Save permissions',
    permissionsTitle: 'Permissions: {name}',
    userPermissions: 'User permissions',
    rolePermissions: 'Role permissions',
    selectedCount: '{legend} — {selected} of {total} selected',
    confirm: 'Confirm',
  },
  pl: {
    crumb: 'Ustawienia · Zespół',
    title: 'Zespół',
    lead: 'Kto ma dostęp do magazynu, sprzedaży i pieniędzy.',
    accessEyebrow: 'Ustawienia dostępu',
    noViewPermission:
      'Brak uprawnień do przeglądania zespołu. Poproś właściciela firmy o otwarcie sekcji „Zespół”.',
    accessLost:
      'Twoje uprawnienie do zarządzania zespołem zostało zmienione. Odśwież uprawnienia lub poproś właściciela firmy o przywrócenie dostępu.',
    loadFailed:
      'Nie udało się wczytać zespołu. Sprawdź połączenie i odśwież stronę.',
    accessRefreshFailed:
      'Gotowe, ale nie udało się odświeżyć uprawnień. Kliknij „Odśwież uprawnienia”, aby kontynuować.',
    actionFailed: 'Nie udało się wykonać czynności. Spróbuj ponownie.',
    roleUpdated: 'Rola członka zespołu zaktualizowana.',
    roleUpdateFailed:
      'Nie udało się zmienić roli. Sprawdź połączenie i spróbuj ponownie.',
    permissionsUpdated: 'Uprawnienia członka zespołu zaktualizowane.',
    permissionsSaveFailed:
      'Nie udało się zapisać uprawnień. Sprawdź połączenie i spróbuj ponownie.',
    invitationCreated: 'Zaproszenie utworzone.',
    invitationCreateFailed:
      'Nie udało się utworzyć zaproszenia. Sprawdź połączenie i spróbuj ponownie.',
    permissionsLoadFailed:
      'Nie udało się wczytać uprawnień. Sprawdź połączenie i spróbuj ponownie.',

    groupCars: 'Auta',
    groupParts: 'Części',
    groupOrders: 'Zamówienia',
    groupCustomers: 'Klienci',
    groupFinance: 'Finanse',
    groupIntakes: 'Przyjęcia',
    groupInventory: 'Inwentaryzacja',
    groupStickers: 'Naklejki',
    groupReports: 'Raporty',
    groupTeam: 'Zespół',
    groupBilling: 'Subskrypcja',

    segmentAll: 'Wszyscy',
    segmentActive: 'Aktywni',
    segmentOff: 'Wyłączeni',

    roleOwner: 'Właściciel',
    roleManager: 'Menedżer',
    roleMaster: 'Mechanik',

    invitationUsed: 'Wykorzystane',
    invitationRevoked: 'Odwołane',
    invitationExpired: 'Wygasłe',
    invitationActive: 'Aktywne',

    noLastSeen:
      'Ostatnie logowanie nie jest zapisywane — znana jest tylko data dołączenia.',
    noEmail:
      'Członek zespołu nie ma e-maila — konto zna imię i telefon, a telefonu tu nie podano.',
    noEmailInvite:
      'Konto nie wysyła e-maili ani o nie nie pyta: zaproszenie to kod, który przekazujesz osobie sam. Miejsca w planie liczą się według członków zespołu, nie wydanych kodów.',

    searchMembers: 'Szukaj członków zespołu',
    searchPlaceholder: 'Imię lub telefon',
    invite: 'Zaproś',
    refreshAccess: 'Odśwież uprawnienia',
    loading: 'Wczytywanie zespołu…',
    kpiMembers: 'Członkowie',
    activeCount: {
      one: '{count} aktywny',
      few: '{count} aktywnych',
      many: '{count} aktywnych',
      other: '{count} aktywnego',
    },
    offCount: {
      one: '{count} wyłączony',
      few: '{count} wyłączonych',
      many: '{count} wyłączonych',
      other: '{count} wyłączonego',
    },
    kpiSeats: 'Miejsca w planie',
    seatsUnknown: 'plan nie podaje limitu miejsc',
    planFallback: 'Plan',
    seatsUnlimited: '{plan} · bez ograniczeń',
    seatsFree: '{plan} · wolne: {count}',
    kpiInvitations: 'Aktywne zaproszenia',
    invitationsNone: 'wszystkie kody wykorzystane lub odwołane',
    invitationsHint: 'kod wpisuje się podczas rejestracji',
    memberState: 'Stan członka zespołu',
    shownMembers: {
      one: 'Pokazano {shown} z {count} osoby',
      few: 'Pokazano {shown} z {count} osób',
      many: 'Pokazano {shown} z {count} osób',
      other: 'Pokazano {shown} z {count} osoby',
    },
    members: 'Członkowie zespołu',
    noMembersForFilter: 'Brak członków zespołu dla tego filtra.',
    membersCaption: 'Członkowie zespołu',
    columnUser: 'Użytkownik',
    columnRole: 'Rola',
    columnActivity: 'Aktywność',
    columnStatus: 'Status',
    itsYou: 'to Ty',
    noContact: 'nie podano e-maila ani telefonu',
    roleFor: 'Rola dla: {name}',
    inTeamSince: 'w zespole od',
    memberActive: 'Aktywny',
    memberOff: 'Wyłączony',
    permissions: 'Uprawnienia',
    deactivate: 'Wyłącz',
    activate: 'Aktywuj',
    deactivateTitle: 'Wyłącz członka zespołu',
    activateTitle: 'Aktywuj członka zespołu',
    deactivateDescription:
      '{name} straci dostęp do konta. Możesz aktywować to konto później.',
    activateDescription:
      '{name} ponownie otrzyma dostęp do konta z rolą „{role}”.',
    deactivateFailed:
      'Nie udało się wyłączyć członka zespołu. Sprawdź połączenie i spróbuj ponownie.',
    activateFailed:
      'Nie udało się aktywować członka zespołu. Sprawdź połączenie i spróbuj ponownie.',
    deactivated: 'Członek zespołu wyłączony.',
    activated: 'Członek zespołu aktywowany.',
    deleteTitle: 'Usuń członka zespołu',
    deleteDescription:
      '{name} straci dostęp na zawsze. Aby przywrócić tę osobę do zespołu, trzeba będzie utworzyć nowe zaproszenie.',
    deleteFailed:
      'Nie udało się usunąć członka zespołu. Sprawdź połączenie i spróbuj ponownie.',
    deleted: 'Członek zespołu usunięty.',
    memberActions: 'Działania: {name}',
    lastSeenNote:
      'Ostatnie logowanie nie jest zapisywane — kolumna „Aktywność” pokazuje tylko datę dołączenia.',
    seatsNoteUnknown: 'Nie wiadomo, ile miejsc daje plan.',
    seatsNoteUnlimited: 'Zajęte: {used} — plan nie ogranicza liczby osób.',
    seatsNote: 'Zajęte {used} z {max} miejsc w planie.',
    raiseLimit: 'Zwiększ limit',
    invitations: 'Zaproszenia',
    invitationsLead: 'Przekaż aktywny kod osobie do rejestracji.',
    noActive: 'brak aktywnych',
    activeInvitations: {
      one: '{count} aktywne',
      few: '{count} aktywne',
      many: '{count} aktywnych',
      other: '{count} aktywnego',
    },
    validUntil: '{role} · ważne do',
    revoke: 'Odwołaj',
    revokeTitle: 'Odwołaj zaproszenie',
    revokeDescription:
      'Kod {code} przestanie działać. Utwórz nowe zaproszenie, jeśli dostęp jest nadal potrzebny.',
    revokeFailed:
      'Nie udało się odwołać zaproszenia. Sprawdź połączenie i spróbuj ponownie.',
    revoked: 'Zaproszenie odwołane.',
    invitationActions: 'Działania dla zaproszenia {code}',
    noActiveInvitations: 'Brak aktywnych zaproszeń.',
    hideHistory: 'Ukryj historię',
    invitationHistory: 'Historia zaproszeń ({count})',
    newInvitationDescription:
      'Wybierz rolę. Po utworzeniu przekaż kod osobie — będzie go potrzebować podczas rejestracji.',
    createInvitation: 'Utwórz zaproszenie',
    newInvitation: 'Nowe zaproszenie',
    invitationRoleHint: 'Nowy członek zespołu otrzyma uprawnienia tej roli.',
    invitationRole: 'Rola dla zaproszenia',
    permissionsDescription:
      'Indywidualne uprawnienia dla: {name}. Zastępują uprawnienia roli „{role}”.',
    permissionsEyebrow: 'Zespół · Uprawnienia',
    savePermissions: 'Zapisz uprawnienia',
    permissionsTitle: 'Uprawnienia: {name}',
    userPermissions: 'Uprawnienia użytkownika',
    rolePermissions: 'Uprawnienia roli',
    selectedCount: '{legend} — wybrano {selected} z {total}',
    confirm: 'Potwierdź',
  },
})

const systemRoleKeys = {
  owner: 'roleOwner',
  manager: 'roleManager',
  master: 'roleMaster',
} as const

/**
 * Name of a role as the reader should see it. The fixed system roles
 * (Owner, Manager, Master) are translated; roles a business created keep the
 * name it gave them.
 */
export function roleLabel(
  role: { name: string; isSystem: boolean },
  locale: Locale,
): string {
  if (!role.isSystem) return role.name
  const key =
    systemRoleKeys[
      role.name.trim().toLowerCase() as keyof typeof systemRoleKeys
    ]
  return key === undefined ? role.name : translate(teamMessages, locale, key)
}
