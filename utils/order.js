const pool = require('../db/connection.js')

async function getOrders(useriD) {
    try {
        const result = await pool.query(
            `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, 
            [useriD]
        );
        return result.rows;
    } catch(err) {
        console.error(err.message)
        throw err;
    }
};

async function getOrderByiD(orderiD, useriD) {
    try {
        const orderResult = await pool.query(
            `SELECT * FROM orders WHERE id = $1 AND user_id = $2`, 
            [orderiD, useriD]
        );
        
        if (orderResult.rows.length === 0) {
            return null;
        }
        
        const order = orderResult.rows[0];
        
        // Get order items
        const itemsResult = await pool.query(
            `SELECT 
                order_items.*,
                products.name,
                products.description
            FROM order_items
            JOIN products ON order_items.product_id = products.id
            WHERE order_items.order_id = $1`,
            [orderiD]
        );
        
        return {
            ...order,
            items: itemsResult.rows
        };
    } catch (err) {
        console.error(err.message);
        throw err;
    }
};

async function createOrder(useriD, cartData, paymentDetails) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const totalPrice = cartData.total_price;

        const orderResult = await client.query(
            `INSERT INTO orders (user_id, total_amount, status, payment_method)
            VALUES ($1, $2, $3, $4)
            RETURNING *`, 
            [useriD, totalPrice, 'completed', paymentDetails.payment_method]
        );

        const order = orderResult.rows[0];

        for (const item of cartData.items) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES ($1, $2, $3, $4)`,
                [order.id, item.product_id, item.quantity, item.price]
            );
        }
        
        await client.query(
            `DELETE FROM cart WHERE user_id = $1`,
            [useriD]
        );

        await client.query('COMMIT');
        return order;
    } catch(err) {
        await client.query('ROLLBACK');
        console.error(err.message)
        throw err;
    } 
}

module.exports = { getOrders, getOrderByiD, createOrder }