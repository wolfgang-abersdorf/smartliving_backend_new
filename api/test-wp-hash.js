const wpHash = require('wordpress-hash-node');
const hash = '$wp$2y$10$SPLVbBjWkhtXyUqres6gi9eyf/0qKkJ2LoQWh2caWRyrazCSWQ3shO';
const md5Hash = require('crypto').createHash('md5').update('adminsl12').digest('hex');

const isMatch1 = wpHash.CheckPassword('adminsl12', hash);
console.log('WP Hash Match:', isMatch1);
