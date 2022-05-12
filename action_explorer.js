/*
 *permutations :order does matter ,combination order doesnt matter all equal
 we generate sparse format in place of dense format for permutations
  
  Action Explorer can generate N visits of same node with expected value .
  by using that we can know which state we should be to do something.
   * */


const {range} = require("lodash");
const { Node } = require('./node_graph.js');
const { Action } = require('./dom_actions');
const { timeout } = require('./common');

function* generateCombinations(n, r, curr_idx = 0, depth = 1) {
    let max_val = n - r + depth;
    for (let i = curr_idx; i < max_val; i++) {
        if (depth < r) {
            for (let val of generateCombinations(n, r, i + 1, depth + 1)) {
                let arr = [i].concat(val);
                yield arr;
            }
        }
        else {
            yield [i];
        }
    }
}
/* every state can have multiple composite actions,we have to generate
 * combination on each of these composite actions
 * */
function* getNodeActionsCombinations(nodes, nodes_list, curr_idx = 0) {
    let node_idx = nodes_list[curr_idx];
    let curr_node = nodes[node_idx];
    for (let action of curr_node.currState.actions) {
        if (!action.isComposite()) continue;
        if (curr_idx < nodes_list.length - 1) {
            for (let val of getNodeActionsCombinations(nodes, nodes_list, curr_idx + 1)) {
                let curr_val = { 'actionId': action.actionId, 'nodeId': node_idx, 'nodeSeq': curr_idx,'type':'composite'}
                let arr = [curr_val].concat(val);
                yield arr;
            }
        }
        else {
            yield [{ 'actionId': action.actionId, 'nodeId': node_idx, 'nodeSeq': curr_idx, 'type': 'composite'}];
        }
    }

}



class ActionExplorer {
    constructor() {
    }

    _generateUnaryActions(nodes) {
        let action_list = [];
        for (let [node, info] of nodes) {        
            action_list.push(node.curr_state.actions);
        }
        return action_list;
    }
    __getNodesWithCompositeActions(nodes) {
        let compositeNodes = []
        for (let [idx,node] of Object.entries(nodes)) {
            if (node.currState.hasCompositeAction()) {
                compositeNodes.push([node, idx]);
            }
        }
        return compositeNodes;
    }
    __getCombinations(N) {
        let rList = range(1, N+1);
        let combinations = [];
        for (let r of rList) {
            for (let val of generateCombinations(N, r)) {
                combinations.push(val);
            }
        }
        return combinations;

    }
    _getNodeGroups(nodes, base_node) {
     /*
      *nodes are composite nodes.
      */
        let groups = {};
        let grpNode = function () {
            this.path = path;
            this.children = [];
        }
        
        let node_paths = nodes.map(item => item.path);
        
        for (let node of nodes) {
            let c_node = (groups?.[node.path] != undefined) ?groups[node.path] :new grpNode(node.path);
            groups[node.path]=c_node
            while (true) { 
                node = node.parent;
                if (node == null) {
                    let p_path = 'body';
                    let p_node = (groups?.[p_path] != undefined) ? groups[p_path] : new grpNode(p_path);
                    p_node.children.push(c_node);
                    groups[p_path] = p_node;
                    break;
                }
                let p_path = node.parent.path;
                if (node_paths.includes(p_path)) {
                    let p_node = (groups?.[p_path] != undefined) ? groups[p_path] : new grpNode(p_path);
                    p_node.children.push(c_node);
                    groups[p_path] = p_node;
                    break;
                }

            }


        }
        // groups['body']  node has all info
        console.log('finding groups');
  

    }
    _generateCompositeActions(nodes) {
        let compositeNodes = this.__getNodesWithCompositeActions(nodes);
        let combinations = this.__getCombinations(compositeNodes.length);
        let actionList = [];
        for (let nodeList of combinations) {
            for (let action of getNodeActionsCombinations(nodes, nodeList)) {
                actionList.push(action);
            }
        }
        return actionList;
    }

    generateActions(nodes) {
        let action_combs=[]
        let unary_combs=this._generateUnaryActions(nodes);
        //let composite_combs = this._generateCompositeActions(nodes);
        //action_combs=action_combs.concat(unary_combs);
        //action_combs=action_combs.concat(composite_combs);
        return unary_combs;
    }
 
}





module.exports = { ActionExplorer: ActionExplorer}


//function _createNodes(n) {
//    let nn_list = [];
//    for (let i of range(n)) {
//        let nd = new Node();
//        nd.uId = i;
//        nd.currState.addAction('input');
//        nn_list.push(nd);
//    }
//    return nn_list;
//}

//function test_click_nodes(){
//    try {
//        let exp = new ActionExplorer();
//        let nodes = _createNodes(3);
//        let actions = exp.generateActions(nodes);

//        console.log('over');
//    } catch (err) {
//        console.log(err.message);
//    }
//}

//try {
//    test_click_nodes();
//}
//catch (err) {
//    console.log(err);
//}