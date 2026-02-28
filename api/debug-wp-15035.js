const mysql = require('mysql2/promise');

async function run() {
    try {
        const wp = await mysql.createConnection('mysql://wordpress:wordpress@127.0.0.1:3376/wp-app');
        const [meta] = await wp.query("SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id=15035");
        console.log('META:' + JSON.stringify(meta));
        await wp.end();
    } catch (e) {
        console.error(e);
    }
}

run();
