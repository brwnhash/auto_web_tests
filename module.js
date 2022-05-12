
function cool() {
    console.log('cool function executed',this.name);
    return 'cool';

}
class Listner{
    constructor(callback) {
        this.name = 'cola';
        this.callback = callback;
    }
    run() {
        this.callback();
    }
}
try {
    dd = new Listner(cool);
    dd.run();
} catch (err) {
    console.log(err);
}
