require('dotenv').config();
const chalk = require('chalk');
const path = require('path')
const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const ReportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const fs = require('fs');
const request = require('request');
const AWS = require('aws-sdk');
const pti = require('puppeteer-to-istanbul');
const artillery = require('./artillery');
const istanbul = require('./istanbul');
const {URL} = require('url')
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
});

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

module.exports = async () => {
try{
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = process.env.URL;
    const token = process.env.TEST_TOKEN;
    const opts = {
      chromeFlags: ['--show-paint-rects'],
      output: 'html',
      flags: { extraHeaders: {token: token}},
     };
    // const chrome = await chromeLauncher.launch({chromeFlags: opts.chromeFlags});
    opts.port = (new URL(browser.wsEndpoint())).port;
    const report = await lighthouse(url,opts,null);
    const lightHouseHtml = ReportGenerator.generateReport(report.lhr, 'html');
    // let browser = await puppeteer.launch();
    // let page = await browser.newPage();
    const date = new Date().toString();
    //coverage test
    await Promise.all([
        page.coverage.startJSCoverage(), page.coverage.startCSSCoverage()
    ])
    await page.goto(url);

    const [jsCoverage, cssCoverage] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage()
    ]);
    
    await pti.write(jsCoverage);

    //tracing
    await page.tracing.start({path: 'trace.json'});
    await page.goto(url);
    await page.tracing.stop();

    //service worker cached test
    console.log("Service worker test start")
    await page.goto(url);
    await page.evaluate('navigator.serviceWorker.ready');

    console.log("request test");
    const requests = new Map();
    page.on('request', req => requests.set(req.url(),req));
    await page.setOfflineMode(true);
    await page.reload({waitUntil: 'networkidle0'});
    let successCache = [];
    let failCache = [];
    for (const [url,req] of requests){
        const swResp = req.response().fromServiceWorker();
        console.log(url, swResp ? chalk.green('✔') : chalk.red('✕'));
        if(swResp){
            const success = `${url} : ✔`
            successCache.push(`<div>${success}</div>`);
        }else{
            const fail = `${url} : ✕`
            failCache.push(`<div>${fail}</div>`);
        }
    }
    successCache = successCache.reduce((acc,val) => {
        acc += val;
        return acc;
    },'')

    failCache = failCache.reduce((acc,val) => {
        acc += val;
        return acc;
    },'')

    await page.setContent(`
        <html>
        <h1 style="color: blue">Success Caching</h1>
        ${successCache}
        <h1 style="color: red">Fail Caching</h1>
        ${failCache}
        </html>
    `)

    await page.setViewport({
        width: 1280, height: 1024, deviceScaleFactor: 2
    })
    await page.pdf({
        path: 'worker.pdf'
    })

    const pdf = fs.readFileSync(__dirname+'/worker.pdf');
        const params = {
            Key: `worker/${date}report.pdf`,
            Body: pdf,
            Bucket: 'jobstates',
            ContentType: 'application/pdf'
        }

        s3.upload(params,async (err,res)=> {
            if(err){
                console.log("에러 발생");
                //console.log(err);
            }else{
                //slack notification
                // console.log("업로드 성공");
                request.post({
                    url: 'https://slack.com/api/files.upload',
                    formData: {
                        token: process.env.SLACK_BOT_TOKEN,
                        title: `Today ServiceWorker Report`,
                        filename: `serviceworker.pdf`,
                        filetype: 'pdf',
                        channels: [process.env.SLACK_CHANNEL],
                        file: fs.createReadStream(__dirname+`/worker.pdf`)
                    }
                }, (err,res)=>{
                    if(err){
                        console.log("에러 발생");
                        //console.log(err);
                    }else{
                        //console.log(JSON.parse(res.body));
                        // console.log("슬랙 성공");
                    }
                })
                }
                })

    await page.setOfflineMode(false);

    //artillery test
    var artilleryHtml = null;
    if(artillery()){
    await page.goto('file:///'+path.resolve('./artillerytest.html'));
    timeout(1000);
    artilleryHtml = await page.content();
    }
    var istanbulHtml = null;
    if(istanbul()){
    await page.goto('file://'+path.resolve('./coverage/index.html'));
    timeout(1000);
    istanbulHtml = await page.content();
    }
    
   
    // LightHouse
    if(lightHouseHtml){
        console.log("lighthouse html searched!!")
        await page.setContent(
            lightHouseHtml
        )
        await page.setViewport({
            width: 1280, height: 1024, deviceScaleFactor: 2
        })
        await page.pdf({
            path: 'lighthousereport.pdf'
        })

        const pdf = fs.readFileSync(__dirname+'/lighthousereport.pdf');
        const params = {
            Key: `lighthouse/${date}report.pdf`,
            Body: pdf,
            Bucket: 'jobstates',
            ContentType: 'application/pdf'
        }

        s3.upload(params,async (err,res)=> {
            if(err){
                console.log("에러 발생");
                //console.log(err);
            }else{
                //slack notification
                // console.log("업로드 성공");
                request.post({
                    url: 'https://slack.com/api/files.upload',
                    formData: {
                        token: process.env.SLACK_BOT_TOKEN,
                        title: `Today Lighthouse Report`,
                        filename: `lighthousereport.pdf`,
                        filetype: 'pdf',
                        channels: [process.env.SLACK_CHANNEL],
                        file: fs.createReadStream(__dirname+`/lighthousereport.pdf`)
                    }
                }, (err,res)=>{
                    if(err){
                        console.log("에러 발생");
                        //console.log(err);
                    }else{
                        //console.log(JSON.parse(res.body));
                        // console.log("슬랙 성공");
                    }
                })
                }
                })
        
    }

    // Artillery
    if(artilleryHtml){
        console.log("artillery html searched")
        await page.setContent(
            artilleryHtml
        )
        await page.setViewport({
            width: 1280, height: 1024, deviceScaleFactor: 2
        })
        await page.pdf({
            path: 'artilleryreport.pdf'
        })

        const pdf = fs.readFileSync(__dirname+'/artilleryreport.pdf');

        const params = {
            Key: `artillery/${date}report.pdf`,
            Body: pdf,
            Bucket: 'jobstates',
            ContentType: 'application/pdf'
        }

        s3.upload(params,async (err,res)=> {
            if(err){
                console.log("에러 발생");
                //console.log(err);
            }else{
                //slack notification
                // console.log("업로드 성공");
                request.post({
                    url: 'https://slack.com/api/files.upload',
                    formData: {
                        token: process.env.SLACK_BOT_TOKEN,
                        title: `Today Artillery Report`,
                        filename: `artilleryreport.pdf`,
                        filetype: 'pdf',
                        channels: [process.env.SLACK_CHANNEL],
                        file: fs.createReadStream(__dirname+`/artilleryreport.pdf`)
                    }
                }, (err,res)=>{
                    if(err){
                        console.log("에러 발생");
                        //console.log(err);
                    }else{
                        //console.log(JSON.parse(res.body));
                        // console.log("슬랙 성공");
                    }
                })
                }
                })
    }

    if(istanbulHtml){
        console.log("istanbul html searched")
        await page.setContent(
            istanbulHtml
        )
        await page.setViewport({
            width: 1280, height: 1024, deviceScaleFactor: 2
        })
        await page.pdf({
            path: 'istanbulreport.pdf'
        }) 

        const pdf = fs.readFileSync(__dirname+'/istanbulreport.pdf');

        const params = {
            Key: `istanbul/${date}report.pdf`,
            Body: pdf,
            Bucket: 'jobstates',
            ContentType: 'application/pdf'
        }

        s3.upload(params,async (err,res)=> {
            if(err){
                console.log("에러 발생");
                //console.log(err);
            }else{
                //slack notification
                // console.log("업로드 성공");
                request.post({
                    url: 'https://slack.com/api/files.upload',
                    formData: {
                        token: process.env.SLACK_BOT_TOKEN,
                        title: `Today Istanbul Report`,
                        filename: `istanbulreport.pdf`,
                        filetype: 'pdf',
                        channels: [process.env.SLACK_CHANNEL],
                        file: fs.createReadStream(__dirname+`/istanbulreport.pdf`)
                    }
                }, (err,res)=>{
                    if(err){
                        console.log("에러 발생");
                        //console.log(err);
                    }else{
                        //console.log(JSON.parse(res.body));
                        // console.log("슬랙 성공");
                    }
                })
                }
                })

    }
    console.log("------reporting success------")
    await browser.close();

}catch(err){
    console.log(err);
}
}
