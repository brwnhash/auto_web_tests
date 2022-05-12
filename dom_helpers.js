



function getElmentFullPath(elm, path) {
    if (elm.parentElement != null) {
        let ref_name = elm.localName;
        if (ref_name == 'body') return '//html/body' + path;
        let count_idx = 0;
        for (let [idx, child] of Object.entries(elm.parentElement.children)) {
            if (child.localName == ref_name) {
                count_idx += 1;
            }
            if (child == elm) break;
        }
        ref_name += '[' + count_idx.toString() + ']';
        path = '/' + ref_name + path;
        path = getElmentFullPath(elm.parentElement, path);
    }
    return path;
}


function getCoords(elem) {

    if (elem.nodeType != 1) return null;
    let box = elem.getBoundingClientRect();
    return {
        top: box.top + window.pageYOffset,
        right: box.right + window.pageXOffset,
        bottom: box.bottom + window.pageYOffset,
        left: box.left + window.pageXOffset,
        width: box.right - box.left,
        height: box.bottom - box.top
    };
}
function getCalculatedProps(elem) {
    let calc_prop = window.getComputedStyle(elem);
    let obj_props = {};
    for (let [key, val] of Object.entries(calc_prop)) {
        if (isNaN(key) && typeof (val) == 'string' && (!key.startsWith('webkit'))) {
            obj_props[key]=val;
        }
    }
    return obj_props
}


function getElementProps(elem) {
    cords = getCoords(elem);
    if (cords == null) return null
    props = getCalculatedProps(elem);
    return { 'dims': cords, 'props': props };

}

function getLocalName(elm) {
    let count_idx = 0;
    let ref_name = elm.localName;
    if (ref_name == 'body') return 'body';
    for (let [idx, child] of Object.entries(elm.parentElement.children)) {
        if (child.localName == ref_name) {
            count_idx += 1;
        }
        if (child == elm) break;
    }
    ref_name += '[' + count_idx.toString() + ']';
    return ref_name;
}
//  recursive object 
//if index is 0 then dont add local name
function objectRecurse(node, node_path, idx) {
    let node_result = getElementProps(node), childrens = [];
    let local_name = getLocalName(node);
    let curr_path = (idx == 0) ? node_path : node_path + '/' + local_name;
    if (node_result == null) return null;
    idx += 1
    for (let child of node.children) {
        res = objectRecurse(child, curr_path, idx);
        if (res != null) childrens.push(res);
    }
    return { 'node': node_result, 'child_nodes': childrens, 'path': curr_path };
}


function domDeepCopy(object, max_level, ignore_props, node_spec_prop, level) {
    let node_props = {}
    if (object == null) return node_props;
    try {
        //  append properties which are node specific..
        let extra_props = [], local_props = [];
        for (let key in node_spec_prop) {
            if (object ?.['nodeName'] == key) {
                extra_props = extra_props.concat(node_spec_prop[key]);
            }
        }
        if (extra_props.length > 0) {
            let ignore_props_copy = ignore_props.slice();
            local_props = ignore_props_copy.filter(pr => !(extra_props.includes(pr)));
            //console.log(local_props)
        }
        else local_props = ignore_props;
        //  node specific properties added..

        for (let key in object) {
            if (local_props.includes(key)) continue;
            let val = object[key];
            if (val instanceof Function) continue;
            if (val instanceof Object) {
                if (level <= max_level) {
                    val = domDeepCopy(val, max_level, ignore_props, node_spec_prop, level + 1);
                }
                else val = {}
            }
            node_props[key] = val;
        }
    } catch (err) {
        console.error(err.message);
    }
    return node_props;
}


