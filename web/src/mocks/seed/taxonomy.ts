import type { VehicleType } from "@sayaratak/shared/schemas/listing"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import type { Country } from "../types"
import { slugify } from "./util"

// City: id, English, Arabic, lat, lng, then districts as "English|Arabic".
const cityRows: [string, string, string, number, number, string[]][] = [
  [
    "khartoum",
    "Khartoum",
    "الخرطوم",
    15.5007,
    32.5599,
    [
      "Riyadh|الرياض",
      "Amarat|العمارات",
      "Burri|بري",
      "Manshiya|المنشية",
      "Jabra|جبرة",
      "Kafouri|كافوري",
    ],
  ],
  [
    "omdurman",
    "Omdurman",
    "أم درمان",
    15.6445,
    32.4777,
    [
      "Al Thawra|الثورة",
      "Mahdia|المهدية",
      "Wad Nubawi|ود نوباوي",
      "Mulazmin|الملازمين",
    ],
  ],
  [
    "bahri",
    "Khartoum North (Bahri)",
    "الخرطوم بحري",
    15.6333,
    32.5333,
    ["Shaabiya|الشعبية", "Halfaya|الحلفاية", "Kober|كوبر"],
  ],
  [
    "port-sudan",
    "Port Sudan",
    "بورتسودان",
    19.6158,
    37.2164,
    ["Deim Arab|ديم عرب", "Deim Madina|ديم مدينة", "Salbouna|سلبونا"],
  ],
  [
    "kassala",
    "Kassala",
    "كسلا",
    15.45,
    36.4,
    ["Khatmiya|الختمية", "Gash|القاش", "Central Market|السوق الكبير"],
  ],
  [
    "wad-madani",
    "Wad Madani",
    "ود مدني",
    14.4012,
    33.5199,
    ["Daraja|الدرجة", "Madina Arab|المدينة عرب", "Railway|السكة حديد"],
  ],
  [
    "el-obeid",
    "El Obeid",
    "الأبيض",
    13.1833,
    30.2167,
    ["Andalus|الأندلس", "Al Wehda|الوحدة", "Market|السوق"],
  ],
  [
    "nyala",
    "Nyala",
    "نيالا",
    12.0489,
    24.8807,
    ["Al Matar|المطار", "Al Jabal|الجبل", "Market|السوق"],
  ],
  [
    "gedaref",
    "Gedaref",
    "القضارف",
    14.0349,
    35.3838,
    ["Al Salam|السلام", "Market|السوق", "Al Matar|المطار"],
  ],
  [
    "atbara",
    "Atbara",
    "عطبرة",
    17.7022,
    33.9861,
    ["Dakhla|الداخلة", "Market|السوق", "Al Wehda|الوحدة"],
  ],
]

