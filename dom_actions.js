

const objHash = require('object-hash');
const { CheckActionMuationExists, isMutationSame, getParentPaths } = require('./activityRecorder');
const MOUSE_ACT_TYPE = 'mouse';
ACTION_MAP = {
    [MOUSE_ACT_TYPE]: mouseSimulate
}
const MOUSE_DEFAULT_ACTIONS = ['mouseenter', 'mouseleave', 'click'];
MOUSE_ACTIONS_ORDER_MAP = {
    'mouseenter': { 'order': 0, 'wait_time': 200 }, // time in msec
    'mouseover': { 'order': 0, 'wait_time': 200 },
    'mousedown': { 'order': 1, 'wait_time': 200 },
    'mouseup': { 'order': 2, 'wait_time': 200 },
    'mouseleave': { 'order': 2, 'wait_time': 200 },
    'click': { 'order': 2, 'wait_time': 1000 },
    'mousemove': { 'order': 2, 'wait_time': 200 },
    'contextmenu': { 'order': 2, 'wait_time': 200 },
    'dblclick': { 'order': 2, 'wait_time': 1000 },
};
const MOUSE_ACTIONS = Object.keys(MOUSE_ACTIONS_ORDER_MAP);


async function mouseSimulate(page, action, action_name) {
    let path = action['path'];
    let status = await page.evaluate((path, action_name) => {
        let elm = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (elm == null) return false;
        let evt = new MouseEvent(action_name, {
            bubbles: true,
            cancelable: true,
            view: window
        });
        elm.dispatchEvent(evt);
        return true;

    }, path, action_name);

    return status;
}



// action index tells how many times action taken.
//backward trace keeps action that came first as assumption is ,what calls
//first has usuaully short path.
class Event {
    constructor(state, act_idx) {
        /*Actions are done at given state. They will create,update,destroy
         * state.
         * 
         * */
        this.state = state;
        this.act_idx = act_idx;
        this.trace = null;
        this.trace_list = [];
        this.mutation_list = [];
        this.next_nodes = new Map();
        this.back_activity_name = '';
    }
    async elementExists(page, path) {
        return await page.evaluate((path) => {
            let elm = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (elm == null) return false;
            return true;
        }, path);
    }
    addNextNode(node) {
        //this.next_nodes.set(node);
    }
    addMutations(mutations) {
        /* list of mutations added ...
         * same event can cause different type of mutations/based on conditional execution
         * muation {'time_diff' ,'path':'' } */
        if (isMutationSame(mutations, this.mutation_list)) return;
        let valid_mutations = getParentPaths(mutations);
        this.mutation_list.push(valid_mutations);

    }

    forwardTrace() {
        let next_event = this.trace;
        this.trace = null;
        return next_event;
    }
    backTrace(next_event) {
        this.trace = next_event;
    }

}

class PageReload extends Event {
    constructor(state, reload) {
        super(state);
        this.name = 'page_load';
        this.data_obj = {};
        this.reload = reload;
        this.id = 'page_load';

    }
    async runWithoutTrace(page) {
        console.log('page load event called ');
        this.data_obj['timestamp'] = new Date().getTime();
        await this.reload();
        return true;

    }
    async run(page) {
        console.log('page load event called ');
        this.data_obj['timestamp'] = new Date().getTime();
        await this.reload();
        return true;

    }
}

class Action extends Event {
    constructor(data_obj, state, act_idx) {
        super(state, act_idx);
        this.data_obj = data_obj;
        this.act_type = data_obj['act_type'];
        this.name = this.data_obj['sub_type'];
        this.id = objHash(data_obj, { respectType: false });

    }

    isPrevActionsFinished(prev_executed_events) {
        if (prev_executed_events == null) return true;
        let valid = true;
        for (let event of this.trace_list) {
            if (!prev_executed_events.includes(event.hash)) {
                valid = false;
                break;
            }
        }
        return valid;
    }

    async runWithoutTrace(page) {
        let status = false;
        for (let i = 0; i < this.act_idx; i++) {
            status = await this._doAction(page, this.data_obj);
        }
        return status;
    }

    async run(page, prev_events = null) {
        /*if element doesnt exist,trace from start so that u can perform action
         * tarce list is how to reach to given action.If all goes fine do the action at end
         * */
        let status = false;
        let elm_exist = await this.elementExists(page, this.data_obj['path']);
        if (!elm_exist) {
            if (this.trace_list.length == 0) {
                this.trace_list = this.state.node.node_graph.getEventTrace(this);
            }
            //if (!this.isPrevActionsFinished(prev_events)) return false;

            for (let ev of this.trace_list) {
                status = await CheckActionMuationExists(page, ev, ev.mutation_list);
                if (!status) return false;
            }
        }

        for (let i = 0; i < this.act_idx; i++) {
            status = await this._doAction(page, this.data_obj);
        }
        return status;
    }


    async _doAction(page, action) {
        this.data_obj['timestamp'] = new Date().getTime();
        if (ACTION_MAP ?.[this.act_type] == undefined) {
            console.error('unknown action on page called ', action);
            return true;
        }
        return await ACTION_MAP[this.act_type](page, action, this.name);
    }

}



module.exports = {
    Action: Action,
    PageReload: PageReload,
    Event: Event,
    MOUSE_DEFAULT_ACTIONS: MOUSE_DEFAULT_ACTIONS,
    MOUSE_ACTIONS_ORDER_MAP: MOUSE_ACTIONS_ORDER_MAP,
    MOUSE_ACTIONS: MOUSE_ACTIONS,
    MOUSE_ACT_TYPE: MOUSE_ACT_TYPE
}

//its singleton class.
//Mutation observer uses this class to send results of mutation given action




