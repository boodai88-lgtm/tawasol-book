/* Tawasol assistant · clinic facts the assistant is allowed to state. Edit here (or later in the admin); anything marked [confirm] is a placeholder, not a fact. */
(function (g) {
  g.TAWASOL_CLINIC = {
    name: { en: 'Tawasol wellbeing clinic', ar: 'عيادة تواصل' },
    assistant: { en: 'Tawasol', ar: 'تواصل' },
    lead: { en: 'Dr. Bibi Alamiri', ar: 'د. بيبي العميري' },
    city: { en: 'Kuwait', ar: 'الكويت' },
    address: { en: 'MEDC2 Complex, Sabah Al-Salem, Block 1, Street 106, 7th floor — beside AlMezzan Pharmacy', ar: 'مجمع MEDC2، صباح السالم، قطعة 1، شارع 106، الدور السابع، بجانب صيدلية الميزان' },   // sent by the team ONLY after confirmation (see mapLink)
    mapLink: 'https://maps.app.goo.gl/ndSysaztJUuQsEbS8',
    hours: { en: 'Sunday, Monday and Wednesday, 3:00 to 7:30 pm', ar: 'الأحد والاثنين والأربعاء، من ٣:٠٠ إلى ٧:٣٠ مساءً' },   // Juana, 4 Nov 2026
    phone: '+965 6668 9362',                               // clinic WhatsApp (confirmed 3 Nov 2026)
    whatsappLink: 'https://wa.me/96566689362',
    emergency: { en: '112 (Kuwait emergency services)', ar: '١١٢ (الطوارئ في الكويت)' },
    urgentLine: '',                                    // the clinic's own urgent line, if one exists; shown inside the crisis message
    confirmWindow: { en: 'within 24 hours on business days (Sunday–Thursday) to confirm the time and payment', ar: 'خلال ٢٤ ساعة في أيام العمل (الأحد–الخميس) لتأكيد الموعد والدفع' },
    /* Fee card — the exact wording the team sends today. Advance payment confirms a booking; cancellations under 24 h may forfeit the fee. */
    fees: [
      { en: 'Psychiatric Clinical Diagnostic Interview', ar: 'المقابلة التشخيصية النفسية', price: 'KD 220', dur: { en: '50 minutes, all ages', ar: '٥٠ دقيقة، لجميع الأعمار' } },
      { en: 'Follow-up session', ar: 'جلسة متابعة', price: 'KD 120', dur: { en: '25 minutes, all ages', ar: '٢٥ دقيقة، لجميع الأعمار' } },
    ],
    cancellation: { en: 'Same-day cancellations or rescheduling may result in the session fee being forfeited; please give at least 24 hours’ notice.', ar: 'قد يؤدي الإلغاء أو تغيير الموعد في اليوم نفسه إلى خسارة رسوم الجلسة؛ يرجى الإبلاغ قبل ٢٤ ساعة على الأقل.' },
    /* Booking details. askAge=false → the assistant does not ask the age; instead it tells the client the team will request a Civil ID copy on WhatsApp to confirm (Juana, 4 Nov 2026 — pending Dr. Bibi). The ID is never collected in the chat. */
    askAge: false,
    civilIdNote: { en: 'To confirm the booking, the team will ask you on WhatsApp for a copy of the Civil ID of the person attending.', ar: 'لتأكيد الحجز سيطلب منك الفريق عبر واتساب صورة من البطاقة المدنية للشخص صاحب الموعد.' },
    minorsNote: { en: 'For under-18s, a parent or guardian attends the first visit. [confirm]', ar: 'لمن هم دون ١٨ عاماً، يحضر أحد الوالدين أو الوصي الزيارة الأولى. [للتأكيد]' },
    bookSite: 'https://www.amazon.com/s?k=Tawasol+Bibi+Alamiri',   // the book is sold on Amazon only; paste the exact product link when available
    /* Appointment calendar. DEMO: simulated Google Calendar with these hours. LIVE: the Worker reads free/busy from googleCalendarId (see api/src/calendar.js). */
    calendar: { tz: 'Asia/Kuwait', days: [0, 1, 3], start: '15:00', end: '19:30', slotMin: 50, followupMin: 25, /* consultation 50 min, follow-up 25 min (fee card, Nov 2026) */ leadHours: 20, googleCalendarId: '[confirm: clinic calendar id, e.g. tawasol.clinic@gmail.com]' },
    /* Google Forms the assistant shares after a booking is placed. Staff own payments and intake — the assistant only sends the links. Replace the placeholder URLs with the real forms (see assistant/README.md for the suggested fields). */
    forms: {
      intake: { en: 'https://forms.gle/REPLACE-intake-en', ar: 'https://forms.gle/REPLACE-intake-ar' },
      consent: { en: 'https://forms.gle/REPLACE-consent-en', ar: 'https://forms.gle/REPLACE-consent-ar' },
    },
    services: [                                           // exactly two (Dr. Bibi, 3 Nov 2026) — matches the fee card
      { id: 'psychiatry', en: 'Psychiatric consultation', ar: 'استشارة نفسية', k: ['psychiat', 'consult', 'assessment', 'evaluat', 'diagnos', 'interview', 'first', 'new', 'therap', 'counsel', 'child', 'kid', 'teen', 'famil', 'طب نفسي', 'استشارة', 'تقييم', 'تشخيص', 'مقابلة', 'جديد', 'أول', 'اول', 'طفل', 'مراهق', 'أسر'] },
      { id: 'followup', en: 'Follow-up session', ar: 'جلسة متابعة', k: ['follow', 'review', 'again', 'second', 'متابعة', 'مراجعة', 'مرة ثانية'] },
    ],
    clinicians: [
      { id: 'bibi', en: 'Dr. Bibi Alamiri', ar: 'د. بيبي العميري', k: ['bibi', 'alamiri', 'بيبي', 'العميري'] },
      { id: 'any', en: 'First available', ar: 'أول موعد متاح', k: ['any', 'first', 'available', 'whoever', 'أي', 'أول', 'متاح'] },
    ],
    faqs: [
      { id: 'hours', k: ['hour', 'open', 'timing', 'when are you', 'دوام', 'ساعات', 'متى تفتح', 'أوقات', 'اوقات'], en: 'Clinic hours: {hours}.', ar: 'ساعات العمل: {hours}.' },
      { id: 'location', k: ['where', 'location', 'address', 'map', 'parking', 'direction', 'وين', 'أين', 'اين', 'موقع', 'عنوان', 'مواقف'], en: 'We’re at {address}. If you’d like, I can send directions once the team confirms your appointment.', ar: 'عنواننا: {address}. ويمكن للفريق إرسال الموقع لك عند تأكيد الموعد.' },
      { id: 'fees', k: ['fee', 'price', 'cost', 'how much', 'charge', 'رسوم', 'سعر', 'أسعار', 'اسعار', 'تكلفة', 'بكم', 'كم الرسوم'], en: 'Psychiatric Clinical Diagnostic Interview: KD 220 (all ages), 50 minutes. Follow-up session: KD 120 (all ages), 25 minutes. Appointments are scheduled based on the doctor’s availability, and advance payment is required to confirm a booking. Would you like to proceed?', ar: 'المقابلة التشخيصية النفسية: ٢٢٠ د.ك (لجميع الأعمار)، ٥٠ دقيقة. جلسة المتابعة: ١٢٠ د.ك (لجميع الأعمار)، ٢٥ دقيقة. تُحدَّد المواعيد حسب توفر الطبيبة، ويلزم الدفع المسبق لتأكيد الحجز. هل تودّ المتابعة؟' },
      { id: 'response', k: ['reply', 'respond', 'how long', 'when will', 'answer me', 'متى ترد', 'كم يستغرق', 'الرد'], en: 'I can help you right away with bookings and questions. Anything that needs a person — confirming a time, payment, or a reply from Dr. Bibi — the team handles within 24 hours on business days (Sunday–Thursday). For urgent concerns, please visit the nearest polyclinic.', ar: 'أساعدك فوراً في الحجز والأسئلة. أما ما يحتاج إلى شخص من الفريق، مثل تأكيد الموعد أو الدفع أو رد د. بيبي، فيتم خلال ٢٤ ساعة في أيام العمل (الأحد–الخميس). للحالات العاجلة يرجى التوجه إلى أقرب مستوصف.' },
      { id: 'online', k: ['online', 'video', 'remote', 'zoom', 'teams', 'أونلاين', 'اونلاين', 'عن بعد', 'عن بُعد', 'فيديو'], en: 'Yes — online video sessions are available for many appointments; the clinician will say if an in-person visit is better. [confirm]', ar: 'نعم، الجلسات عن بُعد متاحة لكثير من المواعيد، وسيخبرك الطبيب إن كانت الزيارة الحضورية أنسب. [للتأكيد]' },
      { id: 'first', k: ['first visit', 'expect', 'prepare', 'what happens', 'first time', 'الزيارة الأولى', 'أول مرة', 'اول مرة', 'ماذا يحدث', 'أتوقع', 'أحضّر'], en: 'A first visit is usually a calm conversation of about [confirm: 45–60] minutes, to understand what’s going on and agree the next steps together. There’s nothing to prepare — coming as you are is enough.', ar: 'الزيارة الأولى عادةً حديث هادئ يستغرق نحو [للتأكيد: ٤٥–٦٠] دقيقة لفهم ما يحدث والاتفاق معاً على الخطوات التالية. لا حاجة للتحضير، يكفي أن تأتي كما أنت.' },
      { id: 'insurance', k: ['insurance', 'تأمين', 'تامين'], en: 'I don’t have insurance details yet — please ask the team when they confirm your appointment. [confirm]', ar: 'ليست لدي تفاصيل التأمين بعد، فاسأل الفريق عند تأكيد موعدك. [للتأكيد]' },
      { id: 'privacy', k: ['privacy', 'confidential', 'private', 'secret', 'سري', 'خصوصي', 'سرية'], en: 'Everything you share here stays with the clinic team and is treated as confidential, exactly like a phone call to reception.', ar: 'كل ما تشاركه هنا يبقى لدى فريق العيادة ويُعامل بسرية تامة، تماماً كمكالمة هاتفية مع الاستقبال.' },
      { id: 'languages', k: ['arabic', 'english', 'language', 'لغة', 'عربي', 'انجليزي', 'إنجليزي'], en: 'Sessions are available in Arabic and English. [confirm]', ar: 'الجلسات متاحة بالعربية والإنجليزية. [للتأكيد]' },
      { id: 'children', k: ['see children', 'treat children', 'for kids', 'for children', 'تعالجون الأطفال', 'تستقبلون الأطفال'], en: 'Yes — the clinic sees children and adolescents. {minors}', ar: 'نعم، تستقبل العيادة الأطفال والمراهقين. {minors}' },
      { id: 'book', k: ['guidebook', 'the book', 'ebook', 'audiobook', 'كتاب', 'الكتاب'], en: 'Dr. Bibi’s guidebook “Tawasol” is available on Amazon if you’d like it: {bookSite}. It isn’t needed for an appointment.', ar: 'كتاب د. بيبي «تواصل» متوفر على أمازون إن رغبت فيه: {bookSite}. وليس مطلوباً للموعد.' },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
