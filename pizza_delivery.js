const express = require('express');
var mysql = require('mysql');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const bcrypt = require('bcrypt');
const app = express();
const bodyParser = require('body-parser'); // Middleware 
const jwt = require('jsonwebtoken');
const cookieParser = require("cookie-parser");
app.use(express.urlencoded());
app.use(express.json());
app.use(cookieParser());


const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'api',
    key: '',
});


const secretKey = "secret";


//creating database connection

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root1234",
    database: 'PIZZA_STORE'
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});


//step1 
app.get('/menu', function (req, res) {
    con.query('SELECT * FROM MENU_ITEM', function (err, rows) {
        if (err) {

        } else {
            res.send(rows);
        }
    })

});

//step2
app.post('/register', function (req, res) {
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
app.post('/auth', function (req, res) {
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
            if(!bcrypt.compareSync(req.body.password, rows[0].PASSWORD)){
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


app.get('/users/:id', authHandler, function (req, res) {
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


app.put('/users/:id', function (req, res) {
    console.log(req.body.username);
    console.log(req.body.password);

});


app.post('/orders', authHandler, function (req, res) {
    const userName = getUserNameFromToken(req.headers.access_token);
    const userId = getUserIdFromToken(req.headers.access_token);
    const orderItems = req.body;
    const params = [userId];
    con.query("INSERT INTO ORDERS(CUSTOMER_ID,STATUS,DATE_OF_ORDER) VALUES(?,'Created',NOW());", params, function (err, result) {
        if (err) {
            console.error(err);
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
            return res.status(200).json({ mesaage: `Order created ${result.insertId}` });
        });
    });
});



app.get('/orders', authHandler, (req, res) => {
    const token = req.headers.access_token;
    const userName = getUserNameFromToken(token);
    const myOrder = orders.filter((o) => {
        return userName == o.userName;
    });
    return res.status(200).json({ order: myOrder });
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





app.listen(3000, function () {
    console.log('App listening on port 3000!');
});
