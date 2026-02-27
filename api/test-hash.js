const bcrypt = require('bcrypt');
const hash = '$wp$2y$10$SPLVbBjWkhtXyUqres6gi9eyf/0qKkJ2LoQWh2caWRyrazCSWQ3shO';
const fixedHash = hash.replace(/^\$wp\$/, '$');
console.log('Fixed:', fixedHash);
bcrypt.compare('adminsl12', fixedHash).then(console.log);
