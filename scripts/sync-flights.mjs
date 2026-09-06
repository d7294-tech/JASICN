const AIRLINES = ['7C','AK','KN','IT'];

const CLOSING_KEY = process.env.DATA_GO_KR_CLOSING_KEY || '';
const PAX_KEY = process.env.DATA_GO_KR_PASSENGER_KEY || '';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://yblzvrfkohppnrxeorce.supabase.co';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!CLOSING_KEY) {
  throw new Error('DATA_GO_KR_CLOSING_KEY is missing');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
}

const normFlt = v =>
  String(v || '')
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .trim();

const prefix = v =>
  AIRLINES.find(a => normFlt(v).startsWith(a)) || '';

const pick = (o, keys) => {
  for (const k of keys) {
    const v = o?.[k];

    if (
      v !== undefined &&
      v !== null &&
      String(v).trim() !== ''
    ) {
      return String(v).trim();
    }
  }

  return '';
};

const fmtTime = v => {
  const x = String(v || '').replace(/\D/g, '');

  if (!x) return '';

  const t = x.padStart(4, '0').slice(-4);

  return `${t.slice(0,2)}:${t.slice(2)}`;
};

const pickTime = (o, keys) =>
  fmtTime(pick(o, keys));

const extractList = data => {

  if (Array.isArray(data)) return data;

  const cand = [
    data?.response?.body?.items?.item,
    data?.response?.body?.items,
    data?.body?.items?.item,
    data?.body?.items,
    data?.items?.item,
    data?.items,
    data?.response?.items?.item,
    data?.response?.items
  ];

  for (const x of cand) {

    if (Array.isArray(x)) {
      return x;
    }

    if (x && typeof x === 'object') {
      return [x];
    }
  }

  return [];
};

const parseKind = o => {

  const v = pick(
    o,
    [
      'msIo',
      'ioType',
      'arrDep',
      'arrDepSe',
      'msAd',
      'msAcd',
      'flightType',
      'inout',
      'gbn',
      'type'
    ]
  ).toUpperCase();

  if (
    ['I','IN','A','ARR','ARRIVAL','도착'].includes(v) ||
    /ARR|도착/.test(v)
  ) {
    return 'A';
  }

  if (
    ['O','OUT','D','DEP','DEPARTURE','출발'].includes(v) ||
    /DEP|출발/.test(v)
  ) {
    return 'D';
  }

  return '';
};

const closingObj = x => {

  const rawNum = pick(
    x,
    [
      'flightNum',
      'msFlt',
      'flightId',
      'fltNo',
      'flightNo',
      'flight',
      'fltId',
      'airlineFlightNo',
      'flightnumber',
      'fnumber'
    ]
  );

  const line = pick(
    x,
    ['msLine','airline','airlineCode']
  )
    .toUpperCase()
    .replace(/\s+/g,'');

  let flight = normFlt(rawNum);

  if (/^\d+$/.test(flight) && line) {
    flight = normFlt(line + flight);
  }

  const delay = pick(
    x,
    ['msDelay','delay']
  );

  const regul = pick(
    x,
    ['msRegul','regul']
  );

  return {

    kind: parseKind(x),

    flight,

    line,

    opDate: pick(
      x,
      [
        'msDate',
        'date',
        'flightDate',
        'operationDate',
        'opDate'
      ]
    ),

    airportCode: pick(
      x,
      [
        'airportCode',
        'cityCode',
        'airport',
        'org',
        'des',
        'origin',
        'destination',
        'depAirport',
        'arrAirport',
        'msOrg',
        'msDes'
      ]
    ),

    sched: pickTime(
      x,
      [
        'msStime',
        'msSt',
        'scheduleDateTime',
        'scheduleTime',
        'schedTime',
        'std',
        'sta',
        'schTime',
        'planTime',
        'scheduledTime'
      ]
    ),

    est: pickTime(
      x,
      [
        'msEt',
        'estimatedDateTime',
        'estimatedTime',
        'estTime',
        'etd',
        'eta',
        'changeTime',
        'chngTime'
      ]
    ),

    actual: pickTime(
      x,
      [
        'msAt',
        'actualDateTime',
        'actualTime',
        'atd',
        'ata',
        'realTime'
      ]
    ),

    spot: pick(
      x,
      [
        'msAspot',
        'aSpot',
        'aspot',
        'spot',
        'spotNo',
        'spotNumber'
      ]
    ),

    gate: pick(
      x,
      [
        'msSspot',
        'sSpot',
        'sspot',
        'gate',
        'gateNo',
        'gateNumber',
        'gatenumber'
      ]
    ),

    carousel: pick(
      x,
      [
        'carousel',
        'carouselNo',
        'baggageClaim',
        'baggageClaimNo',
        'claim',
        'claimNo',
        'baggageCarousel'
      ]
    ),

    remark: [regul,delay]
      .filter(Boolean)
      .join(' / '),

    raw: x
  };
};

