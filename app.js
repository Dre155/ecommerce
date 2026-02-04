// @ts-nocheck
// Import environment variables.
require("dotenv").config();
const os = require('os');
// import express.
const express = require('express');
const app = express()

// import passport.
var passport = require('passport');
var LocalStrategy = require("passport-local").Strategy;
var crypto = require('crypto')
var session = require('express-session');
const bcrypt = require('bcrypt');

// import middleware
const { json } = require("body-parser");
const morgan = require('morgan');

// import postgreSQL database.
const pool = require('./db/connection.js')
const pgSession = require('connect-pg-simple')(session);

pool.connect()

// middleware
app.use(json());
app.use(morgan('tiny'));

// import api URL.
const api = process.env.API_URL

// import util modules.
const {getProductiD, createProduct, updateProduct, deleteProduct} = require("./utils/product.js");
const {getUseriD, createUser, updateUser, deleteUser} = require("./utils/user.js");
const {cartItems, addToCart, updateCartItem, removeFromCart, clearCart} = require('./utils/cart.js');
const {getOrders, getOrderByiD, createOrder} = require('./utils/order.js');

// local info
const localInfo = {
    'Network Information': os.networkInterfaces(),
    'hostname': os.hostname(),
    'arch': os.arch(),
    'Last reboot': os.uptime()
}

console.log(localInfo);

if (process.argv[2] && process.argv[2] === 'dev') {
    process.env.NODE_ENV === 'development'
} else {
    process.env.NODE_ENV === 'production'
}

if (process.env.NODE_ENV === 'production') {
    console.log('node productRoute.js dev')
} else {
    console.log('node productRoute.js')
}

// declare listening port.
const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// register user route.
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await createUser({ username, email, password_hash });
    
    if (newUser) {
        res.status(201).json({
            msg: "User created successfully.",
            newUser
        });
    } else {
        res.status(500).json({
            msg: 'An error has occured: Unable to create user'
        });
    }
});


app.use(
    session({
        store: new pgSession({
            pool: pool,
            tableName: 'session',
            createTableIfMissing: true,
        }),
        secret: "h724vjs9sP",
        cookie: {maxAge: 1000 * 60*60 * 24, secure: true,
            sameSite: "none"},
        resave: false,
        saveUninitialized: false,
    })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, cb) {
    cb(null, user.id)
});

passport.deserializeUser(function(id, cb) {
    pool.query('SELECT * FROM users WHERE id = $1', [id], function(err, results) {
        if (err) { return cb(err); }
        cb(null, results.rows[0]);
    });
});

// session middleware.
passport.use(new LocalStrategy(function verify(username, password, cb) {
    pool.query('SELECT * FROM users where username = $1', [username], function(err, results) {
        if (err) {return cb(err); }
        if (!results.rows[0]) {return cb(null, false, { message: 'Incorrect username or password.'}); }

        const user = results.rows[0];
        
        crypto.pbkdf2(password, user.salt, 31000, 32, 'sha256', function(err, password_hash) {
            if (err) { return cb(err); }
            if (!crypto.timingSafeEqual(user.password_hash, password_hash)) {
                return cb(null, false, {message: 'Incorrect username or password.'});
            }
            return cb(null, user)
        });
    });
}));

// Middleware functions
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ msg: 'Unauthorized. Please log in.' });
}

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    }
    res.status(403).json({ msg: 'Forbidden. Admin access required.' });
}

// Validate card expiry date
function validateCardExpiry(expiryString) {
    const parts = expiryString.split('/');
    
    if (parts.length !== 2) {
        return { valid: false, message: 'Invalid expiry format. Use MM/YY' };
    }
    
    const month = parseInt(parts[0]);
    const year = parseInt(parts[1]);
    
    if (isNaN(month) || month < 1 || month > 12) {
        return { valid: false, message: 'Invalid month' };
    }
    
    if (isNaN(year)) {
        return { valid: false, message: 'Invalid year' };
    }
    
    const fullYear = year < 100 ? 2000 + year : year;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (fullYear < currentYear) {
        return { valid: false, message: 'Card has expired' };
    }
    
    if (fullYear === currentYear && month < currentMonth) {
        return { valid: false, message: 'Card has expired' };
    }
    
    return { valid: true };
}

