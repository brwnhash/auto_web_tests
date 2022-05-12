
const WRITE_DIR = 'C:/data/auto_test/mutation';
const BATCH_SIZE = 5;
const fs_path = require('path');
const fs = require('fs');
const _ = require('lodash');
const { readJsonDataFromDir } = require('./file_helpers');
const { timeout } = require('./common');

class ActivityBatchWriter {
    constructor(dir, batch_size) {
        this.batch_size = batch_size;
        this.items = [];
        this.count = 0;
        this.dir = dir;
        if (fs.existsSync(dir)) {
            fs.rmdirSync(dir, { recursive: true });
        }
        try {
            fs.mkdirSync(dir);
        } catch (err) {
            console.log(err);
        }
    }
    write(item, last_item = false) {
        if (item != null) {
            this.items.push(item);
        }
        if ((this.items.length > this.batch_size) || last_item) {
            this._writeToFile(last_item);
        }
    }
    _writeToFile(sync) {
        /* if last item write using sync..
         * */
        const curr_path = fs_path.join(this.dir, this.count.toString() + '.txt');
        if (sync) {
            fs.writeFileSync(curr_path, JSON.stringify({ 'data': this.items }));
        }
        else {
            let data = _.cloneDeep(this.items);
            fs.writeFile(curr_path, JSON.stringify({ 'data': data }), function (err) {
                if (err) {
                    return console.error(err);
                }
            });
        }
        this.count += 1;
        this.items = [];

    }

}
function getMaxWaitForActionMutationList(mutations_list) {
    let mutations = mutations_list.flat();
    let max_delay_time = 2000,min_delay_time=300;//2 sec
    let max_act_delay = mutations.reduce((a, b) => a['time_diff']> b['time_diff']?a:b)['time_diff'];
    let delay_time = Math.min(2 * max_act_delay, max_delay_time);
    return Math.max(delay_time, min_delay_time);
}

function getParentPaths(mutations) {
    let mut_paths = mutations.map(ll => ll['path']);
    let parent_paths=mutations.filter(mutation => {
        let parent_path = mutation.path.slice(0, mutation.path.lastIndexOf('/'));
        return (mut_paths.includes(parent_path)) ? false : true;
    });
    return parent_paths;
}

function isMutationSame(local_mutations, mutations_list) {
    /*local mutations should match any of mutations fully in list 
     in general we should check for state attrs but just path should work
     */
    let mut_same = false;
    let lm_paths = local_mutations.map(ll => ll['path']);
    for (let mutations of mutations_list) {       
        let mm_paths = mutations.map(mm => mm['path']);
        let diff = lm_paths.filter(ll => !mm_paths.includes(ll));
        mut_same = diff.length > 0 ? false : true;
        if (mut_same) break;
    }
    return mut_same;
}

async function waitForActionMutationList(page, action, mutations_list) {
    let local_mutations = [];

    let act = new ActivityRecorder();
    if (action.name == 'page_load') {
        await action.runWithoutTrace();
        //let item = { 'path': '/html', 'sub_type': 'page_load', 'type': 'mutation' };
        //act.addItem(item);
        return [];
    }
    //pause main activity 
    act.pauseActivity(action.back_activity_name);
    let act_name = 'wait_for_act';
    act.startNewActivity(act_name, (item) => {
        if (item['type'] == 'mutation') {
            local_mutations.push(item);
        }

    });
    
    let act_status = await action.runWithoutTrace(page);
    if (!act_status) {
        act.stopActivity(act_name);
        act.resumeActivity(action.back_activity_name);
        return [false, []]
    };
    let max_act_delay = getMaxWaitForActionMutationList(mutations_list);
    await timeout(max_act_delay);
    act.stopActivity(act_name);
    act.resumeActivity(action.data_obj.back_activity_name);
    return local_mutations;
}

async function CheckActionMuationExists(page, action, mutations_list) {
    let local_mutations = await waitForActionMutationList(page, action, mutations_list);
    if (action['name'] == 'page_load') return true; //change it later
    return isMutationSame(local_mutations, mutations_list);
}

class ActivityRecorder {
    constructor() {
        if (ActivityRecorder._ptr != null) {
            return ActivityRecorder._ptr;
        }
        ActivityRecorder._ptr = this;
        this.pause_list = new Map();
        this.callbacks = {};
    }
    startNewActivity(name, callback) {
        console.log('registering  new activity callback ', name);
        this.callbacks[name] = callback;
        console.log('number of registered activities ', Object.keys(this.callbacks));
    }
    getAllActivities() {
        return Object.keys(this.callbacks);
    }
    addItem(item) {
   
        for (let [name, callback] of Object.entries(this.callbacks)) {
            if (this.pause_list.has(name)) continue;
            callback(item);
        }

    }

