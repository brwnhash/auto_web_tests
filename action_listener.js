const activity_recorder = require('./activityRecorder');
function mouseEventListener(result) {
    result['timestamp'] = new Date().getTime();
    const act = new activity_recorder.ActivityRecorder();
    act.addItem(result);
    console.log('mouth event listener path is ',result);
}
async function addMouseListner(page){
    await page.exposeFunction('mouseEventListener', mouseEventListener);
    await page.evaluate(() => {
        function mouseClickCallback(event) {
            let curr_path =  getElmentFullPath(event.target, path = '');
            window.mouseEventListener({ 'type': 'action', 'sub_type': event.type, 'path': curr_path });
        }
        document.body.addEventListener("click", mouseClickCallback);
        //document.body.addEventListener("mouseover", mouse_callback);
        //document.body.addEventListener("mouseout", mouse_callback);


    });
}

function keyEventListener(result) {
    result['timestamp'] = new Date().getTime();
    const act = new activity_recorder.ActivityRecorder();
    act.addItem(result);
    console.log('key event listener path is ', result);
}

async function addKeyListner(page) {
    await page.exposeFunction('keyEventListener', keyEventListener);
    await page.evaluate(() => {
        function keyDownCallback(event) {
            let curr_path = getElmentFullPath(event.target, path = '');
            window.keyEventListener({ 'type': 'action', 'sub_type': event.type, 'path': curr_path, 'data': {'key':event.key} });
        }
        document.body.addEventListener("keydown", keyDownCallback);
        //document.body.addEventListener("mouseover", mouse_callback);
        //document.body.addEventListener("mouseout", mouse_callback);


    });
}
module.exports = {
    addMouseListner: addMouseListner,
    addKeyListner: addKeyListner
}