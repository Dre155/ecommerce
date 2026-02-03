const pool = require('../db/connection.js')
const { cartItems } = require('./cart.js')


async function existingCart(useriD) {
    const existing = await cartItems()

    if (existing) {
        
    }
}


module.exports = { existingCart }