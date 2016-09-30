var devNull = function () { };
/*
    Some libraries are not web-worker aware, they are either browser or Node.
    A web worker should use the browser flavor.
    So trick libs into thinking this is a browser, by existence of a 'window' in the global space.
*/
var window = {};
/* module system */
var module = {};
var requireError = '';
module.require = function (id) {
    if (id in module) {
        return module[id];
    }
    requireError = 'could not require module "' + id + '"';
    return null;
};
function load(id, src) {
    importScripts(src);
    module[id] = module.exports;
}
//add the makerjs module
importScripts('../../fonts/fonts.js', '../fontloader.js', '../../target/js/browser.maker.js', '../../external/bezier-js/bezier.js', '../../external/opentype/opentype.js');
var makerjs = self.require('makerjs');
module['makerjs'] = makerjs;
module['./../target/js/node.maker.js'] = makerjs;
function runCodeIsolated(javaScript) {
    var Fn = new Function('require', 'module', 'document', 'console', 'alert', 'playgroundRender', 'opentype', javaScript);
    var result = new Fn(module.require, module, mockDocument, mockConsole, devNull, playgroundRender, window['opentype']); //call function with the "new" keyword so the "this" keyword is an instance
    return module.exports || result;
}
function playgroundRender(model) {
    var response = {
        requestId: activeRequestId,
        model: model,
        html: getHtml()
    };
    postMessage(response);
}
function postError(requestId, error) {
    var response = {
        requestId: requestId,
        error: error
    };
    postMessage(response);
}
function getLogsHtmls() {
    var logHtmls = [];
    if (logs.length > 0) {
        logHtmls.push('<div class="section"><div class="separator"><span class="console">console:</span></div>');
        logs.forEach(function (log) {
            var logDiv = new makerjs.exporter.XmlTag('div', { "class": "console" });
            logDiv.innerText = log;
            logHtmls.push(logDiv.toString());
        });
        logHtmls.push('</div>');
    }
    return logHtmls;
}
function getHtml() {
    return htmls.concat(getLogsHtmls()).join('');
}
var mockDocument = {
    write: function (html) {
        htmls.push(html);
    }
};
var mockConsole = {
    log: function (entry) {
        switch (typeof entry) {
            case 'number':
                logs.push('' + entry);
                break;
            case 'string':
                logs.push(entry);
                break;
            default:
                logs.push(JSON.stringify(entry));
        }
    }
};
var baseHtmlLength;
var baseLogLength;
var htmls;
var logs;
var kit;
var activeRequestId;
onmessage = function (ev) {
    var request = ev.data;
    if (request.orderedDependencies) {
        self.require = module.require;
        request.orderedDependencies.forEach(function (id) {
            load(id, request.dependencyUrls[id]);
        });
    }
    if (requireError) {
        postError(request.requestId, requireError);
        return;
    }
    if (request.javaScript) {
        htmls = [];
        logs = [];
        kit = runCodeIsolated(request.javaScript);
        baseHtmlLength = htmls.length;
        baseLogLength = logs.length;
    }
    if (requireError) {
        postError(request.requestId, requireError);
        return;
    }
    if (!kit) {
        postError(request.requestId, 'kit was not created');
    }
    else {
        activeRequestId = request.requestId;
        htmls.length = baseHtmlLength;
        logs.length = baseLogLength;
        var fontLoader = new MakerJsPlayground.FontLoader(window['opentype'], kit.metaParameters, request.paramValues);
        fontLoader.successCb = function (realValues) {
            try {
                var model = makerjs.kit.construct(kit, realValues);
                var response = {
                    requestId: request.requestId,
                    model: model,
                    html: getHtml()
                };
                postMessage(response);
            }
            catch (e) {
                postError(request.requestId, 'runtime error');
            }
        };
        fontLoader.failureCb = function (id) {
            postError(request.requestId, 'error loading font' + fonts[id].path);
        };
        fontLoader.load();
    }
};
//# sourceMappingURL=render-worker.js.map