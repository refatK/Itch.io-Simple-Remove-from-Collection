// ==UserScript==
// @name         Itch.io Simple Remove from Collection
// @namespace    https://github.com/refatK
// @version      0.9
// @description  Easily remove games from your itch.io collections from within the "Add to Collection" modal of a game.
// @author       RefatK
// @updateURL    https://github.com/refatK/Itch.io-Simple-Remove-from-Collection/raw/main/ItchioSimpleRemoveFromCollection.user.js
// @match        *://itch.io/*
// @match        *://*.itch.io/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.4.1/dist/jquery.min.js
// @require      https://static.itch.io/api.js
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      itch.io
// @run-at       document-end
// ==/UserScript==

/* global $, Itch */
$(document).ready(function () {
    const GAME_URL_REGEX = "/https:\/\/.+\.itch\.io/g"
    const bodyObserver = new MutationObserver(OnBodyChange);
    const lightboxObserver = new MutationObserver(OnLightboxChange)

    var _gameId
    var _csrf

    // --- ON LOAD ---
    _csrf = GetCsrf()

    let pageUrl = window.location.href

    if (IsAddToCollectionPage(pageUrl)) {
        if (!GameInCollection()) { return }

        let gameCreator = GetUserFromGamePage(pageUrl)
        let gameName = GetGameNameFromGamePage(pageUrl)

        // TODO: refactor duplicate code
        Itch.getGameData({
            user: gameCreator,
            game: gameName,
            onComplete: function (data) {
                if ('errors' in data) {
                    console.error(data)
                    return
                }

                _gameId = data.id

                $('li.already_in_row').each(function (i) {
                    AddRemoveButton($('li.already_in_row').eq(i))
                })

                $('.remove_from_coll_btn').click(function (e) {
                    let collId = $(this).attr("value")
                    PostRemoveGameFromCollection(collId, _gameId, _csrf, $(this).closest('li.already_in_row'))
                })
            }
        })
    } else {
        // wait for add-to-collection lightbox to load on any other page
        bodyObserver.observe($("body")[0], { childList: true })
    }


    // --- EVENTS ---

    // On click "Add To Collection" button for a game
    $('#user_tools, div[class*="game_grid_widget"]').on('click', 'a.add_to_collection_btn', function () {
        _gameId = GetGameId(this)
    });

    function OnBodyChange() {
        // observe lightbox div once loaded on the page
        if ($("div#lightbox_container").length > 0) {
            lightboxObserver.observe($("div#lightbox_container")[0], { childList: true })
            bodyObserver.disconnect()
        }
    }

    // On the lightbox being loaded on the page
    function OnLightboxChange() {
        if (!GameInCollection()) { return }

        $('li.already_in_row').each(function (i) {
            AddRemoveButton($('li.already_in_row').eq(i))
        })

        $('.remove_from_coll_btn').click(function (e) {
            let collId = $(this).attr("value")
            PostRemoveGameFromCollection(collId, _gameId, _csrf, $(this).closest('li.already_in_row'))
        })
    }


    // --- HELPER FUNCTIONS ---

    function GetCsrf() {
        return $("meta[name=csrf_token]").attr("value")
    }

    function GameInCollection() {
        return $("ul.already_in").length > 0
    }

    function GetGameId(addToCollectionBtn) {
        let pageUrl = window.location.href
        let gameId = ""
        let gameCell = addToCollectionBtn.closest('div.game_cell')

        if (gameCell) {
            gameId = $(gameCell).attr("data-game_id")
        } else {
            gameId = $("meta[name='itch:path']").attr("content").replace("games/", "")
        }

        return gameId
    }

    function AddRemoveButton(collectionLinkEl) {
        let collectionId = collectionLinkEl.find("a").prop("href").split("/")[4]
        // TODO: use style margin instead of nbsp
        const removeHTML = $(`<a class="remove_from_coll_btn button outline" title="Remove the game from the collection." value="${collectionId}">❌</a>`)
        removeHTML.css({
            "margin-right": "5px",
            "display": "inline",
            "padding": "4px"
        });
        collectionLinkEl.prepend(removeHTML)
    }

    function PostRemoveGameFromCollection(collectionId, gameId, csrf_token, elToHideOnSuccess) {
        GM_xmlhttpRequest({
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            url: `https://itch.io/collection/${collectionId}/remove/${gameId}`,
            data: `csrf_token=${csrf_token}`,
            onload: function (res) {
                let resJson = JSON.parse(res.responseText)
                if (resJson.removed) {
                    elToHideOnSuccess.remove()
                } else {
                    console.error(res.responseText)
                }
            },
        });
    }

    function IsAddToCollectionPage(url) {
        return url.includes("add-to-collection")
    }

    function GetUserFromGamePage(url) {
        return url.split("/")[2].split(".")[0]
    }

    function GetGameNameFromGamePage(url) {
        return url.split("/")[3]
    }


    // --- FOR DEBUGGING ---
    var showDebugMessages = true;

    function log(message) {
        if (showDebugMessages) { console.log(message); }
    }

});
