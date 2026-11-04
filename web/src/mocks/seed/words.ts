// Hand-written Arabic and English word lists (no lorem ipsum). Pairs are [ar, en].
export const firstNames = [
  "محمد",
  "أحمد",
  "عمر",
  "خالد",
  "إبراهيم",
  "يوسف",
  "عثمان",
  "الطيب",
  "مصطفى",
  "عبدالله",
  "علي",
  "حسن",
  "ياسر",
  "هشام",
  "صلاح",
  "مجدي",
  "عادل",
  "فيصل",
  "طارق",
  "أسامة",
  "فاطمة",
  "آمنة",
  "مها",
  "نجلاء",
  "سارة",
]
// Arabic name part to its English spelling.
export const nameEn: Record<string, string> = {
  محمد: "Mohamed",
  أحمد: "Ahmed",
  عمر: "Omar",
  خالد: "Khalid",
  إبراهيم: "Ibrahim",
  يوسف: "Yousif",
  عثمان: "Osman",
  الطيب: "Al Tayeb",
  مصطفى: "Mustafa",
  عبدالله: "Abdullah",
  علي: "Ali",
  حسن: "Hassan",
  ياسر: "Yasir",
  هشام: "Hisham",
  صلاح: "Salah",
  مجدي: "Magdi",
  عادل: "Adil",
  فيصل: "Faisal",
  طارق: "Tariq",
  أسامة: "Osama",
  فاطمة: "Fatima",
  آمنة: "Amna",
  مها: "Maha",
  نجلاء: "Najla",
  سارة: "Sara",
  بشير: "Bashir",
  عبدالرحمن: "Abdelrahman",
  إدريس: "Idris",
  حامد: "Hamid",
  النور: "Al Nour",
  آدم: "Adam",
  موسى: "Musa",
  سليمان: "Suleiman",
  الزين: "Al Zein",
}
export const familyNames = [
  "حسن",
  "إبراهيم",
  "عثمان",
  "أحمد",
  "الطيب",
  "بشير",
  "عبدالرحمن",
  "إدريس",
  "حامد",
  "النور",
  "آدم",
  "علي",
  "موسى",
  "سليمان",
  "الزين",
]

export const dealerNames: [string, string][] = [
  ["النصر موتورز", "Al Nasr Motors"],
  ["سودان أوتو", "Sudan Auto"],
  ["معرض النيل", "Nile Cars"],
  ["السلام موتورز", "Al Salam Motors"],
  ["بورتسودان أوتو", "Port Sudan Auto"],
  ["البركة موتورز", "Al Baraka Motors"],
  ["العاصمة للسيارات", "Capital Cars"],
  ["الوفاء أوتو", "Al Wafa Auto"],
  ["كسلا موتورز", "Kassala Motors"],
  ["الجزيرة أوتو", "Gezira Auto"],
  ["أم درمان للسيارات", "Omdurman Cars"],
  ["الأمين للشاحنات", "Al Amin Trucks"],
]
export const workshopNames: [string, string][] = [
  ["الأمل لخدمة السيارات", "Al Amal Auto Care"],
  ["ورشة الفاروق", "Al Farouq Workshop"],
  ["ورشة النيل", "Nile Workshop"],
  ["ورشة الصفا", "Al Safa Workshop"],
  ["مركز الإتقان", "Al Itqan Center"],
  ["ورشة البركة", "Al Baraka Workshop"],
  ["مركز السلام للصيانة", "Al Salam Service"],
  ["ورشة الوفاء", "Al Wafa Workshop"],
  ["ورشة الشروق", "Al Shorouk Workshop"],
  ["مركز الحرمين", "Al Haramain Center"],
  ["ورشة الجزيرة", "Gezira Workshop"],
  ["ورشة الاتحاد", "Al Ittihad Workshop"],
  ["ورشة الأمين", "Al Amin Workshop"],
  ["ورشة التقوى", "Al Taqwa Workshop"],
]

export const traits: [string, string][] = [
  ["نظيف جداً", "Very clean"],
  ["استخدام شخصي", "Single owner"],
  ["فل أوبشن", "Full option"],
  ["بحالة ممتازة", "Excellent condition"],
  ["صيانة دورية", "Regularly serviced"],
  ["وارد الخارج", "Imported"],
  ["بدون حوادث", "No accidents"],
  ["جمارك مدفوعة", "Customs paid"],
]
export const colors = [
  "white",
  "black",
  "silver",
  "grey",
  "blue",
  "red",
  "gold",
]

