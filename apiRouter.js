const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mg = require('./mailgun.js');
const bodyParser = require('body-parser'); // Middleware 
const jwt = require('jsonwebtoken');
const db = require('./db.js');
const path = require('path');
const { error, Console } = require('console');
const { access } = require('fs');

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


const secretKey = process.env.JWT_SECRET;

const userAuthHandler = (req, res, next) => {
    console.log('user auth handler invoked');
    let token = req.headers.access_token;
    if (!token) {
        token = req.cookies.access_token;
    }
    if (!token) {
        console.error("token not found");
        return res.status(403)
            .json({ error: 'token not found' });
    }

    try {
        const data = jwt.verify(token, secretKey);
        if (!(data.claim === 'user')) {
            console.error('invalid claim provided')
            return res.status(403)
                .json({ error: 'invalid claim provided' });
        }
        return next();
    } catch (e) {
        console.error('something went wrong', e);
        return res.status(403)
            .json({ error: 'Something went wrong' });
    }
}


const adminAuthHandler = (req, res, next) => {
    console.log('admin auth handler invoked');
    let token = req.headers.access_token;
    if (!token) {
        token = req.cookies.access_token;
    }
    if (!token)
        console.error("token not found");
    return res.sendStatus(403);
    try {
        const data = jwt.verify(token, secretKey);
        if (!(data.claim === 'admin')) {
            console.error('invalid claim provided')
            return res.sendStatus(403);
        }
        return next();
    } catch (e) {
        console.error('something went wrong', e);
        return res.sendStatus(403);
    }
}



router.get('/menu', function (req, res) {
    console.log('menu API invoked');
    db.getMenu().then((rows) => {
        return res.status(200)
            .json(rows);
    })
        .catch((err) => {
            console.log('something went wrong in menu API', err);
            return res.status(403)
                .json({ error: 'Something went wrong' });
        })
});


router.post('/register', function (req, res) {
    console.log('register api invoked with ', req.body.username);
    if (!req.body.username || !req.body.password || !req.body.email) {
        console.error('invalid input');
        return res.status(403)
            .json({ error: 'invalid input' });
    }

    const params = [req.body.username];
    db.getUserDetailsByName(params)
        .then((users) => {
            console.log(JSON.stringify(users));
            if (users.length != 0) {
                console.error('invalid input');
                return res.status(403)
                    .json({ error: 'invalid input' });
            }
            bcrypt.hash(req.body.password, 10, function (err, hash) {
                const params = [req.body.username, hash, req.body.email];
                db.registerUser(params)
                    .then((result) => {
                        return res.status(200)
                            .json({ mesaage: `user created ${result.insertId}` });
                    })
                    .catch((err) => {
                        console.error("something went wrong", err);
                        return res.status(400)
                            .json({ error: "something went wrong" });
                    })
            });

        })
        .catch((err) => {
            console.error("something went wrong", err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })


});

router.get('/create-order', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/create-order.html'));
})

router.get('/order-history', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/order-history.html'));
})

router.get('/login', function (req, res) {

    console.log('login handler invoked');
    let token = req.headers.access_token;
    if (!token) {
        token = req.cookies.access_token;
    }
    if (!token) {
        res.sendFile(path.join(__dirname + '/static/login.html'));
        return;
    }
    console.log('pass1')
    try{
        jwt.verify(token, secretKey)
    }
    catch(err){
        console.log("token error", err);
        res.sendFile(path.join(__dirname + '/static/login.html'));
        retrun;
    }
    res.redirect('/create-order');
    return;
});

router.get('/register', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/register.html'));
})

router.get('/home', userAuthHandler, function (req, res) {
    res.sendFile(path.join(__dirname + '/static/create-order.html'));
})

router.get('/admin-home', adminAuthHandler, function (req, res) {
    res.sendFile(path.join(__dirname + '/static/admin-order-history.html'));
})

router.get('/logout', function (req, res) {
    res.setHeader('set-cookie', 'access_token =; max-age=0');
    //res.sendFile(path.join(__dirname + '/static/login'));
    res.redirect('/login');
    return;
})

//step3
router.post('/auth', function (req, res) {
    console.log("auth api invoked with username : " + req.body.username);
    if (!req.body.username || !req.body.password) {
        return res.status(403)
            .json({ error: 'invalid input' });
    }

    const params = [req.body.username];

    db.getAuthToken(params)
        .then((rows) => {
            if (rows.length == 0) {
                return res.status(400)
                    .json({ error: "Invalid credentials" });
            };
            if (!bcrypt.compareSync(req.body.password, rows[0].PASSWORD)) {
                return res.status(400)
                    .json({ error: "Invalid credentials" });
            }
            console.log('role : ', rows[0].ROLE)
            let token = jwt.sign({ user: req.body.username, claim: rows[0].ROLE, id: rows[0].ID }, secretKey, {
                expiresIn: 86400 // expires in 24 hours
            });
            console.log(token);
            return res
                .cookie("access_token", token, {
                    httpOnly: true,
                    secure: false,
                })
                .status(200)
                .json({ access_token: token });
        })
        .catch((err) => {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })
});




