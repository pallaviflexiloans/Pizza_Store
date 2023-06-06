const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mg = require('./mailgun.js');
const bodyParser = require('body-parser'); // Middleware 
const jwt = require('jsonwebtoken');
const db = require('./db.js');
const path = require('path');

const secretKey = process.env.JWT_SECRET;

const authHandler = (req, res, next) => {
    console.log('called authorization method');
    // if(!req.cookies || !req.cookies.access_token){
    //     return res.sendStatus(403);
    // }
    let token = req.headers.access_token;
    console.log(token);
    if(!token){
       token = req.cookies.access_token; 
    }
    if (!token)
        return res.sendStatus(403);
    try {
        const data = jwt.verify(token, secretKey);
        console.log(data.claim);
        if (!(data.claim === 'user')) {
            return res.sendStatus(403);
        }
        //
        return next();
    } catch {
        return res.sendStatus(403);
    }
}



router.get('/menu', function (req, res) {
    db.getMenu().then((rows) => {
        return res.status(200)
            .json(rows);
    })
        .catch((err) => {
            console.log(err);
            return res.status(403)
                .json({ error: 'Something went wrong' });
        })
});

//step2
router.post('/register', function (req, res) {
    console.log(req.body.username);
    console.log(req.body.password);
    console.log(req.body.email);
    if (!req.body.username || !req.body.password || !req.body.email) {
        return res.status(403)
            .json({ error: 'invalid input' });
    }
    bcrypt.hash(req.body.password, 10, function (err, hash) {
        console.log(hash);
        const params = [req.body.username, hash, req.body.email];
        db.registerUser(params)
            .then((result) => {
                return res.status(200)
                    .json({ mesaage: `user created ${result.insertId}` });
            })
            .catch((err) => {
                console.error(err);
                return res.status(400)
                    .json({ error: "something went wrong" });
            })
    });
});


router.get('/login', function (req, res) {
    res.sendFile(path.join(__dirname+'/static/login.html'));
})

router.get('/register',function (req, res) {
    res.sendFile(path.join(__dirname+'/static/register.html'));
})

router.get('/home', authHandler,function (req, res) {
    res.sendFile(path.join(__dirname+'/static/home.html'));
})

router.get('/logout',function (req, res) {
    res.setHeader('set-cookie', 'access_token =; max-age=0');
    res.sendFile(path.join(__dirname+'/static/logout.html'));
})

//step3
router.post('/auth', function (req, res) {
    console.log(req.body.username);
    console.log(req.body.password);
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
            console.log(rows[0].ID);
            let token = jwt.sign({ user: req.body.username, claim: "user", id: rows[0].ID }, secretKey, {
                expiresIn: 86400 // expires in 24 hours
            });
            
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




router.get('/users/:id', authHandler, function (req, res) {
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
    console.log(req.body.password);

});


router.post('/orders', authHandler, function (req, res) {
    const userName = getUserNameFromToken(req.headers.access_token);
    const userId = getUserIdFromToken(req.headers.access_token);
    const orderItems = req.body;
    const params = [userId];
    db.createOrder(params,orderItems)
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



router.get('/orders', authHandler, (req, res) => {
    let token = req.headers.access_token;
    if(!token){
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