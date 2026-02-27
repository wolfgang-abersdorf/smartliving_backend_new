import mysql from 'mysql2/promise';

async function test() {
    const conn = await mysql.createConnection('mysql://wordpress:wordpress@127.0.0.1:3376/wp-app');
    const [posts] = await conn.query(`SELECT ID, post_title FROM wp_posts WHERE post_type='buildings' AND post_status='publish' LIMIT 1`);
    const postId = (posts as any)[0].ID;
    console.log('Post:', (posts as any)[0]);

    const [meta] = await conn.query(`SELECT meta_key, meta_value FROM wp_postmeta WHERE post_id=? AND meta_key NOT LIKE '\\_%'`, [postId]);
    console.log('Meta:', meta);

    await conn.end();
}

test().catch(console.error);
