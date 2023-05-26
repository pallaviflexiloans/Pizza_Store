const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mg = require('./mailgun.js');
const bodyParser = require('body-parser'); // Middleware 
const jwt = require('jsonwebtoken');
const con = require('./db.js');

const secretKey = process.env.JWT_SECRET;


router.get('/menu', function (req, res) {
    con.query('SELECT * FROM MENU_ITEM', function (err, rows) {
        if (err) {

        } else {
            res.send(rows);
        }
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
        con.query("INSERT INTO USERS (USERNAME,PASSWORD, EMAIL) VALUES(?,?,?);", params, function (err, result) {
            if (err) {
                console.error(err);
                return res.status(400)
                    .json({ error: "something went wrong" });
            } else {
                return res.status(200)
                    .json({ mesaage: `user created ${result.insertId}` });;
            }
        });
    });
});
//step3
router.post('/auth', function (req, res) {
    console.log(req.body.username);
    console.log(req.body.password);
    if (!req.body.username || !req.body.password) {
        return res.status(403)
            .json({ error: 'invalid input' });
    }

    const params = [req.body.username];

    con.query('SELECT * FROM USERS WHERE USERNAME = ?', params, function (err, rows) {
        if (err) {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        } else {
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
        }
    })
});


const authHandler = (req, res, next) => {
    console.log('called authorization method');
    // if(!req.cookies || !req.cookies.access_token){
    //     return res.sendStatus(403);
    // }
    const token = req.headers.access_token;
    console.log(token);

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


router.get('/users/:id', authHandler, function (req, res) {
    console.log(req.params.id);
    const params = [req.params.id];
    con.query('SELECT * FROM USERS WHERE id = ?', params, function (err, rows) {
        if (err) {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        } else {
            if (rows.length == 0) {
                return res.status(400)
                    .json({ error: "no such record exist" });
            }
            console.log(rows);
            return res.status(200)
                .json(rows[0]);
        }

    });
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
    con.beginTransaction((err) => {
        if (err) {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        }
        con.query("INSERT INTO ORDERS(CUSTOMER_ID,STATUS,DATE_OF_ORDER) VALUES(?,'Created',NOW());", params, function (err, result) {
            if (err) {
                console.error(err);
                con.rollback(() => {

                })
                return res.status(400)
                    .json({ error: "something went wrong" });
            }
            const params = [];
            orderItems.forEach(orderItem => {
                const row = [orderItem.id, result.insertId, orderItem.quantity];
                params.push(row);
            });
            con.query("INSERT INTO ORDER_ITEMS(ITEM_ID,ORDER_ID,QUANTITY) VALUES ?;", [params], function (err, rows) {
                if (err) {
                    console.error(err);
                    con.rollback(() => {

                    })
                    return res.status(400)
                        .json({ error: "something went wrong" });
                }
                mg.messages
                    .create('sandboxaae72b5e2bf74b3181f9f1b4efae17a0.mailgun.org', {
                        from: "pallavisharma12011988@gmail.com",
                        to: ["pallavisharma12011988@gmail.com"],
                        subject: "Order Recieved",
                        text: `Order created ${result.insertId}`,
                    })
                    .then(msg => console.log(msg)) // logs response data
                    .catch(err => console.log(err));
                con.commit((err) => {

                })
                return res.status(200).json({ mesaage: `Order created ${result.insertId}` });
            });
        });

    })

});



router.get('/orders', authHandler, (req, res) => {
    const token = req.headers.access_token;
    const userId = getUserIdFromToken(token);
    const params = [userId];
    con.query('SELECT* FROM ORDERS WHERE CUSTOMER_ID = ?', params, function (err, orders) {
        if (err) {
            console.error(err);
            return res.status(400)
                .json({ error: "something went wrong" });
        } else {
            if (orders.length == 0) {
                return res.status(400)
                    .json({ error: "no such record exist" });
            }
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


            console.log(orders);
            return res.status(200)
                .json(orders);
        }
    });
    
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