// Simulate payment processing
async function simulatePayment(paymentDetails) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const randomFail = Math.random() < 0.1;
    
    if (randomFail) {
        
        const randomReason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
        
        return {
            success: false,
            error: randomReason
        };
    }
    
    return {
        success: true,
        msg: 'Payment successful'
    };
}

// login route.
app.post('/login', 
    passport.authenticate('local', {failureRedirect: '/login'}),
    (req, res) => {
        res.redirect("profile");
    }
);

// profile route.
app.get("/profile", (req, res) => {
    res.render(req.username, {user: req.user});
});

// logout route.
app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/login");
});

// User router
const userRouter = express.Router();
app.use('/users', userRouter);

// get user by id route.
userRouter.get('/me', isAuthenticated, async (req, res) => {
    try {
        const user = await getUseriD(req.user.id);
        if (!user) {
            return res.status(404).json({msg: 'Cannot find user'});
        }
        res.json(user);
    } catch(err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'})
    }
});

// update user details route.
userRouter.put('/me', isAuthenticated, async (req, res) => {
    try {
        const { username, email } = req.body;
        const updatedUser = await updateUser(req.user.id, {username, email});
        res.json({
            msg: 'User updated successfully',
            user: updatedUser
        });
    } catch(err) {
        console.error(err.message)
        res.status(500).json({ msg: 'Server error'});
    }
});

// delete user route.
userRouter.delete('/me', isAuthenticated, async (req, res) => {
    try {
        const deletedUser = await deleteUser(req.user.id);
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ msg: 'Error logging out' });
            }
            res.json({
                msg: 'User deleted successfully',
                user: deletedUser
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'})
    }
});

// Products router.
const productsRouter = express.Router();
app.use('/products', productsRouter);

// Get a product by id.
productsRouter.get('/:id', async (req, res) => {
    try {
        const product = await getProductiD(req.params.id);
        if (!product) {
            return res.status(404).json({msg: 'Product not found'})
        }
        res.json(product)
    } catch(err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'})
    }
});

// create new product route.
productsRouter.post('/add-product', isAdmin, async (req, res) => {
    try {
        const addedProduct = await createProduct(req.body);
        res.status(201).json(addedProduct);
    } catch(err) {
        console.error(err.message)
        res.status(500).json({msg: 'Server error'});
    }
});

// Update product route.
productsRouter.put('/:id', isAdmin, async (req, res) => {
    try {
        const updatedProduct = await updateProduct(req.params.id, req.body);
        res.json({
            msg: 'Product updated successfully',
            product: updatedProduct
        });
    } catch(err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'});
    }
});

// delete product by id route.
productsRouter.delete('/:id', isAdmin, async (req, res) => {
    try {
        const deletedProduct = await deleteProduct(req.params.id);
        res.json({
            msg: 'Product deleted successfully',
            product: deletedProduct
        });
    } catch(err) {
        console.error(err.message)
        res.status(500).json({msg: 'Server error'});
    }
});

// Orders router
const orderRouter = express.Router()
app.use('/orders', orderRouter);

// get user order history route
orderRouter.get('/my-orders', isAuthenticated, async (req, res) => {
    try {
        const orders = await getOrders(req.user.id);
        res.json({
            msg: 'Order history retrieved successfully',
            count: orders.length,
            orders: orders
        })
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'})
    }
});

// get order via id route.
orderRouter.get('/my-orders/:id', isAuthenticated, async (req, res) => {
    try {
        const order = await getOrderByiD(req.params.id, req.user.id);
        if (!order) {
            return res.status(404).json({msg: 'Order not found'});
        }
        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'})
    }
});

// Cart router
const cartRouter = express.Router()
app.use('/cart', cartRouter);