const paxObj = (x, kind) => ({

  kind,

  flight: normFlt(
    pick(
      x,
      [
        'flightId',
        'flight_id',
        'flightNum',
        'flightNo'
      ]
    )
  ),

  airportCode: pick(
    x,
    ['airportCode','cityCode']
  ),

  sched: fmtTime(
    pick(
      x,
      [
        'scheduleDateTime',
        'scheduleTime'
      ]
    )
  ),

  est: fmtTime(
    pick(
      x,
      [
        'estimatedDateTime',
        'estimatedTime'
      ]
    )
  ),

  carousel: pick(
    x,
    ['carousel','carouselNo']
  ),

  gate: pick(
    x,
    [
      'gatenumber',
      'gateNumber',
      'gate'
    ]
  ),

  remark: pick(
    x,
    ['remark','status']
  ),

  raw: x
});


const kstNow = () =>
  new Date(
    Date.now() +
    9 * 60 * 60 * 1000
  );

const todayKst = () => {

  const d = kstNow();

  return (
    `${d.getUTCFullYear()}-` +
    `${String(d.getUTCMonth()+1).padStart(2,'0')}-` +
    `${String(d.getUTCDate()).padStart(2,'0')}`
  );
};

const ymd = d =>
  d.replaceAll('-','');


/* =========================================
   API FETCH
   HTTP 우선 → HTTPS fallback
   각 주소 최대 3회 재시도
========================================= */

async function fetchText(
  url,
  ms = 210000
) {

  const candidates = [
    String(url)
  ];

  if (
    String(url).startsWith('http://')
  ) {

    candidates.push(
      String(url).replace(
        /^http:\/\//,
        'https://'
      )
    );
  }

  let lastErr = null;

  for (
    const candidate of candidates
  ) {

    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {

      const ctl =
        new AbortController();

      const t =
        setTimeout(
          () => ctl.abort(),
          ms
        );

      try {

        console.log(
          `FETCH ${attempt}/3 ${candidate}`
        );

        const r =
          await fetch(
            candidate,
            {
              signal: ctl.signal,

              headers: {
                'Accept':
                  'application/json,text/plain,*/*'
              }
            }
          );

        const text =
          await r.text();

        if (!r.ok) {

          throw new Error(
            `HTTP ${r.status}: ` +
            text.slice(0,300)
          );
        }

        return text;

      } catch (e) {

        lastErr = e;

        console.warn(
          `Fetch failed (${attempt}/3): ` +
          (e?.message || e)
        );

        if (attempt < 3) {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                attempt * 3000
              )
          );
        }

      } finally {

        clearTimeout(t);
      }
    }
  }

  throw (
    lastErr ||
    new Error(
      'All API fetch attempts failed'
    )
  );
}


async function fetchJson(
  url,
  ms = 210000
) {

  const text =
    await fetchText(
      url,
      ms
    );

  try {

    return JSON.parse(text);

  } catch {

    throw new Error(
      'Non-JSON response: ' +
      text.slice(0,300)
    );
  }
}


/* =========================================
   운항마감정보
========================================= */

async function fetchClosing() {

  const base =
    new URL(
      'http://apis.data.go.kr/B551177/FlightClosingInfoSpot/getFlightClosingInfoSpot'
    );

  base.searchParams.set(
    'serviceKey',
    CLOSING_KEY
  );

  base.searchParams.set(
    'pageNo',
    '1'
  );

  base.searchParams.set(
    'numOfRows',
    '1000'
  );

  base.searchParams.set(
    'type',
    'json'
  );

  const data =
    await fetchJson(
      base,
      240000
    );

  const code =
    data?.response?.header?.resultCode ??
    data?.resultCode;

  if (
    code &&
    !['00','0'].includes(
      String(code)
    )
  ) {

    throw new Error(
      `Closing API ${code}: ` +
      (
        data?.response?.header?.resultMsg ||
        data?.resultMsg ||
        ''
      )
    );
  }

  return extractList(data);
}


/* =========================================
   여객편 보강
========================================= */

async function fetchPassenger(kind) {

  if (!PAX_KEY) {
    return [];
  }

  const endpoint =
    kind === 'A'
      ? 'getPassengerArrivalsOdp'
      : 'getPassengerDeparturesOdp';

  const u =
    new URL(
      `http://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp/${endpoint}`
    );

  u.searchParams.set(
    'serviceKey',
    PAX_KEY
  );

  u.searchParams.set(
    'from_time',
    '0000'
  );

  u.searchParams.set(
    'to_time',
    '2400'
  );

  u.searchParams.set(
    'lang',
    'K'
  );

  u.searchParams.set(
    'type',
    'json'
  );

  const data =
    await fetchJson(
      u,
      120000
    );

  const code =
    data?.response?.header?.resultCode ??
    data?.resultCode;

  if (
    code &&
    !['00','0'].includes(
      String(code)
    )
  ) {

    throw new Error(
      `Passenger API ${kind} ${code}`
    );
  }

  return extractList(data)
    .map(
      x =>
        paxObj(
          x,
          kind
        )
    )
    .filter(
      x => x.flight
    );
}


/* =========================================
   SUPABASE REST
========================================= */

