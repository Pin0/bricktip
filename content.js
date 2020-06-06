/*
 BrickTip!
 A Chrome extension showing tips when hovering a Lego Set Number
 Author: M. Nijdam
 2015-2017
 */

var setData = {};//array for all the found sets
var setsOnPage = [];//array for all the set numbers
var runOnPage = false;
var apiKey = 'ncs5-kkUE-lBQh'; //Obtained via BrickSet
var noimage = chrome.extension.getURL("../icons/lego-no-image.png");

//the chrome extension magic
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.command == "lego") {
        var sets = goLego();
        sendResponse(sets);
    }
});

var bricktip_dont_show_not_found = false;
chrome.storage.sync.get('bricktip_dont_show_not_found', function(data) {
    //console.log(data.bricktip_dont_show_not_found);
    bricktip_dont_show_not_found = data.bricktip_dont_show_not_found;
});

/**
 * BrickTip the page
 * @returns {{}}
 */
var goLego = function () {

    //only run once
    if (runOnPage) {
        //@todo disable all tooltips.
        return setData;
    }

    //create regex
    var yearsToExcludeRegex = '';
    for (var i = 1980; i <= new Date().getFullYear()+1; i++) {
        yearsToExcludeRegex += '(?!' + i + '\\b)';
    }

    var regex = yearsToExcludeRegex + '(\\d{4,7}(-\\d)?)';

    //find and replace numbers of 4-7 digits followed by an optional -1 /g for all numbers in text
    findAndReplace(regex, function (setnumber) {

        var realSetnumber = setnumber;

        //add -1 if not present
        if (!/-\d$/.test(realSetnumber)) {
            realSetnumber += '-1';
        }
        setsOnPage.push(realSetnumber);
        runOnPage = true;
        return '<bricktip class="lego-set" data-legoset="' + realSetnumber + '">' + setnumber + '</bricktip>';
    });

    //unique only
    setsOnPage = setsOnPage.filter(onlyUnique);

    $.ajax({
        url: "https://brickset.com/api/v2.asmx/getSets",
        type: "POST",
        dataType: "xml",
        async: false,
        data: {
            'apiKey': apiKey,
            'setNumber': setsOnPage.join(),
            'userHash': '',
            'query': '',
            'theme': '',
            'subtheme': '',
            'year': '',
            'owned': '',
            'wanted': '',
            'orderBy': 'YearFromDESC',
            'pageSize': '200',
            'pageNumber': '',
            'userName': ''
        }
    }).done(function (data) {
        var $xml = $(data);
        $xml.find("sets").each(function (){

            var setNumber = $(this).find("number").text() + '-' + $(this).find("numberVariant").text();
            setData[setNumber] = {
                'setnumber': setNumber,
                'name': $(this).find('name').text(),
                'thumb': $(this).find('thumbnailURL').text(),
                'pieces': $(this).find('pieces').text(),
                'year': $(this).find('year').text(),
                'theme': $(this).find('theme').text(),
                'link': $(this).find('bricksetURL').text(),
                'notfound': false
            };

        });

        $.each(setsOnPage,function(index,setNumber){
            if(!setData[setNumber]){
                setData[setNumber] = {
                    'setnumber': setNumber,
                    'name': 'Set not found',
                    'notfound': true
                }
            }
        });

    })
    .fail(function () {
        console.log('ajax request failed');
    });

    //add tooltips jQuery ui too just inserted spans
    $("bricktip.lego-set").tooltip({
        items: 'bricktip',
        position: {
            my: "center top",
            at: "bottom",
            collision: "none"
        },
        tooltipClass: 'bricktip_tooltip',
        content: function () {
            var bricktip = this;
            var setnumber = bricktip.getAttribute('data-legoset');

            //check if setnumber ends on -1 otherwise add because the api needs a setnumber {number}-{variant}
            if (!/-1$/.test(setnumber)) {
                setnumber += '-1';
            }

            if(setData[setnumber].notfound === true && bricktip_dont_show_not_found === true){
                return false;
            }

            return setHtml(setData[setnumber]);

        },

        create: function( event, ui ) {
            var setnumber = this.getAttribute('data-legoset');

            if(setData[setnumber].notfound === true && bricktip_dont_show_not_found === true){
                $(this).addClass('set-not-found');
            }
        },

        //don't close tooltip on hover, we need to be able to click on link
        close: function (event, ui) {
            ui.tooltip.hover(
                function () {
                    $(this).stop(true).fadeTo(400, 1);
                },

                function () {
                    $(this).fadeOut("400", function () {
                        $(this).remove();
                    })
                }
            );
        }

    });

    return setData;
}

