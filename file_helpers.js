const path = require('path');
const fs = require('fs');
const _ = require('lodash');

function readFilesFromDir(dir) {
    try {
        let files = fs.readdirSync(dir);
        let files_list = [];
        for (let file of files) {
            let curr_path = path.join(dir, file);
            if (fs.lstatSync(curr_path).isDirectory()) {
                let res = readFilesFromDir(curr_path);
                files_list = files_list.concat(res);
            }
            else {
                files_list.push(curr_path);
            }
        }
        return files_list;
    } catch (err) {
        console.log(err);
        return [];
    }
}

function readJsonDataFromFile(file) {
    let rawdata = fs.readFileSync(file);
    let jsondata = JSON.parse(rawdata);
    return jsondata;
}

function readJsonDataFromDir(dir) {
    let crawledFiles = readFilesFromDir(dir);

    let dataDict = {};
    for (let file of crawledFiles) {
        let jsondata = readJsonDataFromFile(file);
        dataDict[file] = jsondata;
    }
    return dataDict;
}


module.exports = {
    readJsonDataFromDir: readJsonDataFromDir,
    readFilesFromDir: readFilesFromDir
}