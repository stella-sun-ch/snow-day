// Trails Hike Day knows about.
//
// Every trail figure (distance, walking time, ascent, descent, grade, season,
// start and end) is copied from the page in `sourceUrl`, or from the page
// named in `sources` for that field. Nothing is filled in from memory. If a
// figure isn't printed on an official page, it stays null and the trail is
// `verified: false`, with the reason in `unverifiedReason`. Unverified trails
// never reach the planner or the page.
//
// Geodata is the one thing not copied from the trail page:
//   - station names, ids and coordinates come from transport.opendata.ch;
//   - an elevation marked `elevationSource: 'dem'` is the terrain height at
//     those coordinates from Open-Meteo's elevation API (Copernicus DEM,
//     ~90 m grid), so it's approximate. 'source' means the trail page.
// `highPoint` is where we ask for the forecast. Its height is the trail's
// highest point where the source gives one; its coordinates are a named stop
// on the route (see `note`), because no source gives the high point's position.
//
// Grades: `sac` is the SAC T-grade when the source prints one, and `marking`
// then follows the SAC scale (T1 yellow hiking trail, T2–T3 white-red-white
// mountain trail, T4+ white-blue-white alpine route). When the source only
// says "easy" or "medium", that word is kept in `sourceRating`, `marking` is
// null, and `filterGrade` is our assumption for the difficulty chips only.

const S = (name, id, lat, lon, elevationM, elevationSource = 'dem') => ({ name, id, lat, lon, elevationM, elevationSource });

export const TRAILS = [
  {
    id: 'lavaux',
    name: 'Lavaux vineyard terraces',
    region: 'Vaud',
    verified: true,
    sourceUrl: 'https://www.montreuxriviera.com/en/V1433/lavaux-vineyard-terraces-lutry-st-saphorin',
    sources: [{ url: 'https://www.myswitzerland.com/en-us/experiences/route/lavaux-vineyard-terraces-the-swiss-wine-route/', fields: ['seasonMonths'], note: 'Same path, signposted both ways (route No. 113): "March - November".' }],
    startStation: S('Lutry', '8501122', 46.503785, 6.690607, 406),
    endStation: S('St-Saphorin', '8501127', 46.472595, 6.797031, 406),
    highPoint: { lat: 46.503785, lon: 6.690607, elevationM: 537, elevationSource: 'source', note: 'Height is the route\'s highest point (537 m); coordinates are Lutry station, as the source doesn\'t locate the high point.' },
    distanceKm: 11.1,
    walkingTimeMin: 195,
    ascentM: 369,
    descentM: 393,
    grade: { sac: null, marking: null, sourceRating: 'Easy', filterGrade: 'hiking' },
    tags: ['vineyard', 'lake', 'views'],
    seasonMonths: { from: 3, to: 11 },
    lift: null,
  },
  {
    id: 'lauterbrunnen',
    name: 'Lauterbrunnen valley of waterfalls',
    region: 'Bernese Oberland',
    verified: true,
    sourceUrl: 'https://www.myswitzerland.com/en-us/experiences/route/valley-of-the-72-waterfalls-lauterbrunnen-stechelberg/',
    sources: [],
    startStation: S('Lauterbrunnen', '8507384', 46.598429, 7.908094, 792),
    endStation: S('Stechelberg, Hotel', '8507797', 46.545537, 7.90239, 905),
    highPoint: { lat: 46.545537, lon: 7.90239, elevationM: 905, elevationSource: 'dem', note: 'The source gives no highest point; this is Stechelberg, the higher end of a one-way route that climbs 161 m and drops 51 m.' },
    distanceKm: 8,
    walkingTimeMin: 120,
    ascentM: 161,
    descentM: 51,
    grade: { sac: null, marking: null, sourceRating: 'Easy', filterGrade: 'hiking' },
    tags: ['waterfall', 'valley'],
    seasonMonths: { from: 4, to: 11 },
    lift: null,
  },
  {
    id: 'verzasca',
    name: 'Valle Verzasca: Brione to Sonogno',
    region: 'Ticino',
    verified: true,
    sourceUrl: 'https://www.ascona-locarno.com/en/hike/details/Brione-Verzasca-Sonogno/43161352',
    sources: [],
    startStation: S('Brione (Verzasca), Paese', '8505635', 46.297192, 8.791255, 763),
    endStation: S('Sonogno', '8505771', 46.349786, 8.788578, 912),
    highPoint: { lat: 46.349786, lon: 8.788578, elevationM: 923, elevationSource: 'source', note: 'Height is the route\'s highest point (923 m); coordinates are Sonogno, the end of a route that climbs 192 m and drops 11 m.' },
    distanceKm: 8.3,
    walkingTimeMin: 145,
    ascentM: 192,
    descentM: 11,
    grade: { sac: 'T1', marking: 'yellow', sourceRating: 'Easy', filterGrade: 'hiking' },
    tags: ['river', 'valley'],
    seasonMonths: { from: 1, to: 12 }, // the source's "best time of year" lists all twelve months
    lift: null,
  },
  {
    id: 'engelberg-four-lakes',
    name: 'Four Lakes walk: Melchsee-Frutt to Trübsee',
    region: 'Central Switzerland',
    verified: true,
    sourceUrl: 'https://www.myswitzerland.com/en-ch/experiences/route/vier-seen-wanderung/',
    sources: [{ url: 'https://www.engelberg.ch/en/summer/hiking/hiking-trails/tour/four-lakes-walk/29623324/', fields: ['highPoint.elevationM'], note: 'Highest point 2,209 m, from Engelberg Tourism\'s page for the full Four Lakes walk, which crosses the same Jochpass.' }],
    startStation: S('Melchsee-Frutt (Bergstation)', '8508357', 46.776068, 8.269109, 1908),
    endStation: S('Trübsee', '8508366', 46.793894, 8.399023, 1779),
    highPoint: { lat: 46.778634, lon: 8.386698, elevationM: 2209, elevationSource: 'source', note: 'Coordinates are the Jochpass lift station.' },
    distanceKm: 15,
    walkingTimeMin: 275,
    ascentM: 620,
    descentM: 760,
    grade: { sac: null, marking: null, sourceRating: 'Medium', filterGrade: 'mountain' },
    tags: ['lake', 'views'],
    seasonMonths: { from: 7, to: 10 },
    lift: {
      name: 'Stöckalp–Melchsee-Frutt gondola and Titlis Xpress (Trübsee–Engelberg)',
      statusUrls: ['https://frutt.ch', 'https://www.titlis.ch/en'],
    },
  },

  // ---- Not verified: never shown. Kept so the gaps are visible. ----
  unverified('uetliberg-planetenweg', 'Uetliberg Planetenweg', 'Zurich', 'https://www.zuerich.com/en/visit/nature/planet-trail-hike-from-uetliberg-to-felsenegg',
    'The page gives distance (7.17 km) and time (2 h) but only a single "difference in elevation: 220 m", no separate ascent or descent, and no season.'),
  unverified('rigi-panorama', 'Rigi panorama trail: Kaltbad to Scheidegg', 'Central Switzerland', 'https://www.myswitzerland.com/en-us/experiences/route/rigi-panoramaweg-accessible/',
    'The official route page did not load, so no figure could be checked.'),
  unverified('ebenalp-seealpsee', 'Ebenalp to Seealpsee and Wasserauen', 'Appenzell', 'https://ebenalp.ch/en/summer/hiking-map/ebenalp-wildkirchli-seealpsee-wasserauen',
    'The page gives distance, time, ascent and descent but no season, and rates it "difficult" without an SAC grade or trail marking.'),
  unverified('zermatt-five-lakes', 'Zermatt Five Lakes Walk', 'Valais', 'https://zermatt.swiss/en/Media/Planning-hikes-tours/5-Lakes-Walk-Nr.-11',
    'The page gives distance, time, ascent, descent, highest point and T2, but no season, which the planner needs to keep out-of-season days off the list.'),
  unverified('eiger-trail', 'Eiger Trail', 'Bernese Oberland', 'https://www.jungfrau.ch/en-gb/kleine-scheidegg/eiger-trail/',
    'The page lists "78 hm" and "779 hm" without saying which is ascent and which descent, and gives no season or trail grade.'),
  unverified('oeschinensee-panorama', 'Oeschinensee panorama trail', 'Bernese Oberland', 'https://www.oeschinensee.ch/en/wandern/',
    'The operator page gives only "approx. 35 min" for the panorama trail; the Switzerland Tourism route page did not load.'),
  unverified('aletsch-panoramaweg', 'Aletsch Panoramaweg, stage 2', 'Valais', 'https://www.myswitzerland.com/en-us/experiences/route/aletsch-panoramaweg-39_02/',
    'No season on the page, and the stage ends at Märjelensee, which has no public transport stop, so the trip home can\'t be looked up.'),
  unverified('pizol-five-lakes', 'Pizol Five Lakes hike', 'Eastern Switzerland', 'https://pizol.com/en/hiking-trails/5-lakes-hiking/',
    'The page prints "Elevation gain: 553m 911m" without labelling ascent and descent, and names no start or end point.'),
  unverified('hardergrat', 'Hardergrat ridge', 'Bernese Oberland', 'https://www.schweizer-wanderwege.ch/de/wandervorschlaege/1634/Ausgesetzte-Gratwanderung-uber-den-Hardergrat',
    'The Swiss Hiking Federation page gives 11.2 km, 4 h 45 min, T3 and May to October, but its ascent and descent figures are unlabelled.'),
];

