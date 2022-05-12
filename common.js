

async function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    });
}

class ListMap extends Map {
    set(key, val) {
        if (!this.has(key)) super.set(key, []);
        let old_vals = this.get(key);
        if (old_vals.includes(val)) return;
        old_vals.push(val);
        super.set(key, old_vals);
    }
}

module.exports = {
    timeout: timeout,
    ListMap: ListMap
}