import { formatDateTime, formatHoldDuration } from '../lib/format';

/**
 * Every piece of UI text, in English and Bangla. `bn` is typed as `Strings`, so the build
 * fails if a Bangla string is missing. Names of classes, IDs and the student number are
 * data, not text: they are never translated.
 */

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** "10:42" → "১০:৪২". */
export function toBanglaDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]!);
}

const bnNum = (n: number) => toBanglaDigits(String(n));

function bnHoldDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${bnNum(seconds)} সেকেন্ড`;
  }
  return seconds === 0 ? `${bnNum(minutes)} মিনিট` : `${bnNum(minutes)} মিনিট ${bnNum(seconds)} সেকেন্ড`;
}

function bnDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return toBanglaDigits(
    // 24-hour clock: the 12-hour form would put an English "AM"/"PM" into Bangla text.
    date.toLocaleString('bn-BD', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  );
}

const en = {
  /** Shown on the language switch. */
  langName: 'English',
  /** Digits in running text: unchanged in English, Bangla digits in Bangla. */
  digits: (text: string) => text,
  num: (n: number) => String(n),
  dateTime: (iso: string) => formatDateTime(iso),
  holdDuration: (seconds: number) => formatHoldDuration(seconds),
  limitedTime: 'a limited time',

  common: {
    language: 'Language',
    backToHome: 'Back to home',
    admissionYear: (year: number) => `Admission ${year}`,
    tryAgain: 'Try again',
    dismiss: 'Dismiss message',
    loadingClasses: 'Loading classes…',
    loadingApplications: 'Loading applications…',
    loadingApplication: 'Loading application…',
    stale: 'Server unreachable. Showing the last known information; retrying…',
    pageMissing: 'This page does not exist.',
    goHome: 'Go to the home page',
  },

  seats: {
    confirmed: 'Confirmed',
    onHold: 'On hold',
    available: 'Available',
    total: 'Total',
    inTotal: (n: number) => `${n} seats in total`,
    availableUnit: ' seats available',
    open: 'Seats open',
    few: 'Few left',
    full: 'Full',
    barLabel: (confirmed: number, held: number, available: number, total: number) =>
      `${confirmed} confirmed, ${held} on hold, ${available} available of ${total}`,
  },

  /** Status names as shown on badges. In English they are the API's own words. */
  status: { HELD: 'HELD', CONFIRMED: 'CONFIRMED', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' },

  student: {
    label: "Child's birth registration no.",
    placeholder: '17 digits, e.g. 20152691234567890',
    continue: 'Continue',
    help: (count: number) => `${count}/17 digits. Your applications are saved under this number.`,
    applyingAs: 'Applying as',
    change: 'Change',
    current: 'Current student',
  },

  admission: {
    title: 'Online admission',
    lead: "Your child's birth registration number is used as their identity. No login needed.",
    tabsLabel: 'Admission sections',
    tabClasses: 'Classes & seats',
    tabMine: 'My applications',
    tabAdmin: 'School admin',
    count: (n: number) => `${n} applications`,
  },

  classes: {
    title: 'Classes & seats',
    lead: (holdFor: string) => `Each shift is its own class. Applying holds a seat for ${holdFor}.`,
    live: (seconds: number) => `Live · refreshes every ${seconds} s`,
    offline: 'Offline',
    needId: "Enter the child's birth registration number above to apply.",
    none: 'No classes have been opened yet.',
    noneBefore: 'The school admin can open one under ',
    noneLink: 'School admin',
    noneAfter: '.',
    applying: 'Applying…',
    enterIdToApply: 'Enter birth reg. no. to apply',
    seatsFull: 'Seats full',
    apply: 'Apply for a seat',
    viewAdmitted: 'Admitted — view application',
    viewHeld: 'On hold — view my application',
    fullHint: 'All seats are taken. A seat opens again if a hold expires or is cancelled.',
  },

  application: {
    back: 'All my applications',
    applicationFor: 'Application for',
    timeLeft: 'Time left to pay',
    holdTimer: 'Hold timer',
    paid: 'Paid',
    statusText: {
      HELD: 'Your seat is reserved. Pay the admission fee before the timer ends to confirm admission.',
      CONFIRMED: 'Admission confirmed. Keep the application ID for your records.',
      EXPIRED:
        'Time ran out before the fee was paid, so the seat went back to the pool. You can apply to this class again if seats are free.',
      CANCELLED: 'This application was cancelled and the seat was released. You can apply again if seats are free.',
    },
    paying: 'Paying…',
    feePaid: 'Fee paid',
    pay: 'Pay admission fee',
    cancel: 'Cancel application',
    confirmCancelLabel: 'Confirm cancellation',
    confirmCancelQuestion: 'Cancel this application and give up the seat?',
    cancelling: 'Cancelling…',
    yesCancel: 'Yes, cancel it',
    keep: 'Keep it',
    needId: "Enter the child's birth registration number above to pay or cancel.",
    goToList: 'Go to the class list',
    details: 'Details',
    applicationId: 'Application ID',
    birthReg: 'Birth reg. no.',
    appliedAt: 'Applied at',
    holdEnds: 'Hold ends at',
    holdEnded: 'Hold ended at',
    holdWas: 'Hold was until',
    simulated: 'Payment is simulated for this demo: pressing Pay counts as a successful payment.',
  },

  mine: {
    title: 'My applications',
    lead: 'Every application for this birth registration number. They are kept on the server, so they are still here after a refresh or after reopening the browser.',
    needId: "Enter the birth registration number above to see the child's applications.",
    none: 'No applications yet.',
    noneBefore: 'Pick a class with free seats on the ',
    noneLink: 'class list',
    noneAfter: ' and press Apply.',
    waiting: 'Waiting for payment',
    others: 'Other applications',
    applied: (when: string) => `Applied ${when}`,
    left: (time: string) => `${time} left`,
    payOrCancel: 'Pay or cancel',
    view: 'View',
  },

  admin: {
    title: 'Create a class',
    lead: 'Add each shift as its own class, e.g. "Class 6 - Morning Shift" and "Class 6 - Day Shift".',
    name: 'Class name',
    seats: 'Number of seats',
    seatsHelp: 'A whole number from 1 to 10,000.',
    errNameEmpty: 'Enter a class name, for example "Class 6 - Morning Shift".',
    errNameLong: (max: number, length: number) => `The name can be at most ${max} characters (this one has ${length}).`,
    errSeatsEmpty: 'Enter the number of seats.',
    errSeatsWhole: 'The number of seats must be a whole number.',
    errSeatsRange: 'The number of seats must be between 1 and 10,000.',
    created: (name: string, seats: number) => `Created "${name}" with ${seats} seats.`,
    creating: 'Creating…',
    create: 'Create class',
    allClasses: 'All classes',
    none: 'No classes yet. Create the first one.',
    free: (available: number, total: number) => `${available} / ${total} free`,
  },

  /** Messages shown at the top of the admission page after an action. */
  notices: {
    applied: (className: string) => `A seat in ${className} is now held for your child. Pay before the timer ends.`,
    paid: (className: string) => `Payment received. Admission to ${className} is confirmed.`,
    cancelled: 'Application cancelled. The seat has been released.',
    created: (name: string, seats: number) => `"${name}" was created with ${seats} seats. Parents can apply now.`,
  },

  home: {
    topStrip: (year: number) =>
      `Admission for academic year ${year} is open. Seats are given first come, first served.`,
    latestNotice: 'Latest notice:',
    noticeLink: 'See open classes',
    mainNav: 'Main',
    navHome: 'Home',
    navClasses: 'Classes',
    navWhy: 'Why us',
    navTeachers: 'Teachers',
    navContact: 'Contact',
    navHow: 'How to apply',
    navFaq: 'FAQ',
    schoolAdmin: 'School admin',
    applyNow: 'Apply now',

    heroEyebrow: (year: number) => `Admission ${year} is open`,
    heroTitleStart: 'A different kind of school for ',
    heroTitleAccent: 'curious young minds',
    heroLead:
      "Apply online in minutes. Pick a class and shift, and the seat is held in your child's name while you pay the admission fee. No login, no queue at the gate.",
    start: 'Start application',
    howWorks: 'How admission works',
    glanceTitle: 'Admission at a glance',
    glanceSeats: 'Seats open now',
    glanceClasses: 'Classes taking admission',
    glanceHold: 'Seat held while you pay',

    trustTitle: 'Why parents trust our admission',
    trust: (holdFor: string) => [
      'First come, first served',
      `Seat held for ${holdFor} while you pay`,
      'No login, no queue at the gate',
      'Never overbooked',
      'Morning and day shifts',
      'Caring, trained teachers',
      'Safe, bright classrooms',
    ],

    joinEyebrow: 'Join us',
    joinTitle: "Create your child's future here",
    joinLead:
      'Our teachers know every child by name. Admission takes about five minutes from your phone: four steps, and the seat is held for you while you pay.',
    joinPhoto: 'A crowd of smiling school children waving at the camera',

    classesEyebrow: 'Classes we offer',
    classesTitle: 'Choose a class and shift',
    classesLead:
      'Every class we take admission for this year. Each shift has its own seats, and the counts update by themselves. Tap a class to apply.',
    classesEmpty: 'No classes are open for admission yet.',
    classesEmptyBody: 'Please check back soon.',
    classApply: 'Apply for this class',

    whyEyebrow: 'How we teach',
    whyTitle: 'Why families choose us',
    whyLead: 'Small things, done every day, add up to a school children are happy to walk into.',
    why: [
      { title: 'Learning by doing', text: 'Children write, count and draw in every lesson instead of only listening.' },
      { title: 'Teachers who know each child', text: 'Small groups mean a teacher sees who needs help, and who is ready for more.' },
      { title: 'Reading together', text: 'Every day starts with a story, read aloud and talked over in Bangla and English.' },
      { title: 'Bright, safe classrooms', text: 'Airy rooms, child-sized furniture and a campus that is watched all day.' },
    ],

    teachersEyebrow: 'Our teachers',
    teachersTitle: 'The people your child will learn from',
    teachersLead: 'Experienced, patient and trained to teach young children.',
    teachers: [
      { name: 'Nasrin Akter', role: 'Head teacher, Bangla', years: '18 years teaching', bio: 'Builds a love of reading early, one story at a time.' },
      { name: 'Mahmudul Hasan', role: 'Mathematics', years: '12 years teaching', bio: 'Turns numbers into games, with blocks, beads and puzzles.' },
      { name: 'Farzana Rahman', role: 'English', years: '9 years teaching', bio: 'Gets shy children talking through songs and short plays.' },
      { name: 'Tanvir Ahmed', role: 'Science and nature', years: '7 years teaching', bio: 'Takes lessons outdoors to the school garden whenever the weather allows.' },
    ],

    voicesEyebrow: 'Parents say',
    voicesTitle: 'Families who joined last year',
    voices: [
      {
        quote: 'We applied from home at night and the seat was held right away. No standing at the gate at dawn.',
        name: 'Rashida Begum',
        child: 'Mother of a Class 1 student',
      },
      {
        quote: 'My son was very shy. After one term he reads to us every evening.',
        name: 'Kamrul Islam',
        child: 'Father of a Class 3 student',
      },
      {
        quote: 'The teachers call us when something is wrong and when something goes right. That means a lot.',
        name: 'Sharmin Sultana',
        child: 'Mother of a Class 6 student',
      },
      {
        quote: 'Morning shift was nearly full. We saw the live seat count, applied in two minutes and paid the same day.',
        name: 'Abdul Karim',
        child: 'Father of a Class 2 student',
      },
      {
        quote: 'My daughter now asks to go to school early. The science garden is her favourite place.',
        name: 'Nusrat Jahan',
        child: 'Mother of a Class 4 student',
      },
      {
        quote: 'Clear fees, clear timings and a teacher who answers the phone. That is all we wanted.',
        name: 'Mizanur Rahman',
        child: 'Father of a Class 5 student',
      },
    ],
    voicesPrev: 'Previous quotes',
    voicesNext: 'Next quotes',
    voicesGoTo: (n: number) => `Show quote ${n}`,

    steps: (holdFor: string) => [
      {
        title: 'Enter the birth registration no.',
        text: "Type your child's 17-digit number at the top of the admission page. It identifies every application.",
      },
      { title: 'Pick a class and shift', text: 'Press "Apply" on any class that still shows free seats.' },
      {
        title: `Your seat is held for ${holdFor}`,
        text: 'A timer shows how long you have. Nobody else can take the seat meanwhile.',
      },
      {
        title: 'Pay the fee and admission is confirmed',
        text: 'Pay before the timer ends. If time runs out, the seat returns to the pool and you can apply again.',
      },
    ],

    faqEyebrow: 'FAQ',
    faqTitle: 'Questions parents ask',
    faq: (holdFor: string) => [
      {
        q: 'What happens if I don’t pay in time?',
        a: `A seat is held for ${holdFor}. After that the application shows EXPIRED and the seat goes back to the pool. You can apply to the same class again if seats are still free.`,
      },
      {
        q: 'Can I apply for more than one shift?',
        a: 'Yes. Each shift is a separate class, so you can hold a seat in the Morning and the Day shift. Within one class, a child can have only one active application.',
      },
      {
        q: 'Can I cancel after paying?',
        a: 'Online cancel works only while the seat is on hold. For a confirmed admission, please contact the school office.',
      },
      { q: 'I pressed “Pay” twice. Was I charged twice?', a: 'No. Paying again for the same application counts only once.' },
    ],

    ctaTitle: 'Seats are filling up. Secure yours today.',
    ctaText: 'Have the 17-digit birth registration no. ready and apply in minutes.',

    contactEyebrow: 'Contact us',
    contactTitle: 'Visit or call the school office',
    contactLead: 'Questions about classes, fees or a confirmed admission? The office is happy to help.',
    contactAddress: 'Address',
    contactPhone: 'Phone',
    contactEmail: 'Email',
    contactHours: 'Office hours',
    address: 'House 12, Road 5, Dhanmondi, Dhaka 1205',
    officeHours: 'Saturday to Thursday, 9 am to 4 pm',

    footerAdmission: 'Admission',
    footerMine: 'My applications',
    footerCreateClass: 'Create a class',
    copyright: (year: number, name: string) => `© ${year} ${name}`,
    tagline: (year: number) => `Admission ${year} · first come, first served`,
  },
};

export type Strings = typeof en;

const bn: Strings = {
  langName: 'বাংলা',
  digits: toBanglaDigits,
  num: bnNum,
  dateTime: bnDateTime,
  holdDuration: bnHoldDuration,
  limitedTime: 'নির্দিষ্ট সময়',

  common: {
    language: 'ভাষা',
    backToHome: 'হোমে ফিরুন',
    admissionYear: (year) => `ভর্তি ${bnNum(year)}`,
    tryAgain: 'আবার চেষ্টা করুন',
    dismiss: 'বার্তাটি বন্ধ করুন',
    loadingClasses: 'ক্লাসের তালিকা আসছে…',
    loadingApplications: 'আবেদনগুলো আসছে…',
    loadingApplication: 'আবেদন আসছে…',
    stale: 'সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। আগের তথ্য দেখানো হচ্ছে; আবার চেষ্টা চলছে…',
    pageMissing: 'এই পাতাটি নেই।',
    goHome: 'হোম পাতায় যান',
  },

  seats: {
    confirmed: 'নিশ্চিত',
    onHold: 'হোল্ডে',
    available: 'খালি',
    total: 'মোট',
    inTotal: (n) => `মোট ${bnNum(n)}টি আসন`,
    availableUnit: 'টি আসন খালি',
    open: 'আসন খালি আছে',
    few: 'অল্প বাকি',
    full: 'পূর্ণ',
    barLabel: (confirmed, held, available, total) =>
      `${bnNum(confirmed)}টি নিশ্চিত, ${bnNum(held)}টি হোল্ডে, ${bnNum(total)}টির মধ্যে ${bnNum(available)}টি খালি`,
  },

  status: { HELD: 'হোল্ডে আছে', CONFIRMED: 'ভর্তি নিশ্চিত', EXPIRED: 'মেয়াদ শেষ', CANCELLED: 'বাতিল' },

  student: {
    label: 'শিশুর জন্ম নিবন্ধন নম্বর',
    placeholder: '১৭ অঙ্ক, যেমন 20152691234567890',
    continue: 'এগিয়ে যান',
    help: (count) => `${bnNum(count)}/১৭ অঙ্ক। আপনার আবেদনগুলো এই নম্বরে সংরক্ষিত থাকবে।`,
    applyingAs: 'আবেদনকারী',
    change: 'পরিবর্তন',
    current: 'বর্তমান শিক্ষার্থী',
  },

  admission: {
    title: 'অনলাইন ভর্তি',
    lead: 'শিশুর জন্ম নিবন্ধন নম্বরই তার পরিচয়। কোনো লগইন লাগবে না।',
    tabsLabel: 'ভর্তির অংশ',
    tabClasses: 'ক্লাস ও আসন',
    tabMine: 'আমার আবেদন',
    tabAdmin: 'স্কুল অ্যাডমিন',
    count: (n) => `${bnNum(n)}টি আবেদন`,
  },

  classes: {
    title: 'ক্লাস ও আসন',
    lead: (holdFor) => `প্রতিটি শিফট আলাদা ক্লাস। আবেদন করলে একটি আসন ${holdFor} হোল্ডে থাকে।`,
    live: (seconds) => `লাইভ · প্রতি ${bnNum(seconds)} সেকেন্ডে হালনাগাদ`,
    offline: 'অফলাইন',
    needId: 'আবেদন করতে উপরের ঘরে শিশুর জন্ম নিবন্ধন নম্বর লিখুন।',
    none: 'এখনো কোনো ক্লাস খোলা হয়নি।',
    noneBefore: '',
    noneLink: 'স্কুল অ্যাডমিন',
    noneAfter: ' অংশ থেকে ক্লাস খোলা যায়।',
    applying: 'আবেদন হচ্ছে…',
    enterIdToApply: 'আবেদনের জন্য জন্ম নিবন্ধন নম্বর দিন',
    seatsFull: 'আসন পূর্ণ',
    apply: 'আসনের জন্য আবেদন করুন',
    viewAdmitted: 'ভর্তি নিশ্চিত — আবেদন দেখুন',
    viewHeld: 'হোল্ডে আছে — আমার আবেদন দেখুন',
    fullHint: 'সব আসন নেওয়া হয়ে গেছে। কোনো হোল্ডের মেয়াদ শেষ হলে বা বাতিল হলে আসন আবার খুলবে।',
  },

  application: {
    back: 'আমার সব আবেদন',
    applicationFor: 'আবেদন',
    timeLeft: 'ফি দেওয়ার বাকি সময়',
    holdTimer: 'হোল্ডের সময়',
    paid: 'পরিশোধিত',
    statusText: {
      HELD: 'আসনটি সংরক্ষিত আছে। ভর্তি নিশ্চিত করতে সময় শেষ হওয়ার আগে ভর্তি ফি দিন।',
      CONFIRMED: 'ভর্তি নিশ্চিত হয়েছে। আবেদন নম্বরটি সংরক্ষণ করে রাখুন।',
      EXPIRED:
        'ফি দেওয়ার আগেই সময় শেষ হয়ে গেছে, তাই আসনটি আবার সবার জন্য খুলে গেছে। আসন খালি থাকলে এই ক্লাসে আবার আবেদন করতে পারবেন।',
      CANCELLED: 'আবেদনটি বাতিল করা হয়েছে এবং আসনটি ছেড়ে দেওয়া হয়েছে। আসন খালি থাকলে আবার আবেদন করতে পারবেন।',
    },
    paying: 'পরিশোধ হচ্ছে…',
    feePaid: 'ফি পরিশোধিত',
    pay: 'ভর্তি ফি দিন',
    cancel: 'আবেদন বাতিল করুন',
    confirmCancelLabel: 'বাতিল নিশ্চিত করুন',
    confirmCancelQuestion: 'আবেদনটি বাতিল করে আসনটি ছেড়ে দেবেন?',
    cancelling: 'বাতিল হচ্ছে…',
    yesCancel: 'হ্যাঁ, বাতিল করুন',
    keep: 'না, রাখুন',
    needId: 'ফি দিতে বা বাতিল করতে উপরের ঘরে শিশুর জন্ম নিবন্ধন নম্বর লিখুন।',
    goToList: 'ক্লাস তালিকায় যান',
    details: 'বিস্তারিত',
    applicationId: 'আবেদন নম্বর',
    birthReg: 'জন্ম নিবন্ধন নম্বর',
    appliedAt: 'আবেদনের সময়',
    holdEnds: 'হোল্ড শেষ হবে',
    holdEnded: 'হোল্ড শেষ হয়েছে',
    holdWas: 'হোল্ডের মেয়াদ ছিল',
    simulated: 'এই ডেমোতে আসল টাকা নেওয়া হয় না: "ভর্তি ফি দিন" চাপলেই পরিশোধ সফল ধরা হয়।',
  },

  mine: {
    title: 'আমার আবেদন',
    lead: 'এই জন্ম নিবন্ধন নম্বরের সব আবেদন। এগুলো সার্ভারে সংরক্ষিত, তাই পাতা রিফ্রেশ করলে বা ব্রাউজার আবার খুললেও থেকে যায়।',
    needId: 'আবেদন দেখতে উপরের ঘরে শিশুর জন্ম নিবন্ধন নম্বর লিখুন।',
    none: 'এখনো কোনো আবেদন নেই।',
    noneBefore: '',
    noneLink: 'ক্লাস তালিকা',
    noneAfter: ' থেকে খালি আসন আছে এমন একটি ক্লাস বেছে নিয়ে আবেদন করুন।',
    waiting: 'ফি জমার অপেক্ষায়',
    others: 'অন্যান্য আবেদন',
    applied: (when) => `আবেদন: ${when}`,
    left: (time) => `${time} বাকি`,
    payOrCancel: 'ফি দিন বা বাতিল করুন',
    view: 'দেখুন',
  },

  admin: {
    title: 'ক্লাস তৈরি করুন',
    lead: 'প্রতিটি শিফট আলাদা ক্লাস হিসেবে যোগ করুন, যেমন "Class 6 - Morning Shift" ও "Class 6 - Day Shift"।',
    name: 'ক্লাসের নাম',
    seats: 'আসন সংখ্যা',
    seatsHelp: '১ থেকে ১০,০০০-এর মধ্যে একটি পূর্ণ সংখ্যা।',
    errNameEmpty: 'ক্লাসের নাম লিখুন, যেমন "Class 6 - Morning Shift"।',
    errNameLong: (max, length) => `নাম সর্বোচ্চ ${bnNum(max)} অক্ষরের হতে পারে (এখানে ${bnNum(length)}টি)।`,
    errSeatsEmpty: 'আসন সংখ্যা লিখুন।',
    errSeatsWhole: 'আসন সংখ্যা একটি পূর্ণ সংখ্যা হতে হবে।',
    errSeatsRange: 'আসন সংখ্যা ১ থেকে ১০,০০০-এর মধ্যে হতে হবে।',
    created: (name, seats) => `"${name}" তৈরি হয়েছে, আসন ${bnNum(seats)}টি।`,
    creating: 'তৈরি হচ্ছে…',
    create: 'ক্লাস তৈরি করুন',
    allClasses: 'সব ক্লাস',
    none: 'এখনো কোনো ক্লাস নেই। প্রথম ক্লাসটি তৈরি করুন।',
    free: (available, total) => `${bnNum(total)}টির মধ্যে ${bnNum(available)}টি খালি`,
  },

  notices: {
    applied: (className) => `${className}-এ একটি আসন আপনার সন্তানের নামে হোল্ড করা হয়েছে। সময় শেষ হওয়ার আগে ফি দিন।`,
    paid: (className) => `ফি জমা হয়েছে। ${className}-এ ভর্তি নিশ্চিত হয়েছে।`,
    cancelled: 'আবেদন বাতিল হয়েছে। আসনটি ছেড়ে দেওয়া হয়েছে।',
    created: (name, seats) => `"${name}" ক্লাসটি ${bnNum(seats)}টি আসন নিয়ে তৈরি হয়েছে। অভিভাবকরা এখন আবেদন করতে পারবেন।`,
  },

  home: {
    topStrip: (year) => `${bnNum(year)} শিক্ষাবর্ষের ভর্তি চলছে। আসন দেওয়া হয় আগে আবেদন করলে আগে পাবেন ভিত্তিতে।`,
    latestNotice: 'সর্বশেষ নোটিশ:',
    noticeLink: 'খালি ক্লাসগুলো দেখুন',
    mainNav: 'প্রধান মেনু',
    navHome: 'হোম',
    navClasses: 'ক্লাসসমূহ',
    navWhy: 'কেন আমরা',
    navTeachers: 'শিক্ষকবৃন্দ',
    navContact: 'যোগাযোগ',
    navHow: 'আবেদনের নিয়ম',
    navFaq: 'প্রশ্নোত্তর',
    schoolAdmin: 'স্কুল অ্যাডমিন',
    applyNow: 'এখনই আবেদন করুন',

    heroEyebrow: (year) => `${bnNum(year)} সালের ভর্তি চলছে`,
    heroTitleStart: 'কৌতূহলী ছোট্ট মনের জন্য ',
    heroTitleAccent: 'একটু অন্যরকম স্কুল',
    heroLead:
      'কয়েক মিনিটেই অনলাইনে আবেদন করুন। ক্লাস ও শিফট বেছে নিন; ফি দেওয়া পর্যন্ত আসনটি আপনার সন্তানের নামে হোল্ড থাকবে। লগইন নেই, স্কুলের গেটে লাইনও নেই।',
    start: 'আবেদন শুরু করুন',
    howWorks: 'ভর্তি কীভাবে হয়',
    glanceTitle: 'এক নজরে ভর্তি',
    glanceSeats: 'এখন খালি আসন',
    glanceClasses: 'ভর্তি চলছে এমন ক্লাস',
    glanceHold: 'ফি দেওয়ার জন্য আসন হোল্ড থাকে',

    trustTitle: 'অভিভাবকেরা কেন আমাদের ভর্তিতে ভরসা রাখেন',
    trust: (holdFor) => [
      'আগে আবেদন, আগে আসন',
      `ফি দেওয়ার জন্য ${holdFor} আসন হোল্ড`,
      'লগইন নেই, গেটে লাইনও নেই',
      'কখনো অতিরিক্ত ভর্তি নয়',
      'প্রভাতি ও দিবা শিফট',
      'যত্নশীল, প্রশিক্ষিত শিক্ষক',
      'নিরাপদ, আলো-ঝলমলে ক্লাসরুম',
    ],

    joinEyebrow: 'আমাদের সাথে যুক্ত হোন',
    joinTitle: 'আপনার সন্তানের ভবিষ্যৎ গড়ুন এখানে',
    joinLead:
      'আমাদের শিক্ষকেরা প্রতিটি শিশুকে নামে চেনেন। ফোন থেকেই মোটামুটি পাঁচ মিনিটে ভর্তি: চারটি ধাপ, আর ফি দেওয়া পর্যন্ত আসনটি আপনার জন্য হোল্ড থাকে।',
    joinPhoto: 'হাসিমুখে ক্যামেরার দিকে হাত নাড়ছে একদল স্কুলের শিশু',

    classesEyebrow: 'আমাদের ক্লাসসমূহ',
    classesTitle: 'ক্লাস ও শিফট বেছে নিন',
    classesLead:
      'এ বছর যেসব ক্লাসে ভর্তি নেওয়া হচ্ছে। প্রতিটি শিফটের আসন আলাদা, হিসাব নিজে থেকেই হালনাগাদ হয়। আবেদন করতে ক্লাসটিতে চাপুন।',
    classesEmpty: 'এখনো কোনো ক্লাসে ভর্তি শুরু হয়নি।',
    classesEmptyBody: 'কিছুক্ষণ পরে আবার দেখুন।',
    classApply: 'এই ক্লাসে আবেদন করুন',

    whyEyebrow: 'আমরা যেভাবে পড়াই',
    whyTitle: 'পরিবারগুলো কেন আমাদের বেছে নেয়',
    whyLead: 'প্রতিদিনের ছোট ছোট কাজ মিলেই এমন একটি স্কুল, যেখানে শিশুরা আনন্দ নিয়ে আসে।',
    why: [
      { title: 'হাতে-কলমে শেখা', text: 'প্রতিটি ক্লাসে শিশুরা শুধু শোনে না, লেখে, গোনে আর আঁকে।' },
      { title: 'প্রতিটি শিশুকে চেনেন শিক্ষক', text: 'ছোট দলে পড়ানো হয়, তাই শিক্ষক বোঝেন কার সাহায্য দরকার আর কে আরও এগোতে প্রস্তুত।' },
      { title: 'একসাথে পড়া', text: 'প্রতিদিন শুরু হয় একটি গল্প দিয়ে, বাংলা ও ইংরেজিতে জোরে পড়া আর আলোচনা।' },
      { title: 'আলো-ঝলমলে, নিরাপদ ক্লাসরুম', text: 'খোলামেলা ঘর, শিশুদের মাপের আসবাব আর সারাদিন নজরে রাখা ক্যাম্পাস।' },
    ],

    teachersEyebrow: 'আমাদের শিক্ষকবৃন্দ',
    teachersTitle: 'যাঁদের কাছে আপনার সন্তান শিখবে',
    teachersLead: 'অভিজ্ঞ, ধৈর্যশীল এবং ছোটদের পড়ানোয় প্রশিক্ষিত।',
    teachers: [
      { name: 'নাসরিন আক্তার', role: 'প্রধান শিক্ষক, বাংলা', years: '১৮ বছরের শিক্ষকতা', bio: 'একটি একটি গল্প দিয়ে ছোটবেলা থেকেই পড়ার প্রতি ভালোবাসা তৈরি করেন।' },
      { name: 'মাহমুদুল হাসান', role: 'গণিত', years: '১২ বছরের শিক্ষকতা', bio: 'ব্লক, পুঁতি আর ধাঁধা দিয়ে সংখ্যাকে খেলায় বদলে দেন।' },
      { name: 'ফারজানা রহমান', role: 'ইংরেজি', years: '৯ বছরের শিক্ষকতা', bio: 'গান আর ছোট নাটকের মাধ্যমে লাজুক শিশুদেরও কথা বলান।' },
      { name: 'তানভীর আহমেদ', role: 'বিজ্ঞান ও প্রকৃতি', years: '৭ বছরের শিক্ষকতা', bio: 'আবহাওয়া ভালো থাকলেই ক্লাস নিয়ে যান স্কুলের বাগানে।' },
    ],

    voicesEyebrow: 'অভিভাবকেরা বলছেন',
    voicesTitle: 'গত বছর যে পরিবারগুলো যুক্ত হয়েছে',
    voices: [
      {
        quote: 'রাতে বাসা থেকেই আবেদন করেছি, সঙ্গে সঙ্গে আসন হোল্ড হয়ে গেছে। ভোরে গেটে দাঁড়াতে হয়নি।',
        name: 'রাশিদা বেগম',
        child: 'প্রথম শ্রেণির শিক্ষার্থীর মা',
      },
      {
        quote: 'আমার ছেলে খুব লাজুক ছিল। এক টার্ম পরেই সে প্রতি সন্ধ্যায় আমাদের পড়ে শোনায়।',
        name: 'কামরুল ইসলাম',
        child: 'তৃতীয় শ্রেণির শিক্ষার্থীর বাবা',
      },
      {
        quote: 'কিছু ভুল হলে শিক্ষকেরা ফোন করেন, ভালো কিছু হলেও করেন। এটা আমাদের কাছে অনেক কিছু।',
        name: 'শারমিন সুলতানা',
        child: 'ষষ্ঠ শ্রেণির শিক্ষার্থীর মা',
      },
      {
        quote: 'প্রভাতি শিফট প্রায় ভরে গিয়েছিল। লাইভ আসন সংখ্যা দেখে দুই মিনিটে আবেদন করেছি, সেদিনই ফি দিয়েছি।',
        name: 'আব্দুল করিম',
        child: 'দ্বিতীয় শ্রেণির শিক্ষার্থীর বাবা',
      },
      {
        quote: 'আমার মেয়ে এখন আগেভাগে স্কুলে যেতে চায়। বিজ্ঞানের বাগানটাই তার সবচেয়ে প্রিয় জায়গা।',
        name: 'নুসরাত জাহান',
        child: 'চতুর্থ শ্রেণির শিক্ষার্থীর মা',
      },
      {
        quote: 'পরিষ্কার ফি, পরিষ্কার সময়সূচি আর এমন শিক্ষক যিনি ফোন ধরেন। আমরা এটুকুই চেয়েছিলাম।',
        name: 'মিজানুর রহমান',
        child: 'পঞ্চম শ্রেণির শিক্ষার্থীর বাবা',
      },
    ],
    voicesPrev: 'আগের মতামত',
    voicesNext: 'পরের মতামত',
    voicesGoTo: (n) => `${bnNum(n)} নম্বর মতামত দেখুন`,

    steps: (holdFor) => [
      {
        title: 'জন্ম নিবন্ধন নম্বর দিন',
        text: 'ভর্তির পাতার ওপরে শিশুর ১৭ অঙ্কের নম্বরটি লিখুন। প্রতিটি আবেদন এই নম্বর দিয়ে চেনা যায়।',
      },
      { title: 'ক্লাস ও শিফট বেছে নিন', text: 'যে ক্লাসে খালি আসন আছে, সেখানে "আবেদন করুন" চাপুন।' },
      { title: `আসনটি ${holdFor} হোল্ডে থাকবে`, text: 'একটি টাইমারে বাকি সময় দেখা যাবে। এর মধ্যে অন্য কেউ আসনটি নিতে পারবে না।' },
      {
        title: 'ফি দিন, ভর্তি নিশ্চিত',
        text: 'টাইমার শেষ হওয়ার আগে ফি দিন। সময় পেরিয়ে গেলে আসনটি আবার সবার জন্য খুলে যাবে, আপনি আবার আবেদন করতে পারবেন।',
      },
    ],

    faqEyebrow: 'প্রশ্নোত্তর',
    faqTitle: 'অভিভাবকদের প্রশ্ন',
    faq: (holdFor) => [
      {
        q: 'সময়মতো ফি না দিলে কী হবে?',
        a: `আসন ${holdFor} হোল্ডে থাকে। এরপর আবেদনটি "মেয়াদ শেষ" (EXPIRED) দেখাবে এবং আসনটি আবার সবার জন্য খুলে যাবে। আসন খালি থাকলে একই ক্লাসে আবার আবেদন করতে পারবেন।`,
      },
      {
        q: 'একাধিক শিফটে কি আবেদন করা যায়?',
        a: 'হ্যাঁ। প্রতিটি শিফট আলাদা ক্লাস, তাই প্রভাতি ও দিবা দুই শিফটেই আসন হোল্ড করা যায়। তবে একটি ক্লাসে একজন শিশুর একটিই সক্রিয় আবেদন থাকতে পারে।',
      },
      {
        q: 'ফি দেওয়ার পর কি বাতিল করা যায়?',
        a: 'অনলাইনে শুধু হোল্ডে থাকা আবেদন বাতিল করা যায়। নিশ্চিত ভর্তির ক্ষেত্রে স্কুল অফিসে যোগাযোগ করুন।',
      },
      { q: '"ফি দিন" দুবার চেপেছি। দুবার টাকা কাটা হয়েছে?', a: 'না। একই আবেদনের জন্য আবার ফি দিলে একবারই গণনা হয়।' },
    ],

    ctaTitle: 'আসন দ্রুত পূর্ণ হচ্ছে। আজই নিশ্চিত করুন।',
    ctaText: '১৭ অঙ্কের জন্ম নিবন্ধন নম্বর হাতে রাখুন, কয়েক মিনিটেই আবেদন করুন।',

    contactEyebrow: 'যোগাযোগ',
    contactTitle: 'স্কুল অফিসে আসুন বা ফোন করুন',
    contactLead: 'ক্লাস, ফি বা নিশ্চিত ভর্তি নিয়ে প্রশ্ন আছে? অফিস সাহায্য করতে প্রস্তুত।',
    contactAddress: 'ঠিকানা',
    contactPhone: 'ফোন',
    contactEmail: 'ইমেইল',
    contactHours: 'অফিস সময়',
    address: 'বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা ১২০৫',
    officeHours: 'শনিবার থেকে বৃহস্পতিবার, সকাল ৯টা থেকে বিকেল ৪টা',

    footerAdmission: 'ভর্তি',
    footerMine: 'আমার আবেদন',
    footerCreateClass: 'ক্লাস তৈরি',
    copyright: (year, name) => `© ${bnNum(year)} ${name}`,
    tagline: (year) => `ভর্তি ${bnNum(year)} · আগে আবেদন, আগে আসন`,
  },
};

export type Lang = 'en' | 'bn';

export const STRINGS: Record<Lang, Strings> = { en, bn };

/** Both languages of one message, for a notice that must follow a later language switch. */
export function inBoth(pick: (s: Strings) => string): { en: string; bn: string } {
  return { en: pick(en), bn: pick(bn) };
}
