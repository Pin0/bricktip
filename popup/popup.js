/* Update the sets div with sets */
function insertSets(sets) {
    var html = '';
    if (!sets || Object.keys(sets).length == 0) {
        html += 'no lego sets found for this page';
        $("#sets").html(html);
    } else {
        $.each(sets, function (index, setObject) {
            if (setObject.notfound === false) {
                html += setHtml(setObject);
            }
        });
        $("#sets").html('<ol>' + html + '</ol>');
    }
}

/* Once the DOM is ready... */
window.onload = function () {

    //settings to form
    chrome.storage.sync.get('bricktip_tips_on_load', function (data) {
        $('#tips_on_load').prop('checked', data.bricktip_tips_on_load);
    });
    chrome.storage.sync.get('bricktip_dont_show_not_found', function (data) {
        $('#dont_show_not_found').prop('checked', data.bricktip_dont_show_not_found);
    });

    var tab = null;

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        /* ...and send a request for the DOM info... */
        chrome.tabs.sendMessage(tabs[0].id, {command: 'lego'}, insertSets);
        tab = tabs[0];
    });

    //make brickset links open in new tab
    $(document).ready(function () {
        $('body').on('click', 'a.bricksetlink', function () {
            chrome.tabs.create({url: $(this).attr('href')});
            return false;
        });

        $("#searchfield").autocomplete({
            source: function (request, response) {
                $.ajax({
                    url: "https://brickset.com/api/v2.asmx/getSets",
                    type: "POST",
                    dataType: "xml",
                    async: false,
                    data: {
                        'apiKey': 'ncs5-kkUE-lBQh',
                        'setNumber': '',
                        'userHash': '',
                        'query': request.term,
                        'theme': '',
                        'subtheme': '',
                        'year': '',
                        'owned': '',
                        'wanted': '',
                        'orderBy': 'YearFromDESC',
                        'pageSize': '200',
                        'pageNumber': '',
                        'userName': ''
                    },
                    error: function (xhr, textStatus, errorThrown) {
                        console.log('Error: ' + xhr.responseText);
                    },
                    success: function (data) {
                        var $xml = $(data);
                        var $sets = [];
                        $xml.find("sets").each(function () {
                            var setNumber = $(this).find("number").text() + '-' + $(this).find("numberVariant").text();
                            var setData = {
                                'setnumber': setNumber,
                                'name': $(this).find('name').text(),
                                'thumb': $(this).find('thumbnailURL').text(),
                                'pieces': $(this).find('pieces').text(),
                                'year': $(this).find('year').text(),
                                'theme': $(this).find('theme').text(),
                                'link': $(this).find('bricksetURL').text(),
                                'notfound': false
                            };
                            $sets.push({
                                label: setNumber + ' - ' + $(this).find('name').text(),
                                value: setNumber,
                                setData: setData
                            });
                        });

                        response($.map($sets, function (item) {
                            return {
                                label: item.label,
                                value: item.value,
                                setData: item.setData
                            }
                        }));
                    }

                });
            },
            select: function (event, ui) {
                insertSets([ui.item.setData]);
            }
        });

        //save the settings
        $('body').on('change', '#tips_on_load', function () {
            if ($(this).is(':checked')) {
                chrome.storage.sync.set({bricktip_tips_on_load: true});
            } else {
                chrome.storage.sync.set({bricktip_tips_on_load: false});
            }
        });

        $('body').on('change', '#dont_show_not_found', function () {
            if ($(this).is(':checked')) {
                chrome.storage.sync.set({bricktip_dont_show_not_found: true});
            } else {
                chrome.storage.sync.set({bricktip_dont_show_not_found: false});
            }
        });
    });

    $("#tabs").tabs();
};

/*
 Template function for Lego Set List
 */
var setHtml = function (setObject) {

    if (!setObject) {
        return '<li class=\"set\">Empty setObject provided</li>';
    }

    var html = '<h2>' + setObject.name + '</h2>';
    if (!setObject.notfound) {
        if (setObject.thumb) {
            html += '<img src=\"' + setObject.thumb + '\"/>';
        } else {
            html += '<img src=\"../icons/lego-no-image.png\"/>';
        }

        html += '<div class=\"setdata\">';
        html += '<label>Number</label><span>' + setObject.setnumber + '</span><br/>';
        html += '<label>Year</label><span>' + setObject.year + '</span><br/>';
        html += '<label>Theme</label><span>' + setObject.theme + '</span><br/>';
        html += '<label>Pieces</label><span>' + setObject.pieces + '</span><br/>';
        html += '<br/><a class=\"bricksetlink\" href=\"' + setObject.link + '\">Visit on Brickset</a><br/>';
        //html += '<br/><a class=\"onpage\" href=\"#set' + setObject.setnumber + '\">onpage</a><br/>';
        html += '</div>'
        html += '<div class=\"bricktip-clearfix\">&nbsp;</div>';

    }

    return '<li class=\"set\">' + html + '</li>';
}