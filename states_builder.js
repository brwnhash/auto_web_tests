
const { recurseDom } = require('./dom_reader');
const { ActionExplorer } = require('./action_explorer');
const { addDomListener, removeDomListener } = require('./dom_mutaion_listener');
const { ActivityRecorder, GetActionMutationGroups, ApproxActionMutationLink } = require('./activityRecorder');
const { timeout, ListMap } = require('./common');
const { PageReload } = require('./dom_actions');

class StateBuilder {
    constructor(node_graph, page, config) {
        this.page = page;
        this.act_name = 'actions_sim';
        this.config = config;
        this.node_graph = node_graph;
        this.b_node_info = false;
        this.action_exp = new ActionExplorer();
        this.found_action_nodes = [];
        this.init_event = new PageReload(null, this.reLoadPage.bind(this));

    }
    async _loadUtils(page) {
        this.page = page;
        console.log('load utils called ');
        let scripts_path = this.config['scripts_path'];
        for (let script_path of scripts_path) {
            await page.addScriptTag({ path: script_path });
        }
        await addDomListener(page, this.b_node_info);
        console.log('add dom listner call ');
    }

    async loadPage() {
        await this.page.goto(this.config['url']);
        await this._loadUtils(this.page, this.b_node_info);
    }
    enableNodeInfo() {
        this.b_node_info = true;
    }
    disableNodeInfo() {
        this.b_node_info = false;
    }
    async reLoadPage() {
        await removeDomListener(this.page);
        await this.page.reload();
        await this._loadUtils(this.page,this.b_node_info);

    }

    async getInitNodes(start_time) {
        let dom_obj = await recurseDom(this.page, "//html/body");
        let time_diff = new Date().getTime() - start_time;
        let nodes = this.node_graph.domObjToNodes([dom_obj], this.init_event, time_diff);
        let listners_nodes = await this.node_graph.updateListenersOnNodes(nodes, this.page);

        return [nodes, listners_nodes];
    }

    async getMutatedNodes(act_mut_list, acts_data, acts_map) {
        let nodes_list = [], listner_nodes_list = [];
        for (let [action, muts] of act_mut_list) {
            let ad = acts_data[action];
            let event = acts_map.get(ad['path']).filter(act => (act['name'] == ad['sub_type']))[0];
            for (let mut of muts) {
                let time_diff = mut.timestamp - action.timestamp;
                let dm_nodes = this.node_graph.domObjToNodes([mut], event, time_diff);
                let lis_nodes = await this.node_graph.updateListenersOnNodes(dm_nodes, this.page);
                nodes_list = nodes_list.concat(dm_nodes);
                listner_nodes_list = [...listner_nodes_list, ...lis_nodes];
            }
        }
        return [nodes_list, listner_nodes_list];
    }
    async getActionMutation(data, acts_map) {
        let mg = new GetActionMutationGroups(data);
        let mgrps = mg.run()
        let ag = new ApproxActionMutationLink(this.page, mgrps, acts_map);
        return await ag.run();

    }
    async runActionExplorer(nodes) {
        console.log('exploring actions ');
        let acts_list = this.action_exp.generateActions(nodes);
        let acts_map = new ListMap();
        let acts_data = [];
        for (let acts of acts_list) {
            for (let act of acts) {
                if (await act.run(this.page)) {
                    acts_data.push(act.data_obj);
                    acts_map.set(act.data_obj.path, act);
                    let wait_time = act.data_obj.seq.wait_time;
                    await timeout(wait_time);
                }
                else {
                    console.info('>>> failed to do action on ', act.data_obj.path);
                }

            }
        }
        return [acts_data, acts_map];

    }
    async run() {
        try {
            let start_time = new Date().getTime();
            await this.loadPage();
            let max_act_delay = 1000;
            //first event is page load event            
            let [all_nodes, active_nodes] = await this.getInitNodes(start_time);

            let  mutations = [], found_actions = [];
            let act= new ActivityRecorder();
            act.startNewActivity(this.act_name, (item) => {
                if (item['type'] == 'mutation') {
                    mutations.push(item);
                }
                else if (item['type'] == 'action') {
                    found_actions.push(item);
                }
            });
            let num_pass = 0;
            while (active_nodes.length != 0) {
                act.resumeActivity(this.act_name);
                console.log('number of pass are ', num_pass);
                this.disableNodeInfo();
                let [acts_data, acts_map] = await this.runActionExplorer(active_nodes);
                await timeout(max_act_delay);
                act.pauseActivity(this.act_name);
                //reload for backward pass
                this.enableNodeInfo();
                await this.reLoadPage();
                let act_mut = await this.getActionMutation(acts_data.concat(mutations), acts_map);

                [all_nodes, active_nodes] = await this.getMutatedNodes(act_mut, acts_data,acts_map);
                active_nodes = this.node_graph.updateParentOfNodes(active_nodes);
                mutations = [];
            }

        } catch (err) {
            console.log(err.stack);
        }

    }

}

module.exports = {
    StateBuilder: StateBuilder

}