// Model: English|Arabic|type|min price (million SDG)|max price|engine cc (payload tons for trucks).
const makeRows: [string, string, string, string[]][] = [
  [
    "toyota",
    "Toyota",
    "تويوتا",
    [
      "Hilux|هايلكس|car|20|45|2400",
      "Corolla|كورولا|car|9|28|1600",
      "Camry|كامري|car|15|40|2400",
      "Land Cruiser|لاند كروزر|car|35|60|4000",
      "Prado|برادو|car|28|55|2700",
      "Hiace|هايس|car|18|38|2700",
      "Rav4|راف فور|car|18|42|2000",
      "Dyna|داينا|truck|25|55|3",
    ],
  ],
  [
    "hyundai",
    "Hyundai",
    "هيونداي",
    [
      "Elantra|النترا|car|10|30|1600",
      "Accent|أكسنت|car|9|22|1400",
      "Tucson|توسان|car|18|42|2000",
      "Sonata|سوناتا|car|14|36|2400",
      "HD65|إتش دي 65|truck|30|65|3",
    ],
  ],
  [
    "kia",
    "Kia",
    "كيا",
    [
      "Picanto|بيكانتو|car|9|18|1000",
      "Cerato|سيراتو|car|11|28|1600",
      "Sportage|سبورتاج|car|18|40|2000",
    ],
  ],
  [
    "nissan",
    "Nissan",
    "نيسان",
    [
      "Sunny|صني|car|9|20|1500",
      "Patrol|باترول|car|30|60|4800",
      "Pickup|بيك أب|car|14|30|2400",
    ],
  ],
  [
    "mitsubishi",
    "Mitsubishi",
    "ميتسوبيشي",
    [
      "Lancer|لانسر|car|9|22|1600",
      "L200|إل 200|car|20|42|2500",
      "Pajero|باجيرو|car|22|50|3500",
      "Canter|كانتر|truck|30|70|4",
    ],
  ],
  [
    "suzuki",
    "Suzuki",
    "سوزوكي",
    [
      "Swift|سويفت|car|9|20|1300",
      "Alto|ألتو|car|9|14|800",
      "Carry|كاري|truck|25|40|1",
    ],
  ],
  [
    "honda",
    "Honda",
    "هوندا",
    [
      "Civic|سيفيك|car|11|32|1800",
      "Accord|أكورد|car|14|38|2400",
      "CG125|سي جي 125|motorcycle|1.5|3|125",
    ],
  ],
  [
    "chevrolet",
    "Chevrolet",
    "شيفروليه",
    [
      "Optra|أوبترا|car|9|16|1600",
      "Cruze|كروز|car|11|24|1800",
      "Spark|سبارك|car|9|14|1000",
    ],
  ],
  [
    "mercedes",
    "Mercedes-Benz",
    "مرسيدس بنز",
    [
      "Actros|أكتروس|truck|80|120|20",
      "C200|سي 200|car|20|50|2000",
      "E250|إي 250|car|28|60|2000",
      "Sprinter|سبرنتر|car|25|55|2200",
    ],
  ],
  [
    "peugeot",
    "Peugeot",
    "بيجو",
    [
      "206|206|car|9|14|1400",
      "301|301|car|10|20|1600",
      "508|508|car|16|34|1600",
    ],
  ],
  [
    "isuzu",
    "Isuzu",
    "إيسوزو",
    [
      "NPR|إن بي آر|truck|35|75|4",
      "FVR|إف في آر|truck|70|115|10",
      "D-Max|دي ماكس|car|20|45|2500",
    ],
  ],
  [
    "ford",
    "Ford",
    "فورد",
    [
      "Ranger|رينجر|car|25|55|2200",
      "Explorer|إكسبلورر|car|22|48|3500",
      "Focus|فوكس|car|9|22|1800",
    ],
  ],
  [
    "mazda",
    "Mazda",
    "مازدا",
    [
      "Mazda 3|مازدا 3|car|11|28|1600",
      "Mazda 6|مازدا 6|car|14|32|2000",
      "CX-5|سي إكس 5|car|20|42|2000",
    ],
  ],
  [
    "lexus",
    "Lexus",
    "لكزس",
    [
      "LX570|إل إكس 570|car|55|95|5700",
      "RX350|آر إكس 350|car|30|60|3500",
      "ES350|إي إس 350|car|25|50|3500",
    ],
  ],
  [
    "tvs",
    "TVS",
    "تي في إس",
    [
      "King|كينج|tuk_tuk|4|8|200",
      "King Kargo|كينج كارجو|rickshaw|5|9|200",
      "HLX 125|إتش إل إكس 125|motorcycle|1.5|2.6|125",
    ],
  ],
  [
    "yamaha",
    "Yamaha",
    "ياماها",
    [
      "YBR125|واي بي آر 125|motorcycle|2|4|125",
      "FZ|إف زد|motorcycle|3|6|150",
      "Crux|كروكس|motorcycle|1.5|2.5|110",
    ],
  ],
  [
    "bmw",
    "BMW",
    "بي إم دبليو",
    [
      "320i|320i|car|14|32|2000",
      "520i|520i|car|18|38|2000",
      "X5|إكس 5|car|28|60|3000",
    ],
  ],
  [
    "land-rover",
    "Land Rover",
    "لاند روفر",
    [
      "Range Rover|رينج روفر|car|45|95|5000",
      "Defender|ديفندر|car|40|85|2000",
      "Discovery|ديسكفري|car|30|65|3000",
    ],
  ],
  [
    "jeep",
    "Jeep",
    "جيب",
    [
      "Wrangler|رانجلر|car|28|55|3600",
      "Grand Cherokee|جراند شيروكي|car|25|55|3600",
      "Compass|كومباس|car|16|34|2400",
    ],
  ],
  [
    "volkswagen",
    "Volkswagen",
    "فولكس فاجن",
    [
      "Golf|جولف|car|10|26|1400",
      "Passat|باسات|car|13|30|1800",
      "Tiguan|تيجوان|car|18|40|2000",
    ],
  ],
  [
    "audi",
    "Audi",
    "أودي",
    [
      "A4|إيه 4|car|18|40|2000",
      "A6|إيه 6|car|25|55|2000",
      "Q7|كيو 7|car|40|85|3000",
    ],
  ],
  [
    "subaru",
    "Subaru",
    "سوبارو",
    [
      "Forester|فورستر|car|15|35|2500",
      "Outback|أوتباك|car|18|40|2500",
      "Impreza|إمبريزا|car|10|22|2000",
    ],
  ],
  [
    "dodge",
    "Dodge",
    "دودج",
    ["Charger|تشارجر|car|25|55|3600", "Durango|دورانجو|car|28|55|3600"],
  ],
  [
    "fiat",
    "Fiat",
    "فيات",
    ["500|500|car|9|18|1200", "Tipo|تيبو|car|10|20|1600"],
  ],
  [
    "volvo",
    "Volvo",
    "فولفو",
    [
      "XC90|إكس سي 90|car|35|75|2000",
      "XC60|إكس سي 60|car|28|55|2000",
      "S60|إس 60|car|20|40|2000",
    ],
  ],
  [
    "porsche",
    "Porsche",
    "بورش",
    [
      "Cayenne|كايين|car|50|110|3000",
      "Macan|ماكان|car|40|75|2000",
      "911|911|car|90|200|3000",
    ],
  ],
  [
    "tesla",
    "Tesla",
    "تسلا",
    [
      "Model 3|موديل 3|car|35|60|0",
      "Model Y|موديل واي|car|40|70|0",
      "Model S|موديل إس|car|55|95|0",
    ],
  ],
  [
    "acura",
    "Acura",
    "أكيورا",
    ["MDX|إم دي إكس|car|30|55|3500", "RDX|آر دي إكس|car|25|45|2000"],
  ],
  [
    "alfa-romeo",
    "Alfa Romeo",
    "ألفا روميو",
    ["Giulia|جوليا|car|35|65|2000", "Stelvio|ستيلفيو|car|40|75|2000"],
  ],
  [
    "aston-martin",
    "Aston Martin",
    "أستون مارتن",
    ["DB11|دي بي 11|car|180|300|4000", "Vantage|فانتج|car|150|260|4000"],
  ],
  [
    "bentley",
    "Bentley",
    "بنتلي",
    [
      "Continental GT|كونتيننتال جي تي|car|220|380|6000",
      "Bentayga|بنتايجا|car|250|420|4000",
    ],
  ],
  [
    "bugatti",
    "Bugatti",
    "بوجاتي",
    ["Chiron|شيرون|car|1500|2400|8000", "Veyron|فيرون|car|1200|2000|8000"],
  ],
  [
    "buick",
    "Buick",
    "بيوك",
    ["Enclave|إنكلاف|car|25|45|3600", "Encore|إنكور|car|15|28|1400"],
  ],
  [
    "byd",
    "BYD",
    "بي واي دي",
    ["Song Plus|سونغ بلس|car|25|45|1500", "Han|هان|car|35|60|2000"],
  ],
  [
    "cadillac",
    "Cadillac",
    "كاديلاك",
    ["Escalade|إسكاليد|car|60|110|6200", "CT5|سي تي 5|car|30|55|2000"],
  ],
  [
    "chrysler",
    "Chrysler",
    "كرايسلر",
    ["300C|300 سي|car|18|38|3600", "Pacifica|باسيفيكا|car|25|45|3600"],
  ],
  [
    "ferrari",
    "Ferrari",
    "فيراري",
    ["488|488|car|350|600|3900", "Roma|روما|car|400|650|3900"],
  ],
  [
    "genesis",
    "Genesis",
    "جينيسيس",
    ["G80|جي 80|car|35|65|2500", "GV80|جي في 80|car|45|80|2500"],
  ],
  [
    "gmc",
    "GMC",
    "جي إم سي",
    ["Sierra|سييرا|car|35|70|5300", "Yukon|يوكون|car|50|90|5300"],
  ],
  [
    "hummer",
    "Hummer",
    "هامر",
    ["H2|إتش 2|car|40|80|6000", "H3|إتش 3|car|28|50|3700"],
  ],
  [
    "infiniti",
    "Infiniti",
    "إنفينيتي",
    ["QX60|كيو إكس 60|car|30|55|3500", "Q50|كيو 50|car|20|40|2000"],
  ],
  [
    "jaguar",
    "Jaguar",
    "جاكوار",
    ["F-Pace|إف بيس|car|35|70|2000", "XF|إكس إف|car|25|50|2000"],
  ],
  [
    "koenigsegg",
    "Koenigsegg",
    "كوينيجسيج",
    ["Jesko|جيسكو|car|1800|2800|5000", "Agera|أجيرا|car|1400|2200|5000"],
  ],
  [
    "lamborghini",
    "Lamborghini",
    "لامبورغيني",
    ["Urus|أوروس|car|320|520|4000", "Huracan|هوراكان|car|260|420|5200"],
  ],
  [
    "lincoln",
    "Lincoln",
    "لنكولن",
    ["Navigator|نافيجيتور|car|55|100|3500", "Aviator|أفياتور|car|40|75|3000"],
  ],
  [
    "lotus",
    "Lotus",
    "لوتس",
    ["Emira|إيميرا|car|120|200|3500", "Evora|إيفورا|car|100|170|3500"],
  ],
  [
    "lucid",
    "Lucid",
    "لوسيد",
    ["Air|إير|car|60|120|0", "Gravity|جرافيتي|car|70|130|0"],
  ],
  [
    "maserati",
    "Maserati",
    "مازيراتي",
    ["Ghibli|جيبلي|car|60|110|3000", "Levante|ليفانتي|car|70|130|3000"],
  ],
  [
    "mclaren",
    "McLaren",
    "مكلارين",
    ["720S|720 إس|car|300|480|4000", "GT|جي تي|car|250|400|4000"],
  ],
  [
    "mini",
    "Mini",
    "ميني",
    ["Cooper|كوبر|car|12|28|1500", "Countryman|كانتري مان|car|18|36|1500"],
  ],
  [
    "pagani",
    "Pagani",
    "باجاني",
    ["Huayra|هوايرا|car|1500|2600|6000", "Zonda|زوندا|car|1300|2200|7300"],
  ],
  [
    "polestar",
    "Polestar",
    "بولستار",
    ["Polestar 2|بولستار 2|car|45|75|0", "Polestar 3|بولستار 3|car|65|110|0"],
  ],
  [
    "ram",
    "RAM",
    "رام",
    ["1500|1500|car|35|75|5700", "TRX|تي آر إكس|car|60|110|6200"],
  ],
  [
    "rivian",
    "Rivian",
    "ريفيان",
    ["R1T|آر 1 تي|car|55|95|0", "R1S|آر 1 إس|car|60|105|0"],
  ],
  [
    "rolls-royce",
    "Rolls-Royce",
    "رولز رويس",
    [
      "Phantom|فانتوم|car|450|800|6700",
      "Ghost|جوست|car|380|650|6700",
      "Cullinan|كولينان|car|420|720|6700",
    ],
  ],
]

