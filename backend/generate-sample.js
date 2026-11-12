const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const sampleDir = path.join(__dirname, '..', 'sample-data');
if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

// Generate dates for today
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const yyyy = now.getFullYear();
const mm = pad(now.getMonth() + 1);
const dd = pad(now.getDate());

function timeToday(hour, minute = 0) {
  const d = new Date(yyyy, now.getMonth(), now.getDate(), hour, minute, 0);
  return d;
}

// Preceding 9 rows (rows 1 to 9): CMS Header metadata
const rows = [
  ['NORTH CENTRAL RAILWAY - PRAYAGRAJ DIVISION'],
  ['CREW MANAGEMENT SYSTEM (CMS) - LOCO RUNNING STAFF AVAILABILITY MONITOR'],
  [`GENERATED ON: ${dd}/${mm}/${yyyy} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`],
  ['HQ LOCATION: PRYJ (PRAYAGRAJ)'],
  ['FILTER CRITERIA: ALL STATIONS / ALL RUNNING STAFF'],
  [''],
  ['NOTE: STRICT CMS RULES APPLIED - REST, CALLED, BOOKED AND LEAVE STATUSES TRACKED'],
  ['CONFIDENTIAL - FOR INTERNAL RAILWAY OPERATIONS ONLY'],
  [''],
  // Row 10 (index 9 in 0-based array) - The EXACT column headers:
  [
    'SNO.',
    'CREW ID',
    'CREW NAME',
    'CREW DESIGNATION',
    'FORTNIGHT Hrs',
    'AVAIL TIME',
    'AVAIL STTN',
    'STATUS',
    'CALLED TIME',
    'ACK TIME',
    'SIGN ON TIME',
    'LAST SIGNOFF TIME',
    'TRAIN NO',
    'FROM STTN',
    'TO STTN',
    'HQ'
  ]
];

