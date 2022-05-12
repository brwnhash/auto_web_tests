



async function recurseDom(page,xpath) {
    try {

        res = await page.evaluate((xpath) => {
            let elm = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (elm == null) return null;
            return objectRecurse(elm, xpath,0);
        }, xpath
        );
        return res;
    } catch (err) {
        console.log(err.message);
    }
}

module.exports = {
    recurseDom: recurseDom
}