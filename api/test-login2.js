const bcrypt = require('bcrypt');

async function test() {
  const hash = '$wp$2y$10$PLVbBjWkhtXyUqres6gi9eyf/0qKkJ2LoQWh2caWRyrazCSWQ3shO';
  
  // Strip $wp$ and test bcrypt
  const plainBcrypt = hash.replace(/^\$wp/, '');
  console.log('bcrypt fixed:', await bcrypt.compare('adminsl12', plainBcrypt));
}
test();
