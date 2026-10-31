/* Tawasol assistant · clinic facts the assistant is allowed to state. Edit here (or later in the admin); anything marked [confirm] is a placeholder, not a fact. */
(function (g) {
  g.TAWASOL_CLINIC = {
    name: { en: 'Tawasol wellbeing clinic', ar: 'عيادة تواصل' },
    assistant: { en: 'Tawasol', ar: 'تواصل' },
    lead: { en: 'Dr. Bibi Alamiri', ar: 'د. بيبي العميري' },
    city: { en: 'Kuwait', ar: 'الكويت' },
    address: { en: '[confirm: clinic address]', ar: '[للتأكيد: عنوان العيادة]' },
    hours: { en: '[confirm: e.g. Sunday–Thursday, 9 am–7 pm]', ar: '[للتأكيد: مثلاً الأحد–الخميس، ٩ صباحاً–٧ مساءً]' },
    phone: '[confirm: clinic WhatsApp number]',
    emergency: { en: '112 (Kuwait emergency services)', ar: '١١٢ (الطوارئ في الكويت)' },
    urgentLine: '',                                    // the clinic's own urgent line, if one exists; shown inside the crisis message
    confirmWindow: { en: 'within one working day', ar: 'خلال يوم عمل واحد' },
    minorsNote: { en: 'For under-18s, a parent or guardian attends the first visit. [confirm]', ar: 'لمن هم دون ١٨ عاماً، يحضر أحد الوالدين أو الوصي الزيارة الأولى. [للتأكيد]' },
    bookSite: 'https://boodai88-lgtm.github.io/tawasol-book/',
    /* Appointment calendar. DEMO: simulated Google Calendar with these hours. LIVE: the Worker reads free/busy from googleCalendarId (see api/src/calendar.js). */
    calendar: { tz: 'Asia/Kuwait', days: [0, 1, 2, 3, 4], start: '10:00', end: '18:00', slotMin: 50, leadHours: 20, googleCalendarId: '[confirm: clinic calendar id, e.g. tawasol.clinic@gmail.com]' },
    /* Google Forms the assistant shares after a booking is placed. Staff own payments and intake — the assistant only sends the links. Replace the placeholder URLs with the real forms (see assistant/README.md for the suggested fields). */
    forms: {
      intake: { en: 'https://forms.gle/REPLACE-intake-en', ar: 'https://forms.gle/REPLACE-intake-ar' },
      consent: { en: 'https://forms.gle/REPLACE-consent-en', ar: 'https://forms.gle/REPLACE-consent-ar' },
    },
    services: [
      { id: 'psychiatry', en: 'Psychiatry consultation', ar: 'استشارة طب نفسي', k: ['psychiat', 'consult', 'assessment', 'evaluat', 'طب نفسي', 'استشارة', 'تقييم'] },
      { id: 'therapy', en: 'Therapy & counselling', ar: 'علاج نفسي وإرشاد', k: ['therap', 'counsel', 'talk', 'session', 'علاج', 'إرشاد', 'جلسات'] },
      { id: 'child', en: 'Child & adolescent', ar: 'الأطفال والمراهقون', k: ['child', 'kid', 'son', 'daughter', 'teen', 'adolesc', 'school', 'طفل', 'ابن', 'بنت', 'مراهق', 'مدرسة'] },
      { id: 'family', en: 'Family & parenting', ar: 'إرشاد أسري وتربوي', k: ['famil', 'parent', 'couple', 'marri', 'أسر', 'عائل', 'تربية', 'زوج'] },
      { id: 'followup', en: 'Follow-up visit', ar: 'زيارة متابعة', k: ['follow', 'review', 'متابعة', 'مراجعة'] },
    ],
    clinicians: [
      { id: 'bibi', en: 'Dr. Bibi Alamiri', ar: 'د. بيبي العميري', k: ['bibi', 'alamiri', 'بيبي', 'العميري'] },
      { id: 'any', en: 'First available', ar: 'أول موعد متاح', k: ['any', 'first', 'available', 'whoever', 'أي', 'أول', 'متاح'] },
    ],
    faqs: [
      { id: 'hours', k: ['hour', 'open', 'timing', 'when are you', 'دوام', 'ساعات', 'متى تفتح', 'أوقات', 'اوقات'], en: 'Clinic hours: {hours}.', ar: 'ساعات العمل: {hours}.' },
      { id: 'location', k: ['where', 'location', 'address', 'map', 'parking', 'direction', 'وين', 'أين', 'اين', 'موقع', 'عنوان', 'مواقف'], en: 'We’re at {address}. If you’d like, I can send directions once the team confirms your appointment.', ar: 'عنواننا: {address}. ويمكن للفريق إرسال الموقع لك عند تأكيد الموعد.' },
      { id: 'fees', k: ['fee', 'price', 'cost', 'how much', 'charge', 'رسوم', 'سعر', 'أسعار', 'اسعار', 'تكلفة', 'بكم', 'كم الرسوم'], en: 'The team will confirm fees when they contact you to arrange the appointment — I’d rather not give you a wrong figure. [confirm: publish fees?]', ar: 'سيؤكد لك الفريق الرسوم عند التواصل معك لترتيب الموعد، حتى لا أعطيك رقماً غير دقيق. [للتأكيد: نشر الرسوم؟]' },
      { id: 'online', k: ['online', 'video', 'remote', 'zoom', 'teams', 'أونلاين', 'اونلاين', 'عن بعد', 'عن بُعد', 'فيديو'], en: 'Yes — online video sessions are available for many appointments; the clinician will say if an in-person visit is better. [confirm]', ar: 'نعم، الجلسات عن بُعد متاحة لكثير من المواعيد، وسيخبرك الطبيب إن كانت الزيارة الحضورية أنسب. [للتأكيد]' },
      { id: 'first', k: ['first visit', 'expect', 'prepare', 'what happens', 'first time', 'الزيارة الأولى', 'أول مرة', 'اول مرة', 'ماذا يحدث', 'أتوقع', 'أحضّر'], en: 'A first visit is usually a calm conversation of about [confirm: 45–60] minutes, to understand what’s going on and agree the next steps together. There’s nothing to prepare — coming as you are is enough.', ar: 'الزيارة الأولى عادةً حديث هادئ يستغرق نحو [للتأكيد: ٤٥–٦٠] دقيقة لفهم ما يحدث والاتفاق معاً على الخطوات التالية. لا حاجة للتحضير، يكفي أن تأتي كما أنت.' },
      { id: 'insurance', k: ['insurance', 'تأمين', 'تامين'], en: 'I don’t have insurance details yet — please ask the team when they confirm your appointment. [confirm]', ar: 'ليست لدي تفاصيل التأمين بعد، فاسأل الفريق عند تأكيد موعدك. [للتأكيد]' },
      { id: 'privacy', k: ['privacy', 'confidential', 'private', 'secret', 'سري', 'خصوصي', 'سرية'], en: 'Everything you share here stays with the clinic team and is treated as confidential, exactly like a phone call to reception.', ar: 'كل ما تشاركه هنا يبقى لدى فريق العيادة ويُعامل بسرية تامة، تماماً كمكالمة هاتفية مع الاستقبال.' },
      { id: 'languages', k: ['arabic', 'english', 'language', 'لغة', 'عربي', 'انجليزي', 'إنجليزي'], en: 'Sessions are available in Arabic and English. [confirm]', ar: 'الجلسات متاحة بالعربية والإنجليزية. [للتأكيد]' },
      { id: 'children', k: ['see children', 'treat children', 'for kids', 'for children', 'تعالجون الأطفال', 'تستقبلون الأطفال'], en: 'Yes — the clinic sees children and adolescents. {minors}', ar: 'نعم، تستقبل العيادة الأطفال والمراهقين. {minors}' },
      { id: 'book', k: ['guidebook', 'the book', 'ebook', 'audiobook', 'كتاب', 'الكتاب'], en: 'Dr. Bibi’s guidebook “Tawasol” is available in print, ebook and audiobook at {bookSite}', ar: 'كتاب «تواصل» للدكتورة بيبي متوفر مطبوعاً وإلكترونياً وصوتياً على {bookSite}' },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
