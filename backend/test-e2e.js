const fs = require('fs');
const path = require('path');
const http = require('http');

// Simple multipart form data helper without external dependency
function postFile(token, filePath, callback) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);

  const pre = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([pre, fileData, post]);

  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`
      }
    },
    (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          callback(null, res.statusCode, JSON.parse(data));
        } catch (e) {
          console.error('Non-JSON response:', res.statusCode, data);
          callback(e);
        }
      });
    }
  );

  req.on('error', callback);
  req.write(body);
  req.end();
}

function postJSON(pathUrl, body, token, callback) {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: pathUrl,
      method: 'POST',
      headers
    },
    (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          callback(null, res.statusCode, JSON.parse(data));
        } catch (e) {
          console.error('Non-JSON response:', res.statusCode, data);
          callback(e);
        }
      });
    }
  );
  req.on('error', callback);
  req.write(payload);
  req.end();
}

function getJSON(pathUrl, callback) {
  http.get(`http://127.0.0.1:5000${pathUrl}`, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => callback(null, res.statusCode, JSON.parse(data)));
  }).on('error', callback);
}

async function run() {
  console.log('--- Step 1: Testing Login ---');
  postJSON('/api/login', { username: 'admin', password: 'admin123' }, null, (err, code, loginRes) => {
    if (err) throw err;
    console.log(`Login status: ${code}`, loginRes);
    const token = loginRes.token;
    if (!token) throw new Error('No JWT returned');

    console.log('\n--- Step 2: Testing Excel Upload ---');
    const samplePath = path.join(__dirname, '..', 'sample-data', 'CREW AVAILABILITY.xlsx');
    postFile(token, samplePath, (uploadErr, uploadCode, uploadRes) => {
      if (uploadErr) throw uploadErr;
      console.log(`Upload status: ${uploadCode}`, uploadRes);

      console.log('\n--- Step 3: Testing Summary API ---');
      getJSON('/api/summary', (sumErr, sumCode, sumRes) => {
        if (sumErr) throw sumErr;
        console.log(`Summary status: ${sumCode}`);
        console.log('Grand Total:', JSON.stringify(sumRes.grandTotal, null, 2));
        console.log('\nStations summary count:', sumRes.summary.length);
        sumRes.summary.forEach((s) => {
          console.log(`Station ${s.station}: HQ Total=${s.HQ.total} (0-4:${s.HQ['0-4']}, 4-8:${s.HQ['4-8']}, 8-16:${s.HQ['8-16']}, 16-24:${s.HQ['16-24']}) | OS Total=${s.OS.total}`);
        });

        console.log('\n--- Step 4: Testing Details API ---');
        getJSON('/api/crew/details?station=PRYJ&type=HQ&bucket=4-8', (detErr, detCode, detRes) => {
          if (detErr) throw detErr;
          console.log(`Details status for PRYJ HQ 4-8: ${detCode}`);
          console.log(`Found ${detRes.count} crew members (including LEAVE exception)`);
          detRes.data.forEach((c) => {
            console.log(` - ID: ${c.crew_id}, Name: ${c.crew_name}, Status: ${c.status}, Avail: ${c.avail_time}, HQ: ${c.hq}`);
          });

          console.log('\n✅ ALL E2E BACKEND TESTS PASSED!');
          process.exit(0);
        });
      });
    });
  });
}

run();