export type CatalogModel = {
  id: string
  makeId: string
  type: VehicleType
  min: number
  max: number
  size: number
  ar: string
  en: string
}
const vehicleTypes: [VehicleType, string, string][] = [
  ["car", "Cars", "سيارات"],
  ["truck", "Trucks", "شاحنات"],
  ["motorcycle", "Motorcycles", "دراجات نارية"],
  ["tuk_tuk", "Tuk-tuks", "توك توك"],
  ["rickshaw", "Rickshaws", "ركشات"],
]
// Parts: category, then "Arabic|English|min|max" items (SDG).
export const partCatalog: {
  id: string
  en: string
  ar: string
  items: [string, string, number, number][]
}[] = [
  {
    id: "engine",
    en: "Engine",
    ar: "محرك",
    items: [
      ["طقم بساتم", "Piston set", 250000, 900000],
      ["مضخة مياه", "Water pump", 40000, 150000],
    ],
  },
  {
    id: "brakes",
    en: "Brakes",
    ar: "فرامل",
    items: [
      ["أقمشة فرامل", "Brake pads", 20000, 90000],
      ["اسطوانات فرامل", "Brake discs", 60000, 250000],
    ],
  },
  {
    id: "tires",
    en: "Tires and wheels",
    ar: "إطارات وجنوط",
    items: [
      ["إطار جديد", "New tire", 80000, 350000],
      ["جنط ألمنيوم", "Alloy wheel", 120000, 500000],
    ],
  },
  {
    id: "batteries",
    en: "Batteries",
    ar: "بطاريات",
    items: [
      ["بطارية 70 أمبير", "70Ah battery", 90000, 220000],
      ["بطارية 100 أمبير", "100Ah battery", 140000, 300000],
    ],
  },
  {
    id: "filters-oils",
    en: "Filters and oils",
    ar: "فلاتر وزيوت",
    items: [
      ["طقم فلاتر", "Filter kit", 15000, 60000],
      ["زيت محرك 5 لتر", "Engine oil 5L", 30000, 90000],
    ],
  },
  {
    id: "suspension",
    en: "Suspension",
    ar: "تعليق",
    items: [
      ["مساعدين أمامية", "Front shock absorbers", 100000, 400000],
      ["ذراع تعليق", "Control arm", 50000, 200000],
    ],
  },
  {
    id: "electrical",
    en: "Electrical",
    ar: "كهرباء",
    items: [
      ["دينمو", "Alternator", 150000, 500000],
      ["سلف", "Starter motor", 120000, 400000],
    ],
  },
  {
    id: "body-lights",
    en: "Body and lights",
    ar: "هيكل وإضاءة",
    items: [
      ["كشاف أمامي", "Headlight", 80000, 350000],
      ["صدام أمامي", "Front bumper", 120000, 450000],
    ],
  },
  {
    id: "accessories",
    en: "Accessories",
    ar: "إكسسوارات",
    items: [
      ["طقم كفرات مقاعد", "Seat covers", 40000, 150000],
      ["شاشة أندرويد", "Android screen", 150000, 450000],
    ],
  },
  {
    id: "transmission",
    en: "Transmission",
    ar: "ناقل حركة",
    items: [
      ["قير أوتوماتيك مستعمل", "Used automatic gearbox", 600000, 1800000],
      ["طقم كلتش", "Clutch kit", 80000, 300000],
    ],
  },
]
const specializations: [string, string, string][] = [
  ["engine", "Engines", "المحركات"],
  ["electrical", "Electrical", "الكهرباء"],
  ["ac", "Air conditioning", "التكييف"],
  ["transmission", "Transmission", "ناقل الحركة"],
  ["brakes-suspension", "Brakes and suspension", "الفرامل والتعليق"],
  ["body-paint", "Body and paint", "السمكرة والدهان"],
  ["diagnostics", "Computer diagnostics", "الفحص بالكمبيوتر"],
  ["motorcycles", "Motorcycles and tuk-tuks", "الدراجات والتوك توك"],
]
export const serviceTemplateRows: [string, string, string][] = [
  ["oil-change", "Oil change", "تغيير زيت"],
  ["brakes", "Brakes", "الفرامل"],
  ["engine-diagnostics", "Engine diagnostics", "فحص المحرك"],
  ["air-conditioning", "Air conditioning", "التكييف"],
  ["electrical", "Electrical", "الكهرباء"],
  ["tires-alignment", "Tires and alignment", "الإطارات والميزان"],
  ["body-paint", "Body and paint", "السمكرة والدهان"],
  ["transmission", "Transmission", "ناقل الحركة"],
  ["suspension", "Suspension", "التعليق"],
]
const bi = (en: string, ar: string) => ({ en, ar })

