const bcrypt = require('bcrypt');
const wpHash = require('wordpress-hash-node');

async function test() {
  const hash = '$wp$2y$10$SPLVbBjWkhtXyUqres6gi9eyf/0qKkJ2LoQWh2caWRyrazCSWQ3shO';
  
  // Is it a standard wpHash?
  console.log('wpHash:', wpHash.CheckPassword('adminsl12', hash));
  
  // Strip $wp$ and test bcrypt
  const plainBcrypt = hash.replace(/^\$wp\$/, '$');
  console.log('bcrypt fixed:', await bcrypt.compare('adminsl12', plainBcrypt));
}
test();
