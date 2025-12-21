// Quick test script to verify login endpoint
const http = require('http');

const testLogin = () => {
  const data = JSON.stringify({
    email: 'ismail@housing.gov.om',
    password: 'password123'
  });

  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('Testing login endpoint...');
  console.log('Email: ismail@housing.gov.om');
  console.log('Password: password123');
  console.log('');

  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Status Message: ${res.statusMessage}`);
    console.log('Headers:', res.headers);
    console.log('');

    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Response Body:');
      try {
        const parsed = JSON.parse(responseData);
        console.log(JSON.stringify(parsed, null, 2));
        
        if (parsed.token && parsed.user) {
          console.log('');
          console.log('✅ SUCCESS: Login endpoint is working!');
          console.log(`Token received: ${parsed.token.substring(0, 20)}...`);
          console.log(`User: ${parsed.user.email} (${parsed.user.role})`);
        } else {
          console.log('');
          console.log('❌ ERROR: Response missing token or user data');
        }
      } catch (e) {
        console.log(responseData);
        console.log('');
        console.log('❌ ERROR: Invalid JSON response');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ ERROR:', error.message);
    console.log('');
    console.log('Make sure the backend server is running on port 4000');
  });

  req.write(data);
  req.end();
};

testLogin();

