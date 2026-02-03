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

// import util module.
const {getProductiD, createProduct, updateProduct, deleteProduct} = require("./utils/product.js");
const { getUseriD, updateUser, deleteUser } = require("./utils/user.js");
const { cartItems, addToCart, updateCartItem, removeFromCart, clearCart } = require('./utils/cart.js')


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

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

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
    pool.query('SELECT * FROM users where username = ?', [ username ], function(err, results) {
        if (err) {return cb(err); }
        if (!results) {return cb(null, false, { message: 'Incorrect username or password.'}); }

        const user = results[0];
        
        crypto.pbkdf2(password, user.salt, 31000, 32, 'sha256', function(err, password_hash) {
            if (err) { return cb(err); }
            if (!crypto.timingSafeEqual(user.password_hash, password_hash)) {
                return cb(null, false, {message: 'Incorrect username or password.'});
            }
            return cb(null, user)
        });
    });
}));

function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    }
    res.status(403).json({ msg: 'Admin access required.' });
}

// login route.
app.post('/login', 
    passport.authenticate('local',
    {failureRedirect: '/login'}),
    (req, res) => {
        res.redirect("profile");
    }
);

// profile route.
app.get("/profile", (req, res) => {
    res.render("insertDashboardNameHere", {user: req.user

    });
});

// logout route.
app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/login");
  });

// Authenticate user.
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ msg: 'Unauthorized. Please log in.' });
};

const userRouter = express.Router();
app.use('/users', userRouter);

userRouter.get('/me', isAuthenticated, async (req, res) => {
    try {
        const user = await getUseriD(req.user.id);
        if (!user) {
            return res.status(404).json({msg: 'Cannot find user,'});
        }
        res.json(user);
    } catch(err) {
        console.error(err.message);
        res.status(500).json({msg: 'Error.'})
    }
});

userRouter.put('/me', isAuthenticated, async (req, res) => {
    try {
        const { username, email } = req.body;
        const updatedUser = await updateUser(req.params.id, {username, email});
        res.json({
            msg: 'Updated user',
            user: updatedUser
        });
    } catch(err) {
        console.error(err.message)
        res.status(500).json({ msg: 'Server error'});
    }
});


userRouter.delete('/me', isAuthenticated, async (req, res) => {
    try {
        const deletedUser = await deleteUser(req.user.id);
        res.json({
            msg: 'User deleted.',
            user: deletedUser
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({msg: 'Error has occured.'})
    }
});

// Products router.
const productsRouter = express.Router();
app.use('/products', productsRouter);


// Get a product
productsRouter.get('/:id', async (req, res) => {
    try {
        const product = await getProductiD(req.params.id);
        if (!product) {
            return res.status(404).json()
        }
        res.json(product)
    } catch(err) {
        console.error(err.message);
        res.status(500).json()
    }
});

// create a product.
productsRouter.post('/add-product', isAdmin, async (req, res) => {
    try {
        const addedProduct = await createProduct(req.body);
        res.status(201).json(addedProduct);
    } catch(err) {
        console.error(err.message)
        res.status(500).json();
    }
});

// Update product.

productsRouter.put('/:id', async (req, res) => {
    try {
        const updatedProduct = await updateProduct(req.params.id, req.body);
        res.send(updatedProduct)
    } catch(err) {
        console.error(err.message);
    }
});

productsRouter.delete('/:id', async (req, res) => {
    try {
        const deletedProduct = await deleteProduct(req.params.id);
        res.send(deletedProduct)
    } catch(err) {
        console.error(err.message)
    }
});

const orderRouter = express.Router()
app.use('/orders', orderRouter);

orderRouter.get('/my-orders', isAuthenticated, async (req,res) => {
    try {
        const orders = await getOrders(req.user.id);
        res.json({
            msg: 'Order history',
            amount: orders.length,
            orders: orders
        })
    } catch (err) {
        console.error(err.message);
        res.status(500).json()
    }
});

const cartRouter = express.Router()
app.use('/cart', cartRouter);

cartRouter.post('/', isAuthenticated, async (req, res) => {
    try {
        const { product_id, quantity } = req.body;

        if (!(item.product_id && item.quantity && item.quantity >= 1)) {
            return res.status(400).json({
                msg: 'Invalid product or quantity'
            });
        }

        const cartItem = await addToCart(req.user.id, product_id, quantity);
        res.status(201).json({
            msg: 'Item added to cart successfully',
            cartItem: cartItem
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json()
    }
});

cartRouter.get('/', isAuthenticated, async (req, res) => {
    try {
        const cartData = await getCartItems(req.user.id);
        
        res.json({
            msg: 'Cart',
            items: cartData.items,
            summary: {
                total_price: cartData.total_price,
                total_items: cartData.total_items,
                total_quantity: cartData.total_quantity
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json();
    }
});

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
        res.status(500).json();
    }
});

cartRouter.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const deletedItem = await removeFromCart(req.user.id, req.params.id);
        
        if (!deletedItem) {
            return res.status(404).json({ msg: 'Cart item not found' });
        }
        
        res.json({
            msg: 'Item removed successfully',
            cartItem: deletedItem
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json();
    }
});

cartRouter.delete('/', isAuthenticated, async (req, res) => {
    try {
        const clearedItems = await clearCart(req.user.id);
        res.json({
            msg: 'Cart cleared successfully',
            itemsRemoved: clearedItems.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json();
    }
});

