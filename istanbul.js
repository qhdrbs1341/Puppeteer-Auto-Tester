#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
const shell = require('shelljs');
module.exports = () => {
    console.log("istanbul shell start");
    const url = process.env.URL
    shell.cd(__dirname);
    if(shell.exec('nyc report --reporter=html').code !== 0){
        shell.echo('istanbul report shell script error');
        shell.exit(1);
        return false;
    }else{
        shell.echo('istanbul reporting success')
        return true;
    }
}
