const pool = require('../db/connection.js')


// Check items in user cart.

async function cartItems(useriD) {
    try {
        const itemsInCart = await pool.query(
            `SELECT
                cart.id as cart_id,
                cart.product_id,
                cart.cart_status,
                cart.quantity,
                products.price,
                products.name,
                products.description,
                (cart.quantity * products.price) as item_total
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = $1`,
            [useriD]
        );

        const total = await pool.query(
            `SELECT 
                SUM(cart.quantity * products.price) as total_price,
                COUNT(cart.id) as total_items,
                SUM(cart.quantity) as total_quantity
            FROM cart
            JOIN products ON cart.product_id = products.id
            WHERE cart.user_id = $1`,
            [useriD]
        );
        
        return {
            items: itemsInCart.rows,                                    
            total_price: parseFloat(total.rows[0].total_price) || 0,   
            total_items: parseInt(total.rows[0].total_items) || 0,   
            total_quantity: parseInt(total.rows[0].total_quantity) || 0
        };
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}

// add items to user cart.
async function addToCart(useriD, productiD, quantity) {
    try {
        const existingCart = await pool.query(
            `SELECT * FROM cart WHERE user_id = $1 AND product_id = $2`,
            [useriD, productiD]
        );

        if (existingCart.rows.length > 0) {
            const result = await pool.query(
                `UPDATE cart 
                SET quantity = quantity + $1 
                WHERE user_id = $2 AND product_id = $3 
                RETURNING *`,
                [quantity, useriD, productiD]
            );
            return result.rows[0];
        } else {
            const result = await pool.query(
                `INSERT INTO cart (user_id, product_id, quantity, cart_status) 
                VALUES ($1, $2, $3, 'active') 
                RETURNING *`,
                [useriD, productiD, quantity]
            );
            return result.rows[0];
        }
    } catch(err) {
        console.error(err.message);
        throw err;
    }
}


// update cart item quantity.
async function updateCartItem(useriD, cartiD, quantity) {
    try {
        const result = await pool.query(
            `UPDATE cart 
            SET quantity = $1 
            WHERE id = $2 AND user_id = $3 
            RETURNING *`,
            [quantity, cartiD, useriD]
        );
        return result.rows[0];
    } catch (err) {
        console.error(err.message);
        throw err;
    }
}


// remove user item from cart.
async function removeFromCart(useriD, cartiD) {
    try {
        const result = await pool.query(
            `DELETE FROM cart 
            WHERE id = $1 AND user_id = $2 
            RETURNING *`,
            [cartiD, useriD]
        );
        return result.rows[0];
    } catch (err) {
        console.error(err.message);
        throw err;
    }
}

// Clear user cart.
async function clearCart(useriD) {
    try {
        const result = await pool.query(
            `DELETE FROM cart WHERE user_id = $1 RETURNING *`,
            [useriD]
        );
        return result.rows;
    } catch (err) {
        console.error(err.message);
        throw err;
    }
}

module.exports = { cartItems, addToCart, updateCartItem, removeFromCart, clearCart }