// Sample crew dataset testing all scenarios:
// - HQ at PRYJ, CNB, TDLA
// - Buckets: 0-4 (e.g. 02:30), 4-8 (e.g. 05:45), 8-16 (e.g. 10:15), 16-24 (e.g. 18:30)
// - Status: REST, CALLED, BOOKED (counted)
// - Status: ABSEN (ignored)
// - Status: LEAVE with avail_time >= startOfToday (counted in 4-8 bucket and TOTAL)
// - Status: LEAVE with past avail_time (ignored)
const crewMembers = [
  // PRYJ - HQ crew
  { sno: 1, id: 'PRYJ001', name: 'RAMESH KUMAR', desig: 'LP(G)', fnHrs: '52:30', time: timeToday(2, 30), sttn: 'PRYJ', status: 'REST', hq: 'PRYJ' },
  { sno: 2, id: 'PRYJ002', name: 'AMIT SINGH', desig: 'ALP', fnHrs: '48:15', time: timeToday(5, 15), sttn: 'PRYJ', status: 'CALLED', hq: 'PRYJ' },
  { sno: 3, id: 'PRYJ003', name: 'RAJESH SHARMA', desig: 'LP(P)', fnHrs: '54:00', time: timeToday(9, 45), sttn: 'PRYJ', status: 'BOOKED', hq: 'PRYJ' },
  { sno: 4, id: 'PRYJ004', name: 'DINESH YADAV', desig: 'LP(M)', fnHrs: '45:30', time: timeToday(17, 0), sttn: 'PRYJ', status: 'REST', hq: 'PRYJ' },
  { sno: 5, id: 'PRYJ005', name: 'SUNIL TIWARI', desig: 'LP(G)', fnHrs: '38:00', time: timeToday(11, 30), sttn: 'PRYJ', status: 'LEAVE', hq: 'PRYJ' }, // LEAVE exception -> 4-8 bucket
  { sno: 6, id: 'PRYJ006', name: 'VIKAS MISHRA', desig: 'ALP', fnHrs: '60:10', time: timeToday(3, 0), sttn: 'PRYJ', status: 'ABSEN', hq: 'PRYJ' }, // ABSEN -> ignored

  // PRYJ - OS (Outstation) crew (e.g. HQ is CNB or JHS, but AVAIL STTN is PRYJ)
  { sno: 7, id: 'CNB101', name: 'MANOJ PANDEY', desig: 'LP(G)', fnHrs: '49:20', time: timeToday(1, 15), sttn: 'PRYJ', status: 'REST', hq: 'CNB' },
  { sno: 8, id: 'CNB102', name: 'SURESH VERMA', desig: 'ALP', fnHrs: '42:00', time: timeToday(6, 30), sttn: 'PRYJ', status: 'BOOKED', hq: 'CNB' },
  { sno: 9, id: 'JHS103', name: 'SANDEEP GUPTA', desig: 'LP(P)', fnHrs: '51:45', time: timeToday(14, 0), sttn: 'PRYJ', status: 'CALLED', hq: 'JHS' },
  { sno: 10, id: 'DDU104', name: 'ANIL CHAUHAN', desig: 'LP(G)', fnHrs: '47:10', time: timeToday(20, 15), sttn: 'PRYJ', status: 'REST', hq: 'DDU' },

  // CNB (Kanpur) - HQ crew
  { sno: 11, id: 'CNB201', name: 'RAVI KANT', desig: 'LP(G)', fnHrs: '53:15', time: timeToday(3, 45), sttn: 'CNB', status: 'REST', hq: 'CNB' },
  { sno: 12, id: 'CNB202', name: 'DEEPAK DUBEY', desig: 'ALP', fnHrs: '46:30', time: timeToday(7, 0), sttn: 'CNB', status: 'CALLED', hq: 'CNB' },
  { sno: 13, id: 'CNB203', name: 'ARUN PATEL', desig: 'LP(P)', fnHrs: '55:20', time: timeToday(12, 30), sttn: 'CNB', status: 'BOOKED', hq: 'CNB' },
  { sno: 14, id: 'CNB204', name: 'MOHD ARIF', desig: 'LP(M)', fnHrs: '50:00', time: timeToday(19, 0), sttn: 'CNB', status: 'REST', hq: 'CNB' },
  { sno: 15, id: 'CNB205', name: 'SANJAY MAURYA', desig: 'ALP', fnHrs: '41:15', time: timeToday(15, 0), sttn: 'CNB', status: 'LEAVE', hq: 'CNB' }, // LEAVE exception -> 4-8 bucket

  // CNB - OS crew
  { sno: 16, id: 'PRYJ206', name: 'HARISH RAWAT', desig: 'LP(G)', fnHrs: '44:40', time: timeToday(2, 0), sttn: 'CNB', status: 'CALLED', hq: 'PRYJ' },
  { sno: 17, id: 'TDL207', name: 'PRAMOD SHUKLA', desig: 'ALP', fnHrs: '52:10', time: timeToday(5, 30), sttn: 'CNB', status: 'REST', hq: 'TDLA' },
  { sno: 18, id: 'GZB208', name: 'SATISH CHANDRA', desig: 'LP(P)', fnHrs: '48:50', time: timeToday(10, 0), sttn: 'CNB', status: 'REST', hq: 'GZB' },
  { sno: 19, id: 'DLI209', name: 'OM PRAKASH', desig: 'LP(G)', fnHrs: '56:00', time: timeToday(22, 10), sttn: 'CNB', status: 'BOOKED', hq: 'DLI' },

  // TDLA (Tundla) - HQ & OS
  { sno: 20, id: 'TDL301', name: 'MUKESH TRIPATHI', desig: 'LP(G)', fnHrs: '47:30', time: timeToday(1, 30), sttn: 'TDLA', status: 'REST', hq: 'TDLA' },
  { sno: 21, id: 'TDL302', name: 'ASHOK BHARTI', desig: 'ALP', fnHrs: '43:15', time: timeToday(6, 0), sttn: 'TDLA', status: 'BOOKED', hq: 'TDLA' },
  { sno: 22, id: 'TDL303', name: 'KULDEEP YADAV', desig: 'LP(P)', fnHrs: '58:00', time: timeToday(13, 45), sttn: 'TDLA', status: 'CALLED', hq: 'TDLA' },
  { sno: 23, id: 'TDL304', name: 'MAHESH JOSHI', desig: 'LP(G)', fnHrs: '51:20', time: timeToday(21, 0), sttn: 'TDLA', status: 'REST', hq: 'TDLA' },
  { sno: 24, id: 'CNB305', name: 'VINOD SINGH', desig: 'ALP', fnHrs: '45:00', time: timeToday(7, 30), sttn: 'TDLA', status: 'REST', hq: 'CNB' },
  { sno: 25, id: 'PRYJ306', name: 'KAMAL KISHORE', desig: 'LP(G)', fnHrs: '50:30', time: timeToday(16, 45), sttn: 'TDLA', status: 'BOOKED', hq: 'PRYJ' },

  // SFG (Subedarganj)
  { sno: 26, id: 'SFG401', name: 'RAKESH NIGAM', desig: 'LP(G)', fnHrs: '53:00', time: timeToday(4, 30), sttn: 'SFG', status: 'REST', hq: 'SFG' },
  { sno: 27, id: 'SFG402', name: 'AJAY SAXENA', desig: 'ALP', fnHrs: '49:10', time: timeToday(11, 0), sttn: 'SFG', status: 'BOOKED', hq: 'SFG' },
  { sno: 28, id: 'PRYJ403', name: 'VIJAY PRASAD', desig: 'LP(P)', fnHrs: '46:40', time: timeToday(8, 30), sttn: 'SFG', status: 'CALLED', hq: 'PRYJ' },

  // COI (Chheoki)
  { sno: 29, id: 'COI501', name: 'NAVEEN PANDEY', desig: 'LP(G)', fnHrs: '52:15', time: timeToday(3, 10), sttn: 'COI', status: 'REST', hq: 'COI' },
  { sno: 30, id: 'COI502', name: 'ANAND KUMAR', desig: 'ALP', fnHrs: '41:50', time: timeToday(18, 30), sttn: 'COI', status: 'BOOKED', hq: 'COI' },
  { sno: 31, id: 'MZP503', name: 'PREM PRAKASH', desig: 'LP(G)', fnHrs: '48:00', time: timeToday(6, 15), sttn: 'COI', status: 'REST', hq: 'MZP' }
];

for (const c of crewMembers) {
  rows.push([
    c.sno,
    c.id,
    c.name,
    c.desig,
    c.fnHrs,
    c.time,
    c.sttn,
    c.status,
    c.status === 'CALLED' ? `${yyyy}-${mm}-${dd} 03:00:00` : '',
    c.status === 'CALLED' ? `${yyyy}-${mm}-${dd} 03:05:00` : '',
    c.status === 'BOOKED' ? `${yyyy}-${mm}-${dd} 04:00:00` : '',
    `${yyyy}-${mm}-${dd} 00:30:00`,
    '12417',
    'PRYJ',
    'NDLS',
    c.hq
  ]);
}

// Build Sheet1 worksheet
const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

const outPath = path.join(sampleDir, 'CREW AVAILABILITY.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`✅ Sample Excel generated successfully at: ${outPath}`);