    pauseActivity(name) {
        this.pause_list.set(name,'');
    }


    resumeActivity(name) {
        if (this.pause_list.has(name)) {
            this.pause_list.delete(name);
        };
    }

    stopActivity(name) {
        if (this.callbacks.hasOwnProperty(name)) {
            console.log('activity is removed ', name);
            delete this.callbacks[name];
        }
    }

}
ActivityRecorder._ptr = null;


class GetActionMutationGroups {

    constructor(data, action_mutation_dir = null) {
        this.data = data;
        this.action_mutation_dir = action_mutation_dir;
    }

    sortByTimeStamp(data) {
        let activity_data = {}, timestamps = [];
        for (let val of data) {
            activity_data[val['timestamp']] = val;
            timestamps.push(val['timestamp']);
        }
        timestamps = timestamps.sort();
        let sorted_data = [];
        for (let timestamp of timestamps) {
            sorted_data.push(activity_data[timestamp])

        }
        return [sorted_data, timestamps];
    }


    getActionsAndMutations(data, delay_mutation_time) {
        return data.reduce(function ([actions, mutations], val) {
            let type = val['type'];
            if (type == 'action') {
                actions.push(val);
            }
            else if (type == 'mutation') {
                val['timestamp'] = val['timestamp'] + delay_mutation_time;
                mutations.push(val);
            }
            return [actions, mutations]

        }, [[], []]
        );

    }

    actionMutationGrp(actions, mutations) {
        let action_mutation_grp = [];
        let last_mutation_idx = 0;
        for (let [idx, action] of Object.entries(actions)) {
            let curr_ts = action['timestamp'];
            let mut_grp = [];
            for (let [m_idx, mutation] of Object.entries(mutations)) {
                let diff = (mutation['timestamp'] - curr_ts) / 1000;

                if (diff > 0) {
                    //timestamp less than next action timestamp.
                    mut_grp.push(mutation);
                }

            }
            action_mutation_grp.push([action, mut_grp]);
        }

        return action_mutation_grp;
    }

    run() {
        /*
         * sometimes mutation are recorded before actions,we can reduce time of mutations
         */
        if (this.action_mutation_dir) {
            let data_list = readJsonDataFromDir(this.action_mutation_dir);
            datalist.forEach(dd => {
                this.data = this.data.concat(dd['data']);
            });
        }
        let [sorted_data, timestamps] = this.sortByTimeStamp(this.data);
        let [actions, mutations] = this.getActionsAndMutations(sorted_data, 1000);
        //let distance_matrix = actions.map(action => mutations.map(v => v['timestamp'] - action['timestamp']));
        let act_mut_grp = this.actionMutationGrp(actions, mutations);
        return act_mut_grp;
    }
}
/**   Forward - Backward Algo
 *   Backward Pass - start with the last action and mutations after that action.
 *   wait for maximum time,between the action and mutation,use some approx otherwise 
 *   and max delay.Backward pass at first will remove all mutations from end.leaving
 *   only few possible mutation for front candidates.
 *  Forward Pass- is a confirmation loop that muatation connected to backward
 *  pass are correct.
 *  Conditionaly dependent Actions--lot of actions wont work.which are conditionaly
 *  dependent we need to check
 *
 * 
 * */
class ApproxActionMutationLink {
    constructor(page, action_mutation_grps,acts_map,node_graph) {
        /*
         * action_mutation_grp: every action to all possible mutations w.r.t timestamp
         */
        this.page = page;
        this.action_mutation_grps = action_mutation_grps;
        this.act = new ActivityRecorder();
        this.acts_map = acts_map;
        this.node_graph = node_graph;
        this.found_actions_hash = [-1];
    }

    getMaxWaitForAction(action_ts, mutations) {
        let max_delay_time = 2000, min_delay_time=300;//2 sec
        let max_act_delay = (mutations[mutations.length - 1]['timestamp'] - action_ts);
        let delay_time =Math.min(2 * max_act_delay, max_delay_time);
        return Math.max(delay_time, min_delay_time);
    }

