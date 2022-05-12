var fs = require("fs");
const { domDeepCopy } = require("./dom_helpers");
const activity_recorder = require('./activityRecorder');
let num_mutation_calls = 0;
let mutation_dir = 'data/mutation/';

function sleepFor(sleepDuration) {
    var now = new Date().getTime();
    while (new Date().getTime() < now + sleepDuration) { /* do nothing */ }
}
function domMutationListener(result) {
    num_mutation_calls += 1
    console.log('dom mutation called ');
    result['timestamp'] = new Date().getTime();
    const act = new activity_recorder.ActivityRecorder();
    act.addItem(result);
}

async function removeDomListener(page) {
    await page.evaluate(() => {
        window.observer.disconnect();
        delete window.observer;
    });
    //page._pageBindings.delete('domMutationListener');
}


async function addDomListener(page, b_node_info) {
    let fun_name = 'domMutationListener';
    if (!page._pageBindings.has('domMutationListener')) {
        await page.exposeFunction(fun_name, domMutationListener);
    }
    res = await page.evaluate((b_node_info) => {
        let options = {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: true
        };


        let target = document.documentElement || document.body;

        let observer = new MutationObserver((mutationsList) => {
            //we skip repeated node info in same mutation step.
            let existing_path = [];
            for (const mutation of mutationsList) {
                let curr_path = getElmentFullPath(mutation.target, path = '');
                if (existing_path.includes(curr_path)) {
                    console.log('info skipped for ', curr_path, mutation.type);
                    continue;
                }
                let info = {
                    'path': curr_path,
                    'sub_type': mutation.type,
                    'type': 'mutation'
                }
                existing_path.push(curr_path);
                let res = null;
                if (b_node_info) {
                    let elm = document.evaluate(curr_path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (elm == null) return null;
                    res = objectRecurse(elm, curr_path, 0);
                    res['path'] = info['path'];
                    res['type'] = info['type'];
                    res['sub_type'] = info['sub_type'];
                }
                else res = info;
                window.domMutationListener(res);
            }
        });
        observer.observe(
            target,
            options,
        );
        window.observer = observer;

    },b_node_info);

}

module.exports = {
    addDomListener: addDomListener,
    removeDomListener: removeDomListener
}