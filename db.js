//creating database connection
var mysql = require('mysql');
var con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.MYSQL_DB
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

let db = {};
db.getMenu = () => {
    return new Promise((resolve, reject) => {
        con.query('SELECT * FROM MENU_ITEM', function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        })
    })
}


db.registerUser = (params) => {
    return new Promise((resolve, reject) => {
        con.query("INSERT INTO USERS (USERNAME,PASSWORD, EMAIL) VALUES(?,?,?);", params, function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    })
}

db.getAuthToken = (params) => {
    return new Promise((resolve, reject) => {
        con.query('SELECT * FROM USERS WHERE USERNAME = ?', params, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    })
}



db.getOrders = (params) => {
    return new Promise((resolve, reject) => {
        con.query('SELECT* FROM ORDERS WHERE CUSTOMER_ID = ?', params, function (err, orders) {
            if (err) {
                reject(err);
            } else {
                resolve(orders);
            }
        });
    })
}

db.getUserDetails = (params) => {
    return new Promise((resolve, reject) => {
        con.query('SELECT * FROM USERS WHERE id = ?', params, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    })
}

db.createOrder = (params,orderItems) => {
    return new Promise((resolve, reject) => {
        con.beginTransaction((err) => {
            if (err) {
                console.error(err);
                reject(err);
            }
            con.query("INSERT INTO ORDERS(CUSTOMER_ID,STATUS,DATE_OF_ORDER) VALUES(?,'Created',NOW());", params, function (err, result) {
                if (err) {
                    console.error(err);
                    con.rollback(() => {
                    })
                    reject(err);                 
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
                        reject(err);
                    };
                    con.commit((err) => {

                    })
                    resolve(result.insertId);
                });

            });
        });
    });
};


module.exports = db;