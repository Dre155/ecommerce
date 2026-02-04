const pool = require('../db/connection.js')

pool.connect()

// get each user by id.
async function getUseriD(id) {
    try {
        const useriD = await pool.query(`SELECT id, username, email, created_at, isAdmin FROM users WHERE id = $1`, [id]);
        return useriD.rows[0]
    } catch(err) {
        console.error(err.message)
        throw err;
    } 
};


// create/register new user. 
async function createUser(userInfo) {
    try {
        const {username, email, password_hash} = userInfo;

        const result = await pool.query(`INSERT INTO users(username, email, password_hash, isAdmin)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, created_at, isAdmin`, [username, email, password_hash, false])
        return result.rows[0]
    } catch(err) {
        console.error(err.message)
        throw err;
    }
};

// update user account detials.
async function updateUser(id, userInfo) {
    try {
        const {username, email} = userInfo;

        const result = await pool.query(`UPDATE users
        SET username = ($1, username), email = ($2, email) 
        WHERE id = $3 
        RETURNING id, username, email, created_at, isAdmin`, [username, email, id, false]);
        return result.rows[0]
    } catch(err) {
        console.error(err.message)
        throw err;
    }
};

// delete user.
async function deleteUser(id) {
    try {
        const result = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING id, username, email`, [id])
        return result.rows[0]
    } catch(err) {
        console.error(err.message)
        throw err;
    }
};

// retrieve user by email.
async function getUserByEmail(email) {
    try {
        const userEmail = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        return userEmail.rows[0]
    } catch (err) {
        console.error(err.message)
        throw err;
    }
};

module.exports = {getUseriD, createUser, updateUser, deleteUser, getUserByEmail}