    async getActionMutation(action, next_mutations, found_mutations, act_name) {
        let local_mutations = [];
        let mutations = next_mutations.filter((m_i) => {
            for (let m_j of found_mutations) {
                if (m_i['path'] == m_j['path']) return false;
            }
            return true;
        });

        if (!mutations.length) return [true, local_mutations];

        this.act.startNewActivity(act_name, (item) => {
            if (item['type'] == 'mutation') {
                local_mutations.push(item);
            }

        });

        let max_act_delay = this.getMaxWaitForAction(action['timestamp'], mutations);
        let act = this.acts_map.get(action['path']).filter(act => (act['name'] == action['sub_type']))[0];
        let act_status = await act.run(this.page,this.found_actions_hash);
        console.log('waiting before timeout in backward pass');
        if (!act_status) {
            this.act.stopActivity(act_name);
            return [false, []]
        };
        await timeout(max_act_delay);
        this.act.stopActivity(act_name);
        local_mutations.forEach(item => found_mutations.push(item));
        return [act_status, local_mutations]
    }

    async getValidActionIdxAndMutation(actions_idx, found_mutations, num_actions) {
        let am_list = [];
        for (let action_idx of actions_idx) {
            let [action, next_mutations] = this.action_mutation_grps[action_idx];
            if (next_mutations.length == 0) continue;        
            let [act_status, local_mutations] = await this.getActionMutation(action, next_mutations, found_mutations, 'backward_pass_'+action_idx);
            if (act_status) {
                am_list.push([action_idx, local_mutations])
            }
            if (am_list.length >= num_actions) break;
        }
        return am_list;
    }

    async getAllValidActionMutations(act_idx, pending_actions_idx, found_mutations) {
        let act_list = [act_idx];
        let all_am_list = [];
        while (act_list.length > 0) {
            let act_idx = act_list.pop();
            //action idx which come after current action ,look only those.
            let pending_acts = pending_actions_idx.filter(item => item > act_idx);
            let am_list = await this.getValidActionIdxAndMutation(pending_acts, found_mutations, 1000);
            let new_act_idxs = am_list.map(item => item[0]);
            //remove found actions.
            pending_actions_idx = pending_actions_idx.filter(item => !new_act_idxs.includes(item));
            act_list = act_list.concat(new_act_idxs);
            all_am_list = all_am_list.concat(am_list);
        }
        return [all_am_list, pending_actions_idx];
    }

    sortPendingActions() {
        /* reverse sort actions..
        with in node actions are sorted and they should follow same order
        second loop of sc_idx puts indexes in sorted order.
        we sort based on node path here.so we avoid putting same index again
        byt checking found_elms at top
        */
        let pending_action_idxs=[],found_elms = [];
        for (let idx = this.action_mutation_grps.length - 1; idx >= 0; idx--) {
            let act = this.action_mutation_grps[idx][0];
            if (found_elms.includes(act['path'])) continue;
            let actions = this.acts_map.get(act['path']);
            for (let sc_idx = actions.length - 1; sc_idx>= 0; sc_idx--) {
                pending_action_idxs.push((idx - sc_idx));
            }
            found_elms.push(act['path']);
        }
        return pending_action_idxs;
    }
    async backwardPass() {
        /*
        actions added to pending list,at start. Action is performed
        then we look if any of pending actions performed because of this
        action. if any of action in pending list works,iterate through all
        pending action as any of them might have worked.


         */

        let prob_action_mut = [];
        //action hash is -1 for page load action.
        let found_mutations = [];
        let pending_actions_idx = this.sortPendingActions();

        while (true) {
            // if any valid possible action in queue
            let am_list = await this.getValidActionIdxAndMutation(pending_actions_idx, found_mutations, 1);
            if (am_list.length == 0) break;
            let [act_idx, local_mutations] = am_list[0];
            //remove action whose mutation found.
            pending_actions_idx = pending_actions_idx.filter(item => item != act_idx);
            //let act_path = this.action_mutation_grps[act_idx][0].path;
            //let act_hash = this.acts_map.get(act_path).hash;
            //this.found_actions_hash.push(act_hash);
            //check if this action unblocks other actions.
            let [other_am_list, left_actions_idx] = await this.getAllValidActionMutations(act_idx, pending_actions_idx, found_mutations);
            am_list = am_list.concat(other_am_list);
            pending_actions_idx = left_actions_idx;
            let res = am_list.filter(value => [this.action_mutation_grps[value[0]][0], value[1]]);
            prob_action_mut = prob_action_mut.concat(res);
        }
        return prob_action_mut;
    }
    async  run() {
        return await this.backwardPass();

    }



}


module.exports = {
    ActivityRecorder: ActivityRecorder,
    ActivityBatchWriter: ActivityBatchWriter,
    GetActionMutationGroups: GetActionMutationGroups,
    ApproxActionMutationLink: ApproxActionMutationLink,
    CheckActionMuationExists: CheckActionMuationExists,
    isMutationSame: isMutationSame,
    getParentPaths: getParentPaths
}