// Only Sudan is on; the others are there for the admin to turn on when the site grows.
export const countries: Country[] = [
  { id: "sd", name: bi("Sudan", "السودان"), dialCode: "+249", enabled: true },
  { id: "eg", name: bi("Egypt", "مصر"), dialCode: "+20", enabled: false },
  {
    id: "sa",
    name: bi("Saudi Arabia", "السعودية"),
    dialCode: "+966",
    enabled: false,
  },
  {
    id: "ae",
    name: bi("United Arab Emirates", "الإمارات"),
    dialCode: "+971",
    enabled: false,
  },
  {
    id: "ss",
    name: bi("South Sudan", "جنوب السودان"),
    dialCode: "+211",
    enabled: false,
  },
]

export function seedTaxonomy() {
  const catalog: CatalogModel[] = []
  const taxonomy: Taxonomy = {
    cities: cityRows.map(([id, en, ar, lat, lng]) => ({
      id,
      slug: id,
      countryId: "sd",
      name: bi(en, ar),
      center: { lat, lng },
    })),
    districts: cityRows.flatMap(([cityId, , , , , rows]) =>
      rows.map((row) => {
        const [en = "", ar = ""] = row.split("|")
        return { id: `${cityId}-${slugify(en)}`, cityId, name: bi(en, ar) }
      })
    ),
    makes: [],
    models: [],
    vehicleTypes: vehicleTypes.map(([id, en, ar]) => ({
      id,
      name: bi(en, ar),
      enabled: true,
    })),
    partCategories: partCatalog.map((c) => ({
      id: c.id,
      slug: c.id,
      name: bi(c.en, c.ar),
    })),
    specializations: specializations.map(([id, en, ar]) => ({
      id,
      name: bi(en, ar),
    })),
    serviceTemplates: serviceTemplateRows.map(([id, en, ar]) => ({
      id,
      name: bi(en, ar),
    })),
  }
  for (const [makeId, makeEn, makeAr, models] of makeRows) {
    const types = new Set<VehicleType>()
    for (const row of models) {
      const [en = "", ar = "", type = "car", min = "0", max = "0", size = "0"] =
        row.split("|")
      const id = `${makeId}-${slugify(en)}`
      const vehicleType = vehicleTypes.find(([t]) => t === type)?.[0] ?? "car"
      types.add(vehicleType)
      catalog.push({
        id,
        makeId,
        type: vehicleType,
        min: Number(min),
        max: Number(max),
        size: Number(size),
        ar,
        en,
      })
      taxonomy.models.push({ id, makeId, name: bi(en, ar) })
    }
    taxonomy.makes.push({
      id: makeId,
      slug: makeId,
      name: bi(makeEn, makeAr),
      vehicleTypes: [...types],
    })
  }
  return { taxonomy, catalog }
}