export const descOpen = [
  "{make} {model} موديل {year} بحالة ممتازة.",
  "للبيع {make} {model} {year} نظيفة جداً.",
  "{make} {model} {year} استخدام شخصي وصيانة منتظمة.",
]
export const descRentOpen = [
  "{make} {model} {year} للإيجار بحالة ممتازة.",
  "إيجار {make} {model} {year} مع صيانة دورية.",
]
export const descRentOpenEn = [
  "{make} {model} {year} for rent in excellent condition.",
  "{make} {model} {year} for rent with regular maintenance.",
]
export const descPartOpen = [
  "{part} جديد ومضمون.",
  "{part} بحالة ممتازة ومطابق للمواصفات.",
]
export const descPartOpenEn = [
  "{part}, new and guaranteed.",
  "{part} in excellent condition, matches the specs.",
]
export const descClose = [
  "للتواصل اتصال أو واتساب.",
  "الأوراق كاملة والجمارك مدفوعة.",
  "معاينة في أي وقت بعد العصر.",
  "الجدية فقط من فضلكم.",
]
export const descOpenEn = [
  "{make} {model} {year} in excellent condition.",
  "{make} {model} {year}, clean and well kept.",
  "{make} {model} {year}, regularly serviced.",
]
export const descCloseEn = [
  "Call or message on WhatsApp.",
  "Papers complete, customs paid.",
  "Viewing any day after 4 pm.",
  "Serious buyers only.",
]

export const reviewGood = [
  "خدمة ممتازة وتعامل محترم",
  "سرعة في الإنجاز وأسعار مناسبة",
  "أنصح بالتعامل معهم",
  "أمانة ودقة في المواعيد",
]
export const reviewMid = ["الخدمة جيدة لكن تأخروا قليلاً", "مقبول والسعر معقول"]
export const reviewBad = [
  "تأخير كبير والسعر أعلى من المتفق عليه",
  "التعامل لم يكن جيداً",
]
export const reviewReply = [
  "شكراً لثقتكم، يسعدنا خدمتكم دائماً.",
  "نعتذر عن التأخير وسنحرص على التحسن.",
  "نشكرك على تقييمك الكريم.",
]

export const buyerLines = [
  "السلام عليكم، السيارة متاحة؟",
  "آخر سعر كم؟",
  "ممكن أعاين السيارة اليوم؟",
  "هل فيها أي عطل؟",
  "أين الموقع بالضبط؟",
  "تمام، أشوفك غداً إن شاء الله.",
]
export const sellerLines = [
  "وعليكم السلام، نعم متاحة.",
  "السعر مناسب وقابل للتفاوض قليلاً.",
  "تفضل في أي وقت بعد العصر.",
  "ما شاء الله سليمة بدون أعطال.",
  "الموقع قريب من السوق الرئيسي.",
  "شكراً لك، في الانتظار.",
]
export const customerLines = [
  "السلام عليكم، أريد حجز موعد للصيانة",
  "كم تكلفة تغيير الزيت والفلاتر؟",
  "هل تعملون يوم الجمعة؟",
  "عندي صوت في المحرك",
]
export const providerLines = [
  "وعليكم السلام، تفضل في أي وقت.",
  "التكلفة تبدأ من خمسين ألف جنيه.",
  "نعمل من السبت إلى الخميس.",
  "نفحصها ونخبرك بالسعر قبل العمل.",
]

export const dealerDesc: [string, string][] = [
  [
    "معرض متخصص في بيع وشراء السيارات الجديدة والمستعملة.",
    "A showroom specialising in buying and selling new and used cars.",
  ],
  [
    "نوفر فحصاً شاملاً وضماناً على جميع السيارات المعروضة.",
    "We provide a full inspection and a warranty on every car on display.",
  ],
  [
    "خبرة أكثر من عشر سنوات في سوق السيارات.",
    "More than ten years of experience in the car market.",
  ],
]
export const workshopDesc: [string, string][] = [
  [
    "ورشة متكاملة للصيانة الدورية وإصلاح الأعطال.",
    "A full workshop for routine service and fault repairs.",
  ],
  [
    "فنيون مدربون وقطع غيار أصلية بأسعار واضحة.",
    "Trained technicians and genuine parts at clear prices.",
  ],
  [
    "نقدم فحصاً مجانياً قبل أي إصلاح.",
    "We offer a free inspection before any repair.",
  ],
]
export const mechanicBio: [string, string][] = [
  [
    "ميكانيكي بخبرة طويلة في صيانة السيارات اليابانية والكورية.",
    "Mechanic with long experience servicing Japanese and Korean cars.",
  ],
  [
    "أصل إلى موقعك وأصلح العطل في مكانه.",
    "I come to your location and fix the fault on the spot.",
  ],
  [
    "متخصص في الفحص بالكمبيوتر وإصلاح الكهرباء.",
    "Specialised in computer diagnostics and electrical repairs.",
  ],
]
