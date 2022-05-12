

//http://127.0.0.1:9222/json/version
//google-chrome --remote-debugging-port=9222
'use strict';


try {
    const puppeteer = require('puppeteer-core');
    var fs = require("fs");
    const dom_reader = require('./dom_reader.js');
    const dom_listener = require('./dom_mutaion_listener');
    const action_listener = require('./action_listener');
    const helpers_path = require.resolve('./dom_helpers');
    const ar = require('./activityRecorder');
    //const { performance } = require('perf_hooks');
    const { NodeGraph } = require("./node_graph");
    const { ActionExplorer } = require("./action_explorer");
    const { StateBuilder } = require("./states_builder");
    let actionExplorer = new ActionExplorer();
    (async function run() {
        try {
            let uid = '630431e0-225a-4481-aadf-72457c139977';
            const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/' + uid;
            let browser = await puppeteer.connect({
                browserWSEndpoint: wsChromeEndpointurl,
            });
            
            const page = await browser.newPage();
            await page.setViewport({ width: 1366, height: 768 });
            await page.setBypassCSP(true);
            let url='http://localhost:5000';
            let nn = new NodeGraph();
            let st = new StateBuilder(nn, page, { 'url': url, 'scripts_path': [helpers_path]});
            await st.run();
            console.log('dom recursion finished');
        } catch (err) {  
            console.log(err.message);
        }
    })();


    console.log('all looks cool');
} catch (err) {
    console.log(err.message);
}