/*
 onlyUnique function for making array elements unique
 */
var onlyUnique = function(value, index, self) {
    return self.indexOf(value) === index;
}

/*
Replace numbers on page
 */
var findAndReplace = function (searchText, replacement, searchNode) {
    if (!searchText || typeof replacement === 'undefined') {
        // Throw error here if you want...
        return;
    }
    var regex = typeof searchText === 'string' ?
            new RegExp(searchText, 'g') : searchText,
        childNodes = (searchNode || document.body).childNodes,
        cnLength = childNodes.length,
        excludes = 'html,head,style,title,link,meta,script,object,iframe';

    while (cnLength--) {
        var currentNode = childNodes[cnLength];
        if (currentNode.nodeType === 1 &&
            (excludes + ',').indexOf(currentNode.nodeName.toLowerCase() + ',') === -1) {
            arguments.callee(searchText, replacement, currentNode);
        }

        if (currentNode.nodeType !== 3 || !regex.test(currentNode.data)) {
            //tooltip in links, but only in links
            if(!(currentNode.nodeType == 1 && currentNode.tagName == 'A' && currentNode.text && regex.test(currentNode.text))){
                continue;
            }
        }
        var parent = currentNode.parentNode,
            frag = (function () {
                //if link we just change the tag not insert a new one
                if(currentNode.nodeType == 1 && currentNode.tagName == 'A'){
                    //check if no tags in link
                    if(currentNode.innerHTML.indexOf(">") == -1 && currentNode.innerHTML.indexOf("<") == -1){
                        currentNode.innerHTML = currentNode.innerHTML.replace(regex, replacement);
                    }
                    return null;
                } else {
                    var html = currentNode.data.replace(regex, replacement);
                }

                var wrap = document.createElement('div');
                var frag = document.createDocumentFragment();
                wrap.innerHTML = html;
                while (wrap.firstChild) {
                    frag.appendChild(wrap.firstChild);
                }
                return frag;
            })();

        if(frag){
            parent.insertBefore(frag, currentNode);
            parent.removeChild(currentNode);
        }
    }
}

/*
Template function for Lego Set Tooltip
 */
var setHtml = function (setObject) {

    if(!setObject){
        return '<div class=\"bricktip-set\">Empty setObject provided</div>';
    }

    var html = '<h2 class="bricktip">' + setObject.name + '</h2>';
    if (!setObject.notfound) {
        if (setObject.thumb) {
            html += '<img src=\"' + setObject.thumb + '\"/>';
        } else {
            html += '<img src=\"' + noimage + '\"/>';
        }
        html += '<div class=\"setdata\">';
        html += '<label>Number</label><span>' + setObject.setnumber + '</span><br/>';
        html += '<label>Year</label><span>' + setObject.year + '</span><br/>';
        html += '<label>Theme</label><span>' + setObject.theme + '</span><br/>';
        html += '<label>Pieces</label><span>' + setObject.pieces + '</span><br/>';
        html += '<br/><a class=\"bricksetlink\" href=\"' + setObject.link + '\">Visit on Brickset</a><br/>';
        html += '</div>'
        html += '<div class=\"bricktip-clearfix\">&nbsp;</div>';
    }

    return '<div class=\"bricktip-set\">' + html + '</div>';
}

//set settings on page load
$(document).ready(function() {

    //make brickset links open in new tab
    $('body').on('click', 'a.bricksetlink', function(){
        //chrome.tabs.create({url: $(this).attr('href')});
        window.open($(this).attr('href'));
        return false;
    });

    //runextension on page automatically
    chrome.storage.sync.get('bricktip_tips_on_load', function(data) {
        if(data.bricktip_tips_on_load) {
            goLego();
        }
    });
});