// add cart item route.
cartRouter.post('/', isAuthenticated, async (req, res) => {
    try {
        const { product_id, quantity } = req.body;

        if (!product_id || !quantity || quantity < 1) {
            return res.status(400).json({
                msg: 'Product ID and valid quantity required'
            });
        }

        const cartItem = await addToCart(req.user.id, product_id, quantity);
        res.status(201).json({
            msg: 'Item added to cart successfully',
            cartItem: cartItem
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'})
    }
});

// Get cart data.
cartRouter.get('/', isAuthenticated, async (req, res) => {
    try {
        const cartData = await cartItems(req.user.id);
        
        res.json({
            msg: 'Cart retrieved successfully',
            items: cartData.items,
            summary: {
                total_price: cartData.total_price,
                total_items: cartData.total_items,
                total_quantity: cartData.total_quantity
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'});
    }
});


// update user item quantity.
cartRouter.put('/:id', isAuthenticated, async (req, res) => {
    try {
        const { quantity } = req.body;
        
        if (!quantity || quantity < 1) {
            return res.status(400).json({ msg: 'Valid quantity required' });
        }
        
        const updatedItem = await updateCartItem(req.user.id, req.params.id, quantity);
        
        if (!updatedItem) {
            return res.status(404).json({ msg: 'Cart item not found' });
        }
        
        res.json({
            msg: 'Cart item updated successfully',
            cartItem: updatedItem
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'});
    }
});

// remove item from cart.
cartRouter.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const deletedItem = await removeFromCart(req.user.id, req.params.id);
        
        if (!deletedItem) {
            return res.status(404).json({ msg: 'Cart item not found' });
        }
        
        res.json({
            msg: 'Item removed from cart successfully',
            cartItem: deletedItem
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'});
    }
});

// clear user full cart.
cartRouter.delete('/', isAuthenticated, async (req, res) => {
    try {
        const clearedItems = await clearCart(req.user.id);
        res.json({
            msg: 'Cart cleared successfully',
            itemsRemoved: clearedItems.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Server error'});
    }
});

// Checkout endpoint
cartRouter.post('/checkout', isAuthenticated, async (req, res) => {
    try {
        const { payment_method, card_number, card_expiry, card_cvv } = req.body;

        const cartData = await cartItems(req.user.id);

        if (!cartData.items || cartData.items.length === 0) {
            return res.status(400).json({
                msg: 'Cart is empty'
            });
        }

        if (!payment_method) {
            return res.status(400).json({
                msg: 'Payment method is required'
            });
        }

        // Validate payment details for credit card
        if (payment_method === 'credit_card') {
            if (!card_number || !card_expiry || !card_cvv) {
                return res.status(400).json({
                    msg: 'Credit card details incomplete'
                });
            }

            if (card_number.length < 13 || card_number.length > 19) {
                return res.status(400).json({
                    msg: 'Invalid card number'
                });
            }

            if (card_cvv.length < 3 || card_cvv.length > 4) {
                return res.status(400).json({
                    msg: 'Invalid CVV'
                });
            }

            const expiryValidation = validateCardExpiry(card_expiry);
            if (!expiryValidation.valid) {
                return res.status(400).json({
                    msg: expiryValidation.message
                });
            }
        }

        // Process payment 
        const paymentResult = await simulatePayment({
            payment_method,
            card_number,
            card_expiry,
            card_cvv,
            amount: cartData.total_price
        });

        if (!paymentResult.success) {
            return res.status(402).json({
                msg: 'Payment failed',
                error: paymentResult.error
            });
        }

        // Create order
        const order = await createOrder(
            req.user.id,
            cartData,
            { payment_method }
        );

        res.status(201).json({
            msg: 'Checkout successful! Order created.',
            order: {
                order_id: order.id,
                total_amount: order.total_amount,
                status: order.status,
                created_at: order.created_at
            },
            payment: {
                confirmation_id: paymentResult.confirmation_id,
                payment_method: payment_method
            }
        });

    } catch(err) {
        console.error(err.message);
        res.status(500).json({
            msg: 'Checkout failed',
            error: 'Server error occurred during checkout'
        });
    }
});