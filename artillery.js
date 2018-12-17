#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
const shell = require('shelljs');
module.exports = () => {
    console.log('artillery shell start');
    const url = process.env.URL
    shell.cd(__dirname);
    if(shell.exec(`artillery quick --duration 5 --rate 10 -n 20 -o artillerytest.json ${url}`).code !== 0){
        shell.echo('artillery test shell script error');
        shell.exit(1);
        return false;
    }else{
        shell.echo('reporting start...')
        if(shell.exec('artillery report artillerytest.json -o artillerytest.html').code !== 0){
            shell.echo('artillery report shell script error');
            shell.exit(1);
            return false;
        }else{
            shell.echo('artillery report shell script success');
            return true;
        }
    }
}