function unverified(id, name, region, sourceUrl, unverifiedReason) {
  return {
    id, name, region, verified: false, sourceUrl, sources: [], unverifiedReason,
    startStation: null, endStation: null, highPoint: null,
    distanceKm: null, walkingTimeMin: null, ascentM: null, descentM: null,
    grade: null, tags: [], seasonMonths: null, lift: null,
  };
}

/** The trails the app may use. */
export const VERIFIED_TRAILS = TRAILS.filter((t) => t.verified);
export const TRAIL_IDS = VERIFIED_TRAILS.map((t) => t.id);

export function getTrail(id) {
  return VERIFIED_TRAILS.find((t) => t.id === id) ?? null;
}

/** True if `isoDate` falls in the trail's season (months, inclusive; may wrap over New Year). */
export function inTrailSeason(trail, isoDate) {
  if (!trail.seasonMonths) return false;
  const m = Number(isoDate.slice(5, 7));
  const { from, to } = trail.seasonMonths;
  return from <= to ? m >= from && m <= to : m >= from || m <= to;
}

/** Which difficulty chip a trail belongs to. */
export const gradeOf = (trail) => trail.grade.marking
  ? { yellow: 'hiking', 'white-red-white': 'mountain', 'white-blue-white': 'alpine' }[trail.grade.marking]
  : trail.grade.filterGrade;

/** The slice of trail data the browser needs. */
export function publicTrail(t) {
  return {
    id: t.id, name: t.name, region: t.region,
    start: t.startStation, end: t.endStation, highPoint: t.highPoint,
    distanceKm: t.distanceKm, walkingTimeMin: t.walkingTimeMin, ascentM: t.ascentM, descentM: t.descentM,
    grade: t.grade, tags: t.tags, seasonMonths: t.seasonMonths, lift: t.lift,
    sourceUrl: t.sourceUrl, sources: t.sources,
  };
}
