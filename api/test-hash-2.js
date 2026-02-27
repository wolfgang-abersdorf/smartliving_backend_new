const bcrypt = require('bcrypt');
const hash = '$wp$2y$10$SPLVbBjWkhtXyUqres6gi9eyf/0qKkJ2LoQWh2caWRyrazCSWQ3shO';

// If WordPress wraps the bcrypt hash in $wp...
const fixedHash1 = hash.replace(/^\$wp/, '');
console.log('Fixed 1:', fixedHash1);
bcrypt.compare('adminsl12', fixedHash1).then(match => console.log('Match 1 (adminsl12):', match));

// wait, the password might not be adminsl12! Let's check another user with a known hash/password if possible.
