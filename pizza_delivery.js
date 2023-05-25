const express = require('express');
require("dotenv").config();
const cookieParser = require("cookie-parser");
const routes = require('./apiRouter.js');

const app = express();
app.use(express.urlencoded());
app.use(express.json());
app.use(cookieParser());
app.use('/',routes);


app.listen(process.env.PORT, function () {
    console.log('App listening on port 3000!');
});