async function sb(
  path,
  init = {}
) {

  const r =
    await fetch(
      `${SUPABASE_URL}/rest/v1/${path}`,
      {

        ...init,

        headers: {

          'apikey':
            SUPABASE_SERVICE_ROLE_KEY,

          'Authorization':
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,

          'Content-Type':
            'application/json',

          ...(init.headers || {})
        }
      }
    );

  const text =
    await r.text();

  if (!r.ok) {

    throw new Error(
      `Supabase ${r.status}: ` +
      text.slice(0,500)
    );
  }

  return text
    ? JSON.parse(text)
    : null;
}


/* =========================================
   MAIN
========================================= */

const date =
  todayKst();

const target =
  ymd(date);

console.log(
  'JAS Flight Sync v6.6.7.1'
);

console.log(
  'Collecting',
  date
);


/* 운항마감 API */

const raw =
  await fetchClosing();

let flights =
  raw
    .map(closingObj)
    .filter(
      x =>
        x.flight &&
        x.kind &&
        AIRLINES.includes(
          prefix(x.flight)
        )
    );


/* 날짜 필터 */

const dated =
  flights.filter(
    x => x.opDate
  );

if (dated.length) {

  const yy =
    target.slice(2);

  const md =
    target.slice(4);

  flights =
    flights.filter(
      x => {

        const z =
          String(
            x.opDate || ''
          )
            .replace(
              /\D/g,
              ''
            );

        return (
          z === target ||
          z === yy ||
          z === md ||
          z.endsWith(yy) ||
          z.endsWith(md)
        );
      }
    );
}


/* 여객편 보강 */

let paxA = [];
let paxD = [];

try {

  [paxA,paxD] =
    await Promise.all([
      fetchPassenger('A'),
      fetchPassenger('D')
    ]);

} catch (e) {

  console.warn(
    'Passenger enrichment skipped:',
    e.message
  );
}


const mapA =
  new Map(
    paxA.map(
      x => [
        x.flight,
        x
      ]
    )
  );

const mapD =
  new Map(
    paxD.map(
      x => [
        x.flight,
        x
      ]
    )
  );


flights =
  flights.map(
    x => {

      const p =
        (
          x.kind === 'A'
            ? mapA
            : mapD
        ).get(
          x.flight
        );

      if (!p) {
        return x;
      }

      return {

        ...x,

        airportCode:
          p.airportCode ||
          x.airportCode,

        sched:
          p.sched ||
          x.sched,

        est:
          p.est ||
          x.est,

        carousel:
          p.carousel ||
          x.carousel,

        gate:
          x.gate ||
          p.gate,

        remark:
          p.remark ||
          x.remark
      };
    }
  );


/* =========================================
   기존 REG 보존
========================================= */

let existingRegs =
  new Map();

try {

  const old =
    await sb(
      `jas_flights?operation_date=eq.${date}&select=flight,reg`,
      {
        method:'GET'
      }
    );

  for (
    const x of old || []
  ) {

    if (
      x.flight &&
      x.reg
    ) {

      existingRegs.set(
        normFlt(x.flight),
        String(x.reg)
          .trim()
          .toUpperCase()
      );
    }
  }

} catch (e) {

  console.warn(
    'Existing REG read failed:',
    e.message
  );
}


/* =========================================
   SUPABASE 저장 데이터
========================================= */

const now =
  new Date()
    .toISOString();

const rows =
  flights.map(
    x => ({

      operation_date:
        date,

      direction:
        x.kind,

      flight:
        x.flight,

      reg:
        existingRegs.get(
          x.flight
        ) || null,

      airport_code:
        x.airportCode || null,

      schedule_time:
        x.sched || null,

      estimated_time:
        x.est || null,

      actual_time:
        x.actual || null,

      spot:
        x.spot || null,

      gate:
        x.gate || null,

      carousel:
        x.carousel || null,

      status:
        x.remark || null,

      raw_data:
        x.raw || {},

      updated_at:
        now
    })
  );


/* 데이터 0건이면 기존 CLOUD 보호 */

if (!rows.length) {

  throw new Error(
    'No target airline rows returned; existing CLOUD data preserved.'
  );
}


/* 기존 당일 API 자료 삭제 */

await sb(
  `jas_flights?operation_date=eq.${date}`,
  {
    method:'DELETE',

    headers:{
      'Prefer':
        'return=minimal'
    }
  }
);


/* 새 자료 저장 */

await sb(
  'jas_flights',
  {

    method:'POST',

    headers:{
      'Prefer':
        'return=minimal'
    },

    body:
      JSON.stringify(rows)
  }
);


/* =========================================
   DAILY STATUS
========================================= */

await sb(
  'jas_daily_status?on_conflict=operation_date',
  {

    method:'POST',

    headers:{
      'Prefer':
        'resolution=merge-duplicates,return=minimal'
    },

    body:
      JSON.stringify([
        {

          operation_date:
            date,

          api_updated_at:
            now,

          api_count:
            rows.length,

          updated_at:
            now
        }
      ])
  }
);


console.log(
  `Saved ${rows.length} flights for ${date}`
);
