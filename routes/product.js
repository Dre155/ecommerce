// Import environment variables.
require("dotenv").config();
const os = require('os');
// import express.
const express = require('express');
const app = express()

// import middleware
const { json } = require("body-parser");
const morgan = require('morgan');

// import postgreSQL database.
const pool = require('../db/connection.js')
pool.connect()

// middleware
app.use(json());
app.use(morgan('tiny'));

// import api URL.
const api = process.env.API_URL

// import util module.
const {getProductiD, createProduct, updateProduct, deleteProduct} = require("../utils/product.js");

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


app.get(`${api}/procducts`, async (req, res) => {
    try {
        const productsQuery = await pool.query('SELECT * FROM public.products');
        res.json(productsQuery);
    } catch(err) {
        res.status(500).json(err.message)
    }
});

app.get(`${api}/products/:id`, async (req, res) => {
        const product_iD = req.params.id;
        const product = await getProductiD(product_iD)

        if (product) {
            return res.json(product)
        } else{
            res.status(404).json()
        }
})

app.post(`${api}/products`, async (req, res) => {
    try {
    const createdProduct = await createProduct(req.body);
    res.status(201).json(createdProduct);
    } catch(err) {
        console.error(err.message)
        res.status(500).json()
    }
});

app.put(`${api}/products/:id`, async(req, res) => {
    try {
    const updatedProduct = await updateProduct(req.params.id, req.body);

    if (!updatedProduct) {
        return res.status(404).json()
    }
    res.json(updatedProduct);
} catch(err) {
    res.status(500).json()
}
});

app.delete(`${api}/products/:id`, async (req, res) => {
    try {
        const deletedProduct = await deleteProduct(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json()
        }

        res.json({msg: 'Product deleted', product: deletedProduct});
    } catch(err) {
        res.status(500).json();
    }
});