router.get('/users/:id', userAuthHandler, function (req, res) {
    console.log(req.params.id);
    const params = [req.params.id];
    db.getUserDetails(params)
        .then((rows) => {
            if (rows.length == 0) {
                return res.status(400)
                    .json({ error: "no such record exist" });
            }
            console.log(rows);
            return res.status(200)
                .json(rows[0]);
        })
        .catch((err) => {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })
});



router.put('/users/:id', function (req, res) {
    console.log(req.body.username);

});


router.post('/orders', userAuthHandler, function (req, res) {
    let token = req.headers.access_token;
    if (!token) {
        token = req.cookies.access_token;
    }
    if (!token) {
        console.error("token not found");
        return res.status(403)
            .json({ error: 'token not found' });
    }
    const userName = getUserNameFromToken(token);
    const userId = getUserIdFromToken(token);
    const orderItems = req.body;
    const params = [userId];
    db.createOrder(params, orderItems)
        .then((orderId) => {
            mg.messages
                .create(process.env.MAILGUN_SANDBOX, {
                    from: process.env.PIZZA_STORE_MAILID,
                    to: ["pallavisharma12011988@gmail.com"],
                    subject: "Order Recieved",
                    text: `Order created ${orderId}`,
                })
                .then(msg => console.log(msg)) // logs response data
                .catch(err => console.log(err));

            return res.status(200).json({ mesaage: `Order created ${orderId}` });
        })
        .catch((err) => {
            console.log(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })
});



router.get('/admin-orders', adminAuthHandler, (req, res) => {
    let token = req.headers.access_token;
    if (!token) {
        token = req.cookies.access_token;
    }

    db.getAllOrders()
        .then((orders) => {
            if (orders.length == 0) {
                return res.status(400)
                    .json({ error: "no such record exist" });
            }
            return res.status(200).json(orders);
        })
        .catch((err) => {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })

});
router.get('/orders', userAuthHandler, (req, res) => {
    let token = req.headers.access_token;
    if (!token) {
        token = req.cookies.access_token;
    }
    const userId = getUserIdFromToken(token);
    const params = [userId];
    db.getOrders(params)
        .then((orders) => {
            if (orders.length == 0) {
                return res.status(400)
                    .json({ error: "no such record exist" });
            }
            return res.status(200).json(orders);
        })
        .catch((err) => {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })

    // orders.forEach((o) => {
    //     const id = o.ID;
    //     const params = [id];
    //     con.query('SELECT* FROM ORDER_ITEMS WHERE ORDER_ID = ?', params, function (err, orderItems) {
    //         if (err) {
    //             console.error(err);
    //             return res.status(400)
    //                 .json({ error: "something went wrong" });
    //         } else {
    //             if (orders.length == 0) {
    //                 return res.status(400)
    //                     .json({ error: "no such record exist" });
    //             }

    //         }

    //     })
    //     return res.status(200).json({orders});
    // });
});

router.post('/payment', userAuthHandler, async (req, res, next) => {
    console.log(req.body.orderId);
    const params = [req.body.orderId];
    let orders = await db.getOrderById(params)
    if (orders.length == 0) {
        return res.status(400)
            .json({ error: "no such record exist" });
    }
    const line_items = [];
    Object.keys(orders).forEach((orderId) => {
        let orderDetails = orders[orderId];
        let items = orderDetails.items;
        items.forEach((item) => {
            console.log(JSON.stringify(item));
            const line_item = {
                price_data: {
                    currency: "inr",
                    product_data: {
                        name: item.name,
                    },
                    unit_amount: item.price * 100,
                },
                quantity: item.quantity,
            }
            line_items.push(line_item);
        });
    })
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: line_items,
            success_url: 'http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/failure'
        })
        console.log(session.id);
        console.log('order id ', req.body.orderId);
        let params = [session.id, "Payment in progress", req.body.orderId];
        db.updateStatusById(params)
            .then(() => {
                res.send({ url: session.url });
            })
            .catch((err) => {
                console.error('update status field error', err);
                return res.status(400)
                    .json({ error: "something went wrong" });
            })

    }
    catch (err) {
        console.log(err);
        return res.status(400)
            .json({ error: "something went wrong" });
    }
})

router.get('/success', function (req, res) {

    const sessionId = req.query.session_id;
    let params = ["Payment recieved", sessionId];
    console.log('success handler invoked ', sessionId);
    db.updateStatusBySessionId(params)
        .then(() => {
            // res.sendFile(path.join(__dirname + '/static/success.html'));
            res.redirect('/order-history');
            return;
        })
        .catch((err) => {
            console.error('update status by sessionId field error', err);
            return res.status(400)
                .json({ error: "something went wrong" });
        })

})

router.get('/failure', function (req, res) {
    res.sendFile(path.join(__dirname + '/static/failure.html'));
})

function getUserNameFromToken(token) {
    const data = jwt.verify(token, secretKey);
    return data.user;
}

function getUserIdFromToken(token) {
    const data = jwt.verify(token, secretKey);
    console.log(data);
    return data.id;

}


module.exports = router;