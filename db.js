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
        con.query('SELECT * FROM MENU_ITEMS', function (err, rows) {
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
        con.query("INSERT INTO USERS (USERNAME,PASSWORD, EMAIL,ROLE) VALUES(?,?,?,'user');", params, function (err, result) {
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


const GET_ORDER_QUERY = "select o.id order_id, mi.name, mi.price, mi.size, o.date_of_order, o.status from orders o inner join order_items oi on o.id  = oi.order_id inner join menu_items mi on oi.item_id= mi.id where o.customer_id = ? order by o.date_of_order desc"
db.getOrders = (params) => {

    return new Promise((resolve, reject) => {
        con.query(GET_ORDER_QUERY, params, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                var ordersMap = {};
                rows.forEach((row)=>{
                    if(!ordersMap[row.order_id]){
                        ordersMap[row.order_id] = {};
                        ordersMap[row.order_id].date = row.date_of_order;
                        ordersMap[row.order_id].status = row.status;
                        ordersMap[row.order_id].items = [];
                    }
                    ordersMap[row.order_id]["items"].push({"name" :row.name, "size" : row.size, "price" : row.price});
                })
                resolve(ordersMap);
            }
        });
    })
}


const GET_ALL_ORDER_QUERY = "select o.id order_id, mi.name, mi.price, mi.size, o.date_of_order, o.status from orders o inner join order_items oi on o.id  = oi.order_id inner join menu_items mi on oi.item_id= mi.id order by o.date_of_order desc"
db.getAllOrders = () => {

    return new Promise((resolve, reject) => {
        con.query(GET_ALL_ORDER_QUERY, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                var ordersMap = {};
                rows.forEach((row)=>{
                    if(!ordersMap[row.order_id]){
                        ordersMap[row.order_id] = {};
                        ordersMap[row.order_id].date = row.date_of_order;
                        ordersMap[row.order_id].status = row.status;
                        ordersMap[row.order_id].items = [];
                    }
                    ordersMap[row.order_id]["items"].push({"name" :row.name, "size" : row.size, "price" : row.price});
                })
                resolve(ordersMap);
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


db.getUserDetailsByName = (params) => {
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



const GET_ORDER_BY_ID_QUERY = "select o.id order_id, mi.name, mi.price, mi.size,oi.quantity quantity, o.date_of_order from orders o inner join order_items oi on o.id  = oi.order_id inner join menu_items mi on oi.item_id= mi.id where o.id = ?"
db.getOrderById = (params) => {

    return new Promise((resolve, reject) => {
        con.query(GET_ORDER_BY_ID_QUERY, params, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                var ordersMap = {};
                rows.forEach((row)=>{
                    if(!ordersMap[row.order_id]){
                        ordersMap[row.order_id] = {};
                        ordersMap[row.order_id].date = row.date_of_order;
                        ordersMap[row.order_id].items = [];
                    }
                    ordersMap[row.order_id]["items"].push({"name" :row.name, "size" : row.size, "price" : row.price, "quantity" : row.quantity});
                })
                resolve(ordersMap);
            }
        });
    })
}



const UPDATE_ORDER = "UPDATE ORDERS SET PAYMENT_SESSION = ?, STATUS = ? WHERE ID = ?";
db.updateStatusById = (params)=>{
    return new Promise((resolve, reject) => {
        con.query(UPDATE_ORDER, params, function (err, rows) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    })
}


const UPDATE_ORDER_BY_SESSIONID = "UPDATE ORDERS SET STATUS = ? WHERE PAYMENT_SESSION = ?";
db.updateStatusBySessionId = (params)=>{
    return new Promise((resolve, reject) => {
        con.query(UPDATE_ORDER_BY_SESSIONID, params, function (err, rows) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                resolve();
            }
        });
    })
}



module.exports = db;

