var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
const cron = require('node-cron');
const tester = require('./tester');
const fs = require('fs');

require('dotenv').config();

app.set('port', process.env.PORT);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// cron.schedule('30 21 * * *',()=>{
//   tester();
// })

tester();

app.use((req, res, next) => {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
})

app.use((err, req, res) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  res.status(err.status || 500)
  res.render('error')
  console.log(err);
})

app.listen(app.get('port'), () => {
  // console.log(`${app.get('port')} 포트에서 서버 실행`)
})
module.exports = app;
