// Twelve Swiss resorts Snow Day knows about.
//
// `forecast` is the point we ask Open-Meteo about: a spot on the ski area whose
// real terrain height is close to `elevationM` (checked against Open-Meteo's
// elevation API), so the forecast describes the pistes, not the village.
// `station` is the timetable stop at the foot of the lifts; the id is what we
// query, so the timetable can't guess a different stop with the same name.
// `website` is the lift company's site, where opening status is published;
// `tickets` is its ticket page, so people buy direct.
// `season` is an approximate opening window (MM-DD), used only to flag days
// when a resort is usually shut. Resorts publish their real dates each year.

export const RESORTS = [
  {
    id: 'zermatt', name: 'Zermatt', region: 'Valais',
    villageM: 1608, topM: 3883,
    forecast: { lat: 45.985, lon: 7.748, elevationM: 2600 },
    station: { name: 'Zermatt', id: '8501689' },
    priceTier: 3, glacier: true,
    season: { opens: '01-01', closes: '12-31' },
    goodFor: ['high altitude', 'glacier', 'views', 'long runs'],
    website: 'https://www.matterhornparadise.ch/en',
    tickets: 'https://www.matterhornparadise.ch/en/book/tickets/ski-pass-winter',
    note: 'Car-free village under the Matterhorn; glacier skiing all year.',
  },
  {
    id: 'saas-fee', name: 'Saas-Fee', region: 'Valais',
    villageM: 1800, topM: 3500,
    forecast: { lat: 46.09, lon: 7.925, elevationM: 2500 },
    station: { name: 'Saas-Fee, Busterminal', id: '8501782' },
    priceTier: 2, glacier: true,
    season: { opens: '07-15', closes: '05-01' },
    goodFor: ['glacier', 'snow-sure', 'early season', 'quiet'],
    website: 'https://www.saas-fee.ch/en/',
    tickets: 'https://www.saas-fee.ch/en/ski-passes-1',
    note: 'High, snow-sure glacier resort; car-free village.',
  },
  {
    id: 'verbier', name: 'Verbier', region: 'Valais',
    villageM: 1500, topM: 3330,
    forecast: { lat: 46.085, lon: 7.255, elevationM: 2300 },
    station: { name: 'Verbier (télécabine)', id: '8530095' },
    priceTier: 3, glacier: false,
    season: { opens: '12-05', closes: '04-20' },
    goodFor: ['off-piste', 'advanced', 'après'],
    website: 'https://verbier4vallees.ch/en',
    tickets: 'https://verbier4vallees.ch/en/online-shop/tickets',
    note: 'Big, steep terrain and a lively village.',
  },
  {
    id: 'st-moritz', name: 'St. Moritz', region: 'Graubünden',
    villageM: 1822, topM: 3303,
    forecast: { lat: 46.51, lon: 9.81, elevationM: 2400 },
    station: { name: 'St. Moritz', id: '8509253' },
    priceTier: 3, glacier: false,
    season: { opens: '11-25', closes: '04-10' },
    goodFor: ['sunshine', 'wide pistes', 'views'],
    website: 'https://www.mountains.ch/en',
    tickets: 'https://www.mountains.ch/en/tickets',
    note: 'Famously sunny Engadin valley with wide, groomed slopes.',
  },
  {
    id: 'davos', name: 'Davos Klosters', region: 'Graubünden',
    villageM: 1560, topM: 2844,
    forecast: { lat: 46.825, lon: 9.815, elevationM: 2300 },
    station: { name: 'Davos Dorf', id: '8509072' },
    priceTier: 2, glacier: false,
    season: { opens: '11-25', closes: '04-15' },
    goodFor: ['long runs', 'variety', 'intermediate'],
    website: 'https://www.davosklostersmountains.ch/en',
    tickets: 'https://www.davosklostersmountains.ch/en/mountains/webshop',
    note: 'Six areas on one pass; the Parsenn has classic long runs.',
  },
  {
    id: 'laax', name: 'Flims Laax', region: 'Graubünden',
    villageM: 1100, topM: 3018,
    forecast: { lat: 46.8355, lon: 9.212, elevationM: 2200 },
    station: { name: 'Laax Murschetg (Talstation)', id: '8530785' },
    priceTier: 2, glacier: true,
    season: { opens: '11-20', closes: '04-20' },
    goodFor: ['freestyle', 'intermediate', 'short journey'],
    website: 'https://www.laax.com/en',
    tickets: 'https://shop.laax.com/home',
    note: 'Europe-famous snow parks and a quick trip from Zurich.',
  },
  {
    id: 'engelberg', name: 'Engelberg-Titlis', region: 'Central Switzerland',
    villageM: 1050, topM: 3028,
    forecast: { lat: 46.79, lon: 8.41, elevationM: 2000 },
    station: { name: 'Engelberg', id: '8508399' },
    priceTier: 2, glacier: true,
    season: { opens: '10-15', closes: '05-15' },
    goodFor: ['short journey', 'glacier', 'freeride'],
    website: 'https://www.titlis.ch/en',
    tickets: 'https://shop.titlis.ch/home',
    note: 'Closest big mountain to Zurich; Titlis glacier opens early.',
  },
  {
    id: 'andermatt', name: 'Andermatt-Sedrun', region: 'Central Switzerland',
    villageM: 1444, topM: 2961,
    forecast: { lat: 46.615, lon: 8.5965, elevationM: 2200 },
    station: { name: 'Andermatt', id: '8505165' },
    priceTier: 3, glacier: false,
    season: { opens: '11-20', closes: '04-20' },
    goodFor: ['powder', 'freeride', 'snow-sure'],
    website: 'https://www.andermatt-sedrun-disentis.ch/en/',
    tickets: 'https://www.andermatt-sedrun-disentis.ch/en/stories/buy-skipass',
    note: 'A snow magnet; the Gemsstock is steep and often deep.',
  },
  {
    id: 'grindelwald', name: 'Grindelwald-Wengen', region: 'Bernese Oberland',
    villageM: 1034, topM: 2501,
    forecast: { lat: 46.585, lon: 7.96, elevationM: 2000 },
    station: { name: 'Grindelwald Terminal', id: '8505226' },
    priceTier: 2, glacier: false,
    season: { opens: '12-12', closes: '04-12' },
    goodFor: ['views', 'intermediate', 'beginners'],
    website: 'https://www.jungfrau.ch/en-gb/',
    tickets: 'https://www.jungfrau.ch/en-gb/jungfrau-ski-region/buy-skipass/',
    note: 'Cruising under the Eiger, Mönch and Jungfrau.',
  },
  {
    id: 'crans-montana', name: 'Crans-Montana', region: 'Valais',
    villageM: 1500, topM: 3000,
    forecast: { lat: 46.33, lon: 7.475, elevationM: 2200 },
    station: { name: 'Crans-Montana gare', id: '8501596' },
    priceTier: 2, glacier: false,
    season: { opens: '12-05', closes: '04-12' },
    goodFor: ['sunshine', 'intermediate', 'views'],
    website: 'https://www.mycma.ch/en',
    tickets: 'https://shop.mycma.ch/en/',
    note: 'South-facing plateau with long, sunny days.',
  },
  {
    id: 'arosa-lenzerheide', name: 'Arosa Lenzerheide', region: 'Graubünden',
    villageM: 1775, topM: 2865,
    forecast: { lat: 46.765, lon: 9.64, elevationM: 2200 },
    station: { name: 'Arosa', id: '8509157' },
    priceTier: 2, glacier: false,
    season: { opens: '11-29', closes: '04-12' },
    goodFor: ['intermediate', 'families', 'variety'],
    website: 'https://arosalenzerheide.swiss/en',
    tickets: 'https://shop.arosalenzerheide.swiss/en/ticketoverview',
    note: 'Two valleys joined by a cable car; relaxed and reliable.',
  },
  {
    id: 'adelboden', name: 'Adelboden-Lenk', region: 'Bernese Oberland',
    villageM: 1353, topM: 2362,
    forecast: { lat: 46.4755, lon: 7.5205, elevationM: 1900 },
    station: { name: 'Adelboden, Post', id: '8507851' },
    priceTier: 1, glacier: false,
    season: { opens: '12-12', closes: '04-12' },
    goodFor: ['beginners', 'families', 'value'],
    website: 'https://www.adelboden-lenk.ch/en',
    tickets: 'https://www.adelboden-lenk.ch/en/Service/Passes/Day-and-multi-day-tickets',
    note: 'Friendly, good value, and lots of gentle terrain.',
  },
];

export const RESORT_IDS = RESORTS.map((r) => r.id);

export function getResort(id) {
  return RESORTS.find((r) => r.id === id) ?? null;
}

/** True if `isoDate` (YYYY-MM-DD) falls inside the resort's typical season. */
export function inTypicalSeason(resort, isoDate) {
  const md = isoDate.slice(5); // 'MM-DD' compares correctly as a string
  const { opens, closes } = resort.season;
  return opens <= closes
    ? md >= opens && md <= closes
    : md >= opens || md <= closes; // season wraps over New Year
}

/** The small slice of resort data the browser needs to draw a result. */
export function publicResort(r) {
  const { id, name, region, villageM, topM, forecast, glacier, note, website, tickets, station } = r;
  return {
    id, name, region, villageM, topM, forecastElevationM: forecast.elevationM, glacier, note,
    station: station.name, websiteUrl: website, ticketsUrl: tickets,